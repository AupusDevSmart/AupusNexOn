import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { api } from '@/config/api';

/**
 * Sheet do DJ (Fase 6 — reestruturação IoT). Data-driven pelo mockup
 * arquivos/nexon-web-dj.html: a tela se monta pelo que foi DECLARADO no cadastro
 * (colunas scs_*) e VINCULADO no arqIoT (PM/relé/ton_bo). Primeira versão —
 * o usuário vai lapidando. Lê:
 *   - GET /iot/disjuntor/:id/scs-bundle  (declaração + PM + fonte de status + comandos)
 *   - GET /equipamentos/:pmId/dados/atual  (telemetria do PM associado)
 *   - GET /equipamentos/:releId/dados/atual (status aberto/fechado, via relé)
 */
interface Bundle {
  equipamento: { id: string; nome: string | null };
  scs: { habilitado: boolean; comando: boolean; status: boolean; medicao: string };
  pm: { equipamento_id: string; nome: string | null } | null;
  status_fonte: { rele_equipamento_id: string; rele_nome: string | null; campo_aberto: string | null; campo_fechado: string | null } | null;
  comandos: Array<{ ponto: string; ponto_id: string; bo_numero: number; pulso_ms: number; ton_id: string }>;
}

const fmt = (n: unknown, d = 1) =>
  n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function useDados(equipamentoId?: string | null) {
  const [dados, setDados] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    if (!equipamentoId) { setDados(null); return; }
    let vivo = true;
    const load = () =>
      api.get(`/equipamentos/${equipamentoId.trim()}/dados/atual`)
        .then((r) => { if (vivo) setDados((r?.data?.dado?.dados ?? r?.data?.data?.dado?.dados ?? null) as any); })
        .catch(() => { if (vivo) setDados(null); });
    load();
    const t = setInterval(load, 15000);
    return () => { vivo = false; clearInterval(t); };
  }, [equipamentoId]);
  return dados;
}

