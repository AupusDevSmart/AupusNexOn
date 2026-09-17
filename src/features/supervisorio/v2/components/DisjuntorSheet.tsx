import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { api } from '@/config/api';
import { acionarPontoApi } from '@/services/acionar-ponto.services';

/**
 * Sheet do DJ (Fase 6 — reestruturação IoT). Data-driven pelo mockup
 * arquivos/nexon-web-dj.html: a tela se monta pelo que foi DECLARADO no cadastro
 * (colunas scs_*) e VINCULADO no arqIoT (PM/relé/ton_bo). Lê:
 *   - GET /iot/disjuntor/:id/scs-bundle  (declaração + PM + fonte de status + comandos)
 *   - GET /equipamentos/:pmId/dados/atual  (telemetria do PM associado — medição 'pm')
 *   - GET /equipamentos/:releId/dados/atual (status aberto/fechado via relé; medição 'ied')
 * Comando: POST /equipamentos/:id/pontos/:pontoId/acionar (mesmo caminho do
 * EquipamentoAcionarModal) — o ponto Abrir/Fechar vem de `comandos` (ton_bo).
 */
interface Bundle {
  equipamento: { id: string; nome: string | null };
  scs: { habilitado: boolean; comando: boolean; status: boolean; medicao: string };
  pm: { equipamento_id: string; nome: string | null } | null;
  status_fonte: { rele_equipamento_id: string; rele_nome: string | null; campo_aberto: string | null; campo_fechado: string | null } | null;
  comandos: Array<{ ponto: string; ponto_id: string; bo_numero: number; pulso_ms: number; ton_id: string }>;
}

type Acao = 'Abrir' | 'Fechar';

