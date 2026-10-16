import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { curveMonotoneX } from '@visx/curve';
import { AreaChart, Area } from '@/components/charts/area-chart';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { coaApi, type PeriodoGeracao, type PontoGeracao, type SerieGeracao } from '@/features/coa/api/coa-api';
import { formatEnergy } from '@/utils/formatEnergy';

/**
 * Gráfico de geração com histórico, no estilo do portal do fabricante: Dia / Mês /
 * Ano / Total com navegação por data. Alimentado por GET /coa/unidades/:id/geracao
 * (snapshots horários da nuvem + fechamento diário). Uma série, um eixo.
 * Dia é série de tempo (área, eixo em horas); mês/ano/total são barras por categoria.
 */
const PERIODOS: Array<{ k: PeriodoGeracao; rotulo: string }> = [
  { k: 'dia', rotulo: 'Dia' },
  { k: 'mes', rotulo: 'Mês' },
  { k: 'ano', rotulo: 'Ano' },
  { k: 'total', rotulo: 'Total' },
];

const UNIDADE_PERIODO: Record<PeriodoGeracao, string> = { dia: 'hora', mes: 'dia', ano: 'mês', total: 'ano' };

const MARGEM = { top: 12, right: 16, bottom: 28, left: 56 };

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

/** Ponto do modo Dia: série de tempo do bklit exige `date` como Date local. */
interface PontoDia extends Record<string, unknown> {
  date: Date;
  rotulo: string;
  kwh: number;
  acumulado: number | null;
}

/** Ponto dos modos Mês / Ano / Total: categoria no eixo X. */
interface PontoBarra extends Record<string, unknown> {
  rotulo: string;
  kwh: number | null;
}

/** "HH:00" no dia `ref` (YYYY-MM-DD), em horário local. Rótulo fora do padrão cai no índice. */
function dataDoRotulo(ref: string, rotulo: string, indice: number): Date {
  const [y, m, d] = ref.split('-').map(Number);
  const hm = /^(\d{1,2}):(\d{2})$/.exec(rotulo);
  const hora = hm ? Number(hm[1]) : indice;
  const minuto = hm ? Number(hm[2]) : 0;
  return new Date(y, m - 1, d, hora, minuto);
}

/** Texto do tooltip de hora, como antes: "06:00–07:00" para o rótulo "07:00". */
function faixaHora(rotulo: string): string {
  const h = parseInt(rotulo, 10);
  if (!Number.isNaN(h) && h > 0) return `${String(h - 1).padStart(2, '0')}:00–${rotulo}`;
  return rotulo;
}

function mensagemErro(e: unknown): string {
  const msg = (e as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof msg === 'string' && msg ? msg : 'Não foi possível carregar o histórico de geração.';
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
    } catch (e: unknown) {
      setSerie(null);
      setErro(mensagemErro(e));
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

  const pontos = useMemo<PontoGeracao[]>(() => serie?.pontos ?? [], [serie]);
  const temDado = pontos.some((p) => p.kwh != null && p.kwh > 0);

  // Enquanto troca de período/data, a série em tela ainda é a anterior: o tipo de
  // gráfico e as datas seguem o que a API devolveu, não o que foi pedido.
  const periodoSerie: PeriodoGeracao = serie?.periodo ?? periodo;
  const refSerie = serie?.referencia ?? ref;

  // Dia: horas sem leitura (kwh null) ficam de fora em vez de virar 0 na curva.
  const pontosDia = useMemo<PontoDia[]>(() => {
    if (periodoSerie !== 'dia') return [];
    const lista: PontoDia[] = [];
    pontos.forEach((p, i) => {
      if (p.kwh == null) return;
      lista.push({ date: dataDoRotulo(refSerie, p.rotulo, i), rotulo: p.rotulo, kwh: p.kwh, acumulado: p.acumulado ?? null });
    });
    return lista.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [periodoSerie, pontos, refSerie]);

  const pontosBarra = useMemo<PontoBarra[]>(
    () => (periodoSerie === 'dia' ? [] : pontos.map((p) => ({ rotulo: p.rotulo, kwh: p.kwh }))),
    [periodoSerie, pontos],
  );

  const exportarCsv = () => {
    if (!serie) return;
    const linhas = [
      'periodo;rotulo;kwh',
      ...serie.pontos.map((p) => `${periodo};${p.rotulo};${p.kwh == null ? '' : String(p.kwh).replace('.', ',')}`),
    ];
    const blob = new Blob([`\uFEFF${linhas.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geracao-${periodo}-${periodo === 'total' ? 'total' : ref}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      <div className="px-4 pt-3 text-[11px] text-muted-foreground">kWh por {UNIDADE_PERIODO[periodo]}</div>
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
        ) : periodoSerie === 'dia' ? (
          pontosDia.length > 1 && (
            <AreaChart
              data={pontosDia}
              aspectRatio="auto"
              className="h-full"
              margin={MARGEM}
              animationDuration={600}
            >
              <Grid horizontal numTicksRows={4} />
              <Area
                dataKey="kwh"
                fill={COR.geracao}
                fillOpacity={0.35}
                gradientToOpacity={0.02}
                strokeWidth={2}
                curve={curveMonotoneX}
              />
              <XAxis numTicks={7} />
              <YAxis numTicks={4} formatValue={compacto} />
              <ChartTooltip
                showDots
                content={({ point }) => {
                  const p = point as PontoDia;
                  return (
                    <TooltipDestaque
                      titulo={faixaHora(p.rotulo)}
                      valor={nf(p.kwh, 2)}
                      unidade="kWh"
                      rotulo="Energia na hora"
                      linhas={p.acumulado != null ? [{ label: 'Acumulado do dia', value: `${nf(p.acumulado, 1)} kWh` }] : undefined}
                    />
                  );
                }}
              />
            </AreaChart>
          )
        ) : (
          pontosBarra.length > 0 && (
            <BarChart
              data={pontosBarra}
              xDataKey="rotulo"
              aspectRatio="auto"
              className="h-full"
              margin={MARGEM}
              barGap={0.3}
              barWidth={periodoSerie === 'total' ? 28 : undefined}
              animationDuration={600}
            >
              <Grid horizontal numTicksRows={4} />
              <Bar dataKey="kwh" fill={COR.geracao} lineCap={4} />
              <BarXAxis maxLabels={periodoSerie === 'mes' ? 16 : 12} showAllLabels={periodoSerie !== 'mes'} />
              <YAxis numTicks={4} formatValue={compacto} />
              <ChartTooltip
                showDatePill={false}
                showCrosshair={false}
                showDots={false}
                content={({ point }) => {
                  const p = point as PontoBarra;
                  const titulo = periodoSerie === 'mes' ? `Dia ${p.rotulo}` : p.rotulo;
                  if (p.kwh == null) return <TooltipDestaque titulo={titulo} rotulo="Sem dado de geração" />;
                  return <TooltipDestaque titulo={titulo} valor={nf(p.kwh, 2)} unidade="kWh" rotulo="Energia" />;
                }}
              />
            </BarChart>
          )
        )}
      </div>
    </div>
  );
}

export default GeracaoHistoricoChart;