export function DisjuntorSheet({ equipamentoId, onClose }: { equipamentoId: string; onClose: () => void }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    api.get(`/iot/disjuntor/${equipamentoId.trim()}/scs-bundle`)
      .then((r) => { if (vivo) setBundle((r?.data?.data ?? r?.data) as Bundle); })
      .catch(() => { if (vivo) setBundle(null); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [equipamentoId]);

  const pmDados = useDados(bundle?.scs.medicao === 'pm' ? bundle?.pm?.equipamento_id : null);
  const releDados = useDados(bundle?.scs.status ? bundle?.status_fonte?.rele_equipamento_id : null);

  const posicao = useMemo(() => {
    const f = bundle?.status_fonte;
    if (!f || !releDados) return null;
    const aberto = f.campo_aberto ? !!releDados[f.campo_aberto] : undefined;
    const fechado = f.campo_fechado ? !!releDados[f.campo_fechado] : undefined;
    if (fechado === true || aberto === false) return 'Fechado';
    if (aberto === true || fechado === false) return 'Aberto';
    return null;
  }, [bundle, releDados]);

  const nome = bundle?.equipamento.nome ?? 'Disjuntor';
  const temStatus = !!bundle?.scs.status;
  const temComando = !!bundle?.scs.comando;
  const temPm = bundle?.scs.medicao === 'pm';

  // DJ sem SCS não tem o que ver/comandar — não abre o modal (fecha assim que o
  // bundle chega e revela que está desabilitado). A configuração é na edição do unifilar.
  const scsOff = !!bundle && !bundle.scs.habilitado;
  useEffect(() => { if (scsOff) onClose(); }, [scsOff, onClose]);
  // Não renderiza o Dialog enquanto carrega o bundle NEM se o SCS está desabilitado:
  // evita o "abre e fecha rápido" (flash) num DJ que não é pra ser clicável.
  if (loading || scsOff) return null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b flex items-center gap-2 shrink-0">
          <h2 className="text-lg font-bold flex-1 truncate">{nome}</h2>
          {bundle && !bundle.scs.habilitado && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">SCS desabilitado</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 pb-6">
          {loading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>}
          {!loading && !bundle && <div className="py-8 text-center text-sm text-muted-foreground">Sem dados do disjuntor.</div>}

          {bundle && (
            <>
              {/* Aviso quando SCS desabilitado — a configuração é feita na edição do
                  equipamento no unifilar (não mais aqui; este sheet é só ver/comandar). */}
              {!bundle.scs.habilitado && (
                <div className="mt-5 rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">SCS desabilitado neste disjuntor.</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Habilite medição/comando/status na <b>edição do equipamento</b> (modo edição do unifilar).</p>
                </div>
              )}

              {/* ESTADO */}
              <div className="pt-5">
                {temStatus ? (
                  <div className="rounded-lg border p-4 flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${posicao === 'Fechado' ? 'bg-emerald-500' : posicao === 'Aberto' ? 'bg-gray-400' : 'bg-amber-400'}`} />
                    <div className="flex-1">
                      <b className="text-base">{posicao ?? 'Aguardando'}</b>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border p-4">
                    <b className="text-base text-muted-foreground">Sem supervisão</b>
                    <p className="text-xs text-muted-foreground mt-1">Sem pontos de status vinculados — a posição não é conhecida pelo sistema.</p>
                  </div>
                )}
              </div>

              {/* CONTROLES */}
              {temComando && (
                <div className="pt-5">
                  <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Controles</h4>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2.5 rounded-lg border font-semibold text-sm">Abrir</button>
                    <button className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white" style={{ background: '#177A3C' }}>Fechar</button>
                  </div>
                  {bundle.comandos.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">Comando declarado, mas sem vínculo a canal (BO) da TON — configure em "Configurações SCS".</p>
                  )}
                </div>
              )}

              {/* STATUS */}
              {temStatus && (
                <div className="pt-5">
                  <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Status</h4>
                  <div className="rounded-lg border divide-y text-sm">
                    {[['Aberto', posicao === 'Aberto'], ['Fechado', posicao === 'Fechado'], ['Mola carregada', releDados?.['mola_carregada']], ['Local', releDados?.['local']], ['Remoto', releDados?.['remoto']]].map(([k, v]) => (
                      <div key={String(k)} className="flex items-center px-3.5 py-2">
                        <div className="flex-1 text-muted-foreground">{k}</div>
                        <div className={`font-semibold ${v ? '' : 'text-muted-foreground font-normal'}`}>{v == null ? '—' : v ? 'Sim' : 'Não'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MEDIÇÃO (PM) */}
              {temPm && (
                <div className="pt-5">
                  <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Medição</h4>
                  {!bundle.pm ? (
                    <p className="text-xs text-muted-foreground">Medição declarada como PM, mas nenhum Power Meter associado — associe em "Configurações SCS" da TON.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border p-3">
                          <div className="text-[11px] text-muted-foreground">Potência total</div>
                          <div className="text-xl font-bold">{fmt(pmDados?.Pt != null ? Number(pmDados.Pt) / 1000 : null)} <em className="not-italic text-xs font-medium text-muted-foreground">kW</em></div>
                          <div className="text-[11px] text-muted-foreground">{fmt(pmDados?.Qt != null ? Number(pmDados.Qt) / 1000 : null)} kvar · {fmt(pmDados?.St != null ? Number(pmDados.St) / 1000 : null)} kVA</div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="text-[11px] text-muted-foreground">Fator de potência</div>
                          <div className="text-xl font-bold">{fmt(pmDados?.FPt, 2)}</div>
                          <div className="text-[11px] text-muted-foreground">Freq {fmt(pmDados?.Freq, 2)} Hz</div>
                        </div>
                      </div>
                      <div className="rounded-lg border mt-2 text-sm overflow-hidden">
                        <div className="flex bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground px-3.5 py-2">
                          <div className="flex-1">Fase</div><div className="flex-1 text-right">Tensão</div><div className="flex-1 text-right">Corrente</div>
                        </div>
                        {[['A', 'Va', 'Ia'], ['B', 'Vb', 'Ib'], ['C', 'Vc', 'Ic']].map(([f, vk, ik]) => (
                          <div key={f} className="flex px-3.5 py-2 border-t">
                            <div className="flex-1 text-muted-foreground">{f}</div>
                            <div className="flex-1 text-right font-medium">{fmt(pmDados?.[vk], 0)} V</div>
                            <div className="flex-1 text-right font-medium">{fmt(pmDados?.[ik], 0)} A</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">PM: {bundle.pm.nome ?? bundle.pm.equipamento_id}</p>
                    </>
                  )}
                </div>
              )}

              {/* CADASTRO */}
              <div className="pt-5">
                <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Cadastro</h4>
                <div className="rounded-lg border divide-y text-sm">
                  <div className="flex px-3.5 py-2"><div className="flex-1 text-muted-foreground">Nome</div><div className="font-medium">{nome}</div></div>
                  <div className="flex px-3.5 py-2"><div className="flex-1 text-muted-foreground">SCS</div><div className="font-medium">{bundle.scs.habilitado ? 'Habilitado' : 'Não'} · cmd {bundle.scs.comando ? 'sim' : 'não'} · sts {bundle.scs.status ? 'sim' : 'não'} · med {bundle.scs.medicao}</div></div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DisjuntorSheet;
