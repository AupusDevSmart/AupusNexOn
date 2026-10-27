import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/config/api';
import { iotApiService } from '@/services/iot.services';
import { useGatewayDashboard } from '@/hooks/useGatewayDashboard';
import { useGatewayTendencia } from '@/hooks/useGatewayTendencia';
import { equipamentosDadosService } from '@/services/equipamentos-dados.service';
import { EstadoHero, GrupoTitulo, Section, MiniChart, useDados, getPath, fmt, tsInfo } from './sheetParts';
import {
  useCustos, custosDe, useHistorico, useHorarios, postoEm, fmtHora, bucketize, unwrap,
  type HistPoint, type Horarios,
} from './equipUi';
import { NX, s, NxShell, type NxTone } from './nxMock';
import { RotulosUnifilar } from './InversorSheet';
import { ComposedChart } from '@/components/charts/composed-chart';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { SeriesBar } from '@/components/charts/series-bar';
import { Line } from '@/components/charts/line';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { ReferenceArea } from '@/components/charts/reference-area';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { LINHA_SO_DOMINIO } from '@/components/graficos/linhas-de-buckets';

/**
 * Modal do Medidor da concessionária — mockup "Web — Modal do Medidor" (NEXON-5),
 * marcação, textos e medidas iguais ao HTML (estilos inline, cores do kit nxMock).
 * Duas fontes de medição, escolhidas pelo vínculo em "Vínculos → Medições":
 *  - SSU (A-966 / TON-V2): pulsos por bloco; "agora" é a parcial de 1 em 1 min,
 *    demanda e energia vêm de /equipamentos-dados/:id/gateway/dashboard e /gateway/tendencia;
 *  - telemetria direta (PM M160/PD666): Pt/Qt/St em W; intervalo de 15 min, fluxo
 *    do dia e FP saem do histórico; demanda do mês e energia por posto de /custos-energia.
 * O que não tem fonte de dado (geração dos inversores, reativo excedente…) aparece com "—".
 */

export interface StatusMed { tone: NxTone; label: string; posto?: string }

/** Quadrante NBR 14522 (vem do medidor). Só tem significado com fluxo. */
const QUADRANTE: Record<number, string> = {
  1: 'Q1 · consumindo, indutivo',
  2: 'Q2 · injetando, capacitivo',
  3: 'Q3 · injetando, indutivo',
  4: 'Q4 · consumindo, capacitivo',
};
/** Posto horário informado pelo medidor (bits 0-1 do octeto 3). */
const POSTO: Record<number, string> = { 0: 'não informado', 1: 'Ponta', 2: 'Fora de ponta', 3: 'Quarto posto (reservado)' };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const hhmmD = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
/** "10:45–11:00": o timestamp do pico é o FIM da janela de 15 min. */
const janelaD = (iso?: string | null) => {
  if (!iso) return undefined;
  const fim = new Date(iso);
  return `${hhmmD(new Date(fim.getTime() - 15 * 60_000))}–${hhmmD(fim)}`;
};

/**
 * Bloco compacto da SSU (usado pelo DisjuntorSheet).
 * Medidor da concessionária lido pela SSU (A-966 ou entrada SU+ da TON-V2): os dados são
 * PULSOS por intervalo do medidor, não grandezas instantâneas. Mostra o minuto atual (parcial
 * de 1 em 1 min da TON-V2), a demanda em janelas fixas de 15 min (como a concessionária
 * fatura) e a energia do dia — tudo de /equipamentos-dados/:id/gateway/dashboard.
 */
export function SsuOperacao({ equipamentoId }: { equipamentoId: string }) {
  const { data, error } = useGatewayDashboard(equipamentoId);
  const agora = data?.minuto_a_minuto?.agora ?? null;
  const intervalo = data?.minuto_a_minuto?.intervalo ?? null;
  const serie = data?.minuto_a_minuto?.serie ?? [];
  const comFluxo = !!agora && (agora.kW_consumo > 0.01 || agora.kW_injecao > 0.01);
  const snap = data?.snapshot ?? null;
  const ref = agora ?? snap;
  const injetando = !!ref && ref.kW_injecao > ref.kW_consumo && ref.kW_injecao > 0.05;
  const consumindo = !!ref && ref.kW_consumo >= ref.kW_injecao && ref.kW_consumo > 0.05;
  const dia = data?.resumo_dia;
  const mes = data?.resumo_mes;
  const contrC = data?.unidade?.demanda_carga ?? null;
  const contrG = data?.unidade?.demanda_geracao ?? null;
  const temInjecao = (dia?.injecao_kwh ?? 0) > 0 || (mes?.pico_injecao?.kw ?? 0) > 0;
  const kvarAgora = agora ? agora.kvar_ind - agora.kvar_cap : null;
  return (
    <>
      <GrupoTitulo>Estado</GrupoTitulo>
      <EstadoHero
        label={!ref ? 'Sem dado' : injetando ? 'Injetando na rede' : consumindo ? 'Consumindo da rede' : 'Sem fluxo'}
        tone={!ref ? 'off' : injetando ? 'warn' : consumindo ? 'ok' : 'off'}
      />
      {error && <p className="text-[11px] text-amber-600 mt-1.5">{error}</p>}

      {agora && (
        <>
          <GrupoTitulo right={<span className="text-[11px] text-muted-foreground">{hhmmD(new Date(agora.timestamp))}</span>}>Agora · último minuto</GrupoTitulo>
          <Section rows={[
            { k: 'Consumo', v: `${fmt(agora.kW_consumo, 2)} kW` },
            ...(temInjecao || agora.kW_injecao > 0 ? [{ k: 'Injeção', v: `${fmt(agora.kW_injecao, 2)} kW` }] : []),
            { k: 'Reativo', v: kvarAgora == null ? '—' : `${fmt(Math.abs(kvarAgora), 2)} kvar${kvarAgora > 0 ? ' ind.' : kvarAgora < 0 ? ' cap.' : ''}` },
            ...(agora.FP != null ? [{ k: 'Fator de potência', v: `${fmt(agora.FP, 3)}${agora.FP_natureza ? (agora.FP_natureza === 'cap' ? ' cap.' : ' ind.') : ''}` }] : []),
            ...(agora.q != null ? [{ k: 'Quadrante', v: comFluxo ? (QUADRANTE[agora.q] ?? `Q${agora.q}`) : 'sem fluxo', mute: !comFluxo }] : []),
            ...(agora.posto != null ? [{ k: 'Posto horário', v: POSTO[agora.posto] ?? String(agora.posto), mute: true }] : []),
          ]} />
          {serie.length >= 2 && (
            <div className="mt-2">
              <MiniChart serie={serie.map((m) => (m.kW_consumo >= m.kW_injecao ? m.kW_consumo : -m.kW_injecao))} unit="kW · última hora, por minuto (injeção negativa)" />
            </div>
          )}
        </>
      )}

      {intervalo && (
        <>
          <GrupoTitulo right={intervalo.fecha_em_s != null ? <span className="text-[11px] text-muted-foreground">fecha em {mmss(intervalo.fecha_em_s)}</span> : undefined}>
            Intervalo do medidor em andamento
          </GrupoTitulo>
          <Section rows={[
            { k: 'Energia consumida até agora', sub: `${intervalo.minutos} min do intervalo`, v: `${fmt(intervalo.kwh_consumo, 3)} kWh` },
            ...(intervalo.kwh_injecao > 0 ? [{ k: 'Energia injetada até agora', v: `${fmt(intervalo.kwh_injecao, 3)} kWh` }] : []),
          ]} />
        </>
      )}

      <GrupoTitulo>Demanda (média de 15 min)</GrupoTitulo>
      <Section rows={[
        { k: 'Máxima de hoje', sub: janelaD(dia?.pico_consumo?.timestamp), v: dia?.pico_consumo ? `${fmt(dia.pico_consumo.kw, 2)} kW` : '—' },
        { k: 'Máxima do mês', sub: mes?.pico_consumo ? new Date(mes.pico_consumo.timestamp).toLocaleDateString('pt-BR') + ' ' + janelaD(mes.pico_consumo.timestamp) : undefined, v: mes?.pico_consumo ? `${fmt(mes.pico_consumo.kw, 2)} kW` : '—' },
        ...(contrC != null ? [{ k: 'Contratada (carga)', v: `${fmt(contrC, 0)} kW`, mute: true }] : []),
        ...(temInjecao ? [
          { k: 'Máxima injeção hoje', sub: janelaD(dia?.pico_injecao?.timestamp), v: dia?.pico_injecao ? `${fmt(dia.pico_injecao.kw, 2)} kW` : '—' },
          ...(contrG != null ? [{ k: 'Contratada (geração)', v: `${fmt(contrG, 0)} kW`, mute: true }] : []),
        ] : []),
      ]} />

      <GrupoTitulo>Energia hoje</GrupoTitulo>
      <Section rows={[
        { k: 'Consumida', v: `${fmt(dia?.consumo_kwh ?? null, 3)} kWh` },
        ...(temInjecao ? [{ k: 'Injetada', v: `${fmt(dia?.injecao_kwh ?? null, 3)} kWh` }] : []),
        { k: 'Reativo indutivo', v: `${fmt(dia?.q_ind_kvarh ?? null, 3)} kvarh` },
        { k: 'Reativo capacitivo', v: `${fmt(dia?.q_cap_kvarh ?? null, 3)} kvarh` },
      ]} />

      {snap && (
        <>
          <GrupoTitulo right={<span className="text-[11px] text-muted-foreground">{hhmmD(new Date(snap.timestamp_dados))}</span>}>Último bloco do medidor</GrupoTitulo>
          <Section rows={[
            { k: 'Consumo médio', v: `${fmt(snap.kW_consumo, 2)} kW` },
            ...(temInjecao ? [{ k: 'Injeção média', v: `${fmt(snap.kW_injecao, 2)} kW` }] : []),
            { k: 'Fator de potência', v: snap.FP ? `${fmt(snap.FP, 3)} ${snap.FP_natureza === 'cap' ? 'cap.' : 'ind.'}` : '—' },
          ]} />
        </>
      )}
      <p className="text-[11px] text-muted-foreground mt-2">Medidor lido pela SSU: energia e demanda vêm dos blocos do medidor; o "agora" é a parcial de 1 em 1 min da TON.</p>
    </>
  );
}

