import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { curveMonotoneX } from '@visx/curve';
import { AreaChart, Area } from '@/components/charts/area-chart';
import { ComposedChart } from '@/components/charts/composed-chart';
import { Line } from '@/components/charts/line';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { BrushOverlay } from '@/components/graficos/brush-overlay';
import { COR } from '@/components/graficos/cores';
import { Estatisticas } from '@/components/graficos/estatisticas';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { formatEnergy, formatPower, getPowerValue } from '@/utils/formatEnergy';
import { formatHoraMinuto } from '@/components/charts/chart-formatters';
import { useGraficoDia } from '@/hooks/useInversorGraficos';

interface GraficoDiaData {
  data: string;
  total_pontos: number;
  intervalo_minutos?: number;
  dados: Array<{
    timestamp: string;
    hora: string;
    potencia_kw: number;
    potencia_min?: number;
    potencia_max?: number;
    num_leituras: number;
    qualidade: string;
  }>;
}

interface InversorGraficoDiaProps {
  data: GraficoDiaData | null;      // overview: 30min, dia inteiro
  loading: boolean;
  height?: number;
  equipamentoId?: string | null;    // para buscar detail internamente
  /** Geração do dia pelo contador do inversor (energy.daily_yield). Fonte de
   *  verdade da energia do dia inteiro — usada na estatística "Energia" quando
   *  não há zoom (a integração da curva subconta ~8% por gaps de amostragem). */
  geracaoDiariaKwh?: number;
}

interface PontoDia extends Record<string, unknown> {
  date: Date;
  potencia: number;
  potencia_min?: number;
  potencia_max?: number;
}

const MARGEM_OVERVIEW = { top: 4, right: 8, bottom: 4, left: 8 };
const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Determina intervalo ideal pelo tamanho da janela visível (em minutos)
function intervaloParaJanela(minutos: number): string {
  if (minutos <= 30) return '1';
  if (minutos <= 120) return '5';
  if (minutos <= 360) return '15';
  return '30';
}

const paraPonto = (point: GraficoDiaData['dados'][number]): PontoDia => ({
  date: new Date(point.timestamp),
  potencia: point.potencia_kw,
  potencia_min: point.potencia_min,
  potencia_max: point.potencia_max,
});

