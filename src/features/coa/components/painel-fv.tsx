import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Sun } from 'lucide-react';
import { curveMonotoneX } from '@visx/curve';
import { ComposedChart } from '@/components/charts/composed-chart';
import { Area } from '@/components/charts/area-chart';
import { Line } from '@/components/charts/line';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { BarYAxis } from '@/components/charts/bar-y-axis';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { Legend, LegendItem, LegendLabel, LegendMarker } from '@/components/charts/legend';
import { COR } from '@/components/graficos/cores';
import { Estatisticas } from '@/components/graficos/estatisticas';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { useRegistrosFv } from '../hooks/use-registros-fv';

// ── formatação ──────────────────────────────────────────────────────────────
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function partesEnergia(kwh: number): { valor: string; unidade: string } {
  const v = Number.isFinite(kwh) ? kwh : 0;
  const a = Math.abs(v);
  if (a >= 1e6) return { valor: (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }), unidade: 'GWh' };
  if (a >= 1000) return { valor: (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }), unidade: 'MWh' };
  return { valor: Math.round(v).toLocaleString('pt-BR'), unidade: 'kWh' };
}
function fmtEnergia(kwh: number): string {
  const p = partesEnergia(kwh);
  return `${p.valor} ${p.unidade}`;
}
const ddmm = (iso: string) => (iso?.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso);
const mesLabel = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1] ?? '?'}/${ym.slice(2, 4)}`;
/** Dia "YYYY-MM-DD" em Date local (nunca por string ISO, que cai em UTC). */
const dataLocal = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const pctMeta = (realizado: number, previsto: number) => (previsto > 0 ? Math.round((realizado / previsto) * 100) : null);

const COR_REALIZADO = COR.geracao;
const COR_META = COR.neutro;
const COR_CRITICO = 'var(--destructive)';
/** Faixa de eficiência: verde ≥ 95 %, âmbar ≥ 85 %, vermelho abaixo; sem meta = neutro. */
const corPct = (pct: number | null): string =>
  pct == null ? COR.neutro : pct >= 95 ? COR.geracao : pct >= 85 ? COR.consumo : COR_CRITICO;

const yTickK = (v: number) =>
  Math.abs(v) >= 1e6 ? `${Math.round(v / 1e6)}G` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`;

interface PontoDiario extends Record<string, unknown> {
  data: string;
  label: string;
  date: Date;
  realizado: number;
  previsto: number;
}
interface PontoMensal extends Record<string, unknown> {
  ym: string;
  label: string;
  realizado: number;
  previsto: number;
}
/** Linha do ranking: o % vai numa só das chaves ok/atencao/critico (barras empilhadas). */
interface LinhaRanking extends Record<string, unknown> {
  id: string;
  categoria: string;
  nome: string;
  realizado: number;
  pct: number | null;
  ok: number;
  atencao: number;
  critico: number;
}

const LEGENDA_REAL_META = [
  { label: 'Realizado', value: 0, color: COR_REALIZADO },
  { label: 'Meta', value: 0, color: COR_META },
];
const LEGENDA_FAIXAS = [
  { label: '≥ 95%', value: 0, color: COR.geracao },
  { label: '85–94%', value: 0, color: COR.consumo },
  { label: '< 85%', value: 0, color: COR_CRITICO },
];

function LegendaSeries({ itens }: { itens: Array<{ label: string; value: number; color: string }> }) {
  return (
    <Legend items={itens} className="flex-row flex-wrap gap-x-3 gap-y-1">
      <LegendItem>
        <LegendMarker className="h-2 w-2" />
        <LegendLabel className="text-[11px] font-medium" />
      </LegendItem>
    </Legend>
  );
}

function TooltipRealizadoMeta({ titulo, realizado, previsto }: { titulo: string; realizado: number; previsto: number }) {
  const pct = pctMeta(realizado, previsto);
  const e = partesEnergia(realizado);
  return (
    <TooltipDestaque
      titulo={titulo}
      valor={e.valor}
      unidade={e.unidade}
      rotulo="Realizado"
      linhas={[
        { label: 'Meta', value: fmtEnergia(previsto), cor: COR_META },
        ...(pct != null ? [{ label: 'Da meta', value: `${pct}%`, cor: corPct(pct) }] : []),
      ]}
    />
  );
}

