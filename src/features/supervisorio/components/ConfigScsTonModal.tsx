import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { api } from '@/config/api';

/**
 * "Configurações SCS" da TON (Fase 6), layout mestre-detalhe.
 * Esquerda: dispositivos conectados à TON. Direita (ao SELECIONAR um): associação a
 * um elemento do unifilar com SCS + correspondência de pontos (título ↔ campo JSON)
 * EDITÁVEL, já preenchida do catálogo (iot_device_tipos.pontos; ai=Medições,
 * bi=Estados, bo=Comandos). Override por-equipamento salvo em props.pontos_override.
 * Backend: GET /iot/ton/:id/scs-config, POST /iot/scs/vinculo, POST /iot/scs/pontos.
 */
interface Ponto { id: string; label: string; json: string; json_default: string }
interface Device {
  comp_id: string; tipo: string; nome: string; equipamento_id: string | null;
  associado: { equipamento_id: string; nome: string | null } | null;
  pontos: { ai: Ponto[]; bi: Ponto[]; bo: Ponto[] };
}
interface Elemento { id: string; nome: string }
const NONE = '__none__';
const LABEL: Record<string, string> = {
  power_meter: 'Power Meter', medidor_comum: 'Medidor Concessionária',
  inversor: 'Inversor', rele_protecao: 'Relé de Proteção',
};
const podeAssociar = (t: string) =>
  t === 'power_meter' || t === 'medidor_comum' || t === 'rele_protecao' || t === 'inversor';
const allPontos = (d: Device) => [...d.pontos.ai, ...d.pontos.bi, ...d.pontos.bo];

