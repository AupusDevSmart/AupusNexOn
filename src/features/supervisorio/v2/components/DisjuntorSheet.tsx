import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { acionarPontoApi } from '@/services/acionar-ponto.services';
import { useUserStore } from '@/store/useUserStore';
import type { CustosEnergiaResponseDto } from '@/types/dtos/custos-energia-dto';
import { SsuOperacao } from './sheets/MedidorSheet';
import { NX, s, NxShell, NxDialog, NxDialogHead, NxDialogButtons, type NxTone } from './sheets/nxMock';
import { Registros, linhasPosto, brl, type RegistroExtra } from './sheets/equipUi';
import { Bloco, Rotulo, RotulosUnifilar, StatusNx, Exclama, LinhasNx, FasesNx, Duas, Coluna, GraficoNx, type GrupoGrandezaNx, type LinhaNx } from './sheets/InversorSheet';

/**
 * Modal do DJ no web — tela "Equipamento · DJ UBS" do app (NEXON-5) adaptada ao
 * padrão dos modais web (Pivô/Medidor). Data-driven pelo que foi DECLARADO no
 * cadastro (colunas scs_*) e VINCULADO no arqIoT (PM/relé/ton_bo). Lê:
 *   - GET /iot/disjuntor/:id/scs-bundle  (declaração + PM + fonte de status + comandos)
 *   - GET /equipamentos/:pmId/dados/atual  (telemetria do PM associado — medição 'pm')
 *   - GET /equipamentos/:releId/dados/atual (status aberto/fechado via relé; medição 'ied')
 *   - GET /equipamentos-dados/:pmId/custos-energia?periodo=dia (consumo/custo de hoje)
 * Comando: POST /equipamentos/:id/pontos/:pontoId/acionar — o ponto Abrir/Fechar vem
 * de `comandos` (ton_bo), sempre com o diálogo "Abrir/Fechar <DJ>?".
 */
interface Bundle {
  equipamento: { id: string; nome: string | null };
  scs: { habilitado: boolean; comando: boolean; status: boolean; medicao: string };
  pm: { equipamento_id: string; nome: string | null } | null;
  status_fonte: { rele_equipamento_id: string; rele_nome: string | null; campo_aberto: string | null; campo_fechado: string | null } | null;
  comandos: Array<{ ponto: string; ponto_id: string; bo_numero: number; pulso_ms: number; ton_id: string }>;
  cadastro?: { corrente_nominal_a: number | null; tensao_nominal_v: number | null; alimentado_por: string[]; alimenta: string[] };
  manobras?: { hoje: number; ultima_em: string | null; ultima_msg: string | null };
  pm_hoje?: { fp_min: number | null; pt_max_kw: number | null; leituras: number } | null;
}

type Telemetria = Record<string, unknown>;
type CustosHoje = Partial<CustosEnergiaResponseDto>;

/** Consumo/custo de HOJE do PM — mesmo cálculo da Gestão de Energia. */
function useCustosHoje(pmId?: string | null) {
  const [c, setC] = useState<CustosHoje | null>(null);
  useEffect(() => {
    if (!pmId) { setC(null); return; }
    let vivo = true;
    const d = new Date();
    const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const load = () =>
      api.get(`/equipamentos-dados/${pmId.trim()}/custos-energia`, { params: { periodo: 'dia', data } })
        .then((r) => { if (vivo) setC((r?.data?.data ?? r?.data ?? null) as CustosHoje); })
        .catch(() => { if (vivo) setC(null); });
    load();
    const t = setInterval(load, 300000);
    return () => { vivo = false; clearInterval(t); };
  }, [pmId]);
  return c;
}

/** created_at vem sem fuso (UTC) → Date local. */
const dataUtc = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

type Acao = 'Abrir' | 'Fechar';