// ============================================================ modal (layout do mockup)

// Cores por token do tema (claro/escuro): verde = dentro do contratado (chart-1), ciano = injeção
// (chart-5), âmbar = atenção (chart-3), vermelho = acima da tolerância (destructive); verde claro =
// meses passados no gráfico mensal.
const INJ = COR.corrente;
const VERDE = COR.geracao;
const AMBAR = COR.consumo;
const VERM = 'var(--destructive)';
const VERDE_CLARO = 'color-mix(in srgb, var(--chart-1) 45%, transparent)';
const Q15 = 15 * 60_000;
const DIA = 86_400_000;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const kw = (w: unknown) => { const v = Number(w); return Number.isFinite(v) ? v / 1000 : null; };
const fpDe = (d: Record<string, unknown>) => {
  const f = Number(d?.FPt); if (Number.isFinite(f) && f !== 0) return Math.abs(f);
  const p = Number(d?.Pt), q = Number(d?.St);
  return Number.isFinite(p) && Number.isFinite(q) && q > 0 ? Math.min(1, Math.abs(p) / q) : null;
};
/** FP a partir de P e Q (kW/kvar). */
const fpPQ = (p: number, q: number) => { const sv = Math.hypot(p, q); return sv > 0 ? Math.abs(p) / sv : null; };
const hhmm = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const ddmm = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const n0 = (v: number | null | undefined) => fmt(v, 0);
/** kW como no mockup ("268"); abaixo de 100 com uma casa ("2,4"). */
const kwTxt = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : fmt(v, Math.abs(v) >= 100 ? 0 : 1));
const inicioDoDia = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const inicioDoMes = (t = Date.now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const diasNoMes = (t = Date.now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
const desde = () => `01/${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const VAZIO = ' ';

/** Grades de 2 colunas do mockup: viram 1 coluna abaixo de 760 px. */
const CSS_MED = '.nx-eq .nxm-g2{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:16px;align-items:stretch}'
  + '@media (max-width:759px){.nx-eq .nxm-g2{grid-template-columns:minmax(0, 1fr)}}';

const card16: CSSProperties = { background: NX.card, border: `1px solid ${NX.borda}`, borderRadius: 16 };
const card14: CSSProperties = { background: NX.card, border: `1px solid ${NX.borda}`, borderRadius: 14 };
const tab: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const cel = (i: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 18px', ...(i % 2 ? { borderLeft: `1px solid ${NX.linha}` } : {}) });

type Per = 'hoje' | 'ciclo';
interface Kpi { k: string; v: string; s: string }
interface FpRow { k: string; s: string; v: string; w: boolean }
interface PostoE { c: number | null; i: number | null }
type Postos = Record<'Ponta' | 'Fora de ponta' | 'Reservado', PostoE> & { Total: PostoE };

/** Linha do gráfico mensal (BarChart categórico): o mês em `k`, a demanda em `v` e uma cor por barra. */
interface LinhaMes extends Record<string, unknown> { k: string; v: number | null; passado: number; atual: number; acima: number; teto: number }

/** Tudo o que a tela mostra; as duas fontes (SSU e PM) preenchem este modelo. */
interface Vista {
  tone: NxTone; stLabel: string; stText: string;
  terminaEm: string; proj: number | null; contr: number | null; tol: number | null;
  kpis: Kpi[];
  gen: boolean;
  per: Per; setPer: (p: Per) => void;
  /** 96 intervalos de hoje, fluxo líquido em kW (injeção negativa). */
  hoje: Array<number | null> | null;
  /** Um ponto por dia do mês: máxima de 15 min de consumo e de injeção. */
  ciclo: Array<{ c: number | null; i: number | null }> | null;
  horarios: Horarios;
  maxMes: { kw: number; t: number | null } | null;
  meses: Array<{ k: string; v: number | null }>;
  injMaxMes: { kw: number; t: number } | null;
  fps: FpRow[];
  postos: Postos | null;
  reativa: string; excedente: string;
  equipamentoId: string;
}

/** Linha do gráfico de fluxo (uma por intervalo/dia): consumo e injeção em kW, sempre ≥ 0 (barra do bklit não desce do zero); `lido` = teve leitura. */
interface LinhaFluxo extends Record<string, unknown> { date: Date; consumo: number; injecao: number; teto: number; acima: boolean; lido: boolean }

function Fluxo({ v }: { v: Vista }) {
  const { per, gen, contr, tol, hoje, ciclo, horarios } = v;
  const dia0 = inicioDoDia();
  const mes0 = inicioDoMes();
  const nDias = diasNoMes();
  // Todos os intervalos do dia / dias do mês entram (o ComposedChart não tem xDomain): o eixo cobre o
  // período inteiro e a largura da barra sai certa; intervalo sem leitura fica com zero e `lido: false`.
  const linhas: LinhaFluxo[] = [];
  if (per === 'hoje') {
    for (let i = 0; i < 96; i++) {
      const x = hoje?.[i] ?? null;
      linhas.push({ date: new Date(dia0 + i * Q15), consumo: Math.max(0, x ?? 0), injecao: Math.max(0, -(x ?? 0)), teto: 0, acima: tol != null && x != null && x > tol, lido: x != null });
    }
  } else {
    const m = new Date(mes0);
    for (let i = 0; i < nDias; i++) {
      const d = ciclo?.[i];
      linhas.push({ date: new Date(m.getFullYear(), m.getMonth(), i + 1), consumo: d?.c ?? 0, injecao: gen ? d?.i ?? 0 : 0, teto: 0, acima: tol != null && d?.c != null && d.c > tol, lido: d != null && (d.c != null || d.i != null) });
    }
  }
  const maior = Math.max(0, ...linhas.map((l) => Math.max(l.consumo, l.injecao)));
  // Teto do eixo acima da contratada e do maior valor: o bklit não tem yDomain, a série `teto` é invisível.
  const teto = Math.max((contr ?? 0) * 1.05, maior, 1);
  linhas.forEach((l) => { l.teto = teto; });
  const util = new Date().getDay() !== 0 && new Date().getDay() !== 6;
  const [p0, p1] = horarios.ponta;
  const ponta = per === 'hoje' && util && p1 > p0;
  const vazio = (per === 'hoje' ? hoje : ciclo) != null && !linhas.some((l) => l.lido);
  const item: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {vazio ? (
        <div style={{ height: 160, display: 'grid', placeItems: 'center', fontSize: 12, color: NX.mudo }}>Sem leituras no período</div>
      ) : (
        <div style={{ height: 160 }} role="img" aria-label={per === 'hoje' ? 'Fluxo na rede por intervalo de 15 minutos hoje' : 'Demanda máxima de 15 minutos por dia do ciclo'}>
          <ComposedChart data={linhas} stacked={per === 'hoje'} aspectRatio="auto" className="h-full"
            margin={{ top: 8, right: 12, bottom: 24, left: 56 }} animationDuration={0}>
            <Grid horizontal numTicksRows={4} highlightRowValues={contr != null ? [contr] : []} highlightRowStroke={COR.neutro} highlightRowStrokeDasharray="5,5" />
            <SeriesBar dataKey="consumo" fill={VERDE} radius={1} animate={false} />
            {gen ? <SeriesBar dataKey="injecao" fill={INJ} radius={1} animate={false} /> : null}
            <Line dataKey="teto" {...LINHA_SO_DOMINIO} />
            <XAxis numTicks={5} />
            <YAxis numTicks={4} formatValue={(x) => `${n0(x)} kW`} />
            {ponta ? <ReferenceArea x1={new Date(dia0 + p0 * 3_600_000 - Q15 / 2)} x2={new Date(dia0 + p1 * 3_600_000 - Q15 / 2)} fill={VERM} fillOpacity={0.07} strokeWidth={0} fadeEdges={false} /> : null}
            {tol != null ? <ReferenceArea y1={tol} y2={teto * 2} fill={VERM} fillOpacity={0.05} stroke={VERM} strokeDasharray="2,4" fadeEdges={false} /> : null}
            <ChartTooltip showCrosshair={false} showDots={false} content={({ point }) => {
              const l = point as LinhaFluxo;
              const t = l.date.getTime();
              const titulo = per === 'hoje' ? `${hhmm(t)}–${hhmm(t + Q15)}` : ddmm(t);
              if (!l.lido) return <TooltipDestaque titulo={titulo} valor="—" rotulo="Sem leitura" />;
              const injecao = gen && l.injecao > 0;
              const principal = per === 'hoje' && injecao ? { v: l.injecao, r: 'Injeção' } : { v: l.consumo, r: per === 'hoje' ? 'Consumo' : 'Demanda máxima' };
              return (
                <TooltipDestaque
                  titulo={titulo}
                  valor={kwTxt(principal.v)} unidade="kW" rotulo={principal.r}
                  linhas={[
                    ...(per === 'ciclo' && injecao ? [{ label: 'Injeção máxima', value: `${kwTxt(l.injecao)} kW`, cor: INJ }] : []),
                    ...(contr != null ? [{ label: 'Contratada', value: `${n0(contr)} kW` }] : []),
                    ...(l.acima && tol != null ? [{ label: 'Acima da tolerância', value: `+${kwTxt(l.consumo - tol)} kW`, cor: VERM }] : []),
                  ]}
                />
              );
            }} />
          </ComposedChart>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', fontSize: 12, color: NX.mudo }}>
        {contr != null && <span style={item}><span style={{ width: 14, borderTop: `1.5px dashed ${NX.texto}` }} />Contratada {n0(contr)} kW</span>}
        {tol != null && <span style={item}><span style={{ width: 10, height: 10, borderRadius: 2, background: VERM, opacity: 0.3 }} />Acima da tolerância ({n0(tol)} kW)</span>}
        {ponta && <span style={item}><span style={{ width: 10, height: 10, borderRadius: 2, background: VERM, opacity: 0.15 }} />Ponta {p0}h–{p1}h</span>}
      </div>
    </div>
  );
}

function FpCard({ fps }: { fps: FpRow[] }) {
  return (
    <div style={{ ...card14, padding: '0 18px' }}>
      <div style={{ fontSize: 15, fontWeight: 800, padding: '12px 0' }}>Fator de potência e reativo</div>
      {fps.map((f) => (
        <div key={f.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 54, borderTop: `1px solid ${NX.linha}` }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{f.k}</span>
            <span style={{ fontSize: 12, color: NX.mudo }}>{f.s}</span>
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, ...tab, whiteSpace: 'nowrap', color: f.w ? AMBAR : NX.texto }}>{f.v}</span>
        </div>
      ))}
    </div>
  );
}

interface LogMqtt { mensagem?: string | null; severidade?: string | null; created_at?: string; regra?: { nome?: string | null } | null }

/** Registros do equipamento (regras de log MQTT), no formato do mockup: DATA · evento. */
function RegistrosMed({ equipamentoId }: { equipamentoId: string }) {
  const [rows, setRows] = useState<LogMqtt[] | null>(null);
  useEffect(() => {
    let vivo = true;
    api.get('/logs-mqtt', { params: { equipamentoId: equipamentoId.trim(), limit: 4, page: 1 } })
      .then((r) => { if (vivo) { const d = unwrap<LogMqtt[] | { data?: LogMqtt[] }>(r); setRows(Array.isArray(d) ? d : d?.data ?? []); } })
      .catch(() => { if (vivo) setRows([]); });
    return () => { vivo = false; };
  }, [equipamentoId]);
  const logs = (rows ?? []).map((l) => {
    const sev = String(l.severidade ?? '').toUpperCase();
    const t = l.created_at ? new Date(l.created_at).getTime() : 0;
    return { t, q: t ? `${ddmm(t)} ${hhmm(t)}` : '—', txt: l.mensagem ?? l.regra?.nome ?? 'Evento', w: sev === 'CRITICA' || sev === 'CRÍTICA' || sev === 'ALTA' || sev === 'MEDIA' || sev === 'MÉDIA' };
  }).sort((a, b) => b.t - a.t).slice(0, 4);
  return (
    <div style={{ ...card14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Registros</span>
        <Link to={`/logs/logs-mqtt?equipamentoId=${encodeURIComponent(equipamentoId.trim())}`} style={{ fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>Ver todos ›</Link>
      </div>
      {rows == null || logs.length === 0 ? (
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>{rows == null ? 'Carregando…' : 'Nenhum registro deste equipamento.'}</div>
      ) : logs.map((l, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}` }}>
          <span style={{ fontSize: 13, color: NX.mudo, ...tab }}>{l.q}</span>
          <span style={{ fontSize: 14, color: l.w ? AMBAR : NX.texto, ...(l.w ? { fontWeight: 700 } : {}) }}>{l.txt}</span>
        </div>
      ))}
    </div>
  );
}