export function ConfigScsTonModal({ tonEquipId, tonNome, onClose }: { tonEquipId: string; tonNome?: string; onClose: () => void }) {
  const [data, setData] = useState<{ devices: Device[]; elementos_scs: Elemento[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingV, setSavingV] = useState(false);
  const [savingP, setSavingP] = useState(false);

  const load = (keepSel = true) => {
    setLoading(true);
    return api.get(`/iot/ton/${tonEquipId.trim()}/scs-config`)
      .then((r) => { const d = (r?.data?.data ?? r?.data) as any; setData(d); if (!keepSel) setSelId(null); return d; })
      .catch(() => { setData(null); return null; })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [tonEquipId]);

  const sel = useMemo(() => data?.devices.find((d) => d.comp_id === selId) ?? null, [data, selId]);

  // Ao selecionar um device, semeia os campos editáveis com o json efetivo atual.
  useEffect(() => {
    if (!sel) { setEdits({}); return; }
    const seed: Record<string, string> = {};
    for (const p of allPontos(sel)) seed[p.id] = p.json;
    setEdits(seed);
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    if (!sel) return false;
    return allPontos(sel).some((p) => (edits[p.id] ?? p.json) !== p.json);
  }, [sel, edits]);

  const vincular = async (compId: string, elementoId: string) => {
    setMsg(null); setSavingV(true);
    try {
      await api.post('/iot/scs/vinculo', { comp_id: compId, elemento_equipamento_id: elementoId || null });
      await load();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao salvar vínculo'); }
    finally { setSavingV(false); }
  };

  const salvarPontos = async () => {
    if (!sel) return;
    setMsg(null); setSavingP(true);
    const overrides: Record<string, string> = {};
    for (const p of allPontos(sel)) {
      const v = (edits[p.id] ?? '').trim();
      if (v && v !== p.json_default) overrides[p.id] = v; // só o que diverge do catálogo
    }
    try {
      await api.post('/iot/scs/pontos', { comp_id: sel.comp_id, overrides });
      await load();
    } catch (e: any) { setMsg(e?.response?.data?.message || 'Falha ao salvar correspondência'); }
    finally { setSavingP(false); }
  };

  const resetEdits = () => {
    if (!sel) return;
    const seed: Record<string, string> = {};
    for (const p of allPontos(sel)) seed[p.id] = p.json_default;
    setEdits(seed);
  };

  const secoes: Array<[string, Ponto[]]> = sel
    ? [['Medições', sel.pontos.ai], ['Estados', sel.pontos.bi], ['Comandos', sel.pontos.bo]]
    : [];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-4xl w-[94vw] p-0 gap-0 overflow-hidden flex flex-col"
        style={{ height: '86vh', maxHeight: '86vh' }}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b shrink-0">
          <h2 className="text-lg font-bold">Configurações SCS — {tonNome ?? 'TON'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione um dispositivo para associá-lo a um elemento do unifilar com SCS e revisar a correspondência de pontos.
          </p>
          {msg && <div className="mt-2 text-xs px-2 py-1 rounded bg-red-500/15 text-red-600 dark:text-red-400">{msg}</div>}
        </div>

        {/* Corpo: duas colunas */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          {/* Lista de dispositivos */}
          <aside className="sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r overflow-auto p-2 max-h-40 sm:max-h-none">
            {loading && <div className="p-3 text-xs text-muted-foreground">Carregando…</div>}
            {!loading && data && data.devices.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">Nenhum dispositivo conectado a esta TON.</div>
            )}
            {!loading && data && data.devices.map((d) => {
              const ativo = d.comp_id === selId;
              return (
                <button
                  key={d.comp_id}
                  type="button"
                  onClick={() => setSelId(d.comp_id)}
                  className={`w-full text-left rounded-md px-3 py-2 mb-1 border transition-colors ${ativo ? 'bg-primary/10 border-primary/40' : 'border-transparent hover:bg-muted/50'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.associado ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                    <span className="text-sm font-medium truncate">{d.nome || d.comp_id}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate pl-3">{LABEL[d.tipo] ?? d.tipo}</div>
                </button>
              );
            })}
          </aside>

          {/* Detalhe do dispositivo selecionado */}
          <section className="flex-1 min-w-0 overflow-auto p-4">
            {!sel ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                {data && data.devices.length > 0 ? 'Selecione um dispositivo à esquerda.' : ''}
              </div>
            ) : (
              <>
                {/* Associação */}
                <div className="flex items-center gap-2 flex-wrap pb-3 border-b">
                  <span className="text-sm font-semibold">{sel.nome || sel.comp_id}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{LABEL[sel.tipo] ?? sel.tipo}</span>
                </div>
                {podeAssociar(sel.tipo) ? (
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    <span className="text-xs text-muted-foreground">Associar ao elemento SCS:</span>
                    <Select value={sel.associado?.equipamento_id ?? NONE} onValueChange={(v) => vincular(sel.comp_id, v === NONE ? '' : v)} disabled={savingV}>
                      <SelectTrigger className="h-8 w-56"><SelectValue placeholder="— nenhum —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— nenhum —</SelectItem>
                        {(data?.elementos_scs ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {data && data.elementos_scs.length === 0 && (
                      <span className="text-[11px] text-amber-600">Nenhum elemento com SCS habilitado — habilite no sheet do disjuntor.</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-3">Dispositivo lido direto (não associa a elemento do unifilar).</p>
                )}

                {/* Correspondência editável */}
                <div className="mt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex-1">Correspondência de pontos</h4>
                    {dirty && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetEdits} disabled={savingP}>Restaurar catálogo</Button>}
                    <Button type="button" size="sm" className="h-7 text-xs" onClick={salvarPontos} disabled={!dirty || savingP}>{savingP ? 'Salvando…' : 'Salvar'}</Button>
                  </div>

                  {allPontos(sel).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem catálogo de pontos para este dispositivo.</p>
                  ) : secoes.map(([titulo, pontos]) => pontos.length === 0 ? null : (
                    <div key={titulo} className="mb-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{titulo} ({pontos.length})</div>
                      <div className="rounded-md border overflow-hidden">
                        <div className="flex bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground px-3 py-1.5">
                          <div className="flex-1">Título</div><div className="w-36 text-right pr-1">Campo JSON</div>
                        </div>
                        {pontos.map((p) => {
                          const val = edits[p.id] ?? p.json;
                          const editado = (val ?? '').trim() !== p.json_default;
                          return (
                            <div key={p.id} className="flex items-center px-3 py-1.5 border-t text-xs gap-2">
                              <div className="flex-1 truncate" title={p.label}>{p.label}</div>
                              <input
                                value={val}
                                onChange={(e) => setEdits((x) => ({ ...x, [p.id]: e.target.value }))}
                                placeholder={p.json_default || '—'}
                                title={editado ? `Catálogo: ${p.json_default || '—'}` : undefined}
                                className={`w-36 text-right font-mono text-[11px] rounded border px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary ${editado ? 'border-amber-500/60 text-amber-600 dark:text-amber-400' : 'border-input'}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    O campo JSON é a chave lida da telemetria do dispositivo. Editado (âmbar) = sobrescreve o catálogo; "Restaurar catálogo" volta ao padrão.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex justify-end shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConfigScsTonModal;
