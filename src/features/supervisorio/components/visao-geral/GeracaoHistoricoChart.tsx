import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { coaApi, type PeriodoGeracao, type SerieGeracao } from '@/features/coa/api/coa-api';
import { formatEnergy } from '@/utils/formatEnergy';

/**
 * Gráfico de geração com histórico, no estilo do portal do fabricante: Dia / Mês /
 * Ano / Total com navegação por data. Alimentado por GET /coa/unidades/:id/geracao
 * (snapshots horários da nuvem + fechamento diário). Uma série, um eixo.
 */
const PERIODOS: Array<{ k: PeriodoGeracao; rotulo: string }> = [
  { k: 'dia', rotulo: 'Dia' },
  { k: 'mes', rotulo: 'Mês' },
  { k: 'ano', rotulo: 'Ano' },
  { k: 'total', rotulo: 'Total' },
];

const hojeSP = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

function deslocar(ref: string, periodo: PeriodoGeracao, passo: number): string {
  const [y, m, d] = ref.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (periodo === 'dia') dt.setUTCDate(dt.getUTCDate() + passo);
  else if (periodo === 'mes') { dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth() + passo); }
  else if (periodo === 'ano') { dt.setUTCMonth(0, 1); dt.setUTCFullYear(dt.getUTCFullYear() + passo); }
  return dt.toISOString().slice(0, 10);
}

function podeAvancar(ref: string, periodo: PeriodoGeracao, hoje: string): boolean {
  if (periodo === 'total') return false;
  const prox = deslocar(ref, periodo, 1);
  if (periodo === 'dia') return prox <= hoje;
  if (periodo === 'mes') return prox.slice(0, 7) <= hoje.slice(0, 7);
  return prox.slice(0, 4) <= hoje.slice(0, 4);
}

function rotuloReferencia(ref: string, periodo: PeriodoGeracao): string {
  const [y, m, d] = ref.split('-').map(Number);
  if (periodo === 'dia') return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  if (periodo === 'mes') {
    const s = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (periodo === 'ano') return String(y);
  return 'Desde o início do monitoramento';
}

const nf = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const compacto = (v: number) => (Math.abs(v) >= 1000 ? `${nf(v / 1000, 1)}k` : nf(v, 0));

function TooltipGeracao({ active, payload, label, periodo }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as { kwh: number | null; acumulado?: number | null };
  if (p?.kwh == null) return null;
  let titulo = String(label ?? '');
  if (periodo === 'dia') {
    const h = parseInt(titulo, 10);
    if (!Number.isNaN(h) && h > 0) titulo = `${String(h - 1).padStart(2, '0')}:00–${titulo}`;
  }
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{titulo}</div>
      <div className="mt-0.5 text-muted-foreground">
        {periodo === 'dia' ? 'Energia na hora' : 'Energia'}:{' '}
        <span className="font-semibold text-foreground tabular-nums">{nf(p.kwh, 2)} kWh</span>
      </div>
      {periodo === 'dia' && p.acumulado != null && (
        <div className="text-muted-foreground">
          Acumulado do dia: <span className="font-semibold text-foreground tabular-nums">{nf(p.acumulado, 1)} kWh</span>
        </div>
      )}
    </div>
  );
}

