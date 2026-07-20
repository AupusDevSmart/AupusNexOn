// DeviceIoConfigModal — painel de I/O do device (relé etc.), por INSTÂNCIA.
// COMANDO (ponto tipo 'comando'): vínculo em 1 passo — ponto do equipamento → Binary
//   Output do relé (bo_outputs do catálogo). A chave em io_config.bo é o ponto_id (vira
//   o cmd_id no firmware); NÃO há mais "sinal do catálogo" fixo no meio. O coil/BO é da
//   instalação (amarração do Reydisp), por isso é aqui e não no catálogo.
// STATUS (ponto tipo 'status'): ainda linka a um sinal BI do catálogo (registrador fixo).
// Modelo: o usuário CRIA LINKS. Cada link conecta um PONTO de um equipamento de
// automação (comando/status, cadastrado no PRÓPRIO equipamento do unifilar) a um SINAL
// do catálogo do device (BO = comando Modbus, BI = entrada). O catálogo é usado só pra
// escolher QUAL sinal linkar (não é lista fixa exaustiva). AI/AO = só visualização.
// Persistido em props.io_config = { bo:{catalogId:{equipamento_id,ponto_id}}, bi:{...} }.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { equipamentosApi } from '@/services/equipamentos.services';
import { equipamentoPontosApi, type EquipamentoPonto } from '@/services/equipamento-pontos.services';

// coil/func = OVERRIDE por instância do endereço Modbus do comando (o catálogo é só default).
// addr/count/value: comandos FC15 (write multiple coils / DPC double-bit, ex: CB-1 do
// 7SR5111 — par de bits 01=abre/10=fecha). bo_id: id da saída escolhida em bo_outputs
// (mantém o select do modal amarrado mesmo sem coil).
export interface IoMapEntry { equipamento_id?: string; ponto_id?: string; coil?: number; func?: number; register?: number; addr?: number; count?: number; value?: number; bo_id?: string; }
export interface DeviceIoConfig { bi?: Record<string, IoMapEntry>; bo?: Record<string, IoMapEntry>; }

interface CatalogPoint { id: string; label: string; unit?: string; group?: string; }
interface CatalogPoints { ai?: CatalogPoint[]; bi?: CatalogPoint[]; bo?: CatalogPoint[]; }

interface Link { key: string; tipo?: 'bi' | 'bo'; catalogId?: string; equipamentoId?: string; pontoId?: string; coil?: number; func?: number; addr?: number; count?: number; value?: number; boId?: string; }

interface DeviceIoConfigModalProps {
  open: boolean;
  onClose: () => void;
  compType: string;
  compNome: string;
  catalogId?: string; // modelo selecionado do componente (p/ default de coil/func do bo_map)
  unidadeId: string | null;
  ioConfig: DeviceIoConfig;
  onSave: (io: DeviceIoConfig) => void;
  onEnviarComando?: (cmdId: string, cmdLabel: string) => Promise<string | void>;
}

/** true se o tipo tem BI ou BO no catálogo (justifica o botão "Configurar I/O"). */
export function tipoTemIo(tipo: string | undefined | null): boolean {
  const p = (window as unknown as { getDevicePoints?: (t: string) => CatalogPoints }).getDevicePoints?.(String(tipo ?? ''));
  return !!p && ((p.bi?.length ?? 0) > 0 || (p.bo?.length ?? 0) > 0);
}

let _linkSeq = 0;
const newKey = () => `lnk_${++_linkSeq}`;

