import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { iotApiService } from '@/services/iot.services';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { useUserStore } from '@/store/useUserStore';
import { MSG_SOMENTE_LEITURA } from '@/store/papeis';
import { useDados, getPath, fmt, tsInfo } from './sheetParts';
import { useCustos, linhasPosto, brl, unwrap, useHistorico, janela, bucketize, type Periodo } from './equipUi';
import { curveMonotoneX } from '@visx/curve';
import { LineChart } from '@/components/charts/line-chart';
import { Line } from '@/components/charts/line';
import { Grid } from '@/components/charts/grid';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { corSerie } from '@/components/graficos/cores';
import { linhasDeBuckets } from '@/components/graficos/linhas-de-buckets';
import { EixoTempo } from '@/components/graficos/eixo-tempo';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { diasEntre, mediasPorDia, linhasPorDia, type LinhaDia } from '@/components/graficos/barras-por-dia';
import {
  NX, s, NxShell, NxDialog, NxDialogButtons, NxSwitchRow, IcoChevron, IcoLixo, IcoCheck2, type NxTone,
} from './nxMock';
import {
  IrrigacaoAvancada, CONFIG_PADRAO, arco, resumoConfig, previsao, textoProgramacao, ehParado,
  type ConfigIrrigacao, type EnvioIrrigacao, type FaixaCanhao, type Parada, type Programacao, type NovaProgramacao, type AbaIrrigacao,
  DIRECAO_LABEL, fmtPct, paradaValida,
} from './PivoIrrigacao';
import { usePivoLayout, PIVO_LAYOUTS } from './pivoLayout';
import type { AgendaItem, ItemPlanilha } from './pivoAgendaPlanilha';
import { PainelRapido, AtalhosRapidos, rascunhoDe, mudancas, envioDoRascunho, mesmaParada, type Rascunho } from './PivoRapido';
import { corpo, erroMsg, col, secao, Linha } from './pivoPartes';
import { CalibracaoPivo } from './PivoCalibracao';

/**
 * Modal do Pivô — cópia 1:1 do mockup "Web — Modal do Pivô" (NEXON-5), sobre a operação
 * em SEQUÊNCIA com o bombeamento (docs/IOT-PIVO-BOMBEAMENTO.md): "Ligar" faz o backend
 * ligar a bomba, confirmar, esperar a pressurização e só então girar; "Desligar" para o
 * pivô e desliga a bomba se nenhum outro pivô dela estiver girando.
 * Dados reais: /pivos/:id/estado, /acionar, /bombeamento, /config, /programacoes,
 * telemetria (/equipamentos/:id/dados), custos por posto e /logs-mqtt. Sem leitura → "—".
 */

type Bin = 0 | 1 | null;
type Acao = 'girar_direita' | 'girar_esquerda' | 'desligar';
interface Passo { t: string; etapa: string; msg: string; ok: boolean | null }
/** Onde está um sinal da bomba/válvula: "TON4v2 · 46:A8" + "BO5" (Topologia IoT). */
interface Saida { ton: string | null; saida: string }
interface Bombeamento {
  ton_id: string; ton_nome: string | null; ton_removida: boolean; modo: 'pulso' | 'mantido';
  bo_liga: number; bo_desliga?: number | null; bi_confirma?: number | null; confirma_s?: number; pulso_ms?: number;
  ligada: Bin; compartilhada_com: string[];
  /** pontos = Ligar/Ligado do pivô na Topologia (o Desligar do pivô para a bomba); legado = TON+BO da Configuração antiga */
  origem?: 'pontos' | 'legado'; dono_nome?: string | null;
  saidas?: { ligar: Saida; desligar: Saida | null; confirma: Saida | null };
}
interface Estado {
  pivo: {
    /** `parado`: dá para ligar a água sem girar (percentímetro em 0 % ou, sem o ponto, só a bomba). Ausente em API antiga. */
    comandos: { direita: boolean; esquerda: boolean; desligar: boolean; percentimetro?: boolean; parado?: boolean }; status: { direita: Bin; esquerda: Bin; desligado: Bin; erro: Bin };
    /** Canhão final: ponto Canhao (botão que alterna) + status Canhao_ligado. Ausente em API antiga. */
    canhao?: { comando: boolean; tem_status: boolean; ligado: Bin };
    /** Chave seletora CLP/TON ligada a uma BI (NEXON-103). 1 = modo TON; null = sem leitura. Ausentes em API antiga. */
    tem_modo_ton?: boolean; modo_ton?: 0 | 1 | null;
  };
  bombeamento: null | Bombeamento;
  /** Sistema conjugado: este pivô usa a bomba de outro */
  bomba_de?: null | { id: string; nome: string | null };
  sequencia_cfg: { pressurizacao_s: number; confirma_giro_s: number; confirma_bomba_s?: number; comandos_mantidos?: boolean };
  sequencia: null | { id: string; acao: string; status: string; passos: Passo[]; erro: string | null; created_at: string; finished_at: string | null; origem?: string };
  /** Reinício (NEXON-98) que não executou: as novas opções NÃO valeram. Ausente em API antiga. */
  reinicio_falhou?: null | { erro: string; em: string };
  /** Desligar de irrigação parada que não desligou a bomba: a irrigação segue em curso. Ausente em API antiga. */
  desligar_falhou?: null | { erro: string; em: string };
  /** Automação do servidor (programação, agendamento, parada, ponta). Ausente em API antiga. */
  irrigacao?: {
    ativa: boolean; atual: IrrigacaoSrv | null; parar_em: string | null; ultima: IrrigacaoSrv | null;
    agendada: null | { id: string; acao: string; irrigacao: IrrigacaoSrv | null; inicio_em: string };
    pausada_ponta: null | { retoma_as: string };
    bomba_em_uso_por: string | null;
  };
  /** Posição do pivô (encoder ou telemetria). Ausente em API antiga. */
  posicao?: {
    fonte: 'encoder' | 'telemetria'; angulo: number | null; angulo_sem_zero: number | null; bruto: number | null;
    lido_em: string | null; motivo: string | null;
    encoder: { equipamento_id: string; resolucao: number | null; invertido: boolean; zero: number } | null;
    /** Pivô com encoder e nenhuma calibração ativa: `angulo` vem null e só o `bruto` vale (NEXON-103). Ausente em API antiga. */
    sem_calibracao?: boolean;
    /** Calibração vigente (aba Calibração): zero e sentido do encoder vêm dela. Ausente em API antiga. */
    calibracao?: { id: string; az_cal: number; bruto_cal: number; sentido: 1 | -1; criado_em: string } | null;
  };
}
interface IrrigacaoSrv { modo: string; config: ConfigIrrigacao; parada: Parada; programacao?: { nome: string } | null }
interface Janela { ativo: boolean; inicio: string; fim: string; dias: number[] }
interface ParametrosPivo {
  pressao_minima: number | null; lamina_100: number | null; tempo_volta_100: number | null; percentimetro_ciclo_s?: number | null; correcao_angulo_zero: number | null;
  direcionamento: 'valvula' | 'fisico'; valvula_ton_id: string | null; valvula_bo: number | null;
  encoder_equipamento_id?: string | null; encoder_resolucao?: number | null; encoder_invertido?: boolean;
  /** Alarme de pivô travado (min): girando com o ângulo parado por este tempo. Vazio = 10. */
  travado_min?: number | null;
}
/** Encoders da instalação (criados pelo diagrama IoT) com a última contagem lida. */
interface OpcaoEncoder { id: string; nome: string; bruto: number | null; lido_em: string | null }
/** Resoluções da Série 67 (código de compra): 9, 11, 12 e 13 bits. */
const RESOLUCOES_ENCODER = [360, 2048, 4096, 8192];
/** Contagem → ângulo antes do zero (mesma conta do servidor, pivo-posicao.util). */
const anguloSemZero = (bruto: number, res: number, inv: boolean) => {
  const g = ((((Math.round(bruto) % res) + res) % res) * 360) / res;
  return inv ? (360 - g) % 360 : g;
};
const norm360 = (g: number) => ((g % 360) + 360) % 360;
interface PivoConfig {
  bloqueio_ponta: Janela; reservado: Janela; origem_ponta: { numero_uc?: string; concessionaria?: string } | null;
  parametros?: ParametrosPivo; unidade_nome?: string | null; planta_nome?: string | null; proprietario_nome?: string | null;
}
/** Pivôs da planta com a bomba ligada na Topologia (para o sistema conjugado). */
interface Opcoes { bombas: Array<{ pivo_id: string; nome: string }> }

const ACAO_LABEL: Record<Acao, string> = { girar_direita: 'Ligar · Direita', girar_esquerda: 'Ligar · Esquerda', desligar: 'Desligar' };
const VERDE = '#1F7A43';

function usePivoEstado(id: string) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() =>
    api.get(`/pivos/${id}/estado`).then((r) => { setEstado(corpo<Estado>(r)); setErro(null); }).catch((e) => setErro(erroMsg(e))), [id]);
  const executando = estado?.sequencia?.status === 'executando';
  useEffect(() => {
    void carregar();
    const t = setInterval(carregar, executando ? 1500 : 10000);
    return () => clearInterval(t);
  }, [carregar, executando]);
  return { estado, erro, carregar, executando };
}

/** Programação de horários (/pivos/:id/programacoes) — mesma lista na Configuração e na aba Agenda. */
function useProgramacoes(pivoId: string) {
  const [progs, setProgs] = useState<Programacao[] | null>(null);
  const carregar = useCallback(() => {
    api.get(`/pivos/${pivoId}/programacoes`).then((r) => setProgs(corpo<Programacao[]>(r) ?? [])).catch(() => setProgs([]));
  }, [pivoId]);
  useEffect(() => { carregar(); }, [carregar]);
  const remover = async (pid: string) => {
    try { await api.delete(`/pivos/${pivoId}/programacoes/${pid}`); carregar(); toast.success('Horário removido'); }
    catch (e) { toast.error('Não removeu', { description: erroMsg(e) }); }
  };
  const salvar = async (p: NovaProgramacao) => {
    try { await api.post(`/pivos/${pivoId}/programacoes`, p); carregar(); toast.success('Agendamento salvo'); return true; }
    catch (e) { toast.error('Não salvou', { description: erroMsg(e) }); return false; }
  };
  // Agenda por data (planilha, NEXON-98): de hoje em diante. API antiga (sem a rota) → lista vazia.
  const [agenda, setAgenda] = useState<AgendaItem[] | null>(null);
  const carregarAgenda = useCallback(() => {
    api.get(`/pivos/${pivoId}/agenda`).then((r) => setAgenda(corpo<{ itens?: AgendaItem[] }>(r)?.itens ?? [])).catch(() => setAgenda([]));
  }, [pivoId]);
  useEffect(() => { carregarAgenda(); }, [carregarAgenda]);
  const removerQualquer = async (pid: string) => { await remover(pid); carregarAgenda(); };
  /** Devolve null se gravou, ou o motivo da recusa (a API recusa a planilha inteira e diz as linhas). */
  const importarAgenda = async (itens: ItemPlanilha[], substituir: boolean): Promise<string | null> => {
    try {
      const r = corpo<{ gravados?: number; removidos?: number }>(await api.post(`/pivos/${pivoId}/agenda/importar`, { itens, substituir }));
      carregarAgenda();
      toast.success(`Agenda gravada: ${r?.gravados ?? itens.length} irrigações`, { description: substituir && r?.removidos ? `Substituiu ${r.removidos} que estavam agendadas.` : 'O servidor liga o pivô em cada dia e hora.' });
      return null;
    } catch (e) {
      return erroMsg(e);
    }
  };
  const limparAgenda = async () => {
    try {
      const r = corpo<{ removidos?: number }>(await api.delete(`/pivos/${pivoId}/agenda`));
      carregarAgenda();
      toast.success(`Agenda por data apagada (${r?.removidos ?? 0})`);
    } catch (e) { toast.error('Não apagou', { description: erroMsg(e) }); }
  };
  return { progs, remover: removerQualquer, salvar, agenda, importarAgenda, limparAgenda };
}

/** Abaixo de 760 px a grade de 2 colunas vira 1. */
function useEstreito(max = 759) {
  const q = `(max-width: ${max}px)`;
  const [v, setV] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setV(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return v;
}

// ------------------------------------------------------------------ mapa
const pt = (cx: number, cy: number, r: number, a: number) => {
  const t = (a * Math.PI) / 180;
  return [Math.round((cx + r * Math.sin(t)) * 10) / 10, Math.round((cy - r * Math.cos(t)) * 10) / 10];
};
const setorD = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const span = (((a1 - a0) % 360) + 360) % 360;
  const p0 = pt(cx, cy, r, a0), p1 = pt(cx, cy, r, a0 + span);
  return `M${cx} ${cy} L${p0[0]} ${p0[1]} A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${p1[0]} ${p1[1]} Z`;
};

/**
 * Desenho do pivô (NEXON-103, seção 4.4): norte fixo no topo, braço girado `angulo` graus no
 * sentido horário. Girando: braço branco com a seta do sentido na ponta (tangente ao círculo,
 * para onde o braço vai). Parado: braço cinza, sem seta. Sem leitura válida: "—°" e sem braço
 * (nunca o último valor). Sem calibração: sem braço, só a leitura bruta com aviso.
 * O braço é desenhado por coordenada, sem animação: a virada 359° → 0° não dá a volta.
 */