export function GeracaoHistoricoChart({ unidadeId }: { unidadeId: string }) {
  const hoje = useMemo(hojeSP, []);
  const [periodo, setPeriodo] = useState<PeriodoGeracao>('dia');
  const [ref, setRef] = useState<string>(hoje);
  const [serie, setSerie] = useState<SerieGeracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!unidadeId) return;
    setLoading(true);
    setErro(null);
    try {
      setSerie(await coaApi.getGeracao(unidadeId, periodo, periodo === 'total' ? undefined : ref));
    } catch (e: any) {
      setSerie(null);
      setErro(e?.response?.data?.message || 'Não foi possível carregar o histórico de geração.');
    } finally {
      setLoading(false);
    }
  }, [unidadeId, periodo, ref]);

  useEffect(() => { carregar(); }, [carregar]);

  // Dia corrente: o snapshot da nuvem é horário — recarrega a cada 5 min.
  useEffect(() => {
    if (periodo !== 'dia' || ref !== hoje) return undefined;
    const t = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [periodo, ref, hoje, carregar]);

  const pontos = serie?.pontos ?? [];
  const temDado = pontos.some((p) => p.kwh != null && p.kwh > 0);

  const exportarCsv = () => {
    if (!serie) return;
    const linhas = [
      'periodo;rotulo;kwh',
      ...serie.pontos.map((p) => `${periodo};${p.rotulo};${p.kwh == null ? '' : String(p.kwh).replace('.', ',')}`),
    ];
    const blob = new Blob([`﻿${linhas.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geracao-${periodo}-${periodo === 'total' ? 'total' : ref}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Azul da série de geração (o mesmo azul que o mapa do COA usa). O primary do tema é
  // quase neutro e deixava a curva cinza, com cara de desabilitada.
  const cor = '#3B82F6';
  const eixoX = { dataKey: 'rotulo', tick: { fontSize: 11 }, tickLine: false, axisLine: false, stroke: 'hsl(var(--muted-foreground))' };
  const eixoY = { tick: { fontSize: 11 }, tickLine: false, axisLine: false, width: 44, tickFormatter: compacto, stroke: 'hsl(var(--muted-foreground))' };
  const btnNav = 'grid h-8 w-8 place-items-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Energia no período</div>
          <div className="text-2xl font-bold tabular-nums">{serie ? formatEnergy(serie.total_kwh) : '—'}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label="Período do gráfico">
            {PERIODOS.map((p) => (
              <button
                key={p.k}
                type="button"
                aria-pressed={periodo === p.k}
                onClick={() => { setPeriodo(p.k); if (p.k !== 'total') setRef(hoje); }}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  periodo === p.k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <button type="button" onClick={exportarCsv} disabled={!serie || !temDado} title="Exportar CSV" aria-label="Exportar CSV" className={btnNav}>
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {periodo !== 'total' && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <button type="button" className={btnNav} aria-label="Período anterior" onClick={() => setRef(deslocar(ref, periodo, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          {periodo === 'dia' ? (
            <input
              type="date"
              value={ref}
              max={hoje}
              onChange={(e) => e.target.value && setRef(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
              aria-label="Escolher dia"
            />
          ) : (
            <span className="min-w-[150px] text-center text-sm font-medium">{rotuloReferencia(ref, periodo)}</span>
          )}
          <button
            type="button"
            className={btnNav}
            aria-label="Próximo período"
            disabled={!podeAvancar(ref, periodo, hoje)}
            onClick={() => setRef(deslocar(ref, periodo, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="px-4 pt-3 text-[11px] text-muted-foreground">
        kWh por {periodo === 'dia' ? 'hora' : periodo === 'mes' ? 'dia' : periodo === 'ano' ? 'mês' : 'ano'}
      </div>
      <div className="relative h-72 px-2 pb-3 pt-1">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-card/60">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && (erro || !temDado) ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
            <div>
              <p>{erro ?? 'Sem dados de geração neste período.'}</p>
              {!erro && periodo === 'dia' && (
                <p className="mt-1 text-xs">O detalhamento por hora vem da integração de nuvem do fabricante.</p>
              )}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {periodo === 'dia' ? (
              <AreaChart data={pontos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-geracao-${unidadeId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis {...eixoX} interval={2} />
                <YAxis {...eixoY} />
                <Tooltip content={<TooltipGeracao periodo={periodo} />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }} />
                <Area
                  type="monotone"
                  dataKey="kwh"
                  stroke={cor}
                  strokeWidth={2}
                  fill={`url(#grad-geracao-${unidadeId})`}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <BarChart data={pontos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis {...eixoX} interval={periodo === 'mes' ? 1 : 0} />
                <YAxis {...eixoY} />
                <Tooltip content={<TooltipGeracao periodo={periodo} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
                <Bar dataKey="kwh" fill={cor} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default GeracaoHistoricoChart;