const fmt = (n: unknown, d = 1) =>
  n == null || n === '' || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function useDados(equipamentoId?: string | null) {
  const [dados, setDados] = useState<Telemetria | null>(null);
  const [ts, setTs] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // `reload` força uma leitura fora do polling de 15 s (usado logo após um comando).
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!equipamentoId) { setDados(null); return; }
    let vivo = true;
    const load = () =>
      api.get(`/equipamentos/${equipamentoId.trim()}/dados/atual`)
        .then((r) => {
          if (!vivo) return;
          const dado = r?.data?.dado ?? r?.data?.data?.dado ?? null;
          setDados((dado?.dados ?? null) as Telemetria | null);
          setTs((dado?.timestamp_dados ?? dado?.created_at ?? dado?.timestamp ?? null) as string | null);
        })
        .catch(() => { if (vivo) { setDados(null); setTs(null); } });
    load();
    const t = setInterval(load, 15000);
    return () => { vivo = false; clearInterval(t); };
  }, [equipamentoId, tick]);
  return { dados, reload, ts };
}

/** Parâmetros de proteção do mockup (sem leitura/gravação pelo NexON ainda). */
const PARAMS_DJ = [
  { key: 'sobV', label: 'Sobretensão', faixa: '400 a 440', unit: 'V' },
  { key: 'subV', label: 'Subtensão', faixa: '300 a 380', unit: 'V' },
  { key: 'sobI', label: 'Sobrecorrente', faixa: '50 a 400', unit: 'A' },
  { key: 'deseq', label: 'Desequilíbrio de tensão', faixa: '1,0 a 10,0', unit: '%' },
  { key: 'fpMin', label: 'FP mínimo', faixa: '0,80 a 1,00', unit: '' },
];