/** Corpo da aba Operação — mesma marcação do mockup para as duas fontes. */
function MedidorVista({ v }: { v: Vista }) {
  const { contr, tol, proj } = v;
  const res = useResumoMedidor(v.equipamentoId);
  const g = res?.geracao ?? null;
  const gen = v.gen || !!g || (res?.injecao_kwh ?? 0) > 0;
  const pct = contr && proj != null ? proj / contr : null;
  const over = tol != null && proj != null && proj > tol;
  const maxPct = contr && v.maxMes ? v.maxMes.kw / contr : null;
  const folga = tol != null && v.maxMes ? tol - v.maxMes.kw : null;
  const mVals = v.meses.map((m) => m.v ?? 0);
  const MS = Math.max((contr ?? 0) * 1.2, Math.max(0, ...mVals) * 1.1, 1);
  /** Linhas do gráfico mensal: uma cor por barra (3 séries exclusivas empilhadas) e `teto` transparente para o eixo ir até MS. */
  const meses: LinhaMes[] = v.meses.map((m, i) => {
    const atual = i === v.meses.length - 1, ov = tol != null && m.v != null && m.v > tol, x = m.v ?? 0;
    return { k: m.k, v: m.v, passado: !ov && !atual ? x : 0, atual: !ov && atual ? x : 0, acima: ov ? x : 0, teto: Math.max(0, MS - x) };
  });
  const ultrap = v.meses.filter((m) => tol != null && m.v != null && m.v > tol);
  const cicloTxt = `desde ${desde()}`;
  const injMax = v.injMaxMes ?? (res?.injecao_max ? { kw: res.injecao_max.kw, t: new Date(res.injecao_max.timestamp).getTime() } : null);
  const kwh = (x: number | null | undefined) => (x == null ? '—' : `${n0(x)} kWh`);
  const gens: Kpi[] = [
    { k: 'Geração agora', v: g?.agora_kw != null ? `${kwTxt(g.agora_kw)} kW` : '—', s: g ? `${g.inversores} inversor${g.inversores > 1 ? 'es' : ''} da instalação` : 'inversores da instalação' },
    { k: 'Máx. geração do mês', v: g?.max_mes ? `${kwTxt(g.max_mes.kw)} kW` : '—', s: g?.max_mes ? quando(g.max_mes.timestamp) : VAZIO },
    { k: 'Produzida hoje', v: kwh(g?.hoje_kwh), s: 'até agora' },
    { k: 'Produzida no ciclo', v: kwh(g?.ciclo_kwh), s: cicloTxt },
    { k: 'Injeção máx. do mês', v: injMax ? `${kwTxt(injMax.kw)} kW` : '—', s: injMax ? `${ddmm(injMax.t)} · ${hhmm(injMax.t)} · medidor` : 'medidor' },
    { k: 'Autoconsumo no ciclo', v: kwh(g?.autoconsumo_kwh), s: g?.autoconsumo_kwh != null && g.ciclo_kwh ? `${Math.round((g.autoconsumo_kwh / g.ciclo_kwh) * 100)}% da produção` : VAZIO },
  ];
  const fps = fpsDoResumo(res, cicloTxt);
  const reativa = res ? `${n0(res.energia_reativa_kvarh)} kvarh` : v.reativa;
  const excedente = res ? `${n0(res.reativo_excedente_kvarh)} kvarh` : v.excedente;
  const C = { P: VERM, FP: COR.potencia, HR: VERDE } as const;
  const dot = (c: keyof typeof C | ''): CSSProperties => ({ width: 8, height: 8, borderRadius: 3, flex: 'none', background: c ? C[c] : 'transparent' });
  const p = v.postos;
  const e = (x: number | null | undefined) => (p == null || x == null ? '—' : n0(x));
  const liq = (x: PostoE | undefined) => (x && x.c != null && x.i != null ? x.c - x.i : null);
  const postosG = [
    { k: 'Ponta', r: p?.Ponta, d: 'P' as const },
    { k: 'Fora ponta', r: p?.['Fora de ponta'], d: 'FP' as const },
    { k: 'Reservado', r: p?.Reservado, d: 'HR' as const },
    { k: 'Total', r: p?.Total, d: '' as const },
  ];
  const postosN = [
    { k: 'Ponta', r: p?.Ponta, d: 'P' as const },
    { k: 'Fora de ponta', r: p?.['Fora de ponta'], d: 'FP' as const },
    { k: 'Reservado (HR)', r: p?.Reservado, d: 'HR' as const },
    { k: 'Total', r: p?.Total, d: '' as const },
  ];
  const segBtn = (sel: boolean): CSSProperties => ({ height: 30, padding: '0 12px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', ...(sel ? { borderRadius: 9, background: NX.card } : { color: NX.mudo }) });

  return (
    <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{CSS_MED}</style>
      <div className="nxm-g2">
        <div style={{ ...card16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, color: NX.mudo }}>Intervalo de 15 min · termina em</span>
            <span style={{ fontSize: 20, fontWeight: 800, ...tab }}>{v.terminaEm}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 44, lineHeight: '48px', fontWeight: 800, ...tab, letterSpacing: -1 }}>{kwTxt(proj)}</span>
            <span style={{ fontSize: 16, color: NX.mudo }}>kW projetados</span>
          </div>
          <div style={{ position: 'relative', height: 14, borderRadius: 7, background: NX.linha }}>
            {pct != null && <div style={{ height: '100%', borderRadius: 7, width: `${Math.max(0, Math.min(100, (pct / 1.2) * 100))}%`, background: over ? VERM : pct > 0.95 ? AMBAR : VERDE }} />}
            <div style={{ position: 'absolute', top: -4, bottom: -4, width: 2, background: NX.texto, left: '83.33%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: NX.mudo }}>
            <span>{pct != null ? `${Math.round(pct * 100)}% da contratada` : '— da contratada'}</span>
            <span>Contratada {n0(contr)} kW · tolerância {n0(tol)} kW</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${NX.linha}`, paddingTop: 12 }}>
            <span style={s.stDot(v.tone)} />
            <span style={s.stLabel(v.tone)}>{v.stLabel}</span>
            <span style={{ fontSize: 14, color: NX.mudo }}>{v.stText}</span>
          </div>
        </div>
        <div style={{ ...card16, padding: '18px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignContent: 'space-around', rowGap: 18 }}>
          {v.kpis.map((k, i) => (
            <div key={k.k} style={cel(i)}>
              <span style={{ fontSize: 12, color: NX.mudo }}>{k.k}</span>
              <span style={{ fontSize: 24, fontWeight: 800, ...tab }}>{k.v}</span>
              <span style={{ fontSize: 11, color: NX.mudo, whiteSpace: 'nowrap' }}>{k.s || VAZIO}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card14, padding: '12px 16px 14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', rowGap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{gen ? 'Fluxo na rede por intervalo de 15 min' : 'Demanda por intervalo de 15 min'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {gen && (
              <span style={{ display: 'flex', gap: 14, fontSize: 12, color: NX.mudo }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: VERDE }} />Consumo</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: INJ }} />Injeção</span>
              </span>
            )}
            <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: NX.seg }}>
              <button type="button" aria-pressed={v.per === 'hoje'} onClick={() => v.setPer('hoje')} style={segBtn(v.per === 'hoje')}>Hoje</button>
              <button type="button" aria-pressed={v.per === 'ciclo'} onClick={() => v.setPer('ciclo')} style={segBtn(v.per === 'ciclo')}>Ciclo</button>
            </div>
          </div>
        </div>
        <Fluxo v={v} />
      </div>

      <div className="nxm-g2">
        <div style={{ ...card14, padding: '12px 18px 14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Demanda × contratada</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, color: NX.mudo }}>Máxima do mês</span>
              <span style={{ fontSize: 26, fontWeight: 800, ...tab }}>{v.maxMes ? `${kwTxt(v.maxMes.kw)} kW` : '—'}</span>
              <span style={{ fontSize: 12, color: NX.mudo }}>
                {v.maxMes?.t != null ? `${ddmm(v.maxMes.t)} · ${hhmm(v.maxMes.t)} · ${postoEm(new Date(v.maxMes.t - 60_000), v.horarios).toLowerCase()}` : '—'}
              </span>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
              <span style={{ fontSize: 20, fontWeight: 800, ...tab }}>{maxPct != null ? `${Math.round(maxPct * 100)}%` : '—'}</span>
              <span style={{ fontSize: 12, color: NX.mudo }}>da contratada</span>
              {folga != null && folga < 0
                ? <span style={{ fontSize: 12, color: VERM, fontWeight: 800 }}>{n0(-folga)} kW acima da tolerância</span>
                : <span style={{ fontSize: 12, color: NX.mudo }}>folga até tolerância {folga != null ? `${n0(folga)} kW` : '—'}</span>}
            </span>
          </div>
          <div style={{ height: 150 }} role="img" aria-label="Demanda máxima por mês comparada à contratada">
            <BarChart data={meses} xDataKey="k" stacked aspectRatio="auto" className="h-full" margin={{ top: 8, right: 8, bottom: 24, left: 44 }} barGap={0.35} animationDuration={0}>
              <Grid horizontal numTicksRows={4} highlightRowValues={contr != null ? [contr] : []} highlightRowStroke={COR.neutro} highlightRowStrokeDasharray="5,5" />
              {tol != null ? <Grid horizontal numTicksRows={0} highlightRowValues={[tol]} highlightRowStroke={VERM} highlightRowStrokeOpacity={0.6} highlightRowStrokeDasharray="2,4" /> : null}
              <Bar dataKey="passado" fill={VERDE_CLARO} lineCap="butt" animate={false} />
              <Bar dataKey="atual" fill={VERDE} lineCap="butt" animate={false} />
              <Bar dataKey="acima" fill={VERM} lineCap="butt" animate={false} />
              <Bar dataKey="teto" fill="transparent" lineCap="butt" animate={false} />
              <BarXAxis showAllLabels />
              <YAxis numTicks={4} formatValue={(x) => n0(x)} />
              <ChartTooltip showDatePill={false} showCrosshair={false} showDots={false} content={({ point }) => {
                const m = point as LinhaMes;
                return m.v == null
                  ? <TooltipDestaque titulo={m.k} valor="—" rotulo="Sem medição" />
                  : (
                    <TooltipDestaque titulo={m.k} valor={kwTxt(m.v)} unidade="kW" rotulo="Demanda máxima" linhas={[
                      ...(contr != null ? [{ label: 'Contratada', value: `${n0(contr)} kW` }] : []),
                      ...(tol != null ? [{ label: m.v > tol ? 'Acima da tolerância' : 'Tolerância', value: m.v > tol ? `+${n0(m.v - tol)} kW` : `${n0(tol)} kW`, cor: m.v > tol ? VERM : undefined }] : []),
                    ]} />
                  );
              }} />
            </BarChart>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: NX.mudo, gap: 8 }}>
            <span style={{ display: 'flex', gap: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, borderTop: `1.5px dashed ${NX.texto}` }} />Contratada {n0(contr)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, borderTop: `1.5px dashed ${VERM}` }} />Tolerância {n0(tol)}</span>
            </span>
            {ultrap.length > 0
              ? <span style={{ color: VERM, fontWeight: 800 }}>{ultrap.length} ultrapassage{ultrap.length > 1 ? 'ns' : 'm'} · {ultrap.map((m) => m.k).join(', ')}</span>
              : <span>Sem ultrapassagem</span>}
          </div>
        </div>
        {gen ? (
          <div style={{ ...card14, padding: '12px 0 14px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, padding: '0 18px' }}>Geração</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', rowGap: 16 }}>
              {gens.map((g, i) => (
                <div key={g.k} style={cel(i)}>
                  <span style={{ fontSize: 12, color: NX.mudo }}>{g.k}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, ...tab }}>{g.v}</span>
                  <span style={{ fontSize: 11, color: NX.mudo, whiteSpace: 'nowrap' }}>{g.s}</span>
                </div>
              ))}
            </div>
          </div>
        ) : <FpCard fps={fps} />}
      </div>

      <div className={gen ? 'nxm-g2' : undefined} style={gen ? undefined : { display: 'block' }}>
        <div style={{ ...card14, padding: '0 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Energia do ciclo</span>
            <span style={{ fontSize: 12, color: NX.mudo }}>{cicloTxt}</span>
          </div>
          {gen ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, padding: '6px 0', borderTop: `1px solid ${NX.linha}` }}>
                <span>kWh</span><span style={{ textAlign: 'right' }}>CONSUMIDA</span><span style={{ textAlign: 'right' }}>INJETADA</span><span style={{ textAlign: 'right' }}>LÍQUIDA</span>
              </div>
              {postosG.map((r) => (
                <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', alignItems: 'center', minHeight: 40, fontSize: 14, borderTop: `1px solid ${NX.linha}`, ...(r.d ? {} : { fontWeight: 800 }) }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={dot(r.d)} />{r.k}</span>
                  <span style={{ textAlign: 'right', ...tab }}>{e(r.r?.c)}</span>
                  <span style={{ textAlign: 'right', ...tab, color: INJ }}>{e(r.r?.i)}</span>
                  <span style={{ textAlign: 'right', ...tab }}>{e(liq(r.r))}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, padding: '6px 0', borderTop: `1px solid ${NX.linha}` }}>
                <span>POSTO</span><span style={{ textAlign: 'right' }}>CONSUMIDA kWh</span>
              </div>
              {postosN.map((r) => (
                <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', alignItems: 'center', minHeight: 40, fontSize: 14, borderTop: `1px solid ${NX.linha}`, ...(r.d ? {} : { fontWeight: 800 }) }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={dot(r.d)} />{r.k}</span>
                  <span style={{ textAlign: 'right', ...tab }}>{e(r.r?.c)}</span>
                </div>
              ))}
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, borderTop: `1px solid ${NX.linha}` }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Energia reativa</span>
            <span style={{ fontSize: 15, fontWeight: 800, ...tab }}>{reativa}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, borderTop: `1px solid ${NX.linha}` }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 14, fontWeight: 700 }}>Reativo excedente</span><span style={{ fontSize: 12, color: NX.mudo }}>Abaixo de FP 0,92</span></span>
            <span style={{ fontSize: 15, fontWeight: 800, color: !res || res.reativo_excedente_kvarh <= 0 ? NX.texto : AMBAR, ...tab }}>{excedente}</span>
          </div>
        </div>
        {gen && <FpCard fps={fps} />}
      </div>

      <RegistrosMed equipamentoId={v.equipamentoId} />
    </div>
  );
}

/** Linhas de FP sem fonte de dado: o mockup pede o mês/ciclo, a telemetria não traz. */
const fpsSemFonte = (): FpRow[] => [
  { k: 'Menor FP indutivo', s: 'limite 0,92', v: '—', w: false },
  { k: 'Menor FP capacitivo', s: 'horário capacitivo do medidor', v: '—', w: false },
  { k: 'FP médio do ciclo', s: `desde ${desde()}`, v: '—', w: false },
  { k: 'Reativo máx. do mês', s: VAZIO, v: '—', w: false },
];

/** Resumo do ciclo calculado na API (GET /equipamentos-dados/:id/medidor/resumo). */
interface ResumoMedidor {
  ciclo_inicio: string;
  injecao_kwh: number;
  injecao_max: { kw: number; timestamp: string } | null;
  fp_min_ind: { fp: number; timestamp: string } | null;
  fp_min_cap: { fp: number; timestamp: string } | null;
  fp_medio: number | null;
  reativo_max: { kvar: number; natureza: 'ind' | 'cap'; timestamp: string } | null;
  energia_reativa_kvarh: number;
  reativo_excedente_kvarh: number;
  geracao: null | {
    inversores: number; agora_kw: number | null; max_mes: { kw: number; timestamp: string } | null;
    hoje_kwh: number | null; ciclo_kwh: number | null; autoconsumo_kwh: number | null;
  };
}
function useResumoMedidor(equipamentoId: string) {
  const [res, setRes] = useState<ResumoMedidor | null>(null);
  useEffect(() => {
    let vivo = true;
    const ler = () => api.get(`/equipamentos-dados/${equipamentoId.trim()}/medidor/resumo`)
      .then((r) => { if (vivo) setRes(unwrap<ResumoMedidor>(r)); })
      .catch(() => undefined);
    void ler();
    const t = setInterval(ler, 5 * 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, [equipamentoId]);
  return res;
}
const quando = (iso?: string | null) => (iso ? `${ddmm(new Date(iso).getTime() - 60_000)} · ${hhmm(new Date(iso).getTime() - 15 * 60_000)}` : VAZIO);
function fpsDoResumo(r: ResumoMedidor | null, cicloTxt: string): FpRow[] {
  if (!r) return fpsSemFonte();
  const f2 = (x: number) => fmt(x, 2);
  return [
    { k: 'Menor FP indutivo', s: r.fp_min_ind ? `${quando(r.fp_min_ind.timestamp)} · limite 0,92` : 'limite 0,92', v: r.fp_min_ind ? f2(r.fp_min_ind.fp) : '—', w: !!r.fp_min_ind && r.fp_min_ind.fp < 0.92 },
    { k: 'Menor FP capacitivo', s: r.fp_min_cap ? `${quando(r.fp_min_cap.timestamp)} · horário capacitivo do medidor` : 'horário capacitivo do medidor', v: r.fp_min_cap ? f2(r.fp_min_cap.fp) : '—', w: !!r.fp_min_cap && r.fp_min_cap.fp < 0.92 },
    { k: 'FP médio do ciclo', s: cicloTxt, v: r.fp_medio != null ? f2(r.fp_medio) : '—', w: r.fp_medio != null && r.fp_medio < 0.92 },
    { k: 'Reativo máx. do mês', s: r.reativo_max ? `${quando(r.reativo_max.timestamp)} · ${r.reativo_max.natureza === 'cap' ? 'capacitivo' : 'indutivo'}` : VAZIO, v: r.reativo_max ? `${n0(r.reativo_max.kvar)} kvar` : '—', w: false },
  ];
}

/** Rótulos dos últimos n meses (o atual por último). */
const rotulosMeses = (n = 6) => {
  const h = new Date();
  return Array.from({ length: n }, (_, k) => MESES[new Date(h.getFullYear(), h.getMonth() - (n - 1 - k), 1).getMonth()]);
};

// ------------------------------------------------------------------ fonte PM

/** Demanda máxima dos últimos N meses (um /custos-energia por mês). */
function useDemandaMeses(equipamentoId: string, n = 6) {
  const [rows, setRows] = useState<Array<{ k: string; v: number | null }> | null>(null);
  useEffect(() => {
    let vivo = true;
    const hoje = new Date();
    const meses = Array.from({ length: n }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1 - i), 1));
    Promise.all(meses.map((m) =>
      equipamentosDadosService.getCustosEnergia(equipamentoId, { periodo: 'mes', data: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01` })
        .then((r) => Number(custosDe(r)?.consumo?.demanda_maxima_kw) || null)
        .catch(() => null),
    )).then((vs) => { if (vivo) setRows(meses.map((m, i) => ({ k: MESES[m.getMonth()], v: vs[i] }))); });
    return () => { vivo = false; };
  }, [equipamentoId, n]);
  return rows;
}

