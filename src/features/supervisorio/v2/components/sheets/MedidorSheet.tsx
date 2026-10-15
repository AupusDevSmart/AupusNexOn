import { useEffect, useMemo, useState } from 'react';
import { api } from '@/config/api';
import { iotApiService } from '@/services/iot.services';
import { useGatewayDashboard } from '@/hooks/useGatewayDashboard';
import { useGatewayTendencia } from '@/hooks/useGatewayTendencia';
import { equipamentosDadosService } from '@/services/equipamentos-dados.service';
import { EstadoHero, GrupoTitulo, Section, MiniChart, useDados, getPath, fmt, tsInfo } from './sheetParts';
import {
  EquipShell, Pill, NeutralPill, Card, SectionLabel, KpiCells, FieldRow, Segmented, Registros,
  useCustos, custosDe, useHistorico, useHorarios, postoEm, fmtHora, bucketize, brl, unwrap, TONE_BG, TONE_TEXT,
  type Tone, type HistPoint,
} from './equipUi';

/**
 * Modal do Medidor da concessionária — mockup "Web — Modal do Medidor" (NEXON-5).
 * Duas fontes de medição, escolhidas pelo vínculo em "Vínculos → Medições":
 *  - SSU (A-966 / TON-V2): pulsos por bloco; "agora" é a parcial de 1 em 1 min,
 *    demanda e energia vêm de /equipamentos-dados/:id/gateway/dashboard;
 *  - telemetria direta (PM M160/PD666): Pt/Qt/St em W; intervalo de 15 min, fluxo
 *    do dia e FP saem do histórico de hoje; demanda do mês e energia por posto de
 *    /custos-energia.
 */

export interface StatusMed { tone: Tone; label: string; posto?: string }

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

const INJ = '#1A9BB5';
const kw = (w: unknown) => { const v = Number(w); return Number.isFinite(v) ? v / 1000 : null; };
const fpDe = (d: Record<string, unknown>) => {
  const f = Number(d?.FPt); if (Number.isFinite(f) && f !== 0) return Math.abs(f);
  const p = Number(d?.Pt), s = Number(d?.St);
  return Number.isFinite(p) && Number.isFinite(s) && s > 0 ? Math.min(1, Math.abs(p) / s) : null;
};
const hhmm = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

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

function FluxoDia({ pts, contratada, tol, horarios, gerando }: {
  pts: HistPoint[]; contratada: number | null; tol: number | null; horarios: ReturnType<typeof useHorarios>; gerando: boolean;
}) {
  const ini = new Date(); ini.setHours(0, 0, 0, 0);
  const W = 720, PH = 138, N = 96;
  const vals = bucketize(pts, ini.getTime(), ini.getTime() + 86400000, N, (d) => kw(d?.Pt));
  const pos = Math.max(contratada ?? 0, ...vals.map((v) => (v != null && v > 0 ? v : 0)), 1) * 1.1;
  const neg = gerando ? Math.max(...vals.map((v) => (v != null && v < 0 ? -v : 0)), 0) * 1.1 : 0;
  const H = (v: number) => (v / (pos + neg)) * PH;
  const zY = 10 + H(pos);
  const X = (i: number) => (i / N) * W;
  const util = ini.getDay() !== 0 && ini.getDay() !== 6;
  const [p0, p1] = horarios.ponta;
  const cY = contratada != null ? zY - H(contratada) : null;
  return (
    <svg viewBox="0 0 720 180" width="100%" height="180" className="block mt-2" role="img" aria-label="Fluxo na rede por intervalo de 15 minutos hoje">
      {util && <rect x={(p0 / 24) * W} y="10" width={((p1 - p0) / 24) * W} height={PH} fill="rgba(197,48,48,0.07)" />}
      {util && <text x={(((p0 + p1) / 2) / 24) * W} y="142" fontSize="11" fill="#C53030" textAnchor="middle">Ponta</text>}
      {vals.map((v, i) => {
        if (v == null) return null;
        const a = H(Math.abs(v));
        const c = v < 0 ? INJ : tol != null && v > tol ? '#C53030' : '#2E8B47';
        return <rect key={i} x={X(i) + 0.9} y={v >= 0 ? zY - a : zY} width="5.6" height={Math.max(a, 0.5)} rx="1" fill={c} />;
      })}
      {cY != null && <line x1="0" x2={W} y1={cY} y2={cY} className="stroke-foreground" strokeOpacity="0.55" strokeDasharray="5 5" />}
      {cY != null && <text x={W} y={cY - 6} fontSize="11" className="fill-muted-foreground" textAnchor="end">Contratada {fmt(contratada, 0)} kW</text>}
      <line x1="0" x2={W} y1={zY} y2={zY} className="stroke-border" />
      {[0, 6, 12, 18, 24].map((h, i) => (
        <text key={h} x={(h / 24) * W} y="168" fontSize="11" className="fill-muted-foreground" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{String(h).padStart(2, '0')}h</text>
      ))}
    </svg>
  );
}