export function InversorGraficoDia({ data, loading, height = 400, equipamentoId, geracaoDiariaKwh }: InversorGraficoDiaProps) {
  // Range do brush sobre o overview (índices no array overviewChartData)
  const [brushRange, setBrushRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  // Janela de zoom em timestamps ISO — null = mostrando overview completo
  const [zoomWindow, setZoomWindow] = useState<{ inicio: string; fim: string; intervalo: string } | null>(null);

  const contextContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dados do overview: dia inteiro em 30min (recebidos via prop), ordenados no tempo.
  const overviewChartData = useMemo<PontoDia[]>(() => {
    if (!data?.dados || data.dados.length === 0) return [];
    return data.dados.map(paraPonto).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  // Eixo do overview vai de 00:00 a 24:00 do dia, mesmo que a leitura comece depois.
  const diaDomain = useMemo<[Date, Date] | null>(() => {
    if (overviewChartData.length === 0) return null;
    const inicio = new Date(overviewChartData[0].date);
    inicio.setHours(0, 0, 0, 0);
    return [inicio, new Date(inicio.getTime() + UM_DIA_MS)];
  }, [overviewChartData]);

  const fracoes = useMemo(() => {
    if (!diaDomain) return [];
    const [inicio] = diaDomain;
    return overviewChartData.map((p) => (p.date.getTime() - inicio.getTime()) / UM_DIA_MS);
  }, [overviewChartData, diaDomain]);

  // Inicializa brush ao carregar overview
  useEffect(() => {
    if (overviewChartData.length > 0) {
      setBrushRange({ start: 0, end: overviewChartData.length - 1 });
    }
  }, [overviewChartData.length]);

  // Busca interna de detalhe — só dispara quando zoomWindow está definido
  const detail = useGraficoDia(
    zoomWindow && equipamentoId ? equipamentoId : null,
    undefined,
    zoomWindow?.intervalo,
    zoomWindow?.inicio,
    zoomWindow?.fim,
  );

  // Dados do gráfico de foco: detalhe se disponível, senão slice do overview
  const focusChartData = useMemo<PontoDia[]>(() => {
    if (detail.data?.dados && detail.data.dados.length > 0) {
      return detail.data.dados.map(paraPonto).sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    // Enquanto detalhe carrega (ou se não há zoom), mostra slice do overview
    if (overviewChartData.length === 0) return [];
    return overviewChartData.slice(brushRange.start, brushRange.end + 1);
  }, [detail.data, overviewChartData, brushRange]);

  const temFaixa = useMemo(
    () => focusChartData.some((d) => typeof d.potencia_max === 'number' && typeof d.potencia_min === 'number'),
    [focusChartData],
  );

  const stats = useMemo(() => {
    const pts = focusChartData.map((d) => d.potencia).filter((p): p is number => typeof p === 'number');
    if (!pts.length) return { max: 0, avg: 0, energia: 0 };
    const intervaloH = ((detail.data?.intervalo_minutos ?? data?.intervalo_minutos ?? 30)) / 60;
    const energiaIntegrada = pts.reduce((a, b) => a + b, 0) * intervaloH;
    // Dia inteiro (sem zoom): usa o contador do inversor (daily_yield), que é a
    // geração real do dia e bate com "Geração Diária". A integração da curva fica
    // ~8% abaixo por gaps de amostragem. Com zoom numa janela, integra a janela.
    const energia = (!zoomWindow && geracaoDiariaKwh != null && geracaoDiariaKwh > 0)
      ? geracaoDiariaKwh
      : energiaIntegrada;
    return {
      max: Math.max(...pts),
      avg: pts.reduce((a, b) => a + b, 0) / pts.length,
      energia,
    };
  }, [focusChartData, detail.data?.intervalo_minutos, data?.intervalo_minutos, zoomWindow, geracaoDiariaKwh]);

  // Calcula zoom window a partir dos índices do brush no overview
  const aplicarZoom = useCallback((startIdx: number, endIdx: number) => {
    if (!overviewChartData.length) return;

    const startTs = overviewChartData[startIdx]?.date.getTime();
    const endTs = overviewChartData[endIdx]?.date.getTime();
    if (!startTs || !endTs) return;

    const totalPontos = overviewChartData.length;
    const pontosVisiveis = endIdx - startIdx + 1;
    const percentual = (pontosVisiveis / totalPontos) * 100;

    if (percentual >= 90) {
      // Volta ao overview
      setZoomWindow(null);
      return;
    }

    const minutosVisiveis = (endTs - startTs) / 60000;
    const intervalo = intervaloParaJanela(minutosVisiveis);

    setZoomWindow({
      inicio: new Date(startTs).toISOString(),
      fim: new Date(endTs).toISOString(),
      intervalo,
    });
  }, [overviewChartData]);

  const agendarZoom = useCallback((start: number, end: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => aplicarZoom(start, end), 500);
  }, [aplicarZoom]);

  // Arraste do brush: a janela muda na hora, o detalhe é buscado ao soltar.
  const handleBrushChange = useCallback((start: number, end: number) => {
    setBrushRange({ start, end });
  }, []);

  const handleBrushCommit = useCallback((start: number, end: number) => {
    agendarZoom(start, end);
  }, [agendarZoom]);

  // Scroll sobre o gráfico de contexto ajusta o brush (zoom)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const total = overviewChartData.length;
    if (total < 2) return;

    const { start, end } = brushRange;
    const visivel = end - start;
    const fator = e.deltaY > 0 ? 1.25 : 0.8; // baixo = zoom out, cima = zoom in
    const novoVisivel = Math.max(2, Math.min(total - 1, Math.round(visivel * fator)));

    const centro = Math.round((start + end) / 2);
    const novoStart = Math.max(0, centro - Math.floor(novoVisivel / 2));
    const novoEnd = Math.min(total - 1, novoStart + novoVisivel - 1);

    setBrushRange({ start: novoStart, end: novoEnd });
    agendarZoom(novoStart, novoEnd);
  }, [brushRange, overviewChartData.length, agendarZoom]);

  useEffect(() => {
    const el = contextContainerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const isZoomed = !!zoomWindow;
  const intervaloExibido = isZoomed
    ? (detail.data?.intervalo_minutos ?? zoomWindow?.intervalo ?? '?')
    : (data?.intervalo_minutos ?? 30);

  const handleResetZoom = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setZoomWindow(null);
    setBrushRange({ start: 0, end: overviewChartData.length - 1 });
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Carregando dados do dia...</div>;
  }

  if (!data || overviewChartData.length === 0 || !diaDomain) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Nenhum dado disponível para este dia</div>;
  }

  const focusHeight = Math.max(180, height - 120);

  return (
    <div className="space-y-3">
      <Estatisticas
        itens={[
          { rotulo: isZoomed ? 'Energia na janela' : 'Energia do dia', valor: formatEnergy(stats.energia), cor: COR.geracao },
          { rotulo: 'Potência média', valor: formatPower(stats.avg), cor: COR.potencia },
          { rotulo: 'Pico', valor: formatPower(stats.max) },
        ]}
      />

      {/* Gráfico de foco — exibe a janela selecionada */}
      <div className="relative" style={{ height: focusHeight }}>
        {detail.loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70">
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-md">
              <svg className="h-3 w-3 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Carregando resolução {intervaloExibido}min...
            </div>
          </div>
        )}
        <ComposedChart
          data={focusChartData}
          aspectRatio="auto"
          className="h-full"
          margin={{ top: 12, right: 16, bottom: 28, left: 56 }}
          animationDuration={0}
        >
          <Grid horizontal numTicksRows={4} />
          {temFaixa && (
            <Area
              dataKey="potencia_max"
              fill={COR.potencia}
              fillOpacity={0.1}
              gradientToOpacity={0.02}
              showLine={false}
              showHighlight={false}
              curve={curveMonotoneX}
              animate={false}
            />
          )}
          <Line dataKey="potencia" stroke={COR.potencia} strokeWidth={2} curve={curveMonotoneX} fadeEdges={false} animate={false} />
          {temFaixa && (
            <Line dataKey="potencia_max" stroke={COR.neutro} strokeWidth={1} dashFromIndex={0} dashArray="4,4" curve={curveMonotoneX} fadeEdges={false} animate={false} showHighlight={false} />
          )}
          {temFaixa && (
            <Line dataKey="potencia_min" stroke={COR.neutro} strokeWidth={1} dashFromIndex={0} dashArray="4,4" curve={curveMonotoneX} fadeEdges={false} animate={false} showHighlight={false} />
          )}
          <XAxis numTicks={6} />
          <YAxis numTicks={4} formatValue={(v) => `${v} kW`} />
          <ChartTooltip
            showDots
            content={({ point }) => {
              const p = point as PontoDia;
              const potencia = getPowerValue(p.potencia);
              const linhas = temFaixa && typeof p.potencia_max === 'number' && typeof p.potencia_min === 'number'
                ? [
                    { label: 'Máxima', value: formatPower(p.potencia_max), cor: COR.neutro },
                    { label: 'Mínima', value: formatPower(p.potencia_min), cor: COR.neutro },
                  ]
                : undefined;
              return (
                <TooltipDestaque
                  titulo={formatHoraMinuto(p.date)}
                  valor={potencia.value}
                  unidade={potencia.unit}
                  rotulo="Potência"
                  linhas={linhas}
                />
              );
            }}
          />
        </ComposedChart>
      </div>

      {/* Gráfico de contexto — miniatura do dia com brush */}
      <div className="rounded-lg border bg-card/60 p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 3H3v7h18V3z"/><path d="M21 14H3v7h18v-7z"/><path d="M12 10v4"/><path d="M8 10v4"/><path d="M16 10v4"/>
            </svg>
            {isZoomed
              ? <><span className="font-medium text-foreground">Zoom {intervaloExibido}min/ponto</span> · Scroll ou arraste para ajustar</>
              : <>Visão geral · {intervaloExibido}min/ponto · <span className="font-medium">Arraste ou scroll para zoom</span></>}
          </div>
          {isZoomed && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:opacity-60"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
              Restaurar
            </button>
          )}
        </div>
        <div ref={contextContainerRef} className="relative h-[68px]" style={{ touchAction: 'none' }}>
          <AreaChart
            data={overviewChartData}
            xDomain={diaDomain}
            aspectRatio="auto"
            className="h-full"
            margin={MARGEM_OVERVIEW}
            animationDuration={0}
          >
            <Area
              dataKey="potencia"
              fill={COR.potencia}
              fillOpacity={0.3}
              gradientToOpacity={0.05}
              strokeWidth={1}
              curve={curveMonotoneX}
              showHighlight={false}
              animate={false}
            />
          </AreaChart>
          <BrushOverlay
            fracoes={fracoes}
            start={brushRange.start}
            end={brushRange.end}
            onChange={handleBrushChange}
            onCommit={handleBrushCommit}
            margemEsq={MARGEM_OVERVIEW.left}
            margemDir={MARGEM_OVERVIEW.right}
            cor={COR.potencia}
          />
        </div>
      </div>
    </div>
  );
}