/** Operação do medidor com telemetria direta (PM M160/PD666: Pt/Qt/St em W). */
function MedidorPm({ equipamentoId, onStatus }: { equipamentoId: string; onStatus: (s: StatusMed) => void }) {
  const { dados, ts, carregado } = useDados(equipamentoId);
  const [per, setPer] = useState<Per>('hoje');
  const info = tsInfo(ts);
  const n = (p: string) => { const v = getPath(dados, p); return v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v); };

  // Histórico de hoje (fluxo, intervalo de 15 min, FP). Recarrega a cada 2 min.
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 120_000); return () => clearInterval(t); }, []);
  const [ini, fim, mesIni] = useMemo(() => [new Date(inicioDoDia()), new Date(), new Date(inicioDoMes())], [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pts } = useHistorico(equipamentoId, ini, fim);
  // Ciclo: histórico do mês, só quando a aba Ciclo do gráfico é aberta.
  const { pts: ptsMes } = useHistorico(equipamentoId, mesIni, fim, per === 'ciclo');

  const { res: mes } = useCustos(equipamentoId, 'mes');
  const meses = useDemandaMeses(equipamentoId);
  const horarios = useHorarios(equipamentoId);

  const contr = Number(mes?.consumo?.demanda_contratada_kw) || null;
  const tol = contr != null ? contr * 1.05 : null;

  const now = Date.now();
  const qIni = inicioDoDia(now) + Math.floor((now - inicioDoDia(now)) / Q15) * Q15;
  const qFim = qIni + Q15;
  const ptAgora = kw(n('Pt'));
  const noIntervalo = (pts ?? []).filter((p) => p.t >= qIni);
  const media = (f: (d: Record<string, unknown>) => number | null) => {
    const v = noIntervalo.map((p) => f(p.d)).filter((x): x is number => x != null && Number.isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  // Projeção: média até agora + leitura atual mantida até o fim do intervalo.
  const mediaInt = media((d) => kw(d?.Pt));
  const decorrido = Math.min(1, (now - qIni) / Q15);
  const proj = mediaInt != null && ptAgora != null ? mediaInt * decorrido + ptAgora * (1 - decorrido) : mediaInt ?? ptAgora;
  const fpInt = (() => { const p = media((d) => Math.abs(Number(d?.Pt))), st = media((d) => Number(d?.St)); return p != null && st ? Math.min(1, p / st) : null; })();

  let tone: NxTone = 'ok', stLabel = 'Normal', stText = 'Comunicando · medidor online';
  if (!carregado) { tone = 'off'; stLabel = 'Carregando…'; stText = 'Buscando a última leitura'; }
  else if (!info.online) { tone = 'off'; stLabel = 'Sem comunicação'; stText = info.hasTs ? `Última leitura ${info.idade}` : 'Sem leitura'; }
  else if (tol != null && proj != null && proj > tol) { tone = 'warn'; stLabel = 'Alerta'; stText = 'Projeção acima da tolerância'; }
  const posto = postoEm(new Date(now), horarios);
  useEffect(() => { onStatus({ tone, label: stLabel, posto }); }, [tone, stLabel, posto]); // eslint-disable-line react-hooks/exhaustive-deps

  const fpAgora = dados ? fpDe(dados) : null;
  const qt = kw(n('Qt'));
  const kpis: Kpi[] = [
    { k: 'Rede agora', v: ptAgora != null ? `${kwTxt(Math.abs(ptAgora))} kW` : '—', s: ptAgora == null ? '' : `${ptAgora < 0 ? 'injetando' : 'importando'} · última leitura` },
    { k: 'Reativo agora', v: qt != null ? `${kwTxt(Math.abs(qt))} kvar` : '—', s: qt == null ? '' : `${qt < 0 ? 'capacitivo' : 'indutivo'} · última leitura` },
    { k: 'FP último minuto', v: fpAgora != null ? fmt(fpAgora, 2) : '—', s: qt == null ? '' : qt < 0 ? 'capacitivo' : 'indutivo' },
    { k: 'FP do intervalo', v: fpInt != null ? fmt(fpInt, 2) : '—', s: 'intervalo em andamento' },
  ];

  const gen = (pts ?? []).some((p) => Number(p.d?.Pt) < 0) || (ptAgora ?? 0) < 0;
  const hoje = useMemo(() => {
    if (!pts) return null;
    const b = bucketize(pts as HistPoint[], ini.getTime(), ini.getTime() + DIA, 96, (d) => kw(d?.Pt));
    return b;
  }, [pts, ini]);
  const hojeComProj = hoje ? hoje.map((x, i) => (i === Math.floor((qIni - ini.getTime()) / Q15) && proj != null ? proj : x)) : null;
  const ciclo = useMemo(() => {
    if (!ptsMes) return null;
    const nd = diasNoMes(mesIni.getTime());
    const b = bucketize(ptsMes, mesIni.getTime(), mesIni.getTime() + nd * DIA, nd * 96, (d) => kw(d?.Pt));
    return Array.from({ length: nd }, (_, d) => {
      const sl = b.slice(d * 96, d * 96 + 96).filter((x): x is number => x != null);
      const c = sl.filter((x) => x > 0), i = sl.filter((x) => x < 0).map((x) => -x);
      return { c: c.length ? Math.max(...c) : null, i: i.length ? Math.max(...i) : null };
    });
  }, [ptsMes, mesIni]);

  const maxMes = Number(mes?.consumo?.demanda_maxima_kw) || null;
  const c = mes?.consumo;
  const postos: Postos | null = c ? {
    Ponta: { c: c.energia_ponta_kwh ?? null, i: null },
    'Fora de ponta': { c: c.energia_fora_ponta_kwh ?? null, i: null },
    Reservado: { c: (c.energia_reservado_kwh || 0) + (c.energia_irrigante_kwh || 0), i: null },
    Total: { c: c.energia_total_kwh ?? null, i: null },
  } : null;

  return (
    <MedidorVista v={{
      tone, stLabel, stText, terminaEm: hhmm(qFim), proj, contr, tol, kpis, gen, per, setPer,
      hoje: hojeComProj, ciclo: per === 'ciclo' ? ciclo : null, horarios,
      maxMes: maxMes != null ? { kw: maxMes, t: null } : null,
      meses: meses ?? rotulosMeses().map((k) => ({ k, v: null })),
      injMaxMes: null, fps: fpsSemFonte(), postos, reativa: '—', excedente: '—', equipamentoId,
    }} />
  );
}

// ------------------------------------------------------------------ fonte SSU

interface Bloco { t: number; c: number; i: number; h: number }
interface MesBlocos { k: string; ini: number; fim: number; blocos: Bloco[] | null }

/**
 * Blocos de 15 min (kW consumo/injeção) dos últimos n meses — /gateway/tendencia?periodo=custom.
 * intervalo=15 força blocos de 15 min em janelas de até 62 dias (API, PR #10): um pedido por
 * mês. O timestamp do bloco é o FIM da janela do medidor.
 * Carrega do mês atual para trás e vai publicando mês a mês.
 */
function useBlocosMeses(equipamentoId: string, n = 6) {
  const [meses, setMeses] = useState<MesBlocos[]>(() => listaMeses(n));
  useEffect(() => {
    let vivo = true;
    const lista = listaMeses(n);
    setMeses(lista);
    const buscar = (ini: number, fim: number) => api.get(`/equipamentos-dados/${equipamentoId.trim()}/gateway/tendencia`, {
      params: { periodo: 'custom', inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(), intervalo: 15 },
    })
      .then((r) => {
        const d = unwrap<{ intervalo_min?: number; dados?: Array<{ timestamp: string; kW_consumo: number; kW_injecao: number }> }>(r);
        const h = (Number(d?.intervalo_min) || 15) / 60;
        return (d?.dados ?? []).map((x) => ({ t: new Date(x.timestamp).getTime(), c: Number(x.kW_consumo) || 0, i: Number(x.kW_injecao) || 0, h }));
      })
      .catch(() => [] as Bloco[]);
    void (async () => {
      for (let k = lista.length - 1; k >= 0 && vivo; k--) {
        const m = lista[k];
        const bs = (await buscar(m.ini, m.fim)).sort((x, y) => x.t - y.t);
        if (vivo) setMeses((prev) => prev.map((p, j) => (j === k ? { ...p, blocos: bs } : p)));
      }
    })();
    return () => { vivo = false; };
  }, [equipamentoId, n]);
  return meses;
}
function listaMeses(n: number): MesBlocos[] {
  const hoje = new Date();
  return Array.from({ length: n }, (_, k) => {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1 - k), 1);
    const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 1);
    return { k: MESES[ini.getMonth()], ini: ini.getTime(), fim: Math.min(fim.getTime(), Date.now()), blocos: null };
  });
}