export function DisjuntorSheet({ equipamentoId, onClose, onConfigurarPontos }: { equipamentoId: string; onClose: () => void; onConfigurarPontos?: () => void }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState('op');
  const [ff, setFf] = useState(true);
  const [custosAberto, setCustosAberto] = useState(false);
  // PER-36: sem capacidade de comandar, os botões Abrir/Fechar nem aparecem.
  const podeComandar = useUserStore((st) => st.capacidades.comandar);

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
  const { dados: pmDados, ts: pmTs } = useDados(temPm ? bundle?.pm?.equipamento_id : null);
  const custosHoje = useCustosHoje(temPm ? bundle?.pm?.equipamento_id : null);
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
  const [ultimo, setUltimo] = useState<{ ok: boolean; texto: string; t: number; acao: Acao } | null>(null);

  const executar = async (acao: Acao) => {
    const cmd = acao === 'Abrir' ? cmdAbrir : cmdFechar;
    if (!cmd || enviando) return;
    setEnviando(acao);
    setUltimo(null);
    try {
      const r = await acionarPontoApi.acionar(equipamentoId, cmd.ponto_id);
      setUltimo({ ok: true, texto: `${acao} confirmado pela TON · ack ${r.latency_ms} ms · ${r.comando_tecnico}`, t: Date.now(), acao });
      toast.success(`${nome}: ${acao.toUpperCase()} executado`, {
        description: `${r.comando_semantico} · pulso ${r.pulso_ms} ms · ack ${r.latency_ms} ms`,
      });
      // O relé publica a posição nova logo após a manobra — relê fora do polling.
      [1200, 3000, 6000].forEach((ms) => setTimeout(reloadRele, ms));
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } }; message?: string };
      const status = e?.response?.status;
      const apiMsg = e?.response?.data?.error?.message ?? e?.response?.data?.message;
      let titulo = `Falha ao ${acao.toLowerCase()}`;
      let desc: string = apiMsg ?? e?.message ?? 'Erro desconhecido';
      if (status === 504) { titulo = 'TON não respondeu'; desc = 'Timeout — TON offline ou sem rede.'; }
      else if (status === 502) titulo = 'TON recusou o comando';
      else if (status === 503) titulo = 'Broker MQTT desconectado';
      else if (status === 400) titulo = 'Configuração incompleta';
      else if (status === 403) titulo = 'Sem permissão para comandar';
      setUltimo({ ok: false, texto: `${titulo}: ${desc}`, t: Date.now(), acao });
      toast.error(titulo, { description: desc });
    } finally {
      setEnviando(null);
      setConfirmando(null);
    }
  };

  // DJ sem SCS não tem o que ver/comandar — não abre o modal (fecha assim que o
  // bundle chega e revela que está desabilitado). A configuração é na edição do unifilar.
  const scsOff = !!bundle && !bundle.scs.habilitado;
  useEffect(() => { if (scsOff) onClose(); }, [scsOff, onClose]);
  // Não renderiza enquanto carrega o bundle NEM se o SCS está desabilitado (evita o flash).
  if (loading || scsOff) return null;

  // Medição: PM associado (medição 'pm') ou o próprio relé/IED (medição 'ied').
  const medDados = temPm ? pmDados : temIed ? releDados : null;
  // PM que na verdade é medidor de concessionária lido pela SSU: usa a visão SSU da ficha do medidor.
  const pmEhSsu = temPm && !!pmDados && (pmDados.NSU != null || (pmDados.data as { phf?: unknown } | undefined)?.phf != null);
  const medOk = (temPm && !!bundle?.pm && !pmEhSsu) || (temIed && !!bundle?.status_fonte);
  const num = (k: string) => { const v = medDados?.[k]; return v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v); };
  const kilo = (k: string) => { const v = num(k); return v == null ? null : v / 1000; };
  const flag = (k: string) => (releDados?.[k] == null ? null : !!releDados[k]);

  const pt = kilo('Pt');
  const iMax = Math.max(...['Ia', 'Ib', 'Ic'].map((k) => num(k) ?? 0));
  const In = bundle?.cadastro?.corrente_nominal_a ?? null;
  const local = flag('local');
  const remoto = flag('remoto');
  const mola = flag('mola_carregada');
  const modoTxt = local === true ? 'Local' : remoto === true || local === false ? 'Remoto' : '—';
  const porComando = posicao === 'Aberto' && /abr/i.test(bundle?.manobras?.ultima_msg ?? (ultimo?.ok ? ultimo.acao : ''));

  // Leitura do PM com mais de 30 min = parada (TON/PM fora do ar): não pode aparecer "Normal".
  const velha = (() => {
    if (!pmTs) return null;
    const d = new Date(pmTs);
    const ms = Date.now() - d.getTime();
    if (Number.isNaN(d.getTime()) || ms < 30 * 60_000) return null;
    const min = Math.floor(ms / 60_000);
    const ha = min < 120 ? `${min} min` : min < 48 * 60 ? `${Math.floor(min / 60)} h` : `${Math.floor(min / 1440)} dias`;
    return { quando: d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }), ha };
  })();
  const medVelha = velha?.quando ?? null;
  // DJ só com medição (sem posição nem comando): a coluna da esquerda ficaria só com o status.
  const soMedicao = !temStatus && !temComando;

  // Status (vocabulário do mockup: Normal / Alerta / Falha / Sem comunicação).
  let tone: NxTone; let stLabel: string; let stText: string;
  if (temStatus && !releDados) { tone = 'off'; stLabel = 'Sem comunicação'; stText = bundle?.status_fonte ? 'Sem leitura do relé' : 'Nenhum relé de status vinculado'; }
  else if (temStatus && !posicao) { tone = 'warn'; stLabel = 'Alerta'; stText = 'Posição indefinida'; }
  else if (temStatus && mola === false && posicao === 'Aberto') { tone = 'warn'; stLabel = 'Alerta'; stText = 'Mola descarregada'; }
  else if (temStatus) { tone = 'ok'; stLabel = 'Normal'; stText = posicao === 'Fechado' ? 'Fechado' : porComando ? 'Aberto por comando' : 'Aberto'; }
  else if ((temPm || temIed) && !medDados && !pmEhSsu) { tone = 'off'; stLabel = 'Sem comunicação'; stText = 'Sem leitura da medição'; }
  else if (temPm && !pmEhSsu && medVelha) { tone = 'off'; stLabel = 'Sem comunicação'; stText = `Última leitura ${medVelha}`; }
  else { tone = 'ok'; stLabel = 'Normal'; stText = 'Posição não monitorada'; }

  const fechado = posicao === 'Fechado';
  const posCor = fechado ? NX.ok : posicao === 'Aberto' ? NX.mudo : NX.neutro;

  // Comando (mockup: um botão — Abrir quando fechado, Fechar quando aberto).
  const botoes: Acao[] = posicao === 'Fechado' ? ['Abrir'] : posicao === 'Aberto' ? ['Fechar'] : ['Abrir', 'Fechar'];
  const alimenta = bundle?.cadastro?.alimenta ?? [];
  const alvo = alimenta.length ? alimenta.join(', ') : 'A instalação';
  const plural = alimenta.length > 1;
  const nota = confirmando === 'Abrir'
    ? `${alvo} ${plural ? 'serão desenergizados' : alimenta.length ? 'será desenergizado' : 'será desenergizada'}.`
    : `${alvo} ${plural ? 'serão energizados' : alimenta.length ? 'será energizado' : 'será energizada'}.`;

  // Por fase: FF (Vab/Vbc/Vca) e FN (Va/Vb/Vc) conforme o que a medição publica.
  const temFF = ['Vab', 'Vbc', 'Vca'].some((k) => num(k) != null);
  const temFN = ['Va', 'Vb', 'Vc'].some((k) => num(k) != null);
  const mostraFF = temFF && (!temFN || ff);
  const vTxt = (k: string) => (num(k) == null ? '—' : `${fmt(num(k), 0)} V`);
  const aTxt = (k: string) => (num(k) == null ? '—' : `${fmt(num(k), 1)} A`);
  const fases: Array<[string, string, string]> = mostraFF
    ? [['AB', vTxt('Vab'), aTxt('Ia')], ['BC', vTxt('Vbc'), aTxt('Ib')], ['CA', vTxt('Vca'), aTxt('Ic')]]
    : [['A', vTxt('Va'), aTxt('Ia')], ['B', vTxt('Vb'), aTxt('Ib')], ['C', vTxt('Vc'), aTxt('Ic')]];

  const pickN = (k: string, div = 1) => (d: Telemetria) => { const x = d?.[k]; const v = Number(x); return x == null || x === '' || !Number.isFinite(v) ? null : v / div; };
  const catalogo: GrupoGrandezaNx[] = [
    { label: 'Potência ativa · kW', unit: 'kW', items: [{ id: 'pAt', label: 'Ativa', short: 'Ativa', pick: pickN('Pt', 1000) }] },
    { label: 'Potência reativa · kvar', unit: 'kvar', items: [{ id: 'pRe', label: 'Reativa', short: 'Reativa', pick: pickN('Qt', 1000) }] },
    { label: 'Corrente · A', unit: 'A', items: (['a', 'b', 'c'] as const).map((f) => ({ id: `i${f}`, label: `Fase ${f.toUpperCase()}`, short: `I ${f.toUpperCase()}`, pick: pickN(`I${f}`) })) },
    { label: 'Tensão · V', unit: 'V', items: (temFF ? [['AB', 'Vab'], ['BC', 'Vbc'], ['CA', 'Vca']] : [['A', 'Va'], ['B', 'Vb'], ['C', 'Vc']]).map(([l, k]) => ({ id: `v${l}`, label: l, short: `V ${l}`, pick: pickN(k) })) },
    { label: 'Fator de potência', unit: 'FP', items: [{ id: 'fp', label: 'FP', short: 'FP', pick: pickN('FPt') }] },
    { label: 'Frequência · Hz', unit: 'Hz', items: [{ id: 'hz', label: 'Frequência', short: 'Freq.', pick: pickN('Freq') }] },
  ];
  const medId = temPm ? bundle?.pm?.equipamento_id : temIed ? bundle?.status_fonte?.rele_equipamento_id : null;

  const potRows: LinhaNx[] = [
    { k: 'Ativa', v: pt != null ? `${fmt(pt, 1)} kW${pt < -0.05 ? ' · injetando' : ''}` : '—' },
    { k: 'Reativa', v: kilo('Qt') != null ? `${fmt(kilo('Qt'), 1)} kvar` : '—' },
    { k: 'Aparente', v: kilo('St') != null ? `${fmt(kilo('St'), 1)} kVA` : '—' },
    { k: 'Fator de potência', v: num('FPt') != null ? fmt(num('FPt'), 2) : '—', sub: bundle?.pm_hoje?.fp_min != null ? `menor hoje ${fmt(bundle.pm_hoje.fp_min, 2)}` : undefined },
    { k: 'Frequência', v: num('Freq') != null ? `${fmt(num('Freq'), 2)} Hz` : '—' },
    In
      ? { k: 'Carregamento', v: `${fmt((iMax / In) * 100, 0)}%`, sub: `${fmt(iMax, 0)} A de ${fmt(In, 0)} A`, opcional: !medDados }
      : { k: 'Corrente máxima', v: medDados ? `${fmt(iMax, 0)} A` : '—', sub: 'Informe a corrente nominal no cadastro p/ ver o carregamento', opcional: true },
  ];

  const consumo = custosHoje?.consumo;
  const custoOk = !!(custosHoje?.consumo && custosHoje?.custos);
  const demandaMax = consumo?.demanda_maxima_kw ?? bundle?.pm_hoje?.pt_max_kw ?? null;

  // Registros: eventos do equipamento + última manobra do bundle + resultado do comando desta sessão.
  const extras: RegistroExtra[] = [];
  const ultimaEm = dataUtc(bundle?.manobras?.ultima_em);
  if (ultimaEm) extras.push({ t: ultimaEm.getTime(), txt: bundle?.manobras?.ultima_msg ?? 'Comando', quem: 'Comando' });
  if (ultimo) extras.push({ t: ultimo.t, txt: ultimo.texto, quem: 'Você', ok: ultimo.ok, ruim: !ultimo.ok });
  const manobrasTxt = !temComando
    ? 'Sem pontos de comando declarados'
    : `${bundle?.manobras?.hoje ?? 0} ${(bundle?.manobras?.hoje ?? 0) === 1 ? 'manobra' : 'manobras'} hoje${!temStatus ? ' · só comandos enviados, sem confirmação de posição' : ''}`;

  const subtitulo = [bundle?.status_fonte?.rele_nome && `via ${bundle.status_fonte.rele_nome}`, bundle?.pm?.nome && `PM ${bundle.pm.nome}`].filter(Boolean).join(' · ') || 'Disjuntor';

  const notaMed = temPm && !bundle?.pm
    ? 'Medição declarada como PM, mas nenhum Power Meter associado — associe em "Configurações SCS" da TON.'
    : temIed && !bundle?.status_fonte
      ? 'Medição declarada como IED, mas nenhum relé vinculado a este disjuntor na Topologia.'
      : !temPm && !temIed ? 'Sem medição declarada neste disjuntor.' : null;

  // Cartão "Consumida / Injetada hoje" (PM) — na coluna da medição ou, num DJ só com
  // medição, embaixo do status (equilibra as duas colunas).
  const blocoEnergia = (
                    <Bloco style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        {[['Consumida', consumo?.energia_total_kwh], ['Injetada', null]].map(([k, v]) => (
                          <span key={String(k)} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, color: NX.mudo }}>{k} · hoje</span>
                            <span style={{ fontSize: 24, lineHeight: '30px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: v == null ? NX.mudo : NX.texto }}>
                              {fmt(v, 1)}<span style={{ fontSize: 14, fontWeight: 700, color: NX.mudo, marginLeft: 4 }}>kWh</span>
                            </span>
                          </span>
                        ))}
                      </div>
                      {custosHoje?.aviso && <Exclama title={custosHoje.aviso} />}
                    </Bloco>
  );
  const colunaMedicao = (
    <>
      {velha && temPm && !pmEhSsu && (
        <Bloco style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(214,138,0,0.10)', borderColor: 'rgba(214,138,0,0.45)' }}>
          <Exclama title="Medição sem dados recentes" />
          <span style={{ fontSize: 13, lineHeight: '18px' }}>
            <b>Sem dados novos há {velha.ha}.</b> Os valores abaixo são da <b>última leitura ({velha.quando})</b>, não de agora —
            verifique a TON/medidor desta instalação.
          </span>
        </Bloco>
      )}
              {pmEhSsu && bundle.pm ? (
                <Bloco style={{ padding: '4px 16px 12px 16px' }}><SsuOperacao equipamentoId={bundle.pm.equipamento_id} /></Bloco>
              ) : notaMed || !medOk ? (
                <Bloco style={{ padding: '14px 16px', fontSize: 13, color: NX.mudo }}>{notaMed ?? 'Sem medição.'}</Bloco>
              ) : (
                <>
                  {temPm && !soMedicao && blocoEnergia}
                  <LinhasNx titulo="Potência" rows={potRows} />
                </>
              )}
    </>
  );
  // DJ só com medição e sem o par energia/potência (nota, SSU, sem leitura): status em cima, conteúdo embaixo.
  const umaColuna = soMedicao && !(medOk && !notaMed && temPm && !pmEhSsu);

  return (
    <NxShell
      title={nome}
      subtitle={subtitulo}
      right={<span style={s.pill(tone)}><span style={s.pillDot(tone)} />{stLabel}</span>}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {!bundle ? (
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ textAlign: 'center', fontSize: 14, color: NX.mudo }}>Sem dados do disjuntor.</span>
          {aba === 'cfg' && <RotulosUnifilar onConfigurar={onConfigurarPontos} />}
        </div>
      ) : aba === 'cfg' ? (
        <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RotulosUnifilar onConfigurar={onConfigurarPontos} />
          <Rotulo style={{ marginTop: 4 }}>Parâmetros do disjuntor</Rotulo>
          {PARAMS_DJ.map((p) => (
            <Bloco key={p.key} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <label htmlFor={`cfg-${p.key}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{p.label}</span>
                <span style={{ fontSize: 12, color: NX.mudo }}>Faixa {p.faixa}{p.unit ? ` ${p.unit}` : ''}</span>
              </label>
              <input id={`cfg-${p.key}`} inputMode="decimal" value="—" disabled readOnly style={s.campo(true)} />
              <span style={{ fontSize: 14, color: NX.mudo, width: 28 }}>{p.unit}</span>
            </Bloco>
          ))}
          <button type="button" disabled style={s.save(true)}>Sem alterações</button>
          <span style={{ fontSize: 12, color: NX.mudo, marginTop: 6 }}>
            Limites de tensão, corrente e FP: o NexON ainda não lê nem grava estes parâmetros no relé do disjuntor.
          </span>
          <Rotulo style={{ marginTop: 10 }}>Cadastro</Rotulo>
          <LinhasNx rows={[
            { k: 'Corrente nominal', v: bundle.cadastro?.corrente_nominal_a ? `${fmt(bundle.cadastro.corrente_nominal_a, 0)} A` : '—' },
            { k: 'Tensão nominal', v: bundle.cadastro?.tensao_nominal_v ? `${fmt(bundle.cadastro.tensao_nominal_v, 0)} V` : '—' },
            { k: 'Alimentado por', v: bundle.cadastro?.alimentado_por?.length ? bundle.cadastro.alimentado_por.join(', ') : '—' },
            { k: 'Alimenta', v: alimenta.length ? alimenta.join(', ') : '—' },
            { k: 'SCS', v: `${bundle.scs.habilitado ? 'Habilitado' : 'Não'} · cmd ${bundle.scs.comando ? 'sim' : 'não'} · sts ${bundle.scs.status ? 'sim' : 'não'} · med ${bundle.scs.medicao}` },
          ]} />
          <span style={{ fontSize: 12, color: NX.mudo, marginTop: 6 }}>Comando, status e medição vêm dos pontos ligados às BO/BI da TON e do PM/relé associado (edição do equipamento no unifilar → Configurações SCS).</span>
        </div>
      ) : (
        <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {umaColuna ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StatusNx tone={tone} label={stLabel} text={stText} />
              {colunaMedicao}
            </div>
          ) : (
          <Duas>
            <Coluna>
              <StatusNx tone={tone} label={stLabel} text={stText} />
              {temStatus && (
                <Bloco style={{ padding: '14px 0', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: fechado ? 'rgba(46,139,71,0.12)' : 'rgba(138,143,163,0.14)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={posCor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3v5" /><path d="M12 21v-4" /><path d={fechado || !posicao ? 'M12 8v9' : 'M12 17l5-8'} strokeOpacity={posicao ? 1 : 0.4} />
                      </svg>
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: posicao ? posCor : NX.mudo }}>{posicao ?? '—'}</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>Posição</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2, borderLeft: `1px solid ${NX.linha}` }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: local === true ? NX.warn : modoTxt === '—' ? NX.mudo : NX.texto }}>{modoTxt}</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>Comando</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2, borderLeft: `1px solid ${NX.linha}` }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: mola == null ? NX.mudo : mola ? NX.texto : NX.warn }}>{mola == null ? '—' : mola ? 'Carregada' : 'Descarregada'}</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>Mola</span>
                  </div>
                </Bloco>
              )}
              {temComando && podeComandar && (
                <>
                  {local === true ? (
                    <button type="button" disabled style={s.cmd('busy')}>Modo local</button>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${botoes.length}, minmax(0, 1fr))`, gap: 8 }}>
                      {botoes.map((b) => {
                        const c = b === 'Abrir' ? cmdAbrir : cmdFechar;
                        const off = !c || !!enviando;
                        return (
                          <button key={b} type="button" disabled={off} onClick={() => setConfirmando(b)}
                            style={s.cmd(off ? 'busy' : b === 'Abrir' ? 'outline' : 'primary')}>
                            {enviando ? 'Executando…' : b}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {bundle.comandos.length === 0 && (
                    <span style={{ fontSize: 12, color: NX.warn, textAlign: 'center' }}>Comando declarado, mas sem vínculo a canal (BO) da TON — configure em "Configurações SCS".</span>
                  )}
                  {local === true && <span style={{ fontSize: 12, color: NX.mudo, textAlign: 'center' }}>Disjuntor em modo local: comando remoto bloqueado.</span>}
                  {ultimo && <span style={{ fontSize: 12, fontWeight: 700, color: ultimo.ok ? NX.ok : NX.bad }}>{ultimo.texto}</span>}
                </>
              )}
              {soMedicao && temPm && blocoEnergia}
            </Coluna>
            <Coluna>
              {colunaMedicao}
            </Coluna>
          </Duas>
          )}

          {medOk && temPm && (
            <button type="button" onClick={() => setCustosAberto(true)}
              className="grid grid-cols-1 min-[760px]:grid-cols-3"
              style={{ ...s.card, width: '100%', boxSizing: 'border-box', alignItems: 'center', minHeight: 76, padding: '8px 0' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 20px', minWidth: 0 }}>
                <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Valor da energia hoje</span>
                <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{brl(custosHoje?.custos?.custo_total)}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 20px', borderLeft: `1px solid ${NX.linha}`, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Demanda máxima</span>
                <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{demandaMax != null ? `${fmt(demandaMax, 1)} kW` : '—'}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 20px', borderLeft: `1px solid ${NX.linha}`, height: 44, fontSize: 14, fontWeight: 800, color: NX.acao, whiteSpace: 'nowrap' }}>
                <span>Custos por horário</span><span>›</span>
              </span>
            </button>
          )}

          {medOk && (
            <GraficoNx equipamentoId={medId} catalogo={catalogo} padrao={['pAt']}
              resumo={pt != null ? (velha && temPm ? `${fmt(pt, 1)} kW em ${velha.quando}` : `${fmt(pt, 1)} kW agora`) : undefined} />
          )}

          <Duas>
            {medOk ? (
              <FasesNx rows={fases} ff={mostraFF} onFF={setFf} temToggle={temFF && temFN}
                nota={(temPm ? `PM: ${bundle.pm?.nome ?? bundle.pm?.equipamento_id}` : `IED: ${bundle.status_fonte?.rele_nome ?? bundle.status_fonte?.rele_equipamento_id}`) + (velha && temPm ? ` · última leitura ${velha.quando}` : '')} />
            ) : null}
            {/* Sem medição a coluna das fases some: o cadastro ocupa a largura toda em vez de deixar metade vazia. */}
            <div className={medOk ? 'min-w-0' : 'min-w-0 min-[760px]:col-span-2'}>
            <LinhasNx titulo="Cadastro" rows={[
              { k: 'Corrente nominal', v: bundle.cadastro?.corrente_nominal_a ? `${fmt(bundle.cadastro.corrente_nominal_a, 0)} A` : '—' },
              { k: 'Tensão nominal', v: bundle.cadastro?.tensao_nominal_v ? `${fmt(bundle.cadastro.tensao_nominal_v, 0)} V` : '—', opcional: true },
              { k: 'Alimentado por', v: bundle.cadastro?.alimentado_por?.length ? bundle.cadastro.alimentado_por.join(', ') : '—' },
              { k: 'Alimenta', v: alimenta.length ? alimenta.join(', ') : '—' },
            ]} />
            </div>
          </Duas>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Registros equipamentoId={equipamentoId} extra={extras} />
            <span style={{ fontSize: 12, color: NX.mudo, padding: '0 4px' }}>Histórico de manobras · {manobrasTxt}</span>
          </div>
        </div>
      )}

      <NxDialog open={!!confirmando} onClose={() => { if (!enviando) setConfirmando(null); }} label="Confirmar comando">
        <span style={{ fontSize: 18, fontWeight: 800 }}>{confirmando} {nome}?</span>
        <span style={{ fontSize: 14, color: NX.mudo }}>{nota}</span>
        <span style={{ fontSize: 13, color: NX.mudo }}>O comando vai para o equipamento real pela TON.</span>
        <NxDialogButtons onCancel={() => setConfirmando(null)} busy={!!enviando} onConfirm={() => { if (confirmando) void executar(confirmando); }} />
      </NxDialog>

      <NxDialog open={custosAberto} onClose={() => setCustosAberto(false)} label="Custos por horário" width={520}>
        <NxDialogHead title="Custos por horário" sub={`${nome} · hoje${custosHoje?.unidade?.nome ? ` · tarifa da UC ${custosHoje.unidade.nome}` : ''}`} onClose={() => setCustosAberto(false)} />
        {!custoOk ? (
          <span style={{ fontSize: 14, color: NX.mudo, padding: '12px 0' }}>Sem custo calculado para hoje (confira a unidade e a tarifa do PM).</span>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, padding: '6px 0' }}>
              <span>POSTO</span><span style={{ textAlign: 'right' }}>kWh</span><span style={{ textAlign: 'right' }}>R$/kWh</span><span style={{ textAlign: 'right' }}>R$</span>
            </div>
            {linhasPosto(custosHoje as CustosEnergiaResponseDto).map((r) => (
              <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', fontSize: 14, padding: '8px 0', borderTop: `1px solid ${NX.linha}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className={`w-2.5 h-2.5 rounded-[3px] ${r.cor}`} />{r.k}</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.kwh, 0)}</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.tarifa != null ? fmt(r.tarifa, 2) : '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(r.rs)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, borderTop: `2px solid ${NX.texto}`, paddingTop: 10, marginTop: 2 }}>
              <span>Total</span><span>{brl(custosHoje?.custos?.custo_total)}</span>
            </div>
            <span style={{ fontSize: 13, color: NX.mudo }}>
              {fmt(consumo?.energia_total_kwh, 0)} kWh · demanda máxima {demandaMax != null ? `${fmt(demandaMax, 1)} kW` : '—'}
            </span>
          </>
        )}
        {custosHoje?.aviso && <span style={{ fontSize: 13, color: NX.warn }}>{custosHoje.aviso}</span>}
        <button type="button" onClick={() => setCustosAberto(false)} style={{ height: 44, borderRadius: 12, background: NX.acao, color: '#FFFFFF', fontWeight: 800, textAlign: 'center', marginTop: 8 }}>Fechar</button>
      </NxDialog>
    </NxShell>
  );
}

export default DisjuntorSheet;