function SemDados() {
  return <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados no período.</div>;
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
        ativo ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Painel de Geração Fotovoltaica do COA (integração BDO). Filtra por usina/ano/mês e
 * agrega client-side (como o dashboard do BDO): KPIs do período + tendência diária +
 * geração mensal + ranking de usinas. Não renderiza nada se não houver dado FV.
 */
export function PainelFv() {
  const { registros, loading } = useRegistrosFv(12);
  const [selUsinas, setSelUsinas] = useState<Set<string>>(new Set()); // vazio = todas
  const [ano, setAno] = useState<string>('');
  const [mes, setMes] = useState<string>('');
  const [rankModo, setRankModo] = useState<'periodo' | 'ontem'>('periodo'); // ranking por eficiência: período (filtro) | ontem
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [buscaUsina, setBuscaUsina] = useState('');
  const filtroRef = useRef<HTMLDivElement>(null);

  const usinas = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of registros) if (!m.has(r.unidade_id)) m.set(r.unidade_id, r.nome);
    return Array.from(m, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [registros]);
  const anos = useMemo(
    () => Array.from(new Set(registros.map((r) => r.data.slice(0, 4)))).sort().reverse(),
    [registros],
  );

  const filtrados = useMemo(
    () => registros.filter((r) =>
      (!selUsinas.size || selUsinas.has(r.unidade_id)) &&
      (!ano || r.data.slice(0, 4) === ano) &&
      (!mes || r.data.slice(5, 7) === mes),
    ),
    [registros, selUsinas, ano, mes],
  );

  const kpi = useMemo(() => {
    let realizado = 0, previsto = 0;
    const us = new Set<string>(), dias = new Set<string>();
    for (const r of filtrados) {
      realizado += r.kwh_realizado || 0;
      previsto += r.kwh_previsto || 0;
      us.add(r.unidade_id); dias.add(r.data);
    }
    return { realizado, previsto, efic: previsto > 0 ? Math.round((realizado / previsto) * 100) : null, desvio: realizado - previsto, usinas: us.size, dias: dias.size };
  }, [filtrados]);

  const diaria = useMemo<PontoDiario[]>(() => {
    const m = new Map<string, { realizado: number; previsto: number }>();
    for (const r of filtrados) {
      const a = m.get(r.data) ?? { realizado: 0, previsto: 0 };
      a.realizado += r.kwh_realizado || 0; a.previsto += r.kwh_previsto || 0;
      m.set(r.data, a);
    }
    return Array.from(m, ([data, v]) => ({ data, label: ddmm(data), date: dataLocal(data), ...v })).sort((a, b) => a.data.localeCompare(b.data));
  }, [filtrados]);

  const mensal = useMemo<PontoMensal[]>(() => {
    const m = new Map<string, { realizado: number; previsto: number }>();
    for (const r of filtrados) {
      const ym = r.data.slice(0, 7);
      const a = m.get(ym) ?? { realizado: 0, previsto: 0 };
      a.realizado += r.kwh_realizado || 0; a.previsto += r.kwh_previsto || 0;
      m.set(ym, a);
    }
    return Array.from(m, ([ym, v]) => ({ ym, label: mesLabel(ym), ...v })).sort((a, b) => a.ym.localeCompare(b.ym));
  }, [filtrados]);

  const ranking = useMemo(() => {
    const m = new Map<string, { nome: string; realizado: number; previsto: number }>();
    for (const r of filtrados) {
      const a = m.get(r.unidade_id) ?? { nome: r.nome, realizado: 0, previsto: 0 };
      a.realizado += r.kwh_realizado || 0; a.previsto += r.kwh_previsto || 0;
      m.set(r.unidade_id, a);
    }
    return Array.from(m, ([id, v]) => ({ id, ...v, nomeCurto: v.nome.replace(/^UFV\s+/i, ''), pct: v.previsto > 0 ? Math.round((v.realizado / v.previsto) * 100) : null }))
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  }, [filtrados]);

  // Disponibilidade: % de dias com geração > 0 por usina (igual ao BDO).
  const disponibilidade = useMemo(() => {
    const m = new Map<string, { nome: string; active: number; total: number }>();
    for (const r of filtrados) {
      const a = m.get(r.unidade_id) ?? { nome: r.nome, active: 0, total: 0 };
      a.total += 1;
      if ((r.kwh_realizado || 0) > 0) a.active += 1;
      m.set(r.unidade_id, a);
    }
    return Array.from(m, ([id, v]) => ({ id, nome: v.nome, active: v.active, total: v.total, pct: v.total > 0 ? (v.active / v.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [filtrados]);

  // Fator de capacidade do DIA ANTERIOR (dia mais recente com dado) = realizado ÷ previsto por
  // usina. Recalcula sozinho a cada nova geração. Respeita o filtro de usina (ignora ano/mês,
  // pois é sempre o último dia).
  const fcDia = useMemo(() => {
    const base = registros.filter((r) => !selUsinas.size || selUsinas.has(r.unidade_id));
    if (base.length === 0) return { data: null as string | null, itens: [] as Array<{ id: string; nome: string; nomeCurto: string; realizado: number; pct: number | null }> };
    const maxData = base.reduce((mx, r) => (r.data > mx ? r.data : mx), base[0].data);
    const itens = base
      .filter((r) => r.data === maxData)
      .map((r) => ({ id: r.unidade_id, nome: r.nome, nomeCurto: r.nome.replace(/^UFV\s+/i, ''), realizado: r.kwh_realizado || 0, pct: (r.kwh_previsto || 0) > 0 ? Math.round((r.kwh_realizado / r.kwh_previsto) * 100) : null }))
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
    return { data: maxData, itens };
  }, [registros, selUsinas]);

  // Ranking por eficiência: 'periodo' usa o filtro; 'ontem' usa o último dia. Mesmo formato.
  const rankData = rankModo === 'ontem' ? fcDia.itens : ranking;

  // O bklit não colore barra a barra: cada linha leva o % numa chave (ok/atencao/critico) e
  // 0 nas outras, empilhadas. Barras horizontais com "% · nome" como categoria, porque o
  // BarChart horizontal não tem eixo numérico nem rótulo de valor.
  const rankLinhas = useMemo<LinhaRanking[]>(() => {
    const vistos = new Set<string>();
    return rankData.map((r) => {
      let categoria = `${r.pct != null ? `${r.pct}%` : 's/ meta'} · ${r.nomeCurto}`;
      while (vistos.has(categoria)) categoria += ' ';
      vistos.add(categoria);
      const pct = r.pct ?? 0;
      return {
        id: r.id,
        categoria,
        nome: r.nome,
        realizado: r.realizado,
        pct: r.pct,
        ok: r.pct != null && r.pct >= 95 ? pct : 0,
        atencao: r.pct != null && r.pct >= 85 && r.pct < 95 ? pct : 0,
        critico: r.pct != null && r.pct < 85 ? pct : 0,
      };
    });
  }, [rankData]);
  const alturaRanking = Math.min(440, Math.max(200, 32 + rankLinhas.length * 24));

  useEffect(() => {
    if (!filtroAberto) return;
    const h = (e: MouseEvent) => { if (filtroRef.current && !filtroRef.current.contains(e.target as Node)) setFiltroAberto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [filtroAberto]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Sun className="h-4 w-4 text-amber-500" />GERAÇÃO FOTOVOLTAICA</h3>
        <div className="h-56 animate-pulse rounded-md bg-muted/40" />
      </div>
    );
  }
  if (!registros.length) return null;

  const toggleUsina = (id: string) =>
    setSelUsinas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-4 lg:space-y-6 2xl:space-y-8">
      {/* Header + filtros na mesma linha (topo) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2"><Sun className="h-4 w-4 text-amber-500" />GERAÇÃO FOTOVOLTAICA</h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* Usinas: multi-seleção com busca (escala pra muitas usinas) */}
          <div className="relative" ref={filtroRef}>
            <button type="button" onClick={() => setFiltroAberto((o) => !o)}
              className="h-7 text-xs rounded border border-input bg-background dark:bg-black px-2 inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">Usinas:</span>
              <span className="font-medium">{selUsinas.size === 0 ? 'Todas' : `${selUsinas.size} selecionada${selUsinas.size > 1 ? 's' : ''}`}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
            {filtroAberto && (
              <div className="absolute z-30 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg p-2 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
                <input value={buscaUsina} onChange={(e) => setBuscaUsina(e.target.value)} placeholder="Buscar usina…" autoFocus
                  className="w-full h-7 text-xs rounded border border-input bg-background dark:bg-black px-2 mb-2" />
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  <label className="flex items-center gap-2 text-xs px-1.5 py-1 rounded hover:bg-muted cursor-pointer">
                    <input type="checkbox" className="accent-primary" checked={selUsinas.size === 0} onChange={() => setSelUsinas(new Set())} />
                    <span className="font-medium">Todas</span>
                  </label>
                  {usinas.filter((u) => u.nome.toLowerCase().includes(buscaUsina.toLowerCase())).map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-xs px-1.5 py-1 rounded hover:bg-muted cursor-pointer">
                      <input type="checkbox" className="accent-primary" checked={selUsinas.has(u.id)} onChange={() => toggleUsina(u.id)} />
                      <span className="truncate" title={u.nome}>{u.nome}</span>
                    </label>
                  ))}
                  {usinas.filter((u) => u.nome.toLowerCase().includes(buscaUsina.toLowerCase())).length === 0 && (
                    <div className="text-[11px] text-muted-foreground px-1.5 py-1">Nenhuma usina.</div>
                  )}
                </div>
                {selUsinas.size > 0 && (
                  <button onClick={() => setSelUsinas(new Set())} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground">Limpar seleção</button>
                )}
              </div>
            )}
          </div>
          <select value={ano} onChange={(e) => setAno(e.target.value)} className="h-7 text-xs rounded border border-input bg-background dark:bg-black px-2">
            <option value="">Todos os anos</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="h-7 text-xs rounded border border-input bg-background dark:bg-black px-2">
            <option value="">Todos os meses</option>
            {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </select>
        </div>
      </div>

        {/* ── KPIs do período ── */}
        <Estatisticas
          itens={[
            { rotulo: 'Realizado', valor: fmtEnergia(kpi.realizado), cor: COR_REALIZADO },
            { rotulo: 'Meta', valor: fmtEnergia(kpi.previsto), cor: COR_META },
            { rotulo: 'Eficiência', valor: <span style={{ color: corPct(kpi.efic) }}>{kpi.efic != null ? `${kpi.efic}%` : '--'}</span> },
            {
              rotulo: 'Desvio',
              valor: (
                <span style={{ color: kpi.desvio >= 0 ? COR.geracao : COR_CRITICO }}>
                  {`${kpi.desvio >= 0 ? '+' : ''}${fmtEnergia(kpi.desvio)}`}
                </span>
              ),
            },
            { rotulo: 'Usinas', valor: String(kpi.usinas) },
            { rotulo: 'Dias c/ dados', valor: String(kpi.dias) },
          ]}
        />

        {/* ── Geração diária (metade) + Disponibilidade/FC em abas (metade) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 2xl:gap-8">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-medium text-muted-foreground">Geração diária — realizado × meta</h4>
              <LegendaSeries itens={LEGENDA_REAL_META} />
            </div>
            <div style={{ height: 220 }}>
              {diaria.length === 0 ? <SemDados /> : (
                <ComposedChart
                  data={diaria}
                  aspectRatio="auto"
                  className="h-full"
                  margin={{ top: 8, right: 12, bottom: 28, left: 48 }}
                  animationDuration={600}
                >
                  <Grid horizontal numTicksRows={4} />
                  <Area
                    dataKey="realizado"
                    fill={COR_REALIZADO}
                    fillOpacity={0.2}
                    gradientToOpacity={0.02}
                    strokeWidth={2}
                    curve={curveMonotoneX}
                  />
                  <Line
                    dataKey="previsto"
                    stroke={COR_META}
                    strokeWidth={2}
                    dashFromIndex={0}
                    dashArray="5,4"
                    curve={curveMonotoneX}
                    fadeEdges={false}
                    showHighlight={false}
                  />
                  <XAxis numTicks={6} />
                  <YAxis numTicks={4} formatValue={yTickK} />
                  <ChartTooltip
                    showDots
                    content={({ point }) => {
                      const p = point as PontoDiario;
                      return <TooltipRealizadoMeta titulo={p.label} realizado={p.realizado} previsto={p.previsto} />;
                    }}
                  />
                </ComposedChart>
              )}
            </div>
          </div>

          {/* ── Disponibilidade — % de dias ativos por usina ── */}
          <div className="min-w-0">
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Disponibilidade — % de dias ativos por usina</h4>
            <ul className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {disponibilidade.map((a) => (
                <li key={a.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate" title={a.nome}>{a.nome}</span>
                    <span className="font-mono text-muted-foreground">{Math.round(a.pct)}% <span className="opacity-60">({a.active}/{a.total})</span></span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, a.pct)}%`, background: corPct(a.pct) }} />
                  </div>
                </li>
              ))}
              {disponibilidade.length === 0 && <li className="text-xs text-muted-foreground">Sem dados no período.</li>}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 2xl:gap-8 !mt-8 lg:!mt-12 2xl:!mt-16">
          {/* ── Geração mensal ── */}
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-medium text-muted-foreground">Geração mensal — realizado × meta</h4>
              <LegendaSeries itens={LEGENDA_REAL_META} />
            </div>
            <div style={{ height: 200 }}>
              {mensal.length === 0 ? <SemDados /> : (
                <BarChart
                  data={mensal}
                  xDataKey="label"
                  aspectRatio="auto"
                  className="h-full"
                  margin={{ top: 8, right: 12, bottom: 28, left: 48 }}
                  barGap={0.3}
                  animationDuration={600}
                >
                  <Grid horizontal numTicksRows={4} />
                  <Bar dataKey="realizado" fill={COR_REALIZADO} lineCap={3} />
                  <Bar dataKey="previsto" fill={COR_META} lineCap={3} />
                  <BarXAxis maxLabels={12} />
                  <YAxis numTicks={4} formatValue={yTickK} />
                  <ChartTooltip
                    showDatePill={false}
                    showCrosshair={false}
                    showDots={false}
                    content={({ point }) => {
                      const p = point as PontoMensal;
                      return <TooltipRealizadoMeta titulo={p.label} realizado={p.realizado} previsto={p.previsto} />;
                    }}
                  />
                </BarChart>
              )}
            </div>
          </div>

          {/* ── Ranking de usinas ── */}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <h4 className="text-xs font-medium text-muted-foreground">
                Ranking por eficiência {rankModo === 'ontem' ? `— ontem ${fcDia.data ? ddmm(fcDia.data) : ''}` : '— período'}
              </h4>
              <div className="flex items-center gap-2">
                <LegendaSeries itens={LEGENDA_FAIXAS} />
                <div className="flex items-center gap-1.5">
                  <Chip ativo={rankModo === 'periodo'} onClick={() => setRankModo('periodo')}>Período</Chip>
                  <Chip ativo={rankModo === 'ontem'} onClick={() => setRankModo('ontem')}>Ontem</Chip>
                </div>
              </div>
            </div>
            <div style={{ height: alturaRanking }}>
              {rankLinhas.length === 0 ? <SemDados /> : (
                <BarChart
                  data={rankLinhas}
                  xDataKey="categoria"
                  orientation="horizontal"
                  stacked
                  aspectRatio="auto"
                  className="h-full"
                  margin={{ top: 8, right: 16, bottom: 8, left: 132 }}
                  barGap={0.3}
                  animationDuration={600}
                >
                  <Grid horizontal={false} vertical numTicksColumns={5} />
                  <Bar dataKey="ok" fill={COR.geracao} lineCap={3} />
                  <Bar dataKey="atencao" fill={COR.consumo} lineCap={3} />
                  <Bar dataKey="critico" fill={COR_CRITICO} lineCap={3} />
                  <BarYAxis />
                  <ChartTooltip
                    showDatePill={false}
                    showCrosshair={false}
                    showDots={false}
                    content={({ point }) => {
                      const r = point as LinhaRanking;
                      return (
                        <TooltipDestaque
                          titulo={r.nome}
                          valor={r.pct != null ? String(r.pct) : '—'}
                          unidade={r.pct != null ? '%' : undefined}
                          rotulo={r.pct != null ? 'da meta' : 'sem meta'}
                          linhas={[{ label: 'Geração', value: fmtEnergia(r.realizado) }]}
                        />
                      );
                    }}
                  />
                </BarChart>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