const fmt = (n: unknown, d = 1) =>
  n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function useDados(equipamentoId?: string | null) {
  const [dados, setDados] = useState<Record<string, any> | null>(null);
  const [tick, setTick] = useState(0);
  // `reload` força uma leitura fora do polling de 15 s (usado logo após um comando).
  const reload = useCallback(() => setTick((t) => t + 1), []);
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
  }, [equipamentoId, tick]);
  return { dados, reload };
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

  const temPm = bundle?.scs.medicao === 'pm';
  const temIed = bundle?.scs.medicao === 'ied';
  const { dados: pmDados } = useDados(temPm ? bundle?.pm?.equipamento_id : null);
  // Relé: fonte do status (aberto/fechado) e, na medição 'ied', das grandezas.
  const { dados: releDados, reload: reloadRele } = useDados(
    (bundle?.scs.status || temIed) ? bundle?.status_fonte?.rele_equipamento_id : null,
  );

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

  // ---- Comando: ponto Abrir/Fechar resolvido pelo nome do ponto vinculado (ton_bo) ----
  const cmdAbrir = useMemo(() => bundle?.comandos.find((c) => /abrir|open/i.test(c.ponto)) ?? null, [bundle]);
  const cmdFechar = useMemo(() => bundle?.comandos.find((c) => /fechar|close/i.test(c.ponto)) ?? null, [bundle]);
  const [confirmando, setConfirmando] = useState<Acao | null>(null);
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [ultimo, setUltimo] = useState<{ ok: boolean; texto: string } | null>(null);
  // Confirmação em dois cliques (sem sub-modal): o segundo clique em até 6 s dispara.
  useEffect(() => {
    if (!confirmando) return undefined;
    const t = setTimeout(() => setConfirmando(null), 6000);
    return () => clearTimeout(t);
  }, [confirmando]);

  const executar = async (acao: Acao) => {
    const cmd = acao === 'Abrir' ? cmdAbrir : cmdFechar;
    if (!cmd || enviando) return;
    setConfirmando(null);
    setEnviando(acao);
    setUltimo(null);
    try {
      const r = await acionarPontoApi.acionar(equipamentoId, cmd.ponto_id);
      setUltimo({ ok: true, texto: `${acao} confirmado pela TON · ack ${r.latency_ms} ms · ${r.comando_tecnico}` });
      toast.success(`${nome}: ${acao.toUpperCase()} executado`, {
        description: `${r.comando_semantico} · pulso ${r.pulso_ms} ms · ack ${r.latency_ms} ms`,
      });
      // O relé publica a posição nova logo após a manobra — relê fora do polling.
      [1200, 3000, 6000].forEach((ms) => setTimeout(reloadRele, ms));
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error?.message ?? err?.response?.data?.message;
      let titulo = `Falha ao ${acao.toLowerCase()}`;
      let desc: string = apiMsg ?? err?.message ?? 'Erro desconhecido';
      if (status === 504) { titulo = 'TON não respondeu'; desc = 'Timeout — TON offline ou sem rede.'; }
      else if (status === 502) titulo = 'TON recusou o comando';
      else if (status === 503) titulo = 'Broker MQTT desconectado';
      else if (status === 400) titulo = 'Configuração incompleta';
      else if (status === 403) titulo = 'Sem permissão para comandar';
      setUltimo({ ok: false, texto: `${titulo}: ${desc}` });
      toast.error(titulo, { description: desc });
    } finally {
      setEnviando(null);
    }
  };

  // DJ sem SCS não tem o que ver/comandar — não abre o modal (fecha assim que o
  // bundle chega e revela que está desabilitado). A configuração é na edição do unifilar.
  const scsOff = !!bundle && !bundle.scs.habilitado;
  useEffect(() => { if (scsOff) onClose(); }, [scsOff, onClose]);
  // Não renderiza o Dialog enquanto carrega o bundle NEM se o SCS está desabilitado:
  // evita o "abre e fecha rápido" (flash) num DJ que não é pra ser clicável.
  if (loading || scsOff) return null;

  // Medição: PM associado (medição 'pm') ou o próprio relé/IED (medição 'ied').
  const medDados = temPm ? pmDados : temIed ? releDados : null;
  const medFonte = temPm
    ? (bundle?.pm ? `PM: ${bundle.pm.nome ?? bundle.pm.equipamento_id}` : null)
    : temIed
      ? (bundle?.status_fonte ? `IED: ${bundle.status_fonte.rele_nome ?? bundle.status_fonte.rele_equipamento_id}` : null)
      : null;

  const btnBase = 'flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors';

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
                      {bundle.status_fonte?.rele_nome && (
                        <div className="text-[11px] text-muted-foreground">via {bundle.status_fonte.rele_nome}</div>
                      )}
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
                    <button
                      type="button"
                      disabled={!cmdAbrir || !!enviando}
                      onClick={() => (confirmando === 'Abrir' ? executar('Abrir') : setConfirmando('Abrir'))}
                      className={`${btnBase} border ${confirmando === 'Abrir' ? 'border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40' : ''}`}
                    >
                      {enviando === 'Abrir' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {enviando === 'Abrir' ? 'Abrindo…' : confirmando === 'Abrir' ? 'Confirmar abrir' : 'Abrir'}
                    </button>
                    <button
                      type="button"
                      disabled={!cmdFechar || !!enviando}
                      onClick={() => (confirmando === 'Fechar' ? executar('Fechar') : setConfirmando('Fechar'))}
                      className={`${btnBase} text-white ${confirmando === 'Fechar' ? 'ring-2 ring-amber-500' : ''}`}
                      style={{ background: '#177A3C' }}
                    >
                      {enviando === 'Fechar' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {enviando === 'Fechar' ? 'Fechando…' : confirmando === 'Fechar' ? 'Confirmar fechar' : 'Fechar'}
                    </button>
                  </div>
                  {confirmando && !enviando && (
                    <p className="text-xs text-amber-600 mt-2">Clique de novo para confirmar <b>{confirmando.toLowerCase()}</b> · cancela sozinho em 6 s.</p>
                  )}
                  {ultimo && (
                    <p className={`text-xs mt-2 ${ultimo.ok ? 'text-emerald-600' : 'text-red-600'}`}>{ultimo.texto}</p>
                  )}
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

              {/* MEDIÇÃO (PM associado ou o próprio IED/relé) */}
              {(temPm || temIed) && (
                <div className="pt-5">
                  <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    Medição {temIed ? '· IED (relé)' : '· PM'}
                  </h4>
                  {temPm && !bundle.pm ? (
                    <p className="text-xs text-muted-foreground">Medição declarada como PM, mas nenhum Power Meter associado — associe em "Configurações SCS" da TON.</p>
                  ) : temIed && !bundle.status_fonte ? (
                    <p className="text-xs text-muted-foreground">Medição declarada como IED, mas nenhum relé vinculado a este disjuntor no IoT.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border p-3">
                          <div className="text-[11px] text-muted-foreground">Potência total</div>
                          <div className="text-xl font-bold">{fmt(medDados?.Pt != null ? Number(medDados.Pt) / 1000 : null)} <em className="not-italic text-xs font-medium text-muted-foreground">kW</em></div>
                          <div className="text-[11px] text-muted-foreground">{fmt(medDados?.Qt != null ? Number(medDados.Qt) / 1000 : null)} kvar · {fmt(medDados?.St != null ? Number(medDados.St) / 1000 : null)} kVA</div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="text-[11px] text-muted-foreground">Fator de potência</div>
                          <div className="text-xl font-bold">{fmt(medDados?.FPt, 2)}</div>
                          <div className="text-[11px] text-muted-foreground">Freq {fmt(medDados?.Freq, 2)} Hz</div>
                        </div>
                      </div>
                      <div className="rounded-lg border mt-2 text-sm overflow-hidden">
                        <div className="flex bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground px-3.5 py-2">
                          <div className="flex-1">Fase</div><div className="flex-1 text-right">Tensão</div><div className="flex-1 text-right">Corrente</div>
                        </div>
                        {[['A', 'Va', 'Ia'], ['B', 'Vb', 'Ib'], ['C', 'Vc', 'Ic']].map(([f, vk, ik]) => (
                          <div key={f} className="flex px-3.5 py-2 border-t">
                            <div className="flex-1 text-muted-foreground">{f}</div>
                            <div className="flex-1 text-right font-medium">{fmt(medDados?.[vk], 0)} V</div>
                            <div className="flex-1 text-right font-medium">{fmt(medDados?.[ik], 0)} A</div>
                          </div>
                        ))}
                      </div>
                      {medFonte && <p className="text-[11px] text-muted-foreground mt-2">{medFonte}</p>}
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