/** Energia por posto a partir dos blocos (kWh = kW × duração do bloco). */
function energiaPorPosto(blocos: Bloco[], horarios: Horarios): Postos {
  const acc: Postos = { Ponta: { c: 0, i: 0 }, 'Fora de ponta': { c: 0, i: 0 }, Reservado: { c: 0, i: 0 }, Total: { c: 0, i: 0 } };
  for (const b of blocos) {
    const p = postoEm(new Date(b.t - 60_000), horarios);
    acc[p].c = (acc[p].c ?? 0) + b.c * b.h; acc[p].i = (acc[p].i ?? 0) + b.i * b.h;
    acc.Total.c = (acc.Total.c ?? 0) + b.c * b.h; acc.Total.i = (acc.Total.i ?? 0) + b.i * b.h;
  }
  return acc;
}

/** Operação do medidor lido pela SSU (A-966 / TON-V2). */
function MedidorSsu({ equipamentoId, onStatus }: { equipamentoId: string; onStatus: (s: StatusMed) => void }) {
  const { data, error } = useGatewayDashboard(equipamentoId);
  const horarios = useHorarios(equipamentoId);
  const [per, setPer] = useState<Per>('hoje');
  const { data: tend, refetch } = useGatewayTendencia(equipamentoId, '24H');
  useEffect(() => { const t = setInterval(() => void refetch(), 60_000); return () => clearInterval(t); }, [refetch]);
  const meses = useBlocosMeses(equipamentoId);
  const mesAtual = meses[meses.length - 1];

  const agora = data?.minuto_a_minuto?.agora ?? null;
  const serie = data?.minuto_a_minuto?.serie ?? [];
  const intervalo = data?.minuto_a_minuto?.intervalo ?? null;
  const snap = data?.snapshot ?? null;
  const dia = data?.resumo_dia;
  const mes = data?.resumo_mes;
  const contr = data?.unidade?.demanda_carga ?? null;
  const tol = contr != null ? contr * 1.05 : null;
  const gen = (dia?.injecao_kwh ?? 0) > 0 || (mes?.pico_injecao?.kw ?? 0) > 0 || (agora?.kW_injecao ?? 0) > 0
    || !!mesAtual?.blocos?.some((b) => b.i > 0);

  // Fim do intervalo do medidor: "fecha em N s" contado a partir da leitura do dashboard.
  const [fimInt, setFimInt] = useState<number | null>(null);
  useEffect(() => {
    setFimInt(intervalo?.fecha_em_s != null ? Math.round((Date.now() + intervalo.fecha_em_s * 1000) / 60_000) * 60_000 : null);
  }, [intervalo]);
  const now = Date.now();
  const dIni = inicioDoDia(now);
  const qIni = dIni + Math.floor((now - dIni) / Q15) * Q15;
  const terminaEm = hhmm(fimInt ?? qIni + Q15);

  const rede = agora ? agora.kW_consumo - agora.kW_injecao : null;
  const kvar = agora ? agora.kvar_ind - agora.kvar_cap : null;
  // Projeção: energia líquida já medida no intervalo + minuto atual mantido até o fim.
  const noIntervalo = serie.filter((m) => new Date(m.timestamp).getTime() >= qIni);
  const proj = intervalo && intervalo.fecha_em_s != null
    ? (intervalo.kwh_consumo - intervalo.kwh_injecao + (rede ?? 0) * (intervalo.fecha_em_s / 3600)) / 0.25
    : noIntervalo.length ? noIntervalo.reduce((a, m) => a + (m.kW_consumo - m.kW_injecao), 0) / noIntervalo.length : rede;

  const info = tsInfo(agora?.timestamp ?? snap?.timestamp_dados ?? null);
  let tone: NxTone = 'ok', stLabel = 'Normal', stText = 'Comunicando · TON online';
  if (!data && !error) { tone = 'off'; stLabel = 'Carregando…'; stText = 'Buscando a última leitura'; }
  else if (!info.online) { tone = 'off'; stLabel = 'Sem comunicação'; stText = error ?? (info.hasTs ? `Última leitura ${info.idade}` : 'Sem leitura do medidor'); }
  else if (tol != null && proj != null && proj > tol) { tone = 'warn'; stLabel = 'Alerta'; stText = 'Projeção acima da tolerância'; }
  // Posto informado pelo próprio medidor (TON-V2); sem ele, pela janela da concessionária.
  const POSTO_PILL: Record<number, string> = { 1: 'Ponta', 2: 'Fora de ponta', 3: 'Reservado' };
  const posto = (agora?.posto ? POSTO_PILL[agora.posto] : null) ?? postoEm(new Date(now), horarios);
  useEffect(() => { onStatus({ tone, label: stLabel, posto }); }, [tone, stLabel, posto]); // eslint-disable-line react-hooks/exhaustive-deps

  const fpMin = agora ? (agora.FP ?? fpPQ(rede ?? 0, kvar ?? 0)) : null;
  const natMin = agora ? (agora.FP_natureza ?? ((kvar ?? 0) < 0 ? 'cap' : 'ind')) : null;
  const sp = noIntervalo.reduce((a, m) => a + (m.kW_consumo - m.kW_injecao), 0);
  const sq = noIntervalo.reduce((a, m) => a + (m.kvar_ind - m.kvar_cap), 0);
  const fpInt = noIntervalo.length ? fpPQ(sp, sq) : null;
  const kpis: Kpi[] = [
    { k: 'Rede agora', v: rede != null ? `${kwTxt(Math.abs(rede))} kW` : '—', s: rede == null ? '' : `${rede < 0 ? 'injetando' : 'importando'} · média 1 min` },
    { k: 'Reativo agora', v: kvar != null ? `${kwTxt(Math.abs(kvar))} kvar` : '—', s: kvar == null ? '' : `${kvar < 0 ? 'capacitivo' : 'indutivo'} · média 1 min` },
    { k: 'FP último minuto', v: fpMin != null ? fmt(fpMin, 2) : '—', s: natMin == null ? '' : natMin === 'cap' ? 'capacitivo' : 'indutivo' },
    { k: 'FP do intervalo', v: fpInt != null ? fmt(fpInt, 2) : '—', s: 'intervalo em andamento' },
  ];

  // Hoje: 96 intervalos; o bloco com timestamp T é a janela [T−15 min, T).
  const hoje = useMemo(() => {
    if (!tend) return null;
    const out: Array<number | null> = Array.from({ length: 96 }, () => null);
    for (const p of tend.dados ?? []) {
      const i = Math.round((new Date(p.timestamp).getTime() - dIni) / Q15) - 1;
      if (i >= 0 && i < 96) out[i] = p.kW_consumo - (gen ? p.kW_injecao : 0);
    }
    return out;
  }, [tend, dIni, gen]);
  const iAtual = Math.floor((now - dIni) / Q15);
  const hojeComProj = hoje ? hoje.map((x, i) => (i === iAtual && proj != null ? proj : x)) : null;
  const ciclo = useMemo(() => {
    if (!mesAtual?.blocos) return null;
    const out = Array.from({ length: diasNoMes(mesAtual.ini) }, () => ({ c: null as number | null, i: null as number | null }));
    for (const b of mesAtual.blocos) {
      const d = new Date(b.t - 60_000).getDate() - 1;
      if (!out[d]) continue;
      out[d] = { c: Math.max(out[d].c ?? 0, b.c), i: Math.max(out[d].i ?? 0, b.i) };
    }
    return out;
  }, [mesAtual]);

  const barras = meses.map((m, k) => {
    const v = m.blocos?.length ? Math.max(...m.blocos.map((b) => b.c)) : null;
    // Mês atual: o pico do dashboard é o mesmo cálculo do faturamento.
    return { k: m.k, v: k === meses.length - 1 && mes?.pico_consumo ? Math.max(mes.pico_consumo.kw, v ?? 0) : v };
  });
  const postos = mesAtual?.blocos ? energiaPorPosto(mesAtual.blocos, horarios) : null;

  return (
    <MedidorVista v={{
      tone, stLabel, stText, terminaEm, proj, contr, tol, kpis, gen, per, setPer,
      hoje: hojeComProj, ciclo, horarios,
      maxMes: mes?.pico_consumo ? { kw: mes.pico_consumo.kw, t: new Date(mes.pico_consumo.timestamp).getTime() } : null,
      meses: barras,
      injMaxMes: mes?.pico_injecao ? { kw: mes.pico_injecao.kw, t: new Date(mes.pico_injecao.timestamp).getTime() } : null,
      fps: fpsSemFonte(), postos, reativa: '—', excedente: '—', equipamentoId,
    }} />
  );
}