/** Operação do medidor com telemetria direta (PM M160/PD666: Pt/Qt/St em W). */
function MedidorPm({ equipamentoId, onStatus }: { equipamentoId: string; onStatus: (s: StatusMed) => void }) {
  const { dados, ts } = useDados(equipamentoId);
  const [per, setPer] = useState<'hoje' | 'ciclo'>('hoje');
  const info = tsInfo(ts);
  const g = (p: string) => getPath(dados, p);
  const n = (p: string) => { const v = g(p); return v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v); };

  // Histórico de hoje (fluxo, intervalo de 15 min, FP). Recarrega a cada 5 min.
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 300000); return () => clearInterval(t); }, []);
  const [ini, fim] = useMemo(() => { const a = new Date(); a.setHours(0, 0, 0, 0); return [a, new Date()]; }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pts } = useHistorico(equipamentoId, ini, fim);

  const { res: mes } = useCustos(equipamentoId, 'mes');
  const { res: dia } = useCustos(equipamentoId, 'dia');
  const meses = useDemandaMeses(equipamentoId);
  const horarios = useHorarios(equipamentoId);

  const contratada = Number(mes?.consumo?.demanda_contratada_kw) || null;
  const tol = contratada != null ? contratada * 1.05 : null;

  const agora = new Date();
  const qIni = new Date(agora); qIni.setMinutes(Math.floor(agora.getMinutes() / 15) * 15, 0, 0);
  const qFim = new Date(qIni.getTime() + 15 * 60000);
  const noIntervalo = (pts ?? []).filter((p) => p.t >= qIni.getTime());
  const mediaInt = (f: (d: Record<string, unknown>) => number | null) => {
    const v = noIntervalo.map((p) => f(p.d)).filter((x): x is number => x != null && Number.isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const ptAgora = kw(n('Pt'));
  const demInt = mediaInt((d) => kw(d?.Pt)) ?? ptAgora;
  const fpInt = (() => { const p = mediaInt((d) => Math.abs(Number(d?.Pt))), s = mediaInt((d) => Number(d?.St)); return p != null && s ? Math.min(1, p / s) : null; })();
  const pct = contratada && demInt != null ? demInt / contratada : null;

  let tone: Tone = 'ok', stLabel = 'Normal', stText = 'Comunicando';
  if (!info.online) { tone = 'off'; stLabel = 'Sem comunicação'; stText = info.hasTs ? `Última leitura ${info.idade}` : 'Sem leitura'; }
  else if (tol != null && demInt != null && demInt > tol) { tone = 'warn'; stLabel = 'Alerta'; stText = 'Demanda do intervalo acima da tolerância'; }

  const fpAgora = dados ? fpDe(dados) : null;
  const qt = kw(n('Qt'));
  const kpis = [
    { k: 'Rede agora', v: ptAgora != null ? `${fmt(Math.abs(ptAgora), 0)} kW` : '—', s: ptAgora == null ? '' : ptAgora < 0 ? 'injetando' : 'importando' },
    { k: 'Reativo agora', v: qt != null ? `${fmt(Math.abs(qt), 0)} kvar` : '—', s: qt == null ? '' : qt < 0 ? 'capacitivo' : 'indutivo' },
    { k: 'FP agora', v: fpAgora != null ? fmt(fpAgora, 2) : '—', s: 'última leitura' },
    { k: 'FP do intervalo', v: fpInt != null ? fmt(fpInt, 2) : '—', s: 'intervalo em andamento' },
  ];

  // FP e reativo de hoje, a partir do histórico.
  const fpHoje = useMemo(() => {
    if (!pts || pts.length === 0) return null;
    let minFp: { v: number; t: number } | null = null, maxQ: { v: number; t: number } | null = null, s = 0, c = 0;
    for (const p of pts) {
      const f = fpDe(p.d);
      if (f != null && Math.abs(Number(p.d?.Pt)) > 1000) { s += f; c++; if (!minFp || f < minFp.v) minFp = { v: f, t: p.t }; }
      const q = kw(p.d?.Qt);
      if (q != null && (!maxQ || Math.abs(q) > maxQ.v)) maxQ = { v: Math.abs(q), t: p.t };
    }
    const dem = bucketize(pts, ini.getTime(), ini.getTime() + 86400000, 96, (d) => kw(d?.Pt));
    let maxD: { v: number; i: number } | null = null;
    dem.forEach((v, i) => { if (v != null && (!maxD || v > maxD.v)) maxD = { v, i }; });
    return { minFp, maxQ, media: c ? s / c : null, maxD: maxD as { v: number; i: number } | null };
  }, [pts, ini]);
  const fps = [
    { k: 'Menor FP de hoje', s: fpHoje?.minFp ? `${hhmm(fpHoje.minFp.t)} · limite 0,92` : 'limite 0,92', v: fpHoje?.minFp ? fmt(fpHoje.minFp.v, 2) : '—', w: !!fpHoje?.minFp && fpHoje.minFp.v < 0.92 },
    { k: 'FP médio de hoje', s: 'com carga acima de 1 kW', v: fpHoje?.media != null ? fmt(fpHoje.media, 2) : '—', w: fpHoje?.media != null && fpHoje.media < 0.92 },
    { k: 'Reativo máx. de hoje', s: fpHoje?.maxQ ? hhmm(fpHoje.maxQ.t) : '', v: fpHoje?.maxQ ? `${fmt(fpHoje.maxQ.v, 0)} kvar` : '—', w: false },
    { k: 'Demanda máx. de hoje', s: fpHoje?.maxD ? `intervalo das ${fmtHora(fpHoje.maxD.i / 4)}` : '', v: fpHoje?.maxD ? `${fmt(fpHoje.maxD.v, 0)} kW` : '—', w: tol != null && !!fpHoje?.maxD && fpHoje.maxD.v > tol },
  ];

  const energia = per === 'hoje' ? dia : mes;
  const postos = energia ? [
    { k: 'Ponta', cor: 'bg-red-600', kwh: energia.consumo.energia_ponta_kwh, rs: energia.custos.custo_ponta },
    { k: 'Fora de ponta', cor: 'bg-blue-600', kwh: energia.consumo.energia_fora_ponta_kwh, rs: energia.custos.custo_fora_ponta },
    { k: 'Reservado (HR)', cor: 'bg-emerald-600', kwh: (energia.consumo.energia_reservado_kwh || 0) + (energia.consumo.energia_irrigante_kwh || 0), rs: (energia.custos.custo_reservado || 0) + (energia.custos.custo_irrigante || 0) },
  ] : [];

  const maxMes = Number(mes?.consumo?.demanda_maxima_kw) || null;
  const mesesMax = Math.max(tol ?? 0, ...(meses ?? []).map((m) => m.v ?? 0), 1) * 1.1;
  const MH = (v: number) => (v / mesesMax) * 112;
  const ultrap = (meses ?? []).filter((m) => tol != null && m.v != null && m.v > tol);

  useEffect(() => { onStatus({ tone, label: stLabel, posto: postoEm(agora, horarios) }); }, [tone, stLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            <Card className="rounded-2xl px-5 py-[18px] flex flex-col gap-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Intervalo de 15 min · termina em</span>
                <span className="text-xl font-extrabold tabular-nums">{hhmm(qFim.getTime())}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[44px] leading-[48px] font-extrabold tabular-nums tracking-tight">{demInt != null ? fmt(demInt, 0) : '—'}</span>
                <span className="text-base text-muted-foreground">kW médios no intervalo</span>
              </div>
              <div className="relative h-3.5 rounded-full bg-[#EEF0F4] dark:bg-white/10">
                {pct != null && (
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (pct / 1.2) * 100)}%`, background: tol != null && demInt! > tol ? '#C53030' : pct > 0.95 ? '#B7791F' : '#2E8B47' }} />
                )}
                {contratada != null && <div className="absolute -top-1 -bottom-1 w-0.5 bg-foreground" style={{ left: '83.33%' }} />}
              </div>
              <div className="flex justify-between text-[13px] text-muted-foreground gap-2">
                <span>{pct != null ? `${Math.round(pct * 100)}% da contratada` : 'Demanda contratada não cadastrada'}</span>
                {contratada != null && <span>Contratada {fmt(contratada, 0)} kW · tolerância {fmt(tol, 0)} kW</span>}
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TONE_BG[tone]}`} />
                <span className={`text-[15px] font-extrabold ${TONE_TEXT[tone]}`}>{stLabel}</span>
                <span className="text-sm text-muted-foreground">{stText}</span>
              </div>
            </Card>
            <Card className="rounded-2xl py-[18px] flex items-center">
              <div className="w-full"><KpiCells items={kpis} cols={2} size="lg" align="left" /></div>
            </Card>
          </div>

          <Card className="px-4 pt-3 pb-3.5">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <span className="text-[15px] font-extrabold">Fluxo na rede por intervalo de 15 min · hoje</span>
              <span className="flex gap-3.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2E8B47]" />Consumo</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: INJ }} />Injeção</span>
              </span>
            </div>
            {pts == null ? <div className="h-[180px] grid place-items-center text-xs text-muted-foreground">Carregando…</div>
              : pts.length === 0 ? <div className="h-[180px] grid place-items-center text-xs text-muted-foreground">Sem leituras hoje</div>
                : <FluxoDia pts={pts} contratada={contratada} tol={tol} horarios={horarios} gerando={pts.some((p) => Number(p.d?.Pt) < 0)} />}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            <Card className="px-[18px] pt-3 pb-3.5 flex flex-col gap-2.5">
              <span className="text-[15px] font-extrabold">Demanda × contratada</span>
              <div className="flex justify-between items-end gap-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Máxima do mês</span>
                  <span className="text-[26px] font-extrabold tabular-nums">{maxMes != null ? `${fmt(maxMes, 0)} kW` : '—'}</span>
                </span>
                {contratada != null && maxMes != null && (
                  <span className="flex flex-col gap-0.5 items-end">
                    <span className="text-xl font-extrabold tabular-nums">{Math.round((maxMes / contratada) * 100)}%</span>
                    <span className="text-xs text-muted-foreground">da contratada</span>
                    <span className="text-xs text-muted-foreground">{tol! - maxMes >= 0 ? `folga até tolerância ${fmt(tol! - maxMes, 0)} kW` : `${fmt(maxMes - tol!, 0)} kW acima da tolerância`}</span>
                  </span>
                )}
              </div>
              {meses == null ? <div className="h-[150px] grid place-items-center text-xs text-muted-foreground">Carregando…</div> : (
                <svg viewBox="0 0 334 150" width="100%" height="150" role="img" aria-label="Demanda máxima por mês comparada à contratada">
                  {meses.map((m, i) => {
                    const v = m.v ?? 0, h = MH(v), x = 12 + i * 54, cur = i === meses.length - 1, over = tol != null && v > tol;
                    return (
                      <g key={m.k + i}>
                        <rect x={x} y={128 - h} width="32" height={h} rx="4" fill={over ? '#C53030' : cur ? '#2E8B47' : '#9CC9A8'} />
                        {m.v != null && <text x={x + 16} y={128 - h - 5} fontSize="11" textAnchor="middle" fontWeight="700" fill={over ? '#C53030' : 'currentColor'}>{fmt(v, 0)}</text>}
                        <text x={x + 16} y="146" fontSize="11" className="fill-muted-foreground" textAnchor="middle">{m.k}</text>
                      </g>
                    );
                  })}
                  {contratada != null && <line x1="0" x2="334" y1={128 - MH(contratada)} y2={128 - MH(contratada)} className="stroke-foreground" strokeOpacity="0.55" strokeDasharray="5 5" />}
                  {tol != null && <line x1="0" x2="334" y1={128 - MH(tol)} y2={128 - MH(tol)} stroke="#C53030" strokeOpacity="0.6" strokeDasharray="2 4" />}
                  <line x1="0" x2="334" y1="128" y2="128" className="stroke-border" />
                </svg>
              )}
              <div className="flex justify-between items-center text-xs text-muted-foreground gap-2">
                {contratada != null ? (
                  <span className="flex gap-3.5">
                    <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-[1.5px] border-dashed border-foreground" />Contratada {fmt(contratada, 0)}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-[1.5px] border-dashed border-red-600" />Tolerância {fmt(tol, 0)}</span>
                  </span>
                ) : <span>Sem demanda contratada no cadastro da unidade</span>}
                {ultrap.length > 0 && <span className="text-red-600 font-extrabold">{ultrap.length} ultrapassage{ultrap.length > 1 ? 'ns' : 'm'} · {ultrap.map((m) => m.k).join(', ')}</span>}
              </div>
            </Card>
            <Card className="px-[18px]">
              <div className="text-[15px] font-extrabold py-3">Fator de potência e reativo</div>
              {fps.map((f) => (
                <div key={f.k} className="flex justify-between items-center min-h-[54px] border-t border-border gap-3">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">{f.k}</span>
                    {f.s && <span className="text-xs text-muted-foreground">{f.s}</span>}
                  </span>
                  <span className={`text-lg font-extrabold tabular-nums whitespace-nowrap ${f.w ? 'text-amber-600 dark:text-amber-400' : ''}`}>{f.v}</span>
                </div>
              ))}
            </Card>
          </div>

          <Card className="px-[18px]">
            <div className="flex justify-between items-center py-3 gap-3">
              <span className="text-[15px] font-extrabold">Energia por posto</span>
              <Segmented size="sm" value={per} onChange={setPer} options={[{ v: 'hoje', label: 'Hoje' }, { v: 'ciclo', label: 'Mês' }]} />
            </div>
            {!energia ? (
              <div className="py-3 border-t border-border text-sm text-muted-foreground">Sem cálculo por posto (confira a unidade e a tarifa do medidor).</div>
            ) : (
              <>
                <div className="grid grid-cols-[1.3fr_1fr_1fr] text-[11px] font-bold text-muted-foreground tracking-[0.4px] py-1.5 border-t border-border">
                  <span>POSTO</span><span className="text-right">CONSUMIDA kWh</span><span className="text-right">VALOR</span>
                </div>
                {postos.map((p) => (
                  <div key={p.k} className="grid grid-cols-[1.3fr_1fr_1fr] items-center min-h-[40px] text-sm border-t border-border">
                    <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-[3px] ${p.cor}`} />{p.k}</span>
                    <span className="text-right tabular-nums">{fmt(p.kwh, 0)}</span>
                    <span className="text-right tabular-nums">{brl(p.rs)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[1.3fr_1fr_1fr] items-center min-h-[40px] text-sm font-extrabold border-t border-border">
                  <span>Total</span>
                  <span className="text-right tabular-nums">{fmt(energia.consumo.energia_total_kwh, 0)}</span>
                  <span className="text-right tabular-nums">{brl(energia.custos.custo_total)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center min-h-[44px] border-t border-border">
              <span className="text-sm font-bold">Injetada (acumulado do medidor)</span>
              <span className="text-[15px] font-extrabold tabular-nums" style={{ color: INJ }}>{n('consumo_phr') != null ? `${fmt(n('consumo_phr'), 0)} kWh` : '—'}</span>
            </div>
            <div className="flex justify-between items-center min-h-[44px] border-t border-border">
              <span className="text-sm font-bold">Consumida (acumulado do medidor)</span>
              <span className="text-[15px] font-extrabold tabular-nums">{(n('consumo_phf') ?? n('phf')) != null ? `${fmt(n('consumo_phf') ?? n('phf'), 0)} kWh` : '—'}</span>
            </div>
          </Card>

          <Registros equipamentoId={equipamentoId} limite={4} />
        </div>
  );
}


/** Janela "10:45–11:00" de um pico (o timestamp é o FIM da janela de 15 min). */
const janela15 = (iso?: string | null) => {
  if (!iso) return '';
  const fim = new Date(iso).getTime();
  return `${hhmm(fim - 15 * 60_000)}–${hhmm(fim)}`;
};
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

interface Bloco { t: number; c: number; i: number }
interface MesBlocos { k: string; ini: number; fim: number; blocos: Bloco[] }
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Blocos de 15 min (kW consumo/injeção) dos últimos n meses — /gateway/tendencia?intervalo=15. */
function useBlocosMeses(equipamentoId: string, n = 6) {
  const [meses, setMeses] = useState<MesBlocos[] | null>(null);
  useEffect(() => {
    let vivo = true;
    const hoje = new Date();
    const lista = Array.from({ length: n }, (_, k) => {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1 - k), 1);
      const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 1);
      return { k: MESES_CURTOS[ini.getMonth()], ini: ini.getTime(), fim: Math.min(fim.getTime(), Date.now()) };
    });
    Promise.all(lista.map((m) =>
      api.get(`/equipamentos-dados/${equipamentoId.trim()}/gateway/tendencia`, {
        params: { periodo: 'custom', inicio: new Date(m.ini).toISOString(), fim: new Date(m.fim).toISOString(), intervalo: 15 },
      })
        .then((r) => ((unwrap<{ dados?: Array<{ timestamp: string; kW_consumo: number; kW_injecao: number }> }>(r)?.dados) ?? [])
          .map((d) => ({ t: new Date(d.timestamp).getTime(), c: Number(d.kW_consumo) || 0, i: Number(d.kW_injecao) || 0 })))
        .catch(() => [] as Bloco[]),
    )).then((bs) => { if (vivo) setMeses(lista.map((m, k) => ({ ...m, blocos: bs[k] }))); });
    return () => { vivo = false; };
  }, [equipamentoId, n]);
  return meses;
}

/** Energia por posto a partir dos blocos de 15 min (kWh = kW × 0,25 h). */
function energiaPorPosto(blocos: Bloco[], horarios: ReturnType<typeof useHorarios>) {
  const acc: Record<string, { c: number; i: number }> = { Ponta: { c: 0, i: 0 }, 'Fora de ponta': { c: 0, i: 0 }, Reservado: { c: 0, i: 0 } };
  for (const b of blocos) {
    const p = postoEm(new Date(b.t), horarios);
    acc[p].c += b.c * 0.25; acc[p].i += b.i * 0.25;
  }
  return acc;
}

/** Fluxo na rede por intervalo do medidor (15 min), hoje ou nos últimos 7 dias — /gateway/tendencia. */
function SsuFluxo({ equipamentoId, contr, tol, temInjecao, horarios, mesAtual }: {
  equipamentoId: string; contr: number | null; tol: number | null; temInjecao: boolean; horarios: ReturnType<typeof useHorarios>; mesAtual: MesBlocos | null;
}) {
  const [per, setPer] = useState<'24H' | '7D' | 'MES'>('24H');
  const { data: dataT, loading } = useGatewayTendencia(equipamentoId, per === 'MES' ? '24H' : per);
  const data = per === 'MES' ? null : dataT;
  // Mês: uma barra por dia com a demanda máxima de 15 min daquele dia.
  const pts = per === 'MES'
    ? (() => {
      const porDia = new Map<number, { c: number; i: number }>();
      for (const b of mesAtual?.blocos ?? []) {
        const d = new Date(b.t); d.setHours(12, 0, 0, 0);
        const k = d.getTime(), a = porDia.get(k) ?? { c: 0, i: 0 };
        porDia.set(k, { c: Math.max(a.c, b.c), i: Math.max(a.i, b.i) });
      }
      return [...porDia.entries()].map(([t, v]) => ({ timestamp: new Date(t).toISOString(), kW_consumo: v.c, kW_injecao: v.i, num_leituras: 0 }));
    })()
    : data?.dados ?? [];
  const W = 720, PH = 138;
  const ini = per === '24H' ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })() : per === 'MES' ? (mesAtual?.ini ?? Date.now()) : Date.now() - 7 * 86400000;
  const fim = per === '24H' ? ini + 86400000 : per === 'MES' ? new Date(new Date(ini).getFullYear(), new Date(ini).getMonth() + 1, 1).getTime() : Date.now();
  const vis = pts.filter((p) => { const t = new Date(p.timestamp).getTime(); return t >= ini && t <= fim; });
  const maxPos = Math.max(contr ?? 0, ...vis.map((p) => p.kW_consumo), 0.1) * 1.1;
  const maxNeg = temInjecao ? Math.max(...vis.map((p) => p.kW_injecao), 0) * 1.1 : 0;
  const H = (v: number) => (v / (maxPos + maxNeg)) * PH;
  const zY = 10 + H(maxPos);
  const X = (t: number) => ((t - ini) / (fim - ini)) * W;
  const bw = per === 'MES' ? (W / 31) * 0.7 : Math.max(1.5, (W / ((fim - ini) / ((data?.intervalo_min ?? 15) * 60000))) * 0.75);
  const util = new Date(ini).getDay() !== 0 && new Date(ini).getDay() !== 6;
  const [p0, p1] = horarios.ponta;
  const ticks = per === '24H'
    ? [0, 6, 12, 18, 24].map((h) => ({ f: h / 24, l: `${String(h).padStart(2, '0')}h` }))
    : per === 'MES' ? [1, 8, 15, 22].map((d) => ({ f: ((d - 0.5) / ((fim - ini) / 86400000)), l: String(d).padStart(2, '0') }))
    : Array.from({ length: 5 }, (_, i) => ({ f: i / 4, l: new Date(ini + ((fim - ini) * i) / 4).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }));
  return (
    <Card className="px-4 pt-3 pb-3.5">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <span className="text-[15px] font-extrabold">{per === 'MES' ? 'Demanda máxima de 15 min por dia' : temInjecao ? 'Fluxo na rede por intervalo de 15 min' : 'Demanda por intervalo de 15 min'}</span>
        <div className="flex items-center gap-4">
          {temInjecao && (
            <span className="flex gap-3.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2E8B47]" />Consumo</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: INJ }} />Injeção</span>
            </span>
          )}
          <Segmented size="sm" value={per} onChange={setPer} options={[{ v: '24H', label: 'Hoje' }, { v: '7D', label: 'Semana' }, { v: 'MES', label: 'Mês' }]} />
        </div>
      </div>
      {(per === 'MES' ? !mesAtual : loading && !data) ? <div className="h-[180px] grid place-items-center text-xs text-muted-foreground">Carregando…</div>
        : vis.length === 0 ? <div className="h-[180px] grid place-items-center text-xs text-muted-foreground">Sem blocos do medidor no período</div> : (
          <svg viewBox="0 0 720 180" width="100%" height="180" className="block mt-2" role="img" aria-label="Fluxo na rede por intervalo de 15 minutos">
            {per === '24H' && util && <rect x={(p0 / 24) * W} y="10" width={((p1 - p0) / 24) * W} height={PH} fill="rgba(197,48,48,0.07)" />}
            {per === '24H' && util && <text x={(((p0 + p1) / 2) / 24) * W} y="142" fontSize="11" fill="#C53030" textAnchor="middle">Ponta</text>}
            {vis.map((p) => {
              const x = X(new Date(p.timestamp).getTime());
              const c = H(p.kW_consumo), i = H(p.kW_injecao);
              return (
                <g key={p.timestamp}>
                  {p.kW_consumo > 0 && <rect x={x - bw / 2} y={zY - c} width={bw} height={Math.max(c, 0.5)} rx="1" fill={tol != null && p.kW_consumo > tol ? '#C53030' : '#2E8B47'} />}
                  {temInjecao && p.kW_injecao > 0 && <rect x={x - bw / 2} y={zY} width={bw} height={Math.max(i, 0.5)} rx="1" fill={INJ} />}
                </g>
              );
            })}
            {contr != null && <line x1="0" x2={W} y1={zY - H(contr)} y2={zY - H(contr)} className="stroke-foreground" strokeOpacity="0.55" strokeDasharray="5 5" />}
            {contr != null && <text x={W} y={zY - H(contr) - 6} fontSize="11" className="fill-muted-foreground" textAnchor="end">Contratada {fmt(contr, 0)} kW</text>}
            <line x1="0" x2={W} y1={zY} y2={zY} className="stroke-border" />
            {ticks.map((t, i) => (
              <text key={i} x={t.f * W} y="168" fontSize="11" className="fill-muted-foreground" textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}>{t.l}</text>
            ))}
          </svg>
        )}
    </Card>
  );
}

/** Operação do medidor lido pela SSU (A-966 / TON-V2), no layout novo. */
function MedidorSsu({ equipamentoId, onStatus }: { equipamentoId: string; onStatus: (s: StatusMed) => void }) {
  const { data, error } = useGatewayDashboard(equipamentoId);
  const horarios = useHorarios(equipamentoId);
  const agora = data?.minuto_a_minuto?.agora ?? null;
  const serie = data?.minuto_a_minuto?.serie ?? [];
  const intervalo = data?.minuto_a_minuto?.intervalo ?? null;
  const snap = data?.snapshot ?? null;
  const dia = data?.resumo_dia;
  const mes = data?.resumo_mes;
  const contr = data?.unidade?.demanda_carga ?? null;
  const contrG = data?.unidade?.demanda_geracao ?? null;
  const tol = contr != null ? contr * 1.05 : null;
  const temInjecao = (dia?.injecao_kwh ?? 0) > 0 || (mes?.pico_injecao?.kw ?? 0) > 0 || (agora?.kW_injecao ?? 0) > 0;
  const meses = useBlocosMeses(equipamentoId);
  const mesAtual = meses ? meses[meses.length - 1] : null;
  const postosMes = mesAtual ? energiaPorPosto(mesAtual.blocos, horarios) : null;
  const barrasMes = (meses ?? []).map((m) => ({ k: m.k, v: m.blocos.length ? Math.max(...m.blocos.map((b) => b.c)) : null }));
  const mesesMax = Math.max(tol ?? 0, ...barrasMes.map((m) => m.v ?? 0), 1) * 1.1;
  const MH = (v: number) => (v / mesesMax) * 112;
  const ultrap = barrasMes.filter((m) => tol != null && m.v != null && m.v > tol);

  const now = new Date();
  const qIni = new Date(now); qIni.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  const qFim = new Date(qIni.getTime() + 15 * 60_000);
  const noIntervalo = serie.filter((m) => new Date(m.timestamp).getTime() >= qIni.getTime());
  const demInt = noIntervalo.length
    ? noIntervalo.reduce((a, m) => a + (m.kW_consumo - m.kW_injecao), 0) / noIntervalo.length
    : agora ? agora.kW_consumo - agora.kW_injecao : null;
  const pct = contr && demInt != null ? demInt / contr : null;

  let tone: Tone = 'ok', stLabel = 'Normal', stText = 'Comunicando · SSU';
  if (!agora && !snap) { tone = 'off'; stLabel = 'Sem comunicação'; stText = error ?? 'Sem leitura do medidor'; }
  else if (tol != null && demInt != null && demInt > tol) { tone = 'warn'; stLabel = 'Alerta'; stText = 'Demanda do intervalo acima da tolerância'; }
  // Posto informado pelo próprio medidor (TON-V2); sem ele, pela janela da concessionária.
  const postoMedidor = agora?.posto ? POSTO[agora.posto] : null;
  const posto = postoMedidor ?? postoEm(now, horarios);
  useEffect(() => { onStatus({ tone, label: stLabel, posto }); }, [tone, stLabel, posto]); // eslint-disable-line react-hooks/exhaustive-deps
  const comFluxo = !!agora && (agora.kW_consumo > 0.01 || agora.kW_injecao > 0.01);

  const kvar = agora ? agora.kvar_ind - agora.kvar_cap : null;
  const rede = agora ? agora.kW_consumo - agora.kW_injecao : null;
  const kpis = [
    { k: 'Rede agora', v: rede != null ? `${fmt(Math.abs(rede), 1)} kW` : '—', s: rede == null ? '' : rede < 0 ? 'injetando · último minuto' : 'importando · último minuto' },
    { k: 'Reativo agora', v: kvar != null ? `${fmt(Math.abs(kvar), 1)} kvar` : '—', s: kvar == null ? '' : kvar < 0 ? 'capacitivo' : 'indutivo' },
    agora?.FP != null
      ? { k: 'FP agora', v: fmt(agora.FP, 2), s: agora.q != null && comFluxo ? (QUADRANTE[agora.q] ?? `Q${agora.q}`) : agora.FP_natureza === 'cap' ? 'capacitivo' : 'indutivo' }
      : { k: 'FP do último bloco', v: snap?.FP ? fmt(snap.FP, 2) : '—', s: snap ? `${snap.FP_natureza === 'cap' ? 'capacitivo' : 'indutivo'} · ${hhmm(new Date(snap.timestamp_dados).getTime())}` : '' },
    { k: 'Máxima de hoje', v: dia?.pico_consumo ? `${fmt(dia.pico_consumo.kw, 1)} kW` : '—', s: dia?.pico_consumo ? janela15(dia.pico_consumo.timestamp) : 'demanda de 15 min' },
  ];

  const maxMes = mes?.pico_consumo?.kw ?? null;
  const fps = [
    { k: 'FP do último bloco', s: snap ? `${hhmm(new Date(snap.timestamp_dados).getTime())} · limite 0,92` : 'limite 0,92', v: snap?.FP ? fmt(snap.FP, 2) : '—', w: !!snap?.FP && snap.FP < 0.92 },
    { k: 'Reativo indutivo hoje', s: 'kvarh', v: dia ? `${fmt(dia.q_ind_kvarh, 1)}` : '—', w: false },
    { k: 'Reativo capacitivo hoje', s: 'kvarh', v: dia ? `${fmt(dia.q_cap_kvarh, 1)}` : '—', w: false },
    ...(temInjecao ? [{ k: 'Injeção máx. do mês', s: mes?.pico_injecao ? `${dataCurta(mes.pico_injecao.timestamp)} · ${janela15(mes.pico_injecao.timestamp)}${contrG != null ? ` · contratada ${fmt(contrG, 0)} kW` : ''}` : '', v: mes?.pico_injecao ? `${fmt(mes.pico_injecao.kw, 1)} kW` : '—', w: contrG != null && (mes?.pico_injecao?.kw ?? 0) > contrG }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <Card className="rounded-2xl px-5 py-[18px] flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Intervalo de 15 min · {intervalo?.fecha_em_s != null ? 'fecha em' : 'termina em'}</span>
            <span className="text-xl font-extrabold tabular-nums">{intervalo?.fecha_em_s != null ? mmss(intervalo.fecha_em_s) : hhmm(qFim.getTime())}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[44px] leading-[48px] font-extrabold tabular-nums tracking-tight">{demInt != null ? fmt(demInt, 0) : '—'}</span>
            <span className="text-base text-muted-foreground">kW médios no intervalo</span>
          </div>
          {intervalo && (
            <span className="text-[13px] text-muted-foreground -mt-1">
              {fmt(intervalo.kwh_consumo, 2)} kWh consumidos{intervalo.kwh_injecao > 0 ? ` · ${fmt(intervalo.kwh_injecao, 2)} kWh injetados` : ''} em {intervalo.minutos} min
            </span>
          )}
          <div className="relative h-3.5 rounded-full bg-[#EEF0F4] dark:bg-white/10">
            {pct != null && <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (pct / 1.2) * 100))}%`, background: tol != null && demInt! > tol ? '#C53030' : pct > 0.95 ? '#B7791F' : '#2E8B47' }} />}
            {contr != null && <div className="absolute -top-1 -bottom-1 w-0.5 bg-foreground" style={{ left: '83.33%' }} />}
          </div>
          <div className="flex justify-between text-[13px] text-muted-foreground gap-2">
            <span>{pct != null ? `${Math.round(pct * 100)}% da contratada` : 'Demanda contratada não cadastrada'}</span>
            {contr != null && <span>Contratada {fmt(contr, 0)} kW · tolerância {fmt(tol, 0)} kW</span>}
          </div>
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TONE_BG[tone]}`} />
            <span className={`text-[15px] font-extrabold ${TONE_TEXT[tone]}`}>{stLabel}</span>
            <span className="text-sm text-muted-foreground truncate">{stText}</span>
          </div>
        </Card>
        <Card className="rounded-2xl py-[18px] flex items-center">
          <div className="w-full"><KpiCells items={kpis} cols={2} size="lg" align="left" /></div>
        </Card>
      </div>

      <SsuFluxo equipamentoId={equipamentoId} contr={contr} tol={tol} temInjecao={temInjecao} horarios={horarios} mesAtual={mesAtual} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <Card className="px-[18px] pt-3 pb-3.5 flex flex-col gap-2.5">
          <span className="text-[15px] font-extrabold">Demanda × contratada</span>
          <div className="flex justify-between items-end gap-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Máxima do mês</span>
              <span className="text-[26px] font-extrabold tabular-nums">{maxMes != null ? `${fmt(maxMes, 1)} kW` : '—'}</span>
              {mes?.pico_consumo && <span className="text-xs text-muted-foreground">{dataCurta(mes.pico_consumo.timestamp)} · {janela15(mes.pico_consumo.timestamp)} · {postoEm(new Date(new Date(mes.pico_consumo.timestamp).getTime() - 60_000), horarios).toLowerCase()}</span>}
            </span>
            {contr != null && maxMes != null && (
              <span className="flex flex-col gap-0.5 items-end">
                <span className="text-xl font-extrabold tabular-nums">{Math.round((maxMes / contr) * 100)}%</span>
                <span className="text-xs text-muted-foreground">da contratada</span>
                <span className={`text-xs ${maxMes > tol! ? 'text-red-600 font-extrabold' : 'text-muted-foreground'}`}>
                  {maxMes <= tol! ? `folga até tolerância ${fmt(tol! - maxMes, 0)} kW` : `${fmt(maxMes - tol!, 0)} kW acima da tolerância`}
                </span>
              </span>
            )}
          </div>
          {meses == null ? <div className="h-[150px] grid place-items-center text-xs text-muted-foreground">Carregando…</div> : (
            <svg viewBox="0 0 334 150" width="100%" height="150" role="img" aria-label="Demanda máxima por mês comparada à contratada">
              {barrasMes.map((m, i) => {
                const v = m.v ?? 0, h = MH(v), x = 12 + i * 54, cur = i === barrasMes.length - 1, over = tol != null && v > tol;
                return (
                  <g key={m.k + i}>
                    <rect x={x} y={128 - h} width="32" height={h} rx="4" fill={over ? '#C53030' : cur ? '#2E8B47' : '#9CC9A8'} />
                    {m.v != null && <text x={x + 16} y={128 - h - 5} fontSize="11" textAnchor="middle" fontWeight="700" fill={over ? '#C53030' : 'currentColor'}>{fmt(v, 0)}</text>}
                    <text x={x + 16} y="146" fontSize="11" className="fill-muted-foreground" textAnchor="middle">{m.k}</text>
                  </g>
                );
              })}
              {contr != null && <line x1="0" x2="334" y1={128 - MH(contr)} y2={128 - MH(contr)} className="stroke-foreground" strokeOpacity="0.55" strokeDasharray="5 5" />}
              {tol != null && <line x1="0" x2="334" y1={128 - MH(tol)} y2={128 - MH(tol)} stroke="#C53030" strokeOpacity="0.6" strokeDasharray="2 4" />}
              <line x1="0" x2="334" y1="128" y2="128" className="stroke-border" />
            </svg>
          )}
          <div className="flex justify-between items-center text-xs text-muted-foreground gap-2">
            {contr != null ? (
              <span className="flex gap-3.5">
                <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-[1.5px] border-dashed border-foreground" />Contratada {fmt(contr, 0)}</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-[1.5px] border-dashed border-red-600" />Tolerância {fmt(tol, 0)}</span>
              </span>
            ) : <span>Sem demanda contratada no cadastro da unidade</span>}
            {ultrap.length > 0 && <span className="text-red-600 font-extrabold">{ultrap.length} ultrapassage{ultrap.length > 1 ? 'ns' : 'm'} · {ultrap.map((m) => m.k).join(', ')}</span>}
          </div>
        </Card>
        <Card className="px-[18px]">
          <div className="text-[15px] font-extrabold py-3">Fator de potência e reativo</div>
          {fps.map((f) => (
            <div key={f.k} className="flex justify-between items-center min-h-[54px] border-t border-border gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold">{f.k}</span>
                {f.s && <span className="text-xs text-muted-foreground">{f.s}</span>}
              </span>
              <span className={`text-lg font-extrabold tabular-nums whitespace-nowrap ${f.w ? 'text-amber-600 dark:text-amber-400' : ''}`}>{f.v}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card className="px-[18px]">
        <div className="flex justify-between items-center py-3">
          <span className="text-[15px] font-extrabold">Energia do mês</span>
          <span className="text-xs text-muted-foreground">desde 01/{String(new Date().getMonth() + 1).padStart(2, '0')} · blocos de 15 min</span>
        </div>
        {!postosMes ? <div className="py-3 border-t border-border text-sm text-muted-foreground">Carregando…</div> : (() => {
          const cols = temInjecao ? 'grid-cols-[1.2fr_1fr_1fr_1fr]' : 'grid-cols-[1.3fr_1fr]';
          const linhas = [['Ponta', 'bg-red-600'], ['Fora de ponta', 'bg-blue-600'], ['Reservado', 'bg-emerald-600']] as const;
          const tot = Object.values(postosMes).reduce((a, v) => ({ c: a.c + v.c, i: a.i + v.i }), { c: 0, i: 0 });
          return (
            <>
              <div className={`grid ${cols} text-[11px] font-bold text-muted-foreground tracking-[0.4px] py-1.5 border-t border-border`}>
                <span>kWh</span><span className="text-right">CONSUMIDA</span>{temInjecao && <><span className="text-right">INJETADA</span><span className="text-right">LÍQUIDA</span></>}
              </div>
              {linhas.map(([k, cor]) => (
                <div key={k} className={`grid ${cols} items-center min-h-[40px] text-sm border-t border-border`}>
                  <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-[3px] ${cor}`} />{k}</span>
                  <span className="text-right tabular-nums">{fmt(postosMes[k].c, 0)}</span>
                  {temInjecao && <><span className="text-right tabular-nums" style={{ color: INJ }}>{fmt(postosMes[k].i, 0)}</span><span className="text-right tabular-nums">{fmt(postosMes[k].c - postosMes[k].i, 0)}</span></>}
                </div>
              ))}
              <div className={`grid ${cols} items-center min-h-[40px] text-sm font-extrabold border-t border-border`}>
                <span>Total</span><span className="text-right tabular-nums">{fmt(tot.c, 0)}</span>
                {temInjecao && <><span className="text-right tabular-nums" style={{ color: INJ }}>{fmt(tot.i, 0)}</span><span className="text-right tabular-nums">{fmt(tot.c - tot.i, 0)}</span></>}
              </div>
            </>
          );
        })()}
        <div className="flex justify-between items-center min-h-[44px] border-t border-border">
          <span className="flex flex-col gap-0.5"><span className="text-sm font-bold">Energia reativa hoje</span><span className="text-xs text-muted-foreground">indutiva · capacitiva</span></span>
          <span className="text-[15px] font-extrabold tabular-nums">{dia ? `${fmt(dia.q_ind_kvarh, 1)} · ${fmt(dia.q_cap_kvarh, 1)} kvarh` : '—'}</span>
        </div>
      </Card>

      <Registros equipamentoId={equipamentoId} limite={4} />
    </div>
  );
}

