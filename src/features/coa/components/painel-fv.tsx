import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ComposedChart, Area, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { ChevronDown, Sun } from 'lucide-react';
import { useRegistrosFv } from '../hooks/use-registros-fv';

// ── formatação ──────────────────────────────────────────────────────────────
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function fmtEnergia(kwh: number): string {
  const v = Number.isFinite(kwh) ? kwh : 0;
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GWh`;
  if (a >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MWh`;
  return `${Math.round(v).toLocaleString('pt-BR')} kWh`;
}
const ddmm = (iso: string) => (iso?.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso);
const mesLabel = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1] ?? '?'}/${ym.slice(2, 4)}`;
const corPct = (pct: number | null): string =>
  pct == null ? '#94a3b8' : pct >= 95 ? '#22c55e' : pct >= 85 ? '#f59e0b' : '#ef4444';

const VERDE = '#22c55e'; // realizado
const CINZA = '#94a3b8'; // meta

function KpiTile({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{rotulo}</div>
      <div className="text-base sm:text-lg font-semibold tabular-nums" style={cor ? { color: cor } : undefined}>{valor}</div>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const real = payload.find((p: any) => p.dataKey === 'realizado')?.value ?? 0;
  const meta = payload.find((p: any) => p.dataKey === 'previsto')?.value ?? 0;
  const pct = meta > 0 ? Math.round((real / meta) * 100) : null;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: VERDE }} />Realizado: <span className="font-medium tabular-nums">{fmtEnergia(real)}</span></div>
      <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: CINZA }} />Meta: <span className="font-medium tabular-nums">{fmtEnergia(meta)}</span></div>
      {pct != null && <div className="mt-0.5" style={{ color: corPct(pct) }}>{pct}% da meta</div>}
    </div>
  );
}

const yTickK = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e6)}G` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);

function RankTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cor = corPct(d.pct);
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium mb-0.5">{d.nome}</div>
      <div style={{ color: cor }}>{d.pct != null ? `${d.pct}% da meta` : 'sem meta'}</div>
      <div className="text-muted-foreground">Geração: {fmtEnergia(d.realizado)}</div>
    </div>
  );
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

  const diaria = useMemo(() => {
    const m = new Map<string, { realizado: number; previsto: number }>();
    for (const r of filtrados) {
      const a = m.get(r.data) ?? { realizado: 0, previsto: 0 };
      a.realizado += r.kwh_realizado || 0; a.previsto += r.kwh_previsto || 0;
      m.set(r.data, a);
    }
    return Array.from(m, ([data, v]) => ({ data, label: ddmm(data), ...v })).sort((a, b) => a.data.localeCompare(b.data));
  }, [filtrados]);

  const mensal = useMemo(() => {
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
    setSelUsinas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
              <div className="absolute z-30 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg p-2">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          <KpiTile rotulo="Realizado" valor={fmtEnergia(kpi.realizado)} />
          <KpiTile rotulo="Meta" valor={fmtEnergia(kpi.previsto)} />
          <KpiTile rotulo="Eficiência" valor={kpi.efic != null ? `${kpi.efic}%` : '--'} cor={corPct(kpi.efic)} />
          <KpiTile rotulo="Desvio" valor={`${kpi.desvio >= 0 ? '+' : ''}${fmtEnergia(kpi.desvio)}`} cor={kpi.desvio >= 0 ? '#22c55e' : '#ef4444'} />
          <KpiTile rotulo="Usinas" valor={String(kpi.usinas)} />
          <KpiTile rotulo="Dias c/ dados" valor={String(kpi.dias)} />
        </div>

        {/* ── Geração diária (metade) + Disponibilidade/FC em abas (metade) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 2xl:gap-8">
          <div className="min-w-0">
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Geração diária — realizado × meta</h4>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={diaria} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="label" fontSize={10} interval="preserveStartEnd" minTickGap={28} />
                <YAxis fontSize={10} width={44} tickFormatter={yTickK} />
                <Tooltip content={<TrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
                <Area type="monotone" dataKey="realizado" name="Realizado" stroke={VERDE} strokeWidth={2} fill={VERDE} fillOpacity={0.18} dot={false} />
                <Line type="monotone" dataKey="previsto" name="Meta" stroke={CINZA} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
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
                  <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
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
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Geração mensal — realizado × meta</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mensal} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" vertical={false} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} width={44} tickFormatter={yTickK} />
                <Tooltip content={<TrendTooltip />} cursor={{ fillOpacity: 0.08 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="realizado" name="Realizado" fill={VERDE} radius={[3, 3, 0, 0]} />
                <Bar dataKey="previsto" name="Meta" fill={CINZA} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Ranking de usinas ── */}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <h4 className="text-xs font-medium text-muted-foreground">
                Ranking por eficiência {rankModo === 'ontem' ? `— ontem ${fcDia.data ? ddmm(fcDia.data) : ''}` : '— período'}
              </h4>
              <div className="flex items-center gap-1.5">
                <Chip ativo={rankModo === 'periodo'} onClick={() => setRankModo('periodo')}>Período</Chip>
                <Chip ativo={rankModo === 'ontem'} onClick={() => setRankModo('ontem')}>Ontem</Chip>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rankData} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" vertical={false} />
                <XAxis dataKey="nomeCurto" fontSize={9} interval={0} angle={-35} textAnchor="end" height={54} />
                <YAxis fontSize={10} width={40} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<RankTooltip />} cursor={{ fillOpacity: 0.08 }} />
                <Bar dataKey="pct" name="Eficiência" radius={[3, 3, 0, 0]}>
                  {rankData.map((r) => <Cell key={r.id} fill={corPct(r.pct)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
    </div>
  );
}