// ------------------------------------------------------------- Configuração

function CfgRow({ t, h, v, first }: { t: string; h?: string; v: ReactNode; first?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 62, ...(first ? {} : { borderTop: `1px solid ${NX.linha}` }) }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t}</span>
        {h && <span style={{ fontSize: 12, color: NX.mudo }}>{h}</span>}
      </span>
      <span style={{ fontSize: 15, fontWeight: 800, ...tab, whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );
}

/** Aba Configuração: demanda contratada, postos tarifários e tarifa (leitura). */
function MedidorConfig({ equipamentoId, ssuId }: { equipamentoId: string; ssuId: string | null }) {
  const horarios = useHorarios(equipamentoId);
  const { res: mes } = useCustos(equipamentoId, 'mes');
  const { data } = useGatewayDashboard(ssuId);
  const contr = data?.unidade?.demanda_carga ?? (Number(mes?.consumo?.demanda_contratada_kw) || null);
  const contrG = data?.unidade?.demanda_geracao ?? null;
  const un = mes?.unidade;
  return (
    <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={s.label}>DEMANDA CONTRATADA</span>
      <div style={{ ...s.card, padding: '0 18px' }}>
        <CfgRow first t="Consumo (carga)" h="Cadastro da unidade consumidora" v={contr != null ? `${n0(contr)} kW` : '—'} />
        <CfgRow t="Tolerância" h="5% acima da contratada" v={contr != null ? `${n0(contr * 1.05)} kW` : '—'} />
        <CfgRow t="Geração" h="Cadastro da unidade consumidora" v={contrG != null ? `${n0(contrG)} kW` : '—'} />
      </div>
      <span style={{ ...s.label, marginTop: 12 }}>POSTOS TARIFÁRIOS</span>
      <div style={{ ...s.card, padding: '0 18px' }}>
        <CfgRow first t="Ponta" h="Dias úteis" v={`${fmtHora(horarios.ponta[0])} – ${fmtHora(horarios.ponta[1])}`} />
        <CfgRow t="Reservado (HR)" h="Todos os dias" v={horarios.reservado ? `${fmtHora(horarios.reservado[0])} – ${fmtHora(horarios.reservado[1])}` : '—'} />
        <CfgRow t="Fora de ponta" h="Todo o restante do dia" v="—" />
      </div>
      <span style={{ ...s.label, marginTop: 12 }}>TARIFA</span>
      <div style={{ ...s.card, padding: '0 18px' }}>
        <CfgRow first t="Tarifa usada no valor" h="Custos por posto tarifário" v={mes?.tarifa_fonte === 'PERSONALIZADA' ? 'Personalizada' : mes ? 'Concessionária' : '—'} />
        <CfgRow t="Grupo / subgrupo" h={un?.irrigante ? 'Irrigante' : undefined} v={un ? [un.grupo, un.subgrupo].filter(Boolean).join(' / ') || '—' : '—'} />
      </div>
      <span style={{ fontSize: 12, color: NX.mudo, marginTop: 4 }}>
        {horarios.daConcessionaria ? 'Horários da concessionária ligada à unidade (edição no cadastro de concessionárias).' : 'Concessionária sem janela cadastrada: padrão 18:00–21:00.'}
        {' '}Demanda contratada é editada no cadastro da unidade.
      </span>
    </div>
  );
}