/** Aba Configuração: demanda contratada e postos tarifários (leitura). */
function MedidorConfig({ equipamentoId, ssuId }: { equipamentoId: string; ssuId: string | null }) {
  const horarios = useHorarios(equipamentoId);
  const { res: mes } = useCustos(equipamentoId, 'mes');
  const { data } = useGatewayDashboard(ssuId);
  const contr = data?.unidade?.demanda_carga ?? (Number(mes?.consumo?.demanda_contratada_kw) || null);
  const contrG = data?.unidade?.demanda_geracao ?? null;
  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel className="mt-1">Demanda contratada</SectionLabel>
      <Card className="px-4">
        <FieldRow first label="Consumo (carga)" sub="Cadastro da unidade consumidora">
          <span className="text-[15px] text-muted-foreground">{contr != null ? `${fmt(contr, 0)} kW` : '—'}</span>
        </FieldRow>
        <FieldRow label="Tolerância" sub="5% acima da contratada">
          <span className="text-[15px] text-muted-foreground">{contr != null ? `${fmt(contr * 1.05, 0)} kW` : '—'}</span>
        </FieldRow>
        <FieldRow label="Geração">
          <span className="text-[15px] text-muted-foreground">{contrG != null ? `${fmt(contrG, 0)} kW` : '—'}</span>
        </FieldRow>
      </Card>
      <SectionLabel className="mt-2.5">Postos tarifários</SectionLabel>
      <Card className="px-4">
        <FieldRow first label="Ponta" sub="Dias úteis">
          <span className="text-[15px] text-muted-foreground">{fmtHora(horarios.ponta[0])} – {fmtHora(horarios.ponta[1])}</span>
        </FieldRow>
        <FieldRow label="Reservado (HR)">
          <span className="text-[15px] text-muted-foreground">{horarios.reservado ? `${fmtHora(horarios.reservado[0])} – ${fmtHora(horarios.reservado[1])}` : '—'}</span>
        </FieldRow>
        <FieldRow label="Fora de ponta" sub="Todo o restante do dia">
          <span className="text-[15px] text-muted-foreground">—</span>
        </FieldRow>
        <FieldRow label="Tarifa usada no valor">
          <span className="text-[15px] text-muted-foreground">{mes?.tarifa_fonte === 'PERSONALIZADA' ? 'Personalizada' : mes ? 'Concessionária' : '—'}</span>
        </FieldRow>
      </Card>
      <p className="text-xs text-muted-foreground mt-1">
        {horarios.daConcessionaria ? 'Horários da concessionária ligada à unidade (edição no cadastro de concessionárias).' : 'Concessionária sem janela cadastrada: padrão 18:00–21:00.'}
        {' '}Demanda contratada é editada no cadastro da unidade.
      </p>
    </div>
  );
}

