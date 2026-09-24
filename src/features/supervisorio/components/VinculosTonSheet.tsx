import { useCallback, useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Expandir } from '@/components/ui/expandir';
import { api } from '@/config/api';
import { tonBoApi, type TonBo } from '@/services/ton-bo.services';
import { tonBiApi, type TonBi } from '@/services/ton-bi.services';
import { tonAiApi, type TonAi } from '@/services/ton-ai.services';

/**
 * Vínculos da TON (Fase 7) — organizado por PONTO LÓGICO, não por hardware.
 * O cadastro do unifilar declara o que o elemento tem (comando/status/medição);
 * aqui se escolhe DE ONDE vem cada dado:
 *   Comando  → BO da TON (relé/transistor)
 *   Status   → BI da TON (entrada digital)
 *   Medições → device Modbus (PM/inversor/relé, com a correspondência de pontos)
 *              ou AI da TON (entrada analógica, com escala mV)
 * Grava nos stores que já existem (ton_bo/ton_bi/ton_ai e a associação do device).
 * Fonte Modbus para comando/status (io_config do device) continua no "Configurar
 * I/O" do próprio device — ali o vínculo vive no diagrama, não em tabela.
 */
const NONE = '__none__';
type Aba = 'comando' | 'status' | 'medicao';

interface Ponto { id: string; tipo: string; nome: string }
interface Elemento {
  equipamento_id: string; rotulo: string;
  scs_comando: boolean; scs_status: boolean; scs_medicao: string;
  pontos: Ponto[];
}
interface PontoCat { id: string; label: string; json: string; json_default: string }
interface Device {
  comp_id: string; tipo: string; nome: string; equipamento_id: string | null;
  associado: { equipamento_id: string; nome: string | null } | null;
  pontos: { ai: PontoCat[]; bi: PontoCat[]; bo: PontoCat[] };
}

const LABEL_DEV: Record<string, string> = {
  power_meter: 'Power Meter', medidor_comum: 'Medidor Concessionária',
  inversor: 'Inversor', rele_protecao: 'Relé de Proteção',
};