// -------------------------------------------------------------------- modal

export function MedidorSheet({ equipamentoId, nome, onClose, onConfigurarPontos }: { equipamentoId: string; nome?: string; onClose: () => void; onConfigurarPontos?: () => void }) {
  // Fonte da medição: o device IoT associado a este medidor em "Vínculos → Medições"
  // (TON-V2 com SSU, A-966, PM…) — mesmo lookup do DJ→PM. Sem vínculo, o próprio medidor.
  // Só lê depois de resolver a fonte: antes lia o próprio medidor, montava o corpo de PM
  // (5 requisições) e trocava ao chegar a fonte — e o selo dizia "Sem comunicação" no meio.
  const [fonte, setFonte] = useState<{ id: string; nome: string | null } | null>(null);
  const [fonteOk, setFonteOk] = useState(false);
  useEffect(() => {
    let vivo = true;
    setFonte(null);
    setFonteOk(false);
    iotApiService.powerMeterByDisjuntor(equipamentoId)
      .then((r) => { if (vivo && r?.equipamento_id) setFonte({ id: r.equipamento_id.trim(), nome: r.nome }); })
      .catch(() => undefined)
      .finally(() => { if (vivo) setFonteOk(true); });
    return () => { vivo = false; };
  }, [equipamentoId]);
  const idDados = fonte?.id ?? equipamentoId;
  const { dados, carregado } = useDados(fonteOk ? idDados : null);
  const g = (p: string) => getPath(dados, p);
  // Bloco da SSU (A-966 / TON-V2): tem NSU e pulsos em data.phf — não é telemetria instantânea.
  const ehSsu = !!dados && (g('NSU') != null || g('data.phf') != null);
  const [aba, setAba] = useState('op');
  const [status, setStatus] = useState<StatusMed>({ tone: 'off', label: 'Carregando…' });
  const { res: custos } = useCustos(fonteOk ? idDados : null, 'mes');
  const un = custos?.unidade;
  const tarifa = !custos ? null : custos.tarifa_fonte === 'PERSONALIZADA' ? 'tarifa personalizada' : un?.subgrupo ? `tarifa ${un.subgrupo}` : null;
  const subtitle = ['Entrada', un?.nome ?? fonte?.nome ?? null, ehSsu ? 'SSU via TON' : 'medidor direto', tarifa].filter(Boolean).join(' · ');

  return (
    <NxShell
      title={nome || 'Medidor da concessionária'}
      subtitle={subtitle}
      right={(
        <>
          {status.posto && <span style={{ height: 30, padding: '0 12px', borderRadius: 15, background: NX.trilho, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{status.posto}</span>}
          <span style={s.pill(status.tone)}><span style={s.pillDot(status.tone)} />{status.label}</span>
        </>
      )}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {!(fonteOk && carregado)
        ? <div style={{ padding: '24px 4px', fontSize: 14, color: NX.mudo }}>Carregando leituras do medidor…</div>
        : aba === 'cfg'
        ? <>
            {onConfigurarPontos && <div style={{ padding: '20px 24px 0 24px' }}><RotulosUnifilar onConfigurar={onConfigurarPontos} /></div>}
            <MedidorConfig equipamentoId={idDados} ssuId={ehSsu ? idDados : null} />
          </>
        : ehSsu
          ? <MedidorSsu equipamentoId={idDados} onStatus={setStatus} />
          : <MedidorPm equipamentoId={idDados} onStatus={setStatus} />}
    </NxShell>
  );
}

export default MedidorSheet;