export function MedidorSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  // Fonte da medição: o device IoT associado a este medidor em "Vínculos → Medições"
  // (TON-V2 com SSU, A-966, PM…) — mesmo lookup do DJ→PM. Sem vínculo, o próprio medidor.
  const [fonte, setFonte] = useState<{ id: string; nome: string | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    setFonte(null);
    iotApiService.powerMeterByDisjuntor(equipamentoId)
      .then((r) => { if (vivo && r?.equipamento_id) setFonte({ id: r.equipamento_id.trim(), nome: r.nome }); })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, [equipamentoId]);
  const idDados = fonte?.id ?? equipamentoId;
  const { dados, ts } = useDados(idDados);
  const info = tsInfo(ts);
  const g = (p: string) => getPath(dados, p);
  // Bloco da SSU (A-966 / TON-V2): tem NSU e pulsos em data.phf — não é telemetria instantânea.
  const ehSsu = !!dados && (g('NSU') != null || g('data.phf') != null);
  const [aba, setAba] = useState('op');
  const [status, setStatus] = useState<StatusMed>({ tone: 'off', label: 'Sem comunicação' });

  return (
    <EquipShell
      title={nome || 'Medidor da concessionária'}
      subtitle={[fonte ? `Medição: ${fonte.nome ?? fonte.id}` : null, ehSsu ? 'SSU' : null, info.hasTs ? info.label : 'Sem leitura'].filter(Boolean).join(' · ')}
      right={<>{status.posto && <NeutralPill>{status.posto}</NeutralPill>}<Pill tone={status.tone}>{status.label}</Pill></>}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'cfg'
        ? <MedidorConfig equipamentoId={idDados} ssuId={ehSsu ? idDados : null} />
        : ehSsu
          ? <MedidorSsu equipamentoId={idDados} onStatus={setStatus} />
          : <MedidorPm equipamentoId={idDados} onStatus={setStatus} />}
    </EquipShell>
  );
}

export default MedidorSheet;