export function MapaPivo({ angulo: anguloLido, aviso, girando, falha, sentido, direcao, faixas, semCalibracao = false, bruto = null }: {
  angulo: number | null; aviso?: string | null; girando: boolean; falha: boolean; sentido: 'direita' | 'esquerda' | null; direcao: string; faixas: FaixaCanhao[];
  /** Pivô com encoder e sem calibração ativa: não há ângulo, só a contagem do encoder. */
  semCalibracao?: boolean;
  /** Leitura bruta ATUAL do encoder (null se velha ou ausente), para o aviso de sem calibração. */
  bruto?: number | null;
}) {
  const angulo = semCalibracao ? null : anguloLido;
  const a = angulo ?? 0;
  const arm = pt(179, 150, 118, a);
  const setor = sentido === 'esquerda' ? setorD(179, 150, 118, a - 47, a) : setorD(179, 150, 118, a, a + 47);
  // Seta só com o comando de giro ativo: ponta 13° à frente do braço, no sentido do movimento.
  // (a cor do braço segue `girando`; o lado só decide a seta — pivô sem BI de sentido gira sem seta)
  const emGiro = girando && angulo != null;
  const lado = emGiro ? (sentido === 'direita' ? 1 : sentido === 'esquerda' ? -1 : 0) : 0;
  const seta = lado ? [pt(179, 150, 110, a + lado * 13), pt(179, 150, 118, a + lado * 3), pt(179, 150, 102, a + lado * 3)] : null;
  const avisoTxt = semCalibracao
    ? bruto != null ? `Sem calibração · leitura bruta ${bruto}` : `Sem calibração · ${aviso && !/^sem calibra/i.test(aviso) ? aviso : 'sem leitura atual do encoder'}`
    : aviso ? `Posição indisponível: ${aviso}` : null;
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', position: 'relative', height: 300, background: '#26301F' }}>
      <svg viewBox="0 0 358 300" width="100%" height="300" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }} role="img"
        aria-label={angulo != null
          ? `Mapa do pivô, ângulo atual ${fmt(angulo, 1)} graus, ${lado ? `girando no sentido ${lado > 0 ? 'horário' : 'anti-horário'}` : emGiro ? 'girando' : 'parado'}`
          : semCalibracao ? 'Mapa do pivô, sem calibração do ângulo' : 'Mapa do pivô, ângulo não informado'}>
        <rect x="0" y="0" width="358" height="300" fill="#2B3523" />
        <path d="M0 230 C60 210 90 270 150 300 L0 300 Z" fill="#1F2A1A" />
        <path d="M250 0 C270 40 320 50 358 40 L358 0 Z" fill="#5A4E35" opacity="0.6" />
        <circle cx="-10" cy="50" r="90" fill="#3A4730" />
        <circle cx="365" cy="230" r="100" fill="#3E4B33" />
        <circle cx="179" cy="150" r="118" fill="#5B5A3C" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        <path d={(girando || falha) && angulo != null ? setor : 'M0 0'} fill={falha ? 'rgba(229,88,79,0.45)' : 'rgba(114,191,74,0.5)'} />
        {faixas.map((f) => <path key={f.id} d={arco(179, 150, 125, f.liga, ((f.desliga - f.liga) % 360 + 360) % 360)} fill="none" stroke="#70C04B" strokeWidth="3" strokeLinecap="round" />)}
        {angulo != null && <line data-braco={emGiro ? 'girando' : 'parado'} x1="179" y1="150" x2={arm[0]} y2={arm[1]} stroke={emGiro ? '#FFFFFF' : '#A9ADBC'} strokeWidth="3" strokeLinecap="round" />}
        {seta && <path data-seta={lado > 0 ? 'direita' : 'esquerda'} d={`M${seta[0][0]} ${seta[0][1]} L${seta[1][0]} ${seta[1][1]} L${seta[2][0]} ${seta[2][1]} Z`} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />}
        <circle cx="179" cy="150" r="4" fill="#FFFFFF" />
        <path d="M173 22 L185 22 L179 32 Z" fill="#FFFFFF" />
      </svg>
      <div style={{ position: 'absolute', top: 12, left: 12, height: 30, padding: '0 12px', borderRadius: 15, background: 'rgba(14,14,34,0.75)', color: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700 }}>
        {angulo != null ? `${fmt(angulo, 1)}°` : '—°'} · {direcao}
      </div>
      {avisoTxt && (
        <div role="status" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(14,14,34,0.75)', color: '#FFFFFF', fontSize: 12, fontWeight: 600 }}>
          {avisoTxt}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- gráfico
const kw = (v: unknown) => { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) ? null : Math.abs(n) > 1000 ? n / 1000 : n; };
/** Séries do gráfico (total do pivô e bomba), cores da sequência do tema. */
const SERIES = [
  { id: 'total', label: 'Total', color: corSerie(0), pick: (d: Record<string, unknown>) => kw(d?.Pt ?? d?.['power.active_total']) },
  { id: 'bomba', label: 'Bomba', color: corSerie(1), pick: (d: Record<string, unknown>) => kw(getPath(d, 'bomba.Pt') ?? d?.bomba_Pt ?? getPath(d, 'bomba.potencia') ?? d?.bomba_potencia) },
];

function GraficoPotencia({ equipamentoId, resumo, titulo = 'Gráfico de potência' }: { equipamentoId: string; resumo: string; titulo?: string }) {
  const [open, setOpen] = useState(false);
  const [per, setPer] = useState<Periodo>('hoje');
  // `fimBusca` entra no memo: um `new Date()` solto no render mudava a cada render e refazia a busca em loop.
  const [ini, fim, fimBusca] = useMemo(() => {
    const [a, b] = janela(per);
    if (per === 'hoje') { const e = new Date(a); e.setDate(e.getDate() + 1); return [a, e, new Date()]; }
    return [a, b, b];
  }, [per, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pts, loading } = useHistorico(equipamentoId, ini, fimBusca, open);
  const N = per === 'hoje' ? 96 : per === 'semana' ? 168 : 180;
  const linhas = useMemo(() => {
    if (!pts) return null;
    // Hoje = linha (média a cada 15 min); Semana e Mês = barras, uma por dia (NEXON-99).
    if (per !== 'hoje') {
      const dias = diasEntre(ini, fim);
      const barras: LinhaDia[] = linhasPorDia(dias, mediasPorDia(pts, dias, Object.fromEntries(SERIES.map((x) => [x.id, x.pick]))));
      const vazio = !barras.some((l) => SERIES.some((x) => l[`${x.id}Bruto`] != null));
      return { rows: [], barras, vazio };
    }
    const series: Record<string, Array<number | null>> = {};
    SERIES.forEach((x) => { series[x.id] = bucketize(pts, ini.getTime(), fim.getTime(), N, x.pick); });
    const rows = linhasDeBuckets(ini.getTime(), fim.getTime(), series);
    return { rows, barras: null, vazio: rows.length === 0 };
  }, [pts, ini, fim, N, per]);
  const valorTxt = (p: Record<string, unknown>, id: string) => { const b = p[`${id}Bruto`]; return typeof b === 'number' ? `${fmt(b, 1)} kW` : '—'; };
  const aba = (sel: boolean): CSSProperties => ({ height: 30, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', ...(sel ? { background: NX.card } : { color: NX.mudo }) });

  return (
    <div style={{ ...s.card, padding: '0 16px' }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={VERDE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l5-6 4 3 5-7 4 4" /><path d="M3 21h18" /></svg>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{titulo}</span>
        <span style={{ fontSize: 13, color: NX.mudo }}>{resumo}</span>
        <IcoChevron size={18} style={{ transition: 'transform .15s', transform: `rotate(${open ? 180 : 0}deg)` }} />
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${NX.linha2}`, padding: '12px 0 16px 0', ...col(8) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: NX.seg }}>
              {(['hoje', 'semana', 'mes'] as const).map((p) => (
                <button key={p} type="button" aria-pressed={per === p} onClick={() => setPer(p)} style={aba(per === p)}>{p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : 'Mês'}</button>
              ))}
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: NX.mudo }}>
              {SERIES.map((x) => (
                <span key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 3, background: x.color, borderRadius: 2 }} />{x.label}</span>
              ))}
              <button type="button" aria-label="Escolher grandezas do gráfico" style={{ width: 32, height: 32, borderRadius: 16, background: NX.seg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={VERDE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
              </button>
            </span>
          </div>
          {linhas?.vazio && !loading ? (
            <div style={{ height: 170, display: 'grid', placeItems: 'center', fontSize: 13, color: NX.mudo }}>Sem leituras no período</div>
          ) : (
            <div style={{ height: 170, display: 'flex', flexDirection: 'column' }} role="img" aria-label="Potência do pivô e da bomba">
              {per !== 'hoje' ? (
              <BarChart data={linhas?.barras ?? []} xDataKey="rotulo" aspectRatio="auto" className="min-h-0 flex-1" margin={{ top: 8, right: 12, bottom: 24, left: 56 }} barGap={0.25} animationDuration={0}>
                <Grid horizontal numTicksRows={4} />
                {SERIES.map((x) => <Bar key={x.id} dataKey={x.id} fill={x.color} lineCap={3} />)}
                <BarXAxis maxLabels={per === 'semana' ? 7 : 10} />
                <YAxis numTicks={4} formatValue={(v) => `${fmt(v, Number.isInteger(v) ? 0 : 1)} kW`} />
                <ChartTooltip showDatePill={false} showCrosshair={false} showDots={false} rows={(p) => SERIES.map((x) => ({ color: x.color, label: `${x.label} (média)`, value: valorTxt(p, x.id) }))} />
              </BarChart>
              ) : (<>
              <LineChart data={linhas?.rows ?? []} xDomain={[ini, fim]} aspectRatio="auto" className="min-h-0 flex-1" margin={{ top: 8, right: 12, bottom: 6, left: 56 }} animationDuration={0}
                status={loading || !linhas ? 'loading' : 'ready'} loadingLabel="Carregando…">
                <Grid horizontal numTicksRows={4} />
                {SERIES.map((x, i) => <Line key={x.id} dataKey={x.id} stroke={x.color} strokeWidth={i ? 2 : 2.2} curve={curveMonotoneX} fadeEdges={false} animate={false} />)}
                <YAxis numTicks={4} formatValue={(v) => `${fmt(v, Number.isInteger(v) ? 0 : 1)} kW`} />
                <ChartTooltip showDots rows={(p) => SERIES.map((x) => ({ color: x.color, label: x.label, value: valorTxt(p, x.id) }))} />
              </LineChart>
              <EixoTempo ini={ini} fim={fim} margemEsq={56} margemDir={12} formato="hora" />
              </>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ------------------------------------------------------------- registros
interface LogMqtt { id: string; mensagem?: string | null; severidade?: string | null; created_at?: string; regra?: { nome?: string | null } | null }
interface Reg { t: number; txt: string; quem: string; ok?: boolean; ruim?: boolean }

function RegistrosPivo({ equipamentoId, extra, estreito }: { equipamentoId: string; extra: Reg[]; estreito: boolean }) {
  const [rows, setRows] = useState<LogMqtt[] | null>(null);
  useEffect(() => {
    let vivo = true;
    api.get('/logs-mqtt', { params: { equipamentoId, limit: 6, page: 1 } })
      .then((r) => { if (vivo) { const d = unwrap<LogMqtt[] | { data?: LogMqtt[] }>(r); setRows(Array.isArray(d) ? d : d?.data ?? []); } })
      .catch(() => { if (vivo) setRows([]); });
    return () => { vivo = false; };
  }, [equipamentoId]);
  const todos: Reg[] = useMemo(() => [
    ...extra,
    ...(rows ?? []).map((l) => {
      const sev = String(l.severidade ?? '').toUpperCase();
      return { t: l.created_at ? new Date(l.created_at).getTime() : 0, txt: l.mensagem ?? l.regra?.nome ?? 'Evento', quem: l.regra?.nome ?? 'Sistema', ruim: sev === 'CRITICA' || sev === 'CRÍTICA' || sev === 'ALTA' };
    }),
  ].sort((x, y) => y.t - x.t).slice(0, Math.max(6, extra.length)), [rows, extra]);
  const grade = estreito ? '84px 1fr 96px 24px' : '120px 1fr 160px 28px';
  const gap = estreito ? 8 : 12;
  return (
    <div style={{ ...s.card, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Registros</span>
        <Link to={`/logs/logs-mqtt?equipamentoId=${encodeURIComponent(equipamentoId)}`} style={{ fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Ver todos ›</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: grade, gap, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, borderTop: `1px solid ${NX.linha2}` }}>
        <span>DATA/HORA</span><span>EVENTO</span><span>ORIGEM</span><span />
      </div>
      {rows == null && !extra.length ? (
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>Carregando…</div>
      ) : todos.length === 0 ? (
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>Nenhum registro deste equipamento.</div>
      ) : todos.map((l, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: grade, gap, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, ...(l.ruim ? { background: 'rgba(197,48,48,0.06)' } : {}) }}>
          <span style={{ fontSize: 13, color: NX.mudo, fontVariantNumeric: 'tabular-nums' }}>
            {l.t ? new Date(l.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—'}
          </span>
          <span style={{ fontSize: 14, color: l.ruim ? NX.bad : NX.texto, ...(l.ruim ? { fontWeight: 700 } : {}) }}>{l.txt}</span>
          <span style={{ fontSize: 13, color: NX.mudo, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.quem}</span>
          <span style={{ display: 'flex', justifyContent: 'center' }}>{l.ok && <IcoCheck2 />}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ modal
const kpiCel = (i: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, ...(i % 3 ? { borderLeft: `1px solid ${NX.linha}` } : {}) });
const chaveParada = (id: string) => `nexon:pivo:ultima-parada:${id}`;

/**
 * Perfis (spec NEXON-20, PER-33/34/36): configuração TÉCNICA (bombeamento,
 * pressão, tempo de volta, ângulo zero, direcionamento/válvula, sequência) só
 * Admin e analistas; OPERACIONAL (lâmina, ponta, programação) também o
 * proprietário e o operador; comandar: todos esses (operador só nos liberados —
 * a API confere de novo).
 */
function usePerfilPivo() {
  const capacidades = useUserStore((st) => st.capacidades);
  return {
    tecnico: capacidades.configTecnica,
    operacional: capacidades.configOperacional,
    comandar: capacidades.comandar,
    verNomeProprietario: capacidades.verNomeProprietario,
  };
}

export function PivoSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const id = equipamentoId.trim();
  const titulo = nome || 'Pivô';
  const estreito = useEstreito();
  const perfil = usePerfilPivo();
  // Medição elétrica: o medidor do IoT vinculado a este pivô (Vínculos → Medições; ex.: PM da
  // bomba na TON4 do pivô, fora do unifilar). Sem vínculo, a telemetria do próprio pivô.
  const [fonteMedicao, setFonteMedicao] = useState<string | null>(null);
  const [nomeMedicao, setNomeMedicao] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setFonteMedicao(null); setNomeMedicao(null);
    iotApiService.powerMeterByDisjuntor(id)
      .then((r) => { if (vivo && r?.equipamento_id) { setFonteMedicao(r.equipamento_id.trim()); setNomeMedicao(r.nome ?? null); } })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, [id]);
  // O PM vinculado mede a BOMBA (pivô 3 e 11 dividem a mesma → mesmo PM): elétrica vem dele,
  // ângulo/pressão/horímetro vêm da telemetria do próprio pivô. Sem PM, tudo do pivô.
  const idMedicao = fonteMedicao ?? id;
  const { dados, ts } = useDados(id);
  const { dados: dadosPm, ts: tsPm } = useDados(fonteMedicao);
  const { estado, erro, carregar, executando } = usePivoEstado(id);
  const prog = useProgramacoes(id);
  const [aba, setAba] = useState('op');
  const [modal, setModal] = useState<null | 'cost' | 'irr'>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // stop = desligar · start = ligar pelo Planejamento · restart = pivô ligado reinicia com as
  // novas opções · live = só o percentímetro mudou (a TON troca sem desligar).
  const [confirmKind, setConfirmKind] = useState<'stop' | 'start' | 'restart' | 'live'>('start');
  // Layout em teste só para quem configura (admin e analista): o cliente final fica no Modal.
  const layoutSalvo = usePivoLayout((x) => x.layout);
  const layout = perfil.tecnico ? layoutSalvo : 'modal';
  const [irrAba, setIrrAba] = useState<AbaIrrigacao>('simples');
  const [envio, setEnvio] = useState<EnvioIrrigacao | null>(null);
  // Última irrigação enviada por este navegador (a TON só recebe direção e liga/desliga).
  const chaveUltima = `nexon:pivo:ultima:${id}`;
  const [ultima, setUltima] = useState<ConfigIrrigacao>(() => {
    try { const v = localStorage.getItem(chaveUltima); return v ? { ...CONFIG_PADRAO, ...JSON.parse(v) } : CONFIG_PADRAO; } catch { return CONFIG_PADRAO; }
  });
  const [ultimaParada, setUltimaParada] = useState<Parada>(() => {
    try { const v = localStorage.getItem(chaveParada(id)); return v ? JSON.parse(v) : { tipo: 'semParar' }; } catch { return { tipo: 'semParar' }; }
  });
  // A última irrigação gravada no servidor vale para qualquer navegador/app.
  const ultimaSrv = estado?.irrigacao?.ultima;
  useEffect(() => {
    if (!ultimaSrv?.config) return;
    setUltima({ ...CONFIG_PADRAO, ...ultimaSrv.config, faixasCanhao: ultimaSrv.config.faixasCanhao ?? [] });
    const p = ultimaSrv.parada;
    if (p) setUltimaParada(p);
  }, [ultimaSrv]);
  const [cfgPivo, setCfgPivo] = useState<PivoConfig | null>(null);
  const carregarCfg = useCallback(() => {
    api.get(`/pivos/${id}/config`).then((r) => setCfgPivo(corpo<PivoConfig>(r) ?? null)).catch(() => setCfgPivo(null));
  }, [id]);
  useEffect(() => { carregarCfg(); }, [carregarCfg]);
  const ponta = cfgPivo?.bloqueio_ponta ?? null;
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [canhaoEnv, setCanhaoEnv] = useState(false);
  const [percTxt, setPercTxt] = useState<string | null>(null);   // edição do % com o pivô girando
  const [percEnv, setPercEnv] = useState(false);
  const [custoPer, setCustoPer] = useState<'dia' | 'mes'>('dia');

  const g = (p: string) => getPath(dados, p);
  const num = (...ps: string[]) => { for (const p of ps) { const v = g(p); if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v); } return null; };
  // Elétrica: do PM da bomba quando vinculado; senão da telemetria do pivô.
  const ge = (p: string) => getPath(fonteMedicao ? dadosPm : dados, p);
  const numE = (...ps: string[]) => { for (const p of ps) { const v = ge(p); if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v); } return null; };
  const maisRecente = [ts, tsPm].filter((x): x is string => !!x).sort((a, c) => new Date(a).getTime() - new Date(c).getTime()).pop() ?? null;
  const info = tsInfo(maisRecente);
  const ptKw = kw(ge('Pt') ?? ge('power.active_total'));

  const st = estado?.pivo.status;
  const b = estado?.bombeamento ?? null;
  const seq = estado?.sequencia ?? null;
  const irrSrv = estado?.irrigacao;
  const semStatus = st?.direita == null && st?.esquerda == null && st?.desligado == null;
  // Sem BI de status na TON: vale o que o servidor comandou (sequência concluída e não desligada).
  // Irrigando PARADO só com a bomba (pivô sem percentímetro): o status diz "parado" de propósito;
  // quem diz que está ligado é o servidor (irrigacao.ativa com `semGiro`).
  const irrigandoParado = !!irrSrv?.ativa && irrSrv.atual?.config.semGiro === true && seq?.status !== 'executando';
  const girando = st?.direita === 1 || st?.esquerda === 1 || (semStatus && !!irrSrv?.ativa && seq?.status !== 'executando') || irrigandoParado;
  const cfgAtual = irrSrv?.atual?.config ?? null;
  const sentido: 'direita' | 'esquerda' | null = st?.direita === 1 ? 'direita' : st?.esquerda === 1 ? 'esquerda'
    : girando && cfgAtual ? (cfgAtual.direcao === 'Avanço' ? 'direita' : 'esquerda') : null;
  const emUsoPor = !girando ? irrSrv?.bomba_em_uso_por ?? null : null;
  const agendada = irrSrv?.agendada ?? null;
  const pausaPonta = irrSrv?.pausada_ponta ?? null;
  const direcaoAtual = sentido === 'direita' ? 'Avanço' : sentido === 'esquerda' ? 'Reverso' : ultima.direcao;
  const cfgGiro = cfgAtual ?? ultima;
  // Posição: a do servidor (encoder convertido, ou telemetria). API antiga: telemetria do pivô.
  // Sem calibração (NEXON-103) não há ângulo: só a leitura bruta do encoder, com aviso. Telemetria
  // velha (API antiga) também não vale: nunca o último valor como se fosse o atual.
  const pos = estado?.posicao;
  const semCalibracao = pos?.sem_calibracao === true;
  const angulo = semCalibracao ? null : pos ? pos.angulo : num('angulo', 'posicao');
  const avisoPosicao = pos?.fonte === 'encoder' && angulo == null ? pos.motivo : null;
  // (idade pela diferença simples: relógio do aparelho atrasado não pode esconder leitura fresca)
  const brutoFresco = !!pos?.lido_em && Date.now() - new Date(pos.lido_em).getTime() < 15 * 60 * 1000;
  const brutoAtual = semCalibracao && pos?.bruto != null && brutoFresco ? pos.bruto : null;
  const angTxt = angulo != null ? `${fmt(angulo, 1)}°` : '—°';
  const ligando = executando && seq?.acao !== 'desligar';
  const on = girando || ligando;
  // Última partida que falhou (nas últimas 6 h) e o pivô parado: falha.
  const falhaSeq = !!seq?.erro && !executando && !girando && Date.now() - new Date(seq.finished_at ?? seq.created_at).getTime() < 6 * 3600000;
  // "Sem permissivo… (bomba, tensão, pressão no painel)" cita pressão mas é falta de permissivo.
  const falhaPermissivo = falhaSeq && /permissivo/i.test(seq?.erro ?? '');
  const falhaPressao = falhaSeq && !falhaPermissivo && /press/i.test(seq?.erro ?? '');
  const falha = st?.erro === 1 || falhaSeq;

  const { tone, label, texto } = ((): { tone: NxTone; label: string; texto: string } => {
    if (executando && seq?.acao === 'desligar') return { tone: 'ok', label: 'Normal', texto: 'Desligando…' };
    // Mostra o passo em que a partida está (ex.: "Aguardando pressurização (120s)").
    if (ligando) return { tone: 'ok', label: 'Normal', texto: seq?.passos?.at(-1)?.msg ?? 'Ligando…' };
    if (falha) return { tone: 'bad', label: 'Falha', texto: falhaPressao ? 'Falha de pressão · Parado' : falhaPermissivo ? 'Sem permissivo para ligar · Parado' : st?.erro === 1 ? 'Falha no painel · Parado' : 'Falha na partida · Parado' };
    if (girando) return { tone: 'ok', label: 'Normal', texto: cfgGiro.semAgua ? `Girando · ${DIRECAO_LABEL[direcaoAtual]} · Seco`
      : ehParado(cfgGiro) && (irrigandoParado || estado?.pivo.comandos.percentimetro) ? 'Irrigando parado · no lugar · Molhado' : `Irrigando · ${fmtPct(cfgGiro.percentual)}% · ${DIRECAO_LABEL[direcaoAtual]} · Molhado` };
    if (pausaPonta) return { tone: 'ok', label: 'Normal', texto: `Pausado pelo horário de ponta · retoma às ${pausaPonta.retoma_as}` };
    if (emUsoPor) return { tone: 'ok', label: 'Normal', texto: `Parado · Bomba em uso pelo ${emUsoPor}` };
    if (st?.desligado === 1 || st?.direita === 0 || st?.esquerda === 0) return { tone: 'ok', label: 'Normal', texto: 'Parado · Painel energizado' };
    if (semStatus && estado) return { tone: 'ok', label: 'Normal', texto: 'Parado' };
    if (!estado && !info.online) return { tone: 'off', label: 'Sem comunicação', texto: info.hasTs ? `Última leitura ${info.idade}` : 'Sem leitura' };
    return { tone: 'warn', label: 'Alerta', texto: 'Status do pivô não lido da TON' };
  })();

  // "Término previsto hoje 22:10 · ângulo final 0°" (parada por ângulo da última irrigação).
  const eta = useMemo(() => {
    if (girando && irrSrv?.parar_em) {
      const f = new Date(irrSrv.parar_em);
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const dias = Math.floor((new Date(f).setHours(0, 0, 0, 0) - d0.getTime()) / 86400000);
      const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
      const p = irrSrv.atual?.parada;
      return `Término previsto ${quando} ${f.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p?.tipo === 'porAngulo' ? ` · ângulo final ${p.angulo}°` : ''}${irrSrv.atual?.programacao ? ` · ${irrSrv.atual.programacao.nome}` : ''}`;
    }
    if (!girando || ultimaParada.tipo !== 'porAngulo' || angulo == null) return null;
    const p = previsao(ultima, ultimaParada, direcaoAtual as ConfigIrrigacao['direcao'], angulo, 21, new Date());
    if (!p.fim) return null;
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const dias = Math.floor((new Date(p.fim).setHours(0, 0, 0, 0) - d0.getTime()) / 86400000);
    const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
    return `Término previsto ${quando} ${p.fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ângulo final ${ultimaParada.angulo}°`;
  }, [girando, ultimaParada, angulo, ultima, direcaoAtual, irrSrv]);
  const agendadaTxt = agendada
    ? `Início agendado ${new Date(agendada.inicio_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${agendada.irrigacao ? ` · ${resumoConfig({ ...CONFIG_PADRAO, ...agendada.irrigacao.config })}` : ''}`
    : null;

  const acaoDe = (c: ConfigIrrigacao): Acao => (c.direcao === 'Avanço' ? 'girar_direita' : 'girar_esquerda');
  // Um comando por vez: duplo clique no Confirmar não manda dois pedidos (o estado só fecha o
  // alerta no próximo render).
  const ocupado = useRef(false);
  const aguarde = () => { toast.message('Aguarde o comando anterior terminar.'); };
  const acionar = async (acao: Acao, irrigacao?: EnvioIrrigacao) => {
    // Desligar nunca fica preso atrás de outro comando (o servidor aceita e interrompe o que
    // estiver rodando); só não repete o próprio Desligar em voo.
    if (acao === 'desligar' ? enviando === 'desligar' : ocupado.current) { if (acao !== 'desligar') aguarde(); setConfirmOpen(false); return; }
    ocupado.current = true;
    setModal(null); setConfirmOpen(false);
    setEnviando(acao);
    try {
      const r = await api.post(`/pivos/${id}/acionar`, irrigacao ? { acao, irrigacao } : { acao });
      const res = corpo<{ status?: string; inicio_em?: string }>(r);
      if (irrigacao) {
        setUltima(irrigacao.config); setUltimaParada(irrigacao.parada);
        try {
          localStorage.setItem(chaveUltima, JSON.stringify(irrigacao.config));
          localStorage.setItem(chaveParada(id), JSON.stringify(irrigacao.parada));
        } catch { /* sem storage */ }
      }
      if (res?.status === 'agendada' && res.inicio_em) {
        toast.success(`Irrigação agendada para ${new Date(res.inicio_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`, { description: 'O servidor liga o pivô na hora — acompanhe em Registros.' });
      } else {
        toast.success(`${ACAO_LABEL[acao]}: sequência iniciada`, { description: irrigacao?.config.semAgua ? 'Girando sem água: a bomba não liga.'
          : irrigacao && ehParado(irrigacao.config) ? 'Parado: a bomba liga e o pivô irriga no lugar — acompanhe em Registros.'
            : b ? 'Bomba, pressurização e giro — acompanhe em Registros.' : undefined });
      }
      setEnvio(null);
      await carregar();
    } catch (e) {
      toast.error(`${ACAO_LABEL[acao]}: não iniciou`, { description: erroMsg(e) });
    } finally {
      ocupado.current = false;
      setEnviando(null);
    }
  };

  // NEXON-98 — pivô ligado + opções novas: o servidor desliga (pivô, canhão, bomba), confirma a
  // parada e liga de novo, numa sequência só (`reiniciar: true`). Se a parada não confirmar, não religa.
  const reiniciar = async (irrigacao: EnvioIrrigacao) => {
    if (ocupado.current) { aguarde(); setConfirmOpen(false); return; }
    ocupado.current = true;
    const acao = acaoDe(irrigacao.config);
    setModal(null); setConfirmOpen(false);
    setEnviando(acao);
    try {
      // manterParada: a Parada não foi mexida → o servidor herda a parada automática em curso
      // (o que falta do tempo/das voltas), em vez de recomeçar ou de apagar a da programação.
      const { manterParada: _tocada, ...irr } = irrigacao;   // sinal da tela, não faz parte da irrigação
      await api.post(`/pivos/${id}/acionar`, { acao, irrigacao: { ...irr, inicio: null }, reiniciar: true, manterParada: mantemParada(irrigacao) });
      setUltima(irrigacao.config); setUltimaParada(irrigacao.parada);
      try {
        localStorage.setItem(chaveUltima, JSON.stringify(irrigacao.config));
        localStorage.setItem(chaveParada(id), JSON.stringify(irrigacao.parada));
      } catch { /* sem storage */ }
      toast.success('Reinício com as novas opções iniciado', { description: 'O pivô desliga e liga de novo — acompanhe em Registros.' });
      setEnvio(null); setRasc(null);
      await carregar();
    } catch (e) {
      toast.error('Não reiniciou — o pivô segue como estava', { description: erroMsg(e) });
    } finally {
      ocupado.current = false;
      setEnviando(null);
    }
  };

  // Canhão pela ficha: o backend confere o estado (Canhao_ligado) e só pulsa se for diferente.
  const comandarCanhao = async (ligar: boolean) => {
    setCanhaoEnv(true);
    try {
      await api.post(`/pivos/${id}/canhao`, { ligar });
      toast.success(ligar ? 'Canhão ligado' : 'Canhão desligado');
    } catch (e) {
      toast.error(ligar ? 'Canhão não ligou' : 'Canhão não desligou', { description: erroMsg(e) });
    } finally {
      setCanhaoEnv(false);
      await carregar();
    }
  };

  // Percentímetro com o pivô girando: a TON troca no próximo ciclo, sem desligar.
  const ajustarPerc = async (percentual: number) => {
    if (ocupado.current) { aguarde(); return; }
    ocupado.current = true;
    setPercEnv(true);
    try {
      await api.post(`/pivos/${id}/percentimetro`, { percentual });
      toast.success(`Percentímetro em ${fmtPct(percentual)}%`, { description: 'Vale a partir do próximo ciclo da TON.' });
      setPercTxt(null);
    } catch (e) {
      toast.error('Percentímetro não mudou', { description: erroMsg(e) });
    } finally {
      ocupado.current = false;
      setPercEnv(false);
      await carregar();
    }
  };

  const media = (...ks: string[]) => { const v = ks.map((k) => numE(k)).filter((x): x is number => x != null); return v.length ? v.reduce((a, c) => a + c, 0) / v.length : null; };
  const tensao = media('Vab', 'Vbc', 'Vca') ?? media('Va', 'Vb', 'Vc');
  const corrente = media('Ia', 'Ib', 'Ic');
  const kpis: Array<{ k: string; v: string; nota?: string | null }> = [
    { k: 'Ângulo', v: angTxt, nota: semCalibracao ? (brutoAtual != null ? `Sem calibração · bruto ${brutoAtual}` : 'Sem calibração') : null },
    { k: 'Pressão', v: num('pressao') != null ? `${fmt(num('pressao'), 1)} bar` : '—' },
    { k: 'Horímetro', v: num('horimetro') != null ? `${fmt(num('horimetro'), 0)} h` : '—' },
    // Elétrica no card do pivô só quando NÃO há PM da bomba (aí ela fica no Bombeamento).
    ...(fonteMedicao ? [] : [
      { k: 'Tensão', v: tensao != null ? `${fmt(tensao, 0)} V` : '—' },
      { k: 'Potência total', v: ptKw != null ? `${fmt(ptKw, 1)} kW` : '—' },
      { k: 'Corrente pivô', v: corrente != null ? `${fmt(corrente, 1)} A` : '—' },
    ]),
  ];
  const bNum = (...ks: string[]) => numE(...ks.map((k) => `bomba.${k}`), ...ks.map((k) => `bomba_${k}`));
  // Sem medição própria da bomba (bomba.*), vale o PM vinculado ao pivô (mesmo das tensões).
  // FP só com carga: com corrente zero o PM reporta 0,999, que não quer dizer nada.
  const bPt = bNum('Pt', 'potencia') != null ? kw(bNum('Pt', 'potencia')) : ptKw;
  const stVa = numE('St');
  const bFp = bNum('FPt', 'fp') ?? (stVa ? Math.min(1, Math.abs(Number(ge('Pt'))) / stVa) : null);
  const bCorr = corrente;
  const bKpis = [
    { k: 'Pressão recalque', v: bNum('pressao') != null ? `${fmt(bNum('pressao'), 1)} bar` : null },
    { k: 'Potência', v: bPt != null ? `${fmt(bPt, 1)} kW` : '—' },
    { k: 'FP', v: bFp != null ? fmt(bFp, 2) : bPt === 0 ? 'sem carga' : '—' },
    { k: 'Corrente média', v: bCorr != null ? `${fmt(bCorr, 1)} A` : '—' },
    { k: 'Temp. motor', v: bNum('temperatura') != null ? `${fmt(bNum('temperatura'), 0)} °C` : null },
    { k: 'Horímetro', v: bNum('horimetro') != null ? `${fmt(bNum('horimetro'), 0)} h` : null },
    { k: 'Partidas', v: bNum('partidas') != null ? fmt(bNum('partidas'), 0) : null },
  ].filter((k): k is { k: string; v: string } => k.v != null);
  // Tensão de linha (Vab…) quando o medidor manda; senão fase-neutro (Va…) com rótulo A/B/C.
  const fases: Array<[string, string, string]> = (['a', 'b', 'c'] as const).map((f) => {
    const ff = { a: 'Vab', b: 'Vbc', c: 'Vca' }[f];
    const vl = bNum(ff) ?? numE(ff), v = vl ?? numE(`V${f}`), i = bNum(`I${f}`) ?? numE(`I${f}`);
    return [vl != null ? ff.slice(1).toUpperCase() : f.toUpperCase(), v != null ? `${fmt(v, 0)} V` : '—', i != null ? `${fmt(i, 1)} A` : '—'];
  });
  const bStatus = !b ? '—' : falhaPressao ? 'Desligada · falha de pressão' : emUsoPor ? `Em uso pelo ${emUsoPor}` : b.ligada === 1 ? 'Ligada'
    : b.ligada === 0 ? 'Desligada' : girando && !cfgGiro.semAgua ? 'Ligada' : girando ? 'Desligada · girando sem água' : 'Sem retorno';
  const bCor = !b ? NX.neutro : falhaPressao ? NX.bad : emUsoPor || b.ligada === 1 || (b.ligada == null && girando && !cfgGiro.semAgua) ? NX.ok : NX.neutro;
  const bSub = (!b ? (fonteMedicao ? 'Comando não configurado' : 'Não configurado')
    : `${b.dono_nome ? `bomba do ${b.dono_nome} · ` : ''}${b.ton_nome ?? 'TON'}${b.ton_removida ? ' (removida!)' : ''} · ${b.compartilhada_com.length ? `compartilhada com ${b.compartilhada_com.join(', ')}` : 'ligada junto com o pivô'}`)
    + (nomeMedicao && bNum('Pt', 'potencia') == null ? ` · medição ${nomeMedicao.replace(/_/g, ' ')}` : '');

  // Passos da última sequência entram em Registros (✓✓ = confirmado pelo equipamento).
  const regSeq: Reg[] = useMemo(() => (seq?.passos ?? []).map((p) => ({
    t: new Date(p.t).getTime(), txt: p.msg, quem: p.etapa === 'comando' ? 'Comando' : 'Sistema', ok: p.ok === true, ruim: p.ok === false,
  })), [seq?.passos]);

  // Energia e custo medidos pelo PM da bomba (compartilhado: pivô 3 e 11 mostram o mesmo).
  const { res: custoDia } = useCustos(idMedicao, 'dia');
  const { res: custoSel } = useCustos(idMedicao, custoPer, undefined, modal === 'cost');
  const rotuloEnergia = fonteMedicao ? (b?.compartilhada_com.length ? 'Energia do bombeamento (compartilhado)' : 'Energia do bombeamento') : 'Energia do pivô';

  // Botão principal
  const desligarOff = !estado?.pivo.comandos.desligar && !b;
  // Ligar/deixar PARADO (irriga no lugar): com o ponto Percentímetro (0 %) ou, sem ele, só com a
  // bomba — o servidor não manda girar. É a API que diz se dá (`comandos.parado`); API antiga:
  // só com o percentímetro.
  const podeParado = estado?.pivo.comandos.parado ?? !!estado?.pivo.comandos.percentimetro;
  const lamina100 = cfgPivo?.parametros?.lamina_100 ?? 7.15;
  const busy = !!enviando || (executando && seq?.acao === 'desligar');
  const canhao = estado?.pivo.canhao;
  // Ativar só com o pivô girando com água; desativar sempre (o backend trava se já está desligado).
  const canhaoSeco = girando && !!cfgGiro.semAgua;
  const canhaoOff = canhaoEnv || executando || (canhao?.ligado !== 1 && (!girando || canhaoSeco));
  // Ajuste do % só girando com água e com o ponto Percentimetro na TON.
  const percAtual = cfgAtual && !cfgAtual.semAgua ? cfgAtual.percentual : null;
  const percNovo = percTxt == null ? null : Number(percTxt.replace(',', '.'));
  const percInvalido = percNovo == null || !Number.isFinite(percNovo) || percNovo < 0 || percNovo > 100;
  const percOff = percEnv || executando || percInvalido || percNovo === percAtual;
  // O botão do canhão ALTERNA: sem o Canhao_ligado o NexON não sabe se o pulso liga ou desliga.
  const semCanhaoMotivo = !canhao ? null
    : !canhao.comando ? 'Ligue o ponto Canhao a uma BO (Topologia IoT → Configurar I/O)'
      : !canhao.tem_status ? 'Falta o status Canhao_ligado numa BI: sem ele não dá para saber se o pulso liga ou desliga'
        : null;
  const desligaAgenda = !on && !!agendada;
  // NEXON-98: o botão principal abre o Planejamento de irrigação. Parado → "Ligar" (as opções
  // ficam no diálogo); ligado → "Desligar ou modificar". Só "Cancelar agendamento" confirma direto.
  const semLigar = !estado?.pivo.comandos.direita && !estado?.pivo.comandos.esquerda;
  const cmdLabel = emUsoPor && !on ? `Bomba em uso pelo ${emUsoPor}` : busy ? 'Executando…' : desligaAgenda ? 'Cancelar agendamento' : on ? 'Desligar ou modificar' : 'Ligar';
  const cmdBloq = on ? false : (!!emUsoPor) || (semLigar && !desligaAgenda);
  const cmdStyle = s.cmd(busy || cmdBloq ? 'busy' : on || desligaAgenda ? 'outline' : 'primary');
  const pedirDesligar = () => { setConfirmKind('stop'); setConfirmOpen(true); };

  // Edição rápida na ficha (layouts Painel e Atalhos): rascunho sobre a irrigação em curso.
  const paradaAtual = paradaValida(irrSrv?.atual?.parada);
  // Ligado sem irrigação registrada (ligado no painel, ou um reinício que não executou): a
  // direção em curso é a que a TON lê, nunca a da última enviada — senão "mudar só a água"
  // sairia invertendo o sentido sem o operador pedir.
  const semRegistro = on && !cfgAtual;
  // Sem o ponto Percentímetro o NexON não segura o pivô parado: 0 % registrado nunca vira "Parado".
  const semParado = (c: ConfigIrrigacao): ConfigIrrigacao => (!podeParado && !(c.percentual > 0) ? { ...c, percentual: 100, lamina: null } : c);
  const cfgBase: ConfigIrrigacao = semParado(on ? { ...cfgGiro, direcao: direcaoAtual as ConfigIrrigacao['direcao'] } : cfgGiro);
  const avisoSemRegistro = semRegistro ? 'Pivô ligado fora do NexON: sem irrigação registrada. Confira as opções antes de enviar.' : null;
  // Parada automática em curso (programação por tempo, voltas): o reinício mantém o que falta.
  const paradaSrv = irrSrv?.atual?.parada;
  const paradaAutomatica = on && !!paradaSrv && (paradaSrv.tipo === 'porTempo' || paradaSrv.tipo === 'porVoltas');
  const notaParada = paradaAutomatica
    ? `Parada em curso mantida${irrSrv?.parar_em ? `: término previsto ${new Date(irrSrv.parar_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}${irrSrv?.atual?.programacao ? ` · ${irrSrv.atual.programacao.nome}` : ''}.`
    : null;
  // Mantém a parada em curso quando a Parada não foi mexida; escolher outra (ou "Sem parar") troca.
  // O Planejamento diz se a Parada foi mexida (mesmo valor redigitado = nova, do zero); os cartões
  // da ficha decidem pelo valor.
  const mantemParada = (e: EnvioIrrigacao) => e.manterParada ?? mesmaParada(e.parada, paradaAtual);
  const baseRapida: Rascunho = rascunhoDe(cfgBase, paradaAtual);
  const chaveBase = JSON.stringify(baseRapida);
  const [rasc, setRasc] = useState<Rascunho | null>(null);
  // A irrigação em curso mudou (outro operador, reinício, percentímetro): o rascunho velho cai.
  useEffect(() => { setRasc(null); }, [chaveBase]);
  const rapido = rasc ?? baseRapida;
  const alteracoes = mudancas(baseRapida, rapido);
  const rapidoNaFicha = on && layout !== 'modal';
  // Só o percentímetro mudou e a TON aceita trocar girando: não precisa reiniciar.
  const soPercentual = (e: EnvioIrrigacao) => {
    // Irrigação em curso PARADA (0 % com água, ou só a bomba): voltar a girar é reinício, não troca de
    // percentímetro — o pivô nunca recebeu giro, então o /percentimetro não teria o que mudar.
    if (irrigandoParado || (cfgAtual && ehParado(cfgAtual))) return false;
    if (!girando || !cfgAtual || cfgAtual.semAgua || !estado?.pivo.comandos.percentimetro || e.modo !== 'simples' || e.manterParada === false) return false;
    const m = mudancas(baseRapida, rascunhoDe(e.config, e.parada));
    return m.length === 1 && m[0].campo === 'percentual'
      && e.config.canhao === cfgAtual.canhao && JSON.stringify(e.config.faixasCanhao ?? []) === JSON.stringify(cfgAtual.faixasCanhao ?? []);
  };
  /** Pedido de mudança com o pivô ligado (diálogo, painel ou atalhos) → alerta certo. */
  const pedirModificar = (e: EnvioIrrigacao) => { setEnvio(e); setConfirmKind(soPercentual(e) ? 'live' : 'restart'); setConfirmOpen(true); };

  const confirmQ = confirmKind === 'stop' ? (desligaAgenda ? 'Cancelar o início agendado?' : `Desligar ${titulo}?`)
    : confirmKind === 'live' && envio ? (ehParado(envio.config) ? `Deixar ${titulo} parado?` : `Mudar o percentímetro para ${fmtPct(envio.config.percentual)}%?`)
      : confirmKind === 'restart' ? `Reiniciar ${titulo} com as novas opções?`
        : envio?.inicio ? `Agendar o início de ${titulo}?` : envio && ehParado(envio.config) ? `Ligar ${titulo} parado?` : `Ligar ${titulo}?`;
  const paradaTxt = (p: Parada) => (p.tipo === 'porAngulo' ? `para em ${p.angulo}°` : p.tipo === 'porVoltas' ? `${p.voltas} volta${p.voltas > 1 ? 's' : ''}`
    : p.tipo === 'porTempo' ? `para em ${p.minutos} min` : 'sem parada');
  const vaiParado = !!envio && ehParado(envio.config);
  const partida = !b ? '' : vaiParado ? ' A bomba liga e o pivô fica parado, irrigando no lugar.' : ' A bomba liga e o pivô gira após a pressurização.';
  const confirmNote = confirmKind === 'stop'
    ? desligaAgenda ? `${agendadaTxt}. O pivô não vai ligar sozinho.` : `O pivô para na posição atual (${angTxt})${b ? ' e a bomba desliga' : ''}.`
    : confirmKind === 'live' && envio
      ? `${ehParado(envio.config) ? 'O pivô para de girar e segue irrigando no lugar' : ehParado(cfgGiro) ? 'O pivô volta a girar' : 'Só o percentímetro muda'} (${fmtPct(cfgGiro.percentual)}% → ${fmtPct(envio.config.percentual)}%). Vale a partir do próximo ciclo da TON, sem desligar o pivô.`
      : confirmKind === 'restart' && envio
        ? `O pivô desliga e liga de novo com: ${resumoConfig(envio.config)} · ${paradaAutomatica && mantemParada(envio) ? 'parada em curso mantida' : paradaTxt(envio.parada)}.${b && !envio.config.semAgua ? (vaiParado ? ' A bomba religa e o pivô fica parado, irrigando no lugar.' : ' A bomba religa e o pivô volta a girar após a pressurização.') : ''}`
        : envio
          ? `Com esta configuração: ${resumoConfig(envio.config)} · ${paradaTxt(envio.parada)}${envio.inicio ? ` · início ${envio.inicio.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}.${partida}`
          : '';
  const doConfirm = () => {
    if (confirmKind === 'stop') void acionar('desligar');
    else if (!envio) setConfirmOpen(false);
    else if (confirmKind === 'live') {
      if (ocupado.current) { aguarde(); return; }   // não fecha nem descarta: a mudança segue na tela
      setModal(null); setConfirmOpen(false); setEnvio(null); void ajustarPerc(envio.config.percentual);
    }
    else if (confirmKind === 'restart') void reiniciar(envio);
    else void acionar(acaoDe(envio.config), envio);
  };
  const cancelConfirm = () => setConfirmOpen(false);
  const abrirIrr = (a: AbaIrrigacao = 'simples') => { setIrrAba(a); setModal('irr'); };

  const custoGrid: CSSProperties = estreito
    ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', rowGap: 8, padding: '12px 0' }
    : { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' };
  const linhasCusto = linhasPosto(custoSel);
  const corPosto = (k: string) => (k === 'Ponta' ? NX.bad : k === 'Fora de ponta' ? '#3B6FD6' : NX.ok);

  return (
    <NxShell
      title={titulo}
      subtitle={[cfgPivo?.unidade_nome ?? custoDia?.unidade?.nome, cfgPivo?.planta_nome, perfil.verNomeProprietario ? cfgPivo?.proprietario_nome : null].filter(Boolean).join(' · ') || (info.hasTs ? info.label : 'Sem leitura de energia')}
      right={<span style={s.pill(tone)}><span style={s.pillDot(tone)} />{label}</span>}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }, { key: 'cal', label: 'Calibração' }]}
      tab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'op' ? (
        <div style={{ padding: '20px 24px 28px 24px', ...col(16) }}>
          <div style={{ display: 'grid', gridTemplateColumns: estreito ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={col(12)}>
              <MapaPivo angulo={angulo} aviso={avisoPosicao} semCalibracao={semCalibracao} bruto={brutoAtual} girando={girando && !irrigandoParado} falha={falha} sentido={sentido} direcao={DIRECAO_LABEL[direcaoAtual]} faixas={ultima.canhao ? ultima.faixasCanhao : []} />
              <div style={{ ...s.card, padding: '12px 16px', ...col(4) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={s.stDot(tone)} />
                  <span style={s.stLabel(tone)}>{label}</span>
                  <span style={{ fontSize: 14, color: NX.mudo }}>{texto}</span>
                </div>
                {eta && <span style={{ fontSize: 13, color: NX.mudo }}>{eta}</span>}
                {agendadaTxt && <span style={{ fontSize: 13, color: NX.mudo }}>{agendadaTxt}</span>}
                {erro && <span style={{ fontSize: 13, color: NX.warn }}>{erro}</span>}
                {estado?.reinicio_falhou && (
                  <span style={{ fontSize: 13, color: NX.warn }}>
                    Reinício não executou ({new Date(estado.reinicio_falhou.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}): {estado.reinicio_falhou.erro.replace(/^Reinício não executou:\s*/, '')} — vale a irrigação anterior.
                  </span>
                )}
                {estado?.desligar_falhou && (
                  <span style={{ fontSize: 13, color: NX.bad }}>
                    Desligar não concluiu ({new Date(estado.desligar_falhou.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}): {estado.desligar_falhou.erro.replace(/^Desligar não concluiu:\s*/, '')}. A água pode seguir ligada — desligue de novo e confira a bomba no painel.
                  </span>
                )}
              </div>
              {/* Canhão na ficha: um toque, e SÓ com o pivô girando. Com o pivô desligado não aparece,
                  nem para desligar (pedido do dono): quem desliga o canhão aí é o Desligar do pivô. */}
              {canhao?.comando && canhao.tem_status && girando && (
                <div style={{ ...s.card, padding: '0 16px' }}>
                  <NxSwitchRow first minHeight={52} title="Canhão final" on={canhao.ligado === 1}
                    sub={canhaoEnv ? 'Enviando…' : canhao.ligado === null ? 'Sem leitura' : canhaoSeco ? 'Sem água' : undefined}
                    disabled={!perfil.comandar || canhao.ligado === null || canhaoOff}
                    onToggle={() => comandarCanhao(canhao.ligado !== 1)} />
                </div>
              )}
              {girando && percAtual != null && estado?.pivo.comandos.percentimetro && !rapidoNaFicha && (
                <div style={{ ...s.card, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={col(2)}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>Percentímetro</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>{fmtPct(percAtual)}%{cfgAtual?.lamina ? ` · ${fmt(cfgAtual.lamina, 2)} mm` : ''} · muda sem desligar</span>
                  </span>
                  {perfil.comandar && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input inputMode="decimal" aria-label="Novo percentual" value={percTxt ?? fmtPct(percAtual)} disabled={percEnv || executando}
                        onChange={(e) => setPercTxt(e.target.value)} style={s.campo(percEnv || executando, percTxt != null && percInvalido, 64)} />
                      <span style={{ fontSize: 14, color: NX.mudo }}>%</span>
                      <button type="button" disabled={percOff} onClick={() => percNovo != null && void ajustarPerc(percNovo)}
                        style={{ height: 36, padding: '0 14px', borderRadius: 10, border: `1px solid ${NX.borda}`, fontSize: 14, fontWeight: 700, color: percOff ? NX.desab : NX.texto, background: NX.card, cursor: percOff ? 'default' : 'pointer' }}>
                        {percEnv ? 'Enviando…' : 'Aplicar'}
                      </button>
                    </span>
                  )}
                </div>
              )}
              {perfil.comandar && rapidoNaFicha && (
                <>
                  {layout === 'painel'
                    ? <PainelRapido valor={rapido} base={baseRapida} onChange={setRasc} lamina100={lamina100} desabilitado={busy || executando} onMaisOpcoes={() => abrirIrr('simples')} aviso={avisoSemRegistro} notaParada={notaParada} podeParado={podeParado} />
                    : <AtalhosRapidos valor={rapido} base={baseRapida} onChange={setRasc} lamina100={lamina100} desabilitado={busy || executando} onMaisOpcoes={() => abrirIrr('simples')} aviso={avisoSemRegistro} notaParada={notaParada} podeParado={podeParado} />}
                  {alteracoes.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, color: NX.mudo }}>
                      <span>{alteracoes.map((m) => `${m.label}: ${m.de} → ${m.para}`).join(' · ')}</span>
                      <button type="button" onClick={() => setRasc(null)} style={{ fontWeight: 800, color: NX.acao, whiteSpace: 'nowrap' }}>Desfazer</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={busy || desligarOff} onClick={pedirDesligar}
                      style={{ ...s.cmd(busy || desligarOff ? 'busy' : 'outline'), flex: 1 }}>{busy ? 'Executando…' : 'Desligar'}</button>
                    <button type="button" disabled={busy || executando || !(alteracoes.length || semRegistro)} onClick={() => pedirModificar(envioDoRascunho(rapido, cfgBase))}
                      style={{ ...s.cmd(busy || executando || !(alteracoes.length || semRegistro) ? 'busy' : 'primary'), flex: 1 }}>Salvar e enviar</button>
                  </div>
                </>
              )}
              {perfil.comandar && !rapidoNaFicha && (
              <button type="button" disabled={busy || cmdBloq} style={cmdStyle}
                onClick={() => (desligaAgenda ? pedirDesligar() : abrirIrr('simples'))}>{cmdLabel}</button>
              )}
              {/* Com início agendado o botão principal só cancela: o Planejamento segue acessível
                  (trocar o agendamento, ver a Agenda). */}
              {perfil.comandar && desligaAgenda && (
              <button type="button" onClick={() => abrirIrr('simples')}
                style={{ alignSelf: 'center', height: 36, padding: '0 10px', fontSize: 14, fontWeight: 700, color: NX.mudo }}>
                Planejamento de irrigação
              </button>
              )}
            </div>
            <div style={col(12)}>
              <div style={{ ...s.card, padding: '14px 0', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', rowGap: 14 }}>
                {kpis.map((k, i) => (
                  <div key={k.k} style={kpiCel(i)}>
                    <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{k.v}</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>{k.k}</span>
                    {k.nota && <span style={{ fontSize: 11, color: NX.warn, textAlign: 'center', padding: '0 4px' }}>{k.nota}</span>}
                  </div>
                ))}
              </div>
              <div style={{ ...s.card, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${NX.linha2}`, gap: 12 }}>
                  <span style={{ ...col(2), minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>Bombeamento</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>{bSub}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: bCor, textAlign: 'right' }}>{bStatus}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, bKpis.length)}, minmax(0, 1fr))`, rowGap: 12, padding: '12px 0' }}>
                  {bKpis.map((k, i) => (
                    <div key={k.k} style={kpiCel(i)}>
                      <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{k.v}</span>
                      <span style={{ fontSize: 11, color: NX.mudo, textAlign: 'center' }}>{k.k}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: `1px solid ${NX.linha2}`, padding: '0 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 11, fontWeight: 700, color: NX.mudo, padding: '8px 0', letterSpacing: 0.4 }}>
                    <span>FASE</span><span style={{ textAlign: 'right' }}>TENSÃO</span><span style={{ textAlign: 'right' }}>CORRENTE</span>
                  </div>
                  {fases.map((f) => (
                    <div key={f[0]} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 14, padding: '7px 0', borderTop: `1px solid ${NX.linha}` }}>
                      <span>{f[0]}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f[1]}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f[2]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => setModal('cost')}
            style={{ width: '100%', boxSizing: 'border-box', ...s.card, display: 'grid', alignItems: 'center', minHeight: 76, ...custoGrid }}>
            <span style={{ ...col(2), padding: '0 20px', minWidth: 0 }}>
              <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Custo desta irrigação</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{brl(custoDia?.custos.custo_total)}</span>
            </span>
            <span style={{ ...col(2), padding: '0 20px', borderLeft: `1px solid ${NX.linha}`, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>{rotuloEnergia}</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{custoDia ? `${fmt(custoDia.consumo.energia_total_kwh, 0)} kWh` : '—'}</span>
            </span>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 20px', height: 44, fontSize: 14, fontWeight: 800, color: VERDE, whiteSpace: 'nowrap',
              ...(estreito ? { gridColumn: '1 / -1', borderTop: `1px solid ${NX.linha}` } : { borderLeft: `1px solid ${NX.linha}` }),
            }}>
              <span>Custos por horário</span><span>›</span>
            </span>
          </button>

          <GraficoPotencia equipamentoId={idMedicao} titulo={fonteMedicao ? 'Potência do bombeamento' : 'Gráfico de potência'} resumo={ptKw != null ? `${fmt(ptKw, 1)} kW agora` : '—'} />

          <RegistrosPivo equipamentoId={id} extra={regSeq} estreito={estreito} />
        </div>
      ) : aba === 'cfg' ? (
        <ConfigPivo pivoId={id} estado={estado} cfg={cfgPivo} perfil={perfil} onSalvo={() => { void carregar(); carregarCfg(); }}
          progs={prog.progs} onRemoverProg={prog.remover} onAdicionarHorario={() => abrirIrr('agenda')} />
      ) : (
        <CalibracaoPivo key={id} pivoId={id} tecnico={perfil.tecnico} invertido={estado?.posicao?.encoder?.invertido ?? null}
          onSalvo={() => { void carregar(); carregarCfg(); }} />
      )}

      {/* Confirmar comando */}
      <NxDialog open={confirmOpen} onClose={cancelConfirm} label="Confirmar comando" width={380}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{confirmQ}</span>
        <span style={{ fontSize: 14, color: NX.mudo }}>{confirmNote}</span>
        <NxDialogButtons onCancel={cancelConfirm} onConfirm={doConfirm} />
      </NxDialog>

      {/* Planejamento de irrigação (antiga Irrigação avançada) */}
      <NxDialog open={modal === 'irr'} onClose={() => setModal(null)} label="Planejamento de irrigação" width={520} altura={720}>
        {modal === 'irr' && (
          <IrrigacaoAvancada
            key={`${irrAba}:${on}`}
            nome={titulo} angulo={angulo} ultima={ultima} lamina100={lamina100} tempoVolta100={cfgPivo?.parametros?.tempo_volta_100 ?? 21} ponta={ponta}
            enviando={!!enviando} abaInicial={irrAba} semCanhaoMotivo={semCanhaoMotivo}
            programacoes={prog.progs} onRemoverProgramacao={prog.remover} onSalvarProgramacao={prog.salvar}
            agenda={prog.agenda} onImportarAgenda={prog.importarAgenda} onLimparAgenda={prog.limparAgenda}
            ligado={on} emCurso={on ? { config: cfgBase, parada: irrSrv?.atual?.parada ?? null } : null}
            semRegistro={semRegistro} notaParada={notaParada} enviarOff={on && executando} semReinicio={soPercentual} podeParado={podeParado}
            onDesligar={pedirDesligar} desligarOff={busy || desligarOff}
            onEnviar={(e) => { if (on) pedirModificar(e); else { setEnvio(e); setConfirmKind('start'); setConfirmOpen(true); } }}
            onClose={() => setModal(null)}
          />
        )}
      </NxDialog>

      {/* Custos por horário */}
      <NxDialog open={modal === 'cost'} onClose={() => setModal(null)} label="Custos por horário" width={520}>
        <div style={col(12)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={col(2)}>
              <span style={{ fontSize: 19, fontWeight: 800 }}>Custos por horário</span>
              <span style={{ fontSize: 13, color: NX.mudo }}>{titulo} · tarifa com impostos · {custoPer === 'mes' ? 'mês até hoje' : girando ? 'irrigação em andamento' : 'hoje'}</span>
            </span>
            <button type="button" aria-label="Fechar" onClick={() => setModal(null)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NX.mudo} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, padding: 4, borderRadius: 12, background: NX.seg }}>
            <button type="button" aria-pressed={custoPer === 'dia'} onClick={() => setCustoPer('dia')} style={s.dTab(custoPer === 'dia')}>Irrigação</button>
            <button type="button" aria-pressed={custoPer === 'mes'} onClick={() => setCustoPer('mes')} style={s.dTab(custoPer === 'mes')}>Mês</button>
            <button type="button" disabled aria-pressed={false} title="Sem dados por safra" style={{ ...s.dTab(false), color: NX.desab }}>Safra</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, padding: '4px 0' }}>
            <span>POSTO</span><span style={{ textAlign: 'right' }}>kWh</span><span style={{ textAlign: 'right' }}>R$/kWh</span><span style={{ textAlign: 'right' }}>R$</span>
          </div>
          {!custoSel ? (
            <div style={{ fontSize: 14, color: NX.mudo, padding: '8px 0', borderTop: `1px solid ${NX.linha}` }}>Sem custo calculado para o período (confira a unidade e a tarifa do equipamento).</div>
          ) : (
            <>
              {linhasCusto.map((r) => (
                <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', fontSize: 14, padding: '8px 0', borderTop: `1px solid ${NX.linha}` }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: corPosto(r.k) }} />{r.k}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.kwh, 0)}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.tarifa != null ? fmt(r.tarifa, 2) : '—'}</span>
                  <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(r.rs)}</span>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', fontSize: 14, padding: '8px 0', borderTop: `1px solid ${NX.linha}`, color: NX.mudo }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: NX.neutro }} />Demanda</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>—</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>—</span>
                <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{custoPer === 'mes' && Number(custoSel.custos.custo_demanda) > 0 ? brl(custoSel.custos.custo_demanda) : 'a apurar'}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, borderTop: `2px solid ${NX.texto}`, paddingTop: 10 }}>
            <span>Total</span><span>{brl(custoSel?.custos.custo_total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: NX.mudo }}>
            <span>{fonteMedicao ? 'Bombeamento' : 'Pivô'} {custoSel ? fmt(custoSel.consumo.energia_total_kwh, 0) : '—'} kWh · {brl(custoSel?.custos.custo_total)}{fonteMedicao && b?.compartilhada_com.length ? ` · bomba compartilhada com ${b.compartilhada_com.join(', ')}` : ''}</span>
            <span style={{ whiteSpace: 'nowrap' }}>R$/mm/ha: —</span>
          </div>
        </div>
      </NxDialog>
    </NxShell>
  );
}

// ---------------------------------------------------------------------------
// Configuração: bombeamento + partida + ponta + programação
// ---------------------------------------------------------------------------
const numOk = (v: string, min: number, max: number) => { const n = Number(String(v).replace(',', '.')); return v !== '' && Number.isFinite(n) && n >= min && n <= max; };

/** Layout da aba Operação (NEXON-98): três jeitos de editar com o pivô ligado, para testar. Fica
 *  neste navegador — não é configuração do pivô, não entra em "Revisar alterações". Só aparece
 *  para quem tem a configuração técnica (admin e analista): o cliente final não vê opção de teste. */
function LayoutOperacao() {
  const layout = usePivoLayout((x) => x.layout);
  const setLayout = usePivoLayout((x) => x.setLayout);
  return (
    <>
      {secao('LAYOUT DA OPERAÇÃO · TESTE', 4)}
      <div style={{ ...s.card, padding: '12px 16px', ...col(8) }}>
        <div role="radiogroup" aria-label="Layout da operação" style={{ display: 'grid', gridTemplateColumns: `repeat(${PIVO_LAYOUTS.length}, minmax(0, 1fr))`, gap: 4, padding: 4, borderRadius: 12, background: NX.seg }}>
          {PIVO_LAYOUTS.map((l) => (
            <button key={l.v} type="button" role="radio" aria-checked={layout === l.v} onClick={() => setLayout(l.v)} style={s.dTab(layout === l.v)}>{l.label}</button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: NX.mudo }}>{PIVO_LAYOUTS.find((l) => l.v === layout)?.sub} Vale só neste navegador.</span>
      </div>
    </>
  );
}

/** Select nativo com a cara do chip do mockup ("Bomba 01 · TON 112 · Casa de bombas ⌄"). */
function ChipSelect({ value, onChange, label, height = 38, disabled, children }: {
  value: string; onChange: (v: string) => void; label: string; height?: number; disabled?: boolean; children: ReactNode;
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '60%' }}>
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        style={{ height, padding: '0 34px 0 12px', borderRadius: 10, border: `1px solid ${NX.borda}`, fontSize: 14, fontWeight: 700, color: NX.texto, background: NX.card, appearance: 'none', WebkitAppearance: 'none', maxWidth: '100%', textOverflow: 'ellipsis', cursor: disabled ? 'default' : 'pointer' }}>
        {children}
      </select>
      <IcoChevron style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} />
    </span>
  );
}

const PARAMS = [
  { key: 'pressurizacao_s', label: 'Tempo para pressurizar', hint: 'Com pressostato: espera máxima pela pressão; sem: espera fixa · faixa 10 a 600 s', unit: 's', min: 10, max: 600, real: true, d: 0 },
  { key: 'confirma_giro_s', label: 'Confirmação do giro', hint: 'Tempo para o status "Irrigando" aparecer · faixa 5 a 120 s', unit: 's', min: 5, max: 120, real: true, d: 0 },
  { key: 'confirma_bomba_s', label: 'Confirmação da bomba', hint: 'Tempo para o "Bomba ligada" aparecer · faixa 5 a 300 s', unit: 's', min: 5, max: 300, real: true, d: 0 },
  { key: 'pressao_minima', label: 'Pressão mínima', hint: 'Abaixo dela: falha de pressão · faixa 0,5 a 6,0 bar', unit: 'bar', min: 0.5, max: 6, real: true, d: 1 },
  { key: 'lamina_100', label: 'Lâmina d’água a 100%', hint: 'Faixa 2,00 a 20,00 mm', unit: 'mm', min: 2, max: 20, real: true, d: 2 },
  { key: 'tempo_volta_100', label: 'Tempo de volta a 100%', hint: 'Base da previsão de término · faixa 6 a 72 h', unit: 'h', min: 6, max: 72, real: true, d: 1 },
  { key: 'percentimetro_ciclo_s', label: 'Ciclo do percentímetro', hint: 'A TON liga o motor de movimento % deste tempo · padrão 60 s · faixa 5 a 600 s', unit: 's', min: 5, max: 600, real: true, d: 0 },
  { key: 'correcao_angulo_zero', label: 'Correção do ângulo zero', hint: 'Faixa −180 a 180°', unit: '°', min: -180, max: 180, real: true, d: 0 },
  { key: 'travado_min', label: 'Alarme de pivô travado', hint: 'Girando com o ângulo parado por este tempo · padrão 10 min · faixa 1 a 240 min', unit: 'min', min: 1, max: 240, real: true, d: 0 },
] as const;
/** Ficam na seção POSIÇÃO DO PIVÔ (zero junto do encoder; travado só com encoder), não em PARTIDA E IRRIGAÇÃO. */
const PARAMS_POSICAO: readonly string[] = ['correcao_angulo_zero', 'travado_min'];
/** Linha somente leitura: onde está o sinal (TON · fim do MAC · BO/BI) — muda na Topologia IoT. */
function SinalBomba({ titulo, s: sinal, vazio = '—' }: { titulo: string; s: Saida | null; vazio?: string }) {
  return (
    <Linha titulo={titulo} minHeight={44}>
      <span style={{ fontSize: 14, fontWeight: sinal ? 700 : 400, color: sinal ? NX.texto : NX.mudo, textAlign: 'right' }}>
        {sinal ? `${sinal.ton ?? 'TON'} · ${sinal.saida}` : vazio}
      </span>
    </Linha>
  );
}

/** Tempos da sequência (PUT /bombeamento); o resto vai em pivo_config.parametros (PUT /config). */
type ChaveSeq = 'pressurizacao_s' | 'confirma_giro_s' | 'confirma_bomba_s';
const CHAVES_SEQ: readonly string[] = ['pressurizacao_s', 'confirma_giro_s', 'confirma_bomba_s'];
const PARAMS_PAR = PARAMS.filter((p) => !CHAVES_SEQ.includes(p.key));
const ROT_TRAVADO = PARAMS.find((p) => p.key === 'travado_min')!.label;

const DICA_CALIBRACAO = 'Definido na aba Calibração';
const AVISO_TROCA_ENCODER = 'Trocar o encoder ou a resolução desativa a calibração do ângulo: será preciso calibrar de novo';
/** Mudanças que desativam a calibração vigente (a API desativa ao gravar). */
const ROT_TROCA_ENCODER = ['Encoder', 'Resolução do encoder'];

/**
 * Posição do pivô pelo encoder absoluto: escolhe o encoder (nó Encoder do diagrama IoT,
 * mesma instalação), a resolução do código de compra, o sentido e o zero. "Zerar aqui"
 * faz a posição lida agora virar 0° (o braço apontando para o norte do mapa).
 */
function SecaoEncoder({ encs, enc, setEnc, encSel, encRes, encRuim, ro, somenteLeitura, zero, setZero, calibrado = false }: {
  encs: OpcaoEncoder[] | null; enc: { id: string; res: string; inv: boolean }; setEnc: (f: (e: { id: string; res: string; inv: boolean }) => { id: string; res: string; inv: boolean }) => void;
  encSel: OpcaoEncoder | null; encRes: number | null; encRuim: boolean; ro: boolean; somenteLeitura: boolean; zero: string; setZero: (v: string) => void;
  /** Há calibração vigente (NEXON-103): sentido e zero vêm dela — aqui ficam só para leitura. */
  calibrado?: boolean;
}) {
  // Com calibração, quem define sentido e zero é a aba Calibração (a API recusa mudar por aqui).
  const roCal = ro || calibrado;
  const zeroNum = zero.trim() === '' ? 0 : Number(zero.replace(',', '.'));
  const zeroRuim = zero.trim() !== '' && (Number.isNaN(zeroNum) || zeroNum < -180 || zeroNum > 180);
  const podeCalcular = !!encSel && encSel.bruto != null && encRes != null && !encRuim;
  const semZero = podeCalcular ? anguloSemZero(encSel!.bruto!, encRes!, enc.inv) : null;
  const previa = semZero != null && !zeroRuim ? norm360(semZero + zeroNum) : null;
  const zerarAqui = () => {
    if (semZero == null) return;
    let z = -semZero;
    if (z <= -180) z += 360;
    z = Math.round(z * 10) / 10;
    setZero((Object.is(z, -0) ? 0 : z).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  };
  const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null);
  const resOpcoes = encRes != null && !RESOLUCOES_ENCODER.includes(encRes) ? [...RESOLUCOES_ENCODER, encRes] : RESOLUCOES_ENCODER;
  return (
    <div style={{ ...s.card, padding: '0 16px' }}>
      <Linha first titulo="Encoder" sub={encs && encs.length === 0 ? 'Nenhum encoder nesta instalação · ligue um nó Encoder à TON na Topologia IoT e salve' : 'Encoder absoluto no centro do pivô (Topologia IoT)'}>
        <ChipSelect label="Encoder" disabled={ro || !encs} value={enc.id} onChange={(v) => setEnc((e) => ({ ...e, id: v }))}>
          <option value="">Sem encoder</option>
          {(encs ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          {enc.id && encs && !encs.some((x) => x.id === enc.id) && <option value={enc.id}>Encoder removido</option>}
        </ChipSelect>
      </Linha>
      {enc.id && (
        <>
          <Linha titulo="Resolução" sub={encRuim ? 'Escolha a resolução do código de compra' : 'Posições por volta (código de compra)'}>
            <ChipSelect label="Resolução do encoder" disabled={ro} value={enc.res} onChange={(v) => setEnc((e) => ({ ...e, res: v }))}>
              <option value="">Escolha…</option>
              {resOpcoes.map((r) => <option key={r} value={String(r)}>{r.toLocaleString('pt-BR')}</option>)}
            </ChipSelect>
          </Linha>
          <NxSwitchRow title="Sentido invertido" sub={calibrado ? DICA_CALIBRACAO : 'Ligue se o ângulo diminui com o pivô em Avanço'} on={enc.inv} disabled={roCal}
            onToggle={() => setEnc((e) => ({ ...e, inv: !e.inv }))} />
          <div style={{ borderTop: `1px solid ${NX.linha}`, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <label htmlFor="w-correcao_angulo_zero" style={{ flex: 1, ...col(2) }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Correção do ângulo zero</span>
              <span style={{ fontSize: 12, color: zeroRuim ? NX.bad : NX.mudo }}>{calibrado ? DICA_CALIBRACAO : ro && !somenteLeitura ? MSG_SOMENTE_LEITURA : 'Faixa −180 a 180° · 0° = norte do mapa'}</span>
            </label>
            <button type="button" disabled={roCal || semZero == null} onClick={zerarAqui} title={calibrado ? DICA_CALIBRACAO : undefined}
              style={{ height: 38, padding: '0 12px', borderRadius: 10, border: `1px solid ${NX.borda}`, fontSize: 13, fontWeight: 800, color: roCal || semZero == null ? NX.desab : NX.texto }}>
              Zerar aqui
            </button>
            <input id="w-correcao_angulo_zero" inputMode="decimal" value={zero} disabled={roCal} style={s.campo(roCal, zeroRuim)} onChange={(e) => setZero(e.target.value)} />
            <span style={{ fontSize: 14, color: NX.mudo, width: 28 }}>°</span>
          </div>
          <Linha titulo="Leitura agora" sub={encSel?.lido_em ? `Contagem ${encSel.bruto ?? '—'} · ${hora(encSel.lido_em)}` : 'Sem leitura do encoder ainda'}>
            <span style={{ fontSize: 15, fontWeight: 800, color: previa != null ? NX.texto : NX.mudo, fontVariantNumeric: 'tabular-nums' }}>
              {previa != null ? `${fmt(previa, 1)}°` : '—°'}
            </span>
          </Linha>
        </>
      )}
      {!enc.id && (
        <div style={{ borderTop: `1px solid ${NX.linha}`, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <label htmlFor="w-correcao_angulo_zero" style={{ flex: 1, ...col(2) }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Correção do ângulo zero</span>
            <span style={{ fontSize: 12, color: zeroRuim ? NX.bad : NX.mudo }}>Faixa −180 a 180°</span>
          </label>
          <input id="w-correcao_angulo_zero" inputMode="decimal" value={zero} disabled={ro} style={s.campo(ro, zeroRuim)} onChange={(e) => setZero(e.target.value)} />
          <span style={{ fontSize: 14, color: NX.mudo, width: 28 }}>°</span>
        </div>
      )}
    </div>
  );
}

function ConfigPivo({ pivoId, estado, cfg, perfil, onSalvo, progs, onRemoverProg, onAdicionarHorario }: {
  pivoId: string; estado: Estado | null; cfg: PivoConfig | null; perfil: { tecnico: boolean; operacional: boolean }; onSalvo: () => void;
  progs: Programacao[] | null; onRemoverProg: (id: string) => void; onAdicionarHorario: () => void;
}) {
  const [op, setOp] = useState<Opcoes | null>(null);
  // Base (gravado) × rascunho
  const [base, setBase] = useState<{ bombaDe: string; seq: Record<ChaveSeq, number>; mantido: boolean } | null>(null);
  // Saídas mantidas: BO em alto enquanto a função está ligada (painel sem selo) × pulsos nos botões
  const [mantido, setMantido] = useState(false);
  const [seq, setSeq] = useState<Record<ChaveSeq, string>>({ pressurizacao_s: '120', confirma_giro_s: '30', confirma_bomba_s: '30' });
  const [conj, setConj] = useState(false);
  const [conjPivo, setConjPivo] = useState('');
  const [ponta, setPonta] = useState<Janela | null>(null);
  // Parâmetros de irrigação e válvula (pivo_config.parametros) — texto do campo × gravado.
  const fmtPar = (v: number | null | undefined, d: number) => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const [par, setPar] = useState<Record<string, string>>({});
  useEffect(() => {
    const pp = cfg?.parametros;
    setPar({
      pressao_minima: fmtPar(pp?.pressao_minima, 1), lamina_100: fmtPar(pp?.lamina_100, 2),
      tempo_volta_100: fmtPar(pp?.tempo_volta_100, 1), correcao_angulo_zero: fmtPar(pp?.correcao_angulo_zero, 0),
      percentimetro_ciclo_s: fmtPar(pp?.percentimetro_ciclo_s, 0), travado_min: fmtPar(pp?.travado_min, 0),
    });
  }, [cfg]);
  const parNum = (k: string) => { const t = (par[k] ?? '').trim(); return t === '' ? null : Number(t.replace(',', '.')); };
  // Encoder de posição (técnico): equipamento, resolução e sentido. O zero é o correcao_angulo_zero.
  const [encs, setEncs] = useState<OpcaoEncoder[] | null>(null);
  const [enc, setEnc] = useState<{ id: string; res: string; inv: boolean }>({ id: '', res: '', inv: false });
  useEffect(() => {
    const pp = cfg?.parametros;
    setEnc({ id: pp?.encoder_equipamento_id ?? '', res: pp?.encoder_resolucao != null ? String(pp.encoder_resolucao) : '', inv: !!pp?.encoder_invertido });
  }, [cfg]);
  useEffect(() => {
    api.get(`/pivos/${pivoId}/encoder/opcoes`).then((r) => setEncs(corpo<OpcaoEncoder[]>(r) ?? [])).catch(() => setEncs([]));
  }, [pivoId]);
  const encRes = enc.res === '' ? null : Number(enc.res);
  const encSel = encs?.find((x) => x.id === enc.id) ?? null;
  const nomeEnc = (id: string | null | undefined) => (!id ? 'Sem encoder' : encs?.find((x) => x.id === id)?.nome ?? id);
  // Calibração vigente (NEXON-103): zero e sentido do encoder vêm dela. Não entram no diff nem no
  // PUT — a API recusa, e o zero gravado (duas casas) não pode virar "alteração" pelo arredondamento.
  const calibrado = !!estado?.posicao?.calibracao;
  const zeroGravado = cfg?.parametros?.correcao_angulo_zero;
  const [revisar, setRevisar] = useState(false);
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    api.get(`/pivos/${pivoId}/bombeamento/opcoes`).then((r) => setOp(corpo<Opcoes>(r))).catch(() => setOp({ bombas: [] }));
  }, [pivoId]);
  useEffect(() => { setPonta(cfg?.bloqueio_ponta ?? null); }, [cfg]);
  useEffect(() => {
    if (!estado || base) return;
    const sc = estado.sequencia_cfg;
    const sq = { pressurizacao_s: sc.pressurizacao_s, confirma_giro_s: sc.confirma_giro_s, confirma_bomba_s: sc.confirma_bomba_s ?? 30 };
    const de = estado.bomba_de?.id ?? '';
    setBase({ bombaDe: de, seq: sq, mantido: !!sc.comandos_mantidos });
    setMantido(!!sc.comandos_mantidos);
    setConj(!!de); setConjPivo(de);
    setSeq({ pressurizacao_s: String(sq.pressurizacao_s), confirma_giro_s: String(sq.confirma_giro_s), confirma_bomba_s: String(sq.confirma_bomba_s) });
  }, [estado, base]);

  const b = estado?.bombeamento ?? null;
  // Dono da bomba = pontos no próprio pivô; os outros do conjugado apontam para ele.
  const compartilhada = !conj && !!b?.compartilhada_com.length;
  const nomePivo = (pid: string) => op?.bombas.find((x) => x.pivo_id === pid)?.nome ?? (pid === estado?.bomba_de?.id ? estado?.bomba_de?.nome : null) ?? '—';
  const bombaDeAgora = conj ? conjPivo : '';
  const mudancas = useMemo(() => {
    if (!base) return [];
    const out: Array<{ label: string; de: string; para: string }> = [];
    const add = (label: string, de: string, para: string) => { if (de !== para) out.push({ label, de, para }); };
    add('Usa a bomba do pivô', base.bombaDe ? nomePivo(base.bombaDe) : '—', bombaDeAgora ? nomePivo(bombaDeAgora) : '—');
    add('Saídas', base.mantido ? 'Mantidas' : 'Pulso', mantido ? 'Mantidas' : 'Pulso');
    for (const k of CHAVES_SEQ as ChaveSeq[]) {
      add(PARAMS.find((p) => p.key === k)!.label, `${base.seq[k]} s`, `${Number(seq[k])} s`);
    }
    for (const p of PARAMS_PAR) {
      if (calibrado && p.key === 'correcao_angulo_zero') continue;
      if (!enc.id && p.key === 'travado_min') continue;   // campo só existe com encoder
      const antes = cfg?.parametros?.[p.key as keyof ParametrosPivo] as number | null | undefined;
      const agora = parNum(p.key);
      if ((antes ?? null) !== agora) add(p.label, antes == null ? '—' : `${fmtPar(antes, p.d)} ${p.unit}`, agora == null ? '—' : `${fmtPar(agora, p.d)} ${p.unit}`);
    }
    if (cfg) {
      const pp = cfg.parametros;
      add('Encoder', nomeEnc(pp?.encoder_equipamento_id), nomeEnc(enc.id || null));
      add('Resolução do encoder', pp?.encoder_resolucao != null ? `${pp.encoder_resolucao}` : '—', encRes != null ? `${encRes}` : '—');
      if (!calibrado) add('Encoder invertido', pp?.encoder_invertido ? 'Sim' : 'Não', enc.inv ? 'Sim' : 'Não');
    }
    if (cfg && ponta) {
      const a = cfg.bloqueio_ponta;
      add('Bloquear no horário de ponta', a.ativo ? 'Sim' : 'Não', ponta.ativo ? 'Sim' : 'Não');
      add('Horário de ponta · início', a.inicio, ponta.inicio);
      add('Horário de ponta · fim', a.fim, ponta.fim);
    }
    return out;
  }, [base, seq, cfg, ponta, par, conj, conjPivo, op, enc, encs, mantido, calibrado]); // eslint-disable-line react-hooks/exhaustive-deps
  const desativaCalibracao = calibrado && mudancas.some((m) => ROT_TROCA_ENCODER.includes(m.label));

  const bombaRuim = conj && !conjPivo;
  const seqRuim = (CHAVES_SEQ as ChaveSeq[]).some((k) => { const p = PARAMS.find((x) => x.key === k)!; return !numOk(seq[k], p.min, p.max); });
  const pontaRuim = !!ponta && !(/^\d{2}:\d{2}$/.test(ponta.inicio) && /^\d{2}:\d{2}$/.test(ponta.fim));
  const parRuim = PARAMS_PAR.some((p) => { if ((calibrado && p.key === 'correcao_angulo_zero') || (!enc.id && p.key === 'travado_min')) return false; const v = parNum(p.key); return v != null && (Number.isNaN(v) || v < p.min || v > p.max); });
  // Com encoder escolhido, a resolução é obrigatória (sem ela o servidor não calcula o ângulo).
  const encRuim = !!enc.id && (encRes == null || !Number.isInteger(encRes) || encRes < 16 || encRes > 16_777_216);
  const invalido = bombaRuim || seqRuim || pontaRuim || parRuim || encRuim;
  const n = mudancas.length;
  const saveOff = invalido || n === 0;

  const gravar = async () => {
    setGravando(true);
    try {
      const ROT_ENC = ['Encoder', 'Resolução do encoder', 'Encoder invertido'];
      const daConfig = new Set(['Bloquear no horário de ponta', 'Horário de ponta · início', 'Horário de ponta · fim', ...PARAMS_PAR.map((p) => p.label), ...ROT_ENC]);
      const bombaMudou = mudancas.some((m) => !daConfig.has(m.label));
      const seqNum = { pressurizacao_s: Number(seq.pressurizacao_s), confirma_giro_s: Number(seq.confirma_giro_s), confirma_bomba_s: Number(seq.confirma_bomba_s) };
      if (bombaMudou) {
        // bomba_de só vai quando mudou: pivô ainda na configuração antiga não perde a dele.
        const conjMudou = base!.bombaDe !== bombaDeAgora;
        await api.put(`/pivos/${pivoId}/bombeamento`, {
          ...(conjMudou ? { bombeamento: { bomba_de: bombaDeAgora || null } } : {}),
          sequencia: { ...seqNum, comandos_mantidos: mantido },
        });
      }
      const pontaMudou = cfg && ponta && (cfg.bloqueio_ponta.ativo !== ponta.ativo || cfg.bloqueio_ponta.inicio !== ponta.inicio || cfg.bloqueio_ponta.fim !== ponta.fim);
      const parMudou = mudancas.some((m) => PARAMS_PAR.some((p) => p.label === m.label) || ROT_ENC.includes(m.label));
      if (pontaMudou || parMudou) {
        await api.put(`/pivos/${pivoId}/config`, {
          ...(pontaMudou ? { bloqueio_ponta: ponta } : {}),
          ...(parMudou ? {
            parametros: {
              pressao_minima: parNum('pressao_minima'), lamina_100: parNum('lamina_100'),
              tempo_volta_100: parNum('tempo_volta_100'),
              percentimetro_ciclo_s: parNum('percentimetro_ciclo_s') == null ? null : Math.round(parNum('percentimetro_ciclo_s')!),
              // Só quando mudou: a API anterior ao NEXON-103 recusa o campo que não conhece.
              ...(mudancas.some((m) => m.label === ROT_TRAVADO) ? { travado_min: parNum('travado_min') == null ? null : Math.round(parNum('travado_min')!) } : {}),
              encoder_equipamento_id: enc.id || null,
              encoder_resolucao: enc.id ? encRes : cfg?.parametros?.encoder_resolucao ?? null,
              // Com calibração vigente, zero e sentido vêm dela: não vão no PUT (a API recusa).
              ...(calibrado ? {} : { correcao_angulo_zero: parNum('correcao_angulo_zero'), encoder_invertido: enc.inv }),
            },
          } : {}),
        });
      }
      toast.success('Configuração do pivô salva');
      // O gravado passa a ser o rascunho (não espera o refresh do estado).
      setBase({ bombaDe: bombaDeAgora, seq: seqNum, mantido });
      setRevisar(false); onSalvo();
    } catch (e) {
      toast.error('Não salvou', { description: erroMsg(e) });
    } finally {
      setGravando(false);
    }
  };

  const timeStyle: CSSProperties = { height: 38, borderRadius: 10, border: `1px solid ${NX.borda}`, padding: '0 10px', fontSize: 15, fontWeight: 700, color: NX.texto, background: NX.card };
  const nProg = progs?.length ?? 0;
  const agFull = nProg >= 5;
  const roTec = !perfil.tecnico;
  // Operacional: lâmina, ponta e programação (PER-33b).
  const roOp = !perfil.operacional;
  const somenteLeitura = roTec && roOp;
  /** Cartão de um parâmetro numérico (PARAMS): rótulo, dica com a faixa, campo e unidade. */
  const campoParam = (p: (typeof PARAMS)[number]) => {
    const ehSeq = CHAVES_SEQ.includes(p.key);
    const val = ehSeq ? seq[p.key as ChaveSeq] : (par[p.key] ?? '');
    const nv = Number(String(val).replace(',', '.'));
    const ruim = ehSeq ? !numOk(val, p.min, p.max) : val !== '' && (Number.isNaN(nv) || nv < p.min || nv > p.max);
    // Lâmina é operacional; o resto da partida é técnico.
    const ro = p.key === 'lamina_100' ? roOp : roTec;
    return (
      <div key={p.key} style={{ ...s.card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label htmlFor={`w-${p.key}`} style={{ flex: 1, ...col(2) }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{p.label}</span>
          <span style={{ fontSize: 12, color: ruim ? NX.bad : NX.mudo }}>{ro && !somenteLeitura ? MSG_SOMENTE_LEITURA : p.hint}</span>
        </label>
        <input id={`w-${p.key}`} inputMode="decimal" value={val} disabled={ro} style={s.campo(ro, ruim)}
          onChange={(e) => { if (ehSeq) setSeq((x) => ({ ...x, [p.key]: e.target.value })); else setPar((x) => ({ ...x, [p.key]: e.target.value })); }} />
        <span style={{ fontSize: 14, color: NX.mudo, width: 28 }}>{p.unit}</span>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px 24px 28px 24px', ...col(10) }}>
      {perfil.tecnico && <LayoutOperacao />}
      {secao('BOMBEAMENTO', perfil.tecnico ? 14 : 4)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        {conj ? (
          <Linha first titulo="Bomba" sub="Sistema conjugado · um pivô por vez">
            <ChipSelect label="Usa a bomba do pivô" disabled={roTec} value={conjPivo} onChange={setConjPivo}>
              <option value="">Escolha o pivô…</option>
              {(op?.bombas ?? []).filter((x) => x.pivo_id !== pivoId).map((x) => <option key={x.pivo_id} value={x.pivo_id}>Bomba do {x.nome}</option>)}
            </ChipSelect>
          </Linha>
        ) : (
          <Linha first titulo="Bomba" sub={b?.origem === 'legado' ? 'Configuração antiga · ligue o ponto Ligar na Topologia IoT para substituir' : mantido ? 'Ligar fica em alto durante a irrigação; desligar baixa todas as saídas' : 'Ligar liga a bomba (e fecha a solenoide); o Desligar do pivô para tudo'}>
            <span style={{ fontSize: 14, fontWeight: 700, color: b ? NX.texto : NX.mudo }}>{b ? (compartilhada ? `Compartilhada com ${b.compartilhada_com.join(', ')}` : 'Configurada') : 'Sem bomba'}</span>
          </Linha>
        )}
        {(!conj || conjPivo === estado?.bomba_de?.id) && b?.saidas && (
          <>
            <SinalBomba titulo="Ligar" s={b.saidas.ligar} />
            {b.saidas.desligar && <SinalBomba titulo="Desligar bomba" s={b.saidas.desligar} />}
            <SinalBomba titulo="Ligado" s={b.saidas.confirma} vazio="Sem confirmação" />
          </>
        )}
        <NxSwitchRow title="Sistema conjugado" sub="Usa a bomba de outro pivô" on={conj} disabled={roTec || compartilhada}
          onToggle={() => setConj((v) => !v)} />
        <NxSwitchRow title="Saídas mantidas"
          sub={mantido
            ? 'Cada saída fica ligada enquanto a função está ligada (Ligar, Girar, Canhão). Para painel sem selo, como a TON no lugar do CLP. Só troca com o pivô desligado.'
            : 'Desligado: pulsos nos botões do painel, que faz o selo. Ligue para manter as saídas ligadas (painel sem selo).'}
          on={mantido} disabled={roTec} onToggle={() => setMantido((v) => !v)} />
      </div>
      {roTec && !roOp && <span style={{ fontSize: 12, color: NX.mudo }}>{MSG_SOMENTE_LEITURA}</span>}

      {secao('PARTIDA E IRRIGAÇÃO', 10)}
      {PARAMS.filter((p) => !PARAMS_POSICAO.includes(p.key)).map(campoParam)}

      {secao('POSIÇÃO DO PIVÔ', 10)}
      <SecaoEncoder encs={encs} enc={enc} setEnc={setEnc} encSel={encSel} encRes={encRes} encRuim={encRuim} ro={roTec} somenteLeitura={somenteLeitura} calibrado={calibrado}
        zero={calibrado ? fmtPar(zeroGravado, Number.isInteger(zeroGravado ?? 0) ? 0 : 2) : par.correcao_angulo_zero ?? ''} setZero={(v) => setPar((x) => ({ ...x, correcao_angulo_zero: v }))} />
      {/* Alarme de pivô travado: só faz sentido com encoder (é ele que diz que o ângulo parou). */}
      {enc.id && campoParam(PARAMS.find((p) => p.key === 'travado_min')!)}

      {secao('HORÁRIO DE PONTA', 10)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        <NxSwitchRow first title="Bloquear no horário de ponta" sub="Pausa a irrigação e retoma ao fim da ponta" on={!!ponta?.ativo} disabled={!ponta || roOp}
          onToggle={() => setPonta((p) => (p ? { ...p, ativo: !p.ativo } : p))} />
        <div style={{ borderTop: `1px solid ${NX.linha}`, padding: '12px 0', display: 'flex', gap: 12 }}>
          {(['inicio', 'fim'] as const).map((k) => (
            <label key={k} style={{ flex: 1, ...col(4) }}>
              <span style={{ fontSize: 12, color: NX.mudo }}>{k === 'inicio' ? 'Início' : 'Fim'}</span>
              <input type="time" disabled={!ponta || roOp} value={ponta?.[k] ?? ''} onChange={(e) => setPonta((p) => (p ? { ...p, [k]: e.target.value } : p))} style={timeStyle} />
            </label>
          ))}
        </div>
      </div>

      {secao(`PROGRAMAÇÃO DE HORÁRIOS · ${nProg}/5`, 10)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        {progs == null && <div style={{ minHeight: 58, display: 'flex', alignItems: 'center', fontSize: 14, color: NX.mudo }}>Carregando…</div>}
        {(progs ?? []).map((p, i) => {
          const t = textoProgramacao(p);
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, ...(i > 0 ? { borderTop: `1px solid ${NX.linha}` } : {}) }}>
              <span style={{ flex: 1, ...col(2) }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{t.quando}</span>
                <span style={{ fontSize: 12, color: NX.mudo }}>{t.det}</span>
              </span>
              <button type="button" aria-label="Remover horário" disabled={roOp} onClick={() => onRemoverProg(p.id)} style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IcoLixo />
              </button>
            </div>
          );
        })}
        <button type="button" disabled={agFull || progs == null || roOp} onClick={onAdicionarHorario}
          style={{ width: '100%', height: 46, ...(nProg > 0 || progs == null ? { borderTop: `1px solid ${NX.linha}` } : {}), fontSize: 14, fontWeight: 800, textAlign: 'center', color: agFull || roOp ? NX.desab : VERDE }}>
          {agFull ? 'Limite de 5 horários' : '+ Adicionar horário'}
        </button>
      </div>

      {!somenteLeitura && (
        <button type="button" disabled={saveOff} onClick={() => setRevisar(true)} style={s.save(saveOff)}>
          {invalido ? 'Valor fora da faixa' : n === 0 ? 'Salvar' : `Revisar ${n} ${n > 1 ? 'alterações' : 'alteração'}`}
        </button>
      )}
      {somenteLeitura && <span style={{ textAlign: 'center', fontSize: 13, color: NX.mudo, marginTop: 6 }}>{MSG_SOMENTE_LEITURA}</span>}
      <span style={{ fontSize: 12, color: NX.mudo, marginTop: 6 }}>
        Os comandos do pivô (ligar, desligar, direção, sem água, canhão) e os status vêm dos pontos ligados às BO/BI da TON do pivô (Topologia → TON → Configurar BOs/BIs).
      </span>

      <NxDialog open={revisar} onClose={() => { if (!gravando) setRevisar(false); }} label="Confirmar alterações" width={440}>
        <div style={col(10)}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Confirmar alterações</span>
          {mudancas.map((c) => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15, padding: '6px 0', borderBottom: `1px solid ${NX.linha}` }}>
              <span>{c.label}</span><span style={{ textAlign: 'right' }}><span style={{ color: NX.mudo }}>{c.de}</span> → <b>{c.para}</b></span>
            </div>
          ))}
          {desativaCalibracao && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: NX.warn }}>{AVISO_TROCA_ENCODER}.</span>}
          {gravando
            ? <span style={{ fontSize: 14, color: NX.mudo, textAlign: 'center', padding: '6px 0' }}>Gravando e aguardando releitura da TON…</span>
            : <NxDialogButtons onCancel={() => setRevisar(false)} onConfirm={gravar} cancelLabel="Voltar" marginTop={8} />}
        </div>
      </NxDialog>
    </div>
  );
}

export default PivoSheet;