export const DeviceIoConfigModal: React.FC<DeviceIoConfigModalProps> = ({
  open, onClose, compType, compNome, catalogId, unidadeId, ioConfig, onSave, onEnviarComando,
}) => {
  const points: CatalogPoints = useMemo(
    () => ((window as unknown as { getDevicePoints?: (t: string) => CatalogPoints }).getDevicePoints?.(compType) ?? {}),
    [compType],
  );
  // Catálogo do modelo: lista de saídas físicas (bo_outputs) do relé.
  const catDev = useMemo(() => {
    return (window as unknown as { getCatalogDevice?: (c: string) => { bo_outputs?: Array<{ id: string; label: string; coil?: number; func?: number; addr?: number; count?: number; value?: number }> } })
      .getCatalogDevice?.(catalogId ?? '') ?? {};
  }, [catalogId]);
  const boOutputs = (catDev.bo_outputs ?? []) as Array<{ id: string; label: string; coil?: number; func?: number; addr?: number; count?: number; value?: number }>;
  const bi = points.bi ?? [];
  const ai = points.ai ?? [];

  const [links, setLinks] = useState<Link[]>([]);
  const [equipamentos, setEquipamentos] = useState<Array<{ id: string; nome: string }>>([]);
  const [pontosByEquip, setPontosByEquip] = useState<Record<string, EquipamentoPonto[]>>({});
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  // Constrói a lista de links a partir do io_config salvo.
  useEffect(() => {
    if (!open) return;
    const ls: Link[] = [];
    for (const [cid, m] of Object.entries(ioConfig.bo ?? {})) {
      ls.push({ key: newKey(), tipo: 'bo', catalogId: cid, equipamentoId: (m.equipamento_id ?? '').trim(), pontoId: (m.ponto_id ?? '').trim(), coil: m.coil, func: m.func, addr: m.addr, count: m.count, value: m.value, boId: m.bo_id });
    }
    for (const [cid, m] of Object.entries(ioConfig.bi ?? {})) {
      ls.push({ key: newKey(), tipo: 'bi', catalogId: cid, equipamentoId: (m.equipamento_id ?? '').trim(), pontoId: (m.ponto_id ?? '').trim() });
    }
    setLinks(ls);
  }, [open, ioConfig]);

  // Equipamentos com automação (é onde há pontos cadastrados).
  useEffect(() => {
    if (!open || !unidadeId) return;
    equipamentosApi.findByUnidade(unidadeId, { limit: 100 })
      .then((r) => setEquipamentos(
        ((r.data ?? []) as Array<{ id?: string; nome: string; deleted_at?: unknown; automacao?: boolean }>)
          .filter((e) => !e.deleted_at && e.automacao === true)
          .map((e) => ({ id: (e.id || '').trim(), nome: e.nome })),
      ))
      .catch(() => setEquipamentos([]));
  }, [open, unidadeId]);

  const loadPontos = useCallback(async (equipId: string) => {
    const key = (equipId ?? '').trim();
    if (!key || pontosByEquip[key]) return;
    try {
      const pts = await equipamentoPontosApi.list(key);
      // ids vêm char(26) com espaço no fim; trimar p/ casar com o pontoId salvo (que o buildConfig trima).
      setPontosByEquip((p) => ({ ...p, [key]: pts.filter((x) => x.ativo).map((x) => ({ ...x, id: ((x as { id?: string }).id ?? '').trim() })) }));
    } catch { /* ignora */ }
  }, [pontosByEquip]);

  useEffect(() => {
    if (!open) return;
    const ids = new Set<string>();
    for (const m of [...Object.values(ioConfig.bi ?? {}), ...Object.values(ioConfig.bo ?? {})]) {
      if (m.equipamento_id) ids.add(m.equipamento_id);
    }
    ids.forEach((id) => void loadPontos(id));
  }, [open, ioConfig, loadPontos]);

  const addLink = () => setLinks((l) => [...l, { key: newKey() }]);
  const removeLink = (key: string) => setLinks((l) => l.filter((x) => x.key !== key));
  const patchLink = (key: string, patch: Partial<Link>) =>
    setLinks((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const buildConfig = (): DeviceIoConfig => {
    const outBi: Record<string, IoMapEntry> = {};
    const outBo: Record<string, IoMapEntry> = {};
    for (const l of links) {
      if (!l.equipamentoId || !l.pontoId) continue;
      if (l.tipo === 'bo') {
        // Comando: vínculo em 1 passo — ponto do equipamento → BO. A chave é o ponto_id
        // (vira o cmd_id no firmware); não há mais "sinal do catálogo" no meio.
        // FC15 (DPC double-bit, ex: CB-1 do 7SR5111) usa addr/count/value em vez de coil.
        if (l.coil == null && l.addr == null) continue;
        outBo[l.pontoId.trim()] = {
          equipamento_id: l.equipamentoId.trim(),
          ponto_id: l.pontoId.trim(),
          ...(l.coil != null ? { coil: l.coil } : {}),
          func: l.func ?? (l.addr != null ? 15 : 5),
          ...(l.addr != null ? { addr: l.addr, count: l.count ?? 2, value: l.value ?? 1 } : {}),
          ...(l.boId ? { bo_id: l.boId } : {}),
        };
      } else if (l.tipo === 'bi' && l.catalogId) {
        // Status (leitura): ainda referencia o sinal BI do catálogo (registrador fixo).
        outBi[l.catalogId] = { equipamento_id: l.equipamentoId.trim(), ponto_id: l.pontoId.trim() };
      }
    }
    return { bi: outBi, bo: outBo };
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Configuração de I/O — {compNome}</DialogTitle></DialogHeader>

        <div className="space-y-4 py-1">
          <section>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-foreground">
                LINKS — vincule cada ponto do equipamento.
                <span className="font-normal text-muted-foreground"> Comando → escolha a <b>Binary Output</b> do relé que ele aciona. Status → escolha o sinal de leitura (BI). Por instância/projeto.</span>
              </h4>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={addLink}>
                <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
              </Button>
            </div>

            {links.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">Nenhum link. Clique em "Adicionar".</p>
            )}

            <div className="space-y-1">
              {links.map((l) => {
                const pts = (l.equipamentoId ? pontosByEquip[l.equipamentoId] : []) ?? [];
                const ponto = pts.find((p) => p.id === l.pontoId);
                const pontoTipo = ponto?.tipo; // 'comando' | 'status'
                const isBo = l.tipo === 'bo';
                return (
                  <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 items-center text-xs">
                    {/* equipamento */}
                    <select
                      value={l.equipamentoId ?? ''}
                      onChange={(e) => { const v = e.target.value || undefined; patchLink(l.key, { equipamentoId: v, pontoId: undefined, catalogId: undefined, coil: undefined, func: undefined, tipo: undefined }); if (v) void loadPontos(v); }}
                      className="h-7 rounded border border-input bg-background dark:bg-black px-1"
                    >
                      <option value="">— equipamento —</option>
                      {equipamentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                    {/* ponto do equipamento (comando/status) */}
                    <select
                      value={l.pontoId ?? ''}
                      disabled={!l.equipamentoId}
                      onChange={(e) => {
                        const v = e.target.value || undefined;
                        const p = pts.find((x) => x.id === v);
                        const tipo = p?.tipo === 'comando' ? 'bo' : p?.tipo === 'status' ? 'bi' : undefined;
                        patchLink(l.key, { pontoId: v, tipo, catalogId: undefined, coil: undefined, func: undefined });
                      }}
                      className="h-7 rounded border border-input bg-background dark:bg-black px-1 disabled:opacity-50"
                    >
                      <option value="">— ponto —</option>
                      {pts.map((x) => {
                        const px = x as unknown as { id: string; nome?: string; label?: string; tipo: string };
                        return <option key={px.id} value={px.id}>{(px.nome ?? px.label ?? px.id)} [{px.tipo}]</option>;
                      })}
                    </select>
                    {/* col 3: COMANDO → Binary Output (saída do relé); STATUS → sinal BI do catálogo */}
                    {pontoTipo === 'comando' ? (
                      boOutputs.length > 0 ? (
                        <select
                          value={l.boId ?? (l.coil != null ? (boOutputs.find((o) => o.coil === l.coil)?.id ?? '') : '')}
                          disabled={!l.pontoId}
                          title="Binary Output do relé que este comando aciona (amarrada no Reydisp)"
                          onChange={(e) => {
                            const out = boOutputs.find((o) => o.id === e.target.value);
                            patchLink(l.key, out
                              ? { boId: out.id, coil: out.coil, func: out.func ?? (out.addr != null ? 15 : 5), addr: out.addr, count: out.count, value: out.value }
                              : { boId: undefined, coil: undefined, func: undefined, addr: undefined, count: undefined, value: undefined });
                          }}
                          className="h-7 rounded border border-input bg-background dark:bg-black px-1 disabled:opacity-50"
                        >
                          <option value="">— saída (BO) —</option>
                          {boOutputs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type="number" inputMode="numeric" value={l.coil ?? ''} placeholder="coil (PDU)"
                          title="Coil Modbus (PDU = Modicon − 1)"
                          disabled={!l.pontoId}
                          onChange={(e) => patchLink(l.key, { coil: e.target.value === '' ? undefined : Number(e.target.value), func: l.func ?? 5 })}
                          className="h-7 w-full rounded border border-input bg-background dark:bg-black px-1 disabled:opacity-50"
                        />
                      )
                    ) : pontoTipo === 'status' ? (
                      <select
                        value={l.catalogId ?? ''}
                        disabled={!l.pontoId}
                        onChange={(e) => patchLink(l.key, { catalogId: e.target.value || undefined })}
                        className="h-7 rounded border border-input bg-background dark:bg-black px-1 disabled:opacity-50"
                      >
                        <option value="">— sinal BI —</option>
                        {bi.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    ) : (
                      <span className="text-muted-foreground self-center">— escolha o ponto —</span>
                    )}
                    {/* enviar (só p/ comando com BO escolhida) */}
                    {isBo && onEnviarComando ? (
                      <Button
                        size="sm" variant="outline" className="h-7 px-2 shrink-0"
                        disabled={(l.coil == null && l.addr == null) || sendingKey === l.key}
                        onClick={async () => {
                          if (!onEnviarComando || !l.pontoId) return;
                          const p = pts.find((x) => x.id === l.pontoId) as any;
                          const lbl = String(p?.nome ?? p?.label ?? 'comando');
                          if (!window.confirm(`Enviar "${lbl}" ao ${compNome} via Modbus? Isso aciona o equipamento REAL.`)) return;
                          setSendingKey(l.key);
                          try { await onEnviarComando(l.pontoId, lbl); } finally { setSendingKey(null); }
                        }}
                      >
                        {sendingKey === l.key ? '…' : 'Enviar'}
                      </Button>
                    ) : <span />}
                    {/* remover */}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeLink(l.key)} title="Remover link">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          {ai.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-purple-600 mb-1">ANALÓGICAS (AI/AO) — só visualização (catálogo)</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {ai.map((p) => (
                  <div key={p.id} className="flex justify-between border-b border-border/40 py-0.5">
                    <span className="truncate" title={p.label}>{p.label}</span>
                    <span className="shrink-0 pl-2">{p.unit}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {bi.length === 0 && boOutputs.length === 0 && (
            <p className="text-xs text-muted-foreground">Este tipo não tem BI/BO no catálogo.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => { onSave(buildConfig()); onClose(); }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