export function VinculosTonSheet({
  open, onClose, tonEquipId, tonNome, abaInicial = 'comando',
}: { open: boolean; onClose: () => void; tonEquipId: string; tonNome?: string; abaInicial?: Aba }) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [elementos, setElementos] = useState<Elemento[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [bos, setBos] = useState<TonBo[]>([]);
  const [bis, setBis] = useState<TonBi[]>([]);
  const [ais, setAis] = useState<TonAi[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [corresp, setCorresp] = useState<string | null>(null); // comp_id expandido

  const tid = tonEquipId?.trim();

  const carregar = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    try {
      const [el, scs, b, i, a] = await Promise.all([
        api.get(`/iot/ton/${tid}/elementos-scs`).then((r) => (r?.data?.data ?? r?.data)).catch(() => null),
        api.get(`/iot/ton/${tid}/scs-config`).then((r) => (r?.data?.data ?? r?.data)).catch(() => null),
        tonBoApi.list(tid).catch(() => [] as TonBo[]),
        tonBiApi.list(tid).catch(() => [] as TonBi[]),
        tonAiApi.list(tid).catch(() => [] as TonAi[]),
      ]);
      setElementos(Array.isArray(el?.elementos) ? el.elementos : []);
      setDevices(Array.isArray(scs?.devices) ? scs.devices : []);
      setBos(b); setBis(i); setAis(a);
    } finally { setLoading(false); }
  }, [tid]);

  useEffect(() => { if (open) { setAba(abaInicial); carregar(); } }, [open, abaInicial, carregar]);

  /** Liga um ponto a um canal da TON, liberando antes o canal que ele ocupava. */
  const vincularCanal = async (kind: 'bo' | 'bi' | 'ai', pontoId: string, numero: number | null) => {
    setMsg(null);
    try {
      if (kind === 'bo') {
        for (const r of bos) if (r.id && r.equipamento_ponto_id === pontoId && r.bo_numero !== numero) {
          await tonBoApi.update(tid, r.id, { equipamento_ponto_id: null });
        }
        if (numero != null) {
          const alvo = bos.find((r) => r.bo_numero === numero);
          if (alvo?.id) await tonBoApi.update(tid, alvo.id, { equipamento_ponto_id: pontoId, ativo: true });
          else await tonBoApi.create(tid, { bo_numero: numero, equipamento_ponto_id: pontoId, ativo: true });
        }
      } else if (kind === 'bi') {
        for (const r of bis) if (r.id && r.equipamento_ponto_id === pontoId && r.bi_numero !== numero) {
          await tonBiApi.update(tid, r.id, { equipamento_ponto_id: null });
        }
        if (numero != null) {
          const alvo = bis.find((r) => r.bi_numero === numero);
          if (alvo?.id) await tonBiApi.update(tid, alvo.id, { equipamento_ponto_id: pontoId, ativo: true });
          else await tonBiApi.create(tid, { bi_numero: numero, equipamento_ponto_id: pontoId, ativo: true });
        }
      } else {
        for (const r of ais) if (r.id && r.equipamento_ponto_id === pontoId && r.ai_numero !== numero) {
          await tonAiApi.update(tid, r.id, { equipamento_ponto_id: null });
        }
        if (numero != null) {
          const alvo = ais.find((r) => r.ai_numero === numero);
          if (alvo?.id) await tonAiApi.update(tid, alvo.id, { equipamento_ponto_id: pontoId, ativo: true });
          else await tonAiApi.create(tid, { ai_numero: numero, equipamento_ponto_id: pontoId, ativo: true });
        }
      }
      await carregar();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao vincular'); }
  };

  const associarDevice = async (compId: string, elementoId: string) => {
    setMsg(null);
    try {
      await api.post('/iot/scs/vinculo', { comp_id: compId, elemento_equipamento_id: elementoId || null });
      await carregar();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao associar'); }
  };

  /** Canal atualmente ocupado por este ponto (ou null). */
  const canalDoPonto = (kind: 'bo' | 'bi' | 'ai', pontoId: string): number | null => {
    if (kind === 'bo') return bos.find((r) => r.equipamento_ponto_id === pontoId)?.bo_numero ?? null;
    if (kind === 'bi') return bis.find((r) => r.equipamento_ponto_id === pontoId)?.bi_numero ?? null;
    return ais.find((r) => r.equipamento_ponto_id === pontoId)?.ai_numero ?? null;
  };

  /** Rótulo do canal na lista, marcando os já ocupados por outro ponto. */
  const canais = (kind: 'bo' | 'bi' | 'ai', pontoId: string) => {
    const rows: Array<{ numero: number; ocupadoPor: string | null }> =
      kind === 'bo' ? bos.map((r) => ({ numero: r.bo_numero, ocupadoPor: r.equipamento_ponto_id && r.equipamento_ponto_id !== pontoId ? (r.ponto?.nome ?? 'ocupado') : null }))
      : kind === 'bi' ? bis.map((r) => ({ numero: r.bi_numero, ocupadoPor: r.equipamento_ponto_id && r.equipamento_ponto_id !== pontoId ? (r.ponto?.nome ?? 'ocupado') : null }))
      : ais.map((r) => ({ numero: r.ai_numero, ocupadoPor: r.equipamento_ponto_id && r.equipamento_ponto_id !== pontoId ? (r.ponto?.nome ?? 'ocupado') : null }));
    return rows;
  };

  const prefixo = (kind: 'bo' | 'bi' | 'ai') => (kind === 'bo' ? 'BO' : kind === 'bi' ? 'BI' : 'AI');

  /** Linha ponto → canal. */
  const LinhaPonto = ({ kind, ponto }: { kind: 'bo' | 'bi' | 'ai'; ponto: Ponto }) => {
    const atual = canalDoPonto(kind, ponto.id);
    const lista = canais(kind, ponto.id);
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-t text-sm">
        <div className="flex-1 truncate">{ponto.nome}</div>
        <Select
          value={atual != null ? String(atual) : NONE}
          onValueChange={(v) => vincularCanal(kind, ponto.id, v === NONE ? null : Number(v))}
        >
          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="— sem fonte —" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— sem fonte —</SelectItem>
            {lista.map((c) => (
              <SelectItem key={c.numero} value={String(c.numero)}>
                {prefixo(kind)}{String(c.numero).padStart(2, '0')}{c.ocupadoPor ? ` · ocupado (${c.ocupadoPor})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const semCanais = (kind: 'bo' | 'bi' | 'ai') =>
    (kind === 'bo' ? bos.length : kind === 'bi' ? bis.length : ais.length) === 0;

  const listaPorCapacidade = (): Elemento[] =>
    elementos.filter((e) => aba === 'comando' ? e.scs_comando : aba === 'status' ? e.scs_status : e.scs_medicao !== 'nenhuma');

  const pontosDo = (e: Elemento) =>
    e.pontos.filter((p) => p.tipo === (aba === 'comando' ? 'comando' : aba === 'status' ? 'status' : 'medicao'));

  const kindDaAba: 'bo' | 'bi' | 'ai' = aba === 'comando' ? 'bo' : aba === 'status' ? 'bi' : 'ai';
  const lista = listaPorCapacidade();

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
        <SheetHeader className="px-5 py-4 border-b shrink-0 space-y-0">
          <SheetTitle>Vínculos — {tonNome ?? 'TON'}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Para cada ponto declarado no unifilar, escolha de onde vem o dado.
          </p>
          <div className="mt-3 flex gap-1 bg-muted/50 rounded-lg p-1">
            {([['comando', 'Comando'], ['status', 'Status'], ['medicao', 'Medições']] as Array<[Aba, string]>).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setAba(k)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${aba === k ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          {msg && <div className="mb-3 text-xs px-2 py-1 rounded bg-red-500/15 text-red-600 dark:text-red-400">{msg}</div>}
          {loading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>}

          {!loading && lista.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum elemento do unifilar com <b>{aba === 'medicao' ? 'medição' : aba}</b> declarado nesta unidade.
              <p className="text-xs mt-1">Marque na edição do equipamento, no unifilar.</p>
            </div>
          )}

          {!loading && aba !== 'medicao' && lista.length > 0 && semCanais(kindDaAba) && (
            <div className="mb-3 text-xs px-2 py-1.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
              Esta TON não tem {prefixo(kindDaAba)} disponível. A fonte precisa vir de um device Modbus
              (configure no "Configurar I/O" do próprio device).
            </div>
          )}

          {!loading && lista.map((e) => (
            <div key={e.equipamento_id} className="rounded-lg border mb-3 overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 text-sm font-semibold">{e.rotulo}</div>

              {aba !== 'medicao' ? (
                pontosDo(e).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                    Sem pontos de {aba} — marque os pontos na edição do equipamento.
                  </div>
                ) : pontosDo(e).map((p) => <LinhaPonto key={p.id} kind={kindDaAba} ponto={p} />)
              ) : (
                <>
                  {/* Fonte 1: device Modbus associado (PM/inversor/relé) */}
                  <div className="flex items-center gap-2 px-3 py-2 border-t text-sm flex-wrap">
                    <div className="flex-1 min-w-[120px]">Device Modbus</div>
                    <Select
                      value={devices.find((d) => d.associado?.equipamento_id === e.equipamento_id)?.comp_id ?? NONE}
                      onValueChange={(v) => {
                        const atual = devices.find((d) => d.associado?.equipamento_id === e.equipamento_id);
                        if (atual && atual.comp_id !== v) associarDevice(atual.comp_id, '');
                        if (v !== NONE) associarDevice(v, e.equipamento_id);
                      }}
                    >
                      <SelectTrigger className="h-8 w-56"><SelectValue placeholder="— sem device —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— sem device —</SelectItem>
                        {devices.map((d) => (
                          <SelectItem key={d.comp_id} value={d.comp_id}>
                            {d.nome || d.comp_id} · {LABEL_DEV[d.tipo] ?? d.tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Correspondência de pontos do device associado */}
                  {(() => {
                    const dev = devices.find((d) => d.associado?.equipamento_id === e.equipamento_id);
                    if (!dev) return null;
                    const total = (dev.pontos?.ai?.length ?? 0) + (dev.pontos?.bi?.length ?? 0);
                    if (!total) return null;
                    const aberto = corresp === dev.comp_id;
                    return (
                      <div className="px-3 pb-2 border-t pt-2">
                        <button type="button" className="text-xs text-primary hover:underline"
                          onClick={() => setCorresp(aberto ? null : dev.comp_id)}>
                          {aberto ? '▾ Ocultar' : '▸ Ver'} correspondência de pontos ({total})
                        </button>
                        <Expandir aberto={aberto}>
                          <div className="mt-1 rounded-md border overflow-hidden">
                            <div className="flex bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground px-2.5 py-1">
                              <div className="flex-1">Título</div><div className="w-28 text-right">Campo JSON</div>
                            </div>
                            <div className="max-h-48 overflow-auto">
                              {[...(dev.pontos.ai ?? []), ...(dev.pontos.bi ?? [])].map((p) => (
                                <div key={p.id} className="flex px-2.5 py-1 border-t text-xs">
                                  <div className="flex-1 truncate" title={p.label}>{p.label}</div>
                                  <div className="w-28 text-right font-mono text-[11px]">{p.json || '—'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </Expandir>
                      </div>
                    );
                  })()}

                  {/* Fonte 2: AI da TON, por ponto de medição do elemento */}
                  {pontosDo(e).length > 0 && (
                    <div className="border-t">
                      <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Entradas analógicas da TON</div>
                      {pontosDo(e).map((p) => <LinhaPonto key={p.id} kind="ai" ponto={p} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t shrink-0 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default VinculosTonSheet;
