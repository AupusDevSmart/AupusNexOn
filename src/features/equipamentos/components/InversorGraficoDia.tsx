import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Brush,
} from 'recharts';
import { format } from 'date-fns';
import { formatEnergy, formatPower, getPowerValue } from '@/utils/formatEnergy';
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
}

// Determina intervalo ideal pelo tamanho da janela visível (em minutos)
function intervaloParaJanela(minutos: number): string {
  if (minutos <= 30) return '1';
  if (minutos <= 120) return '5';
  if (minutos <= 360) return '15';
  return '30';
}

export function InversorGraficoDia({ data, loading, height = 400, equipamentoId }: InversorGraficoDiaProps) {
  // Range do brush sobre o overview (índices no array overviewChartData)
  const [brushRange, setBrushRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  // Janela de zoom em timestamps ISO — null = mostrando overview completo
  const [zoomWindow, setZoomWindow] = useState<{ inicio: string; fim: string; intervalo: string } | null>(null);

  const contextContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dados do overview: dia inteiro em 30min (recebidos via prop)
  // Padeia com pontos nulos de 00:00 até o primeiro dado para forçar o eixo X a iniciar na meia-noite
  const overviewChartData = useMemo(() => {
    if (!data?.dados || data.dados.length === 0) return [];

    const pontos = data.dados.map((point) => ({
      timestamp: new Date(point.timestamp).getTime(),
      hora: format(new Date(point.timestamp), 'HH:mm'),
      potencia: point.potencia_kw,
      potencia_min: point.potencia_min,
      potencia_max: point.potencia_max,
    }));

    // Garante que o primeiro ponto seja 00:00 do dia
    const primeiroTs = pontos[0].timestamp;
    const meiaNoit = new Date(primeiroTs);
    meiaNoit.setHours(0, 0, 0, 0);
    if (primeiroTs > meiaNoit.getTime()) {
      pontos.unshift({
        timestamp: meiaNoit.getTime(),
        hora: '00:00',
        potencia: null as any,
        potencia_min: undefined,
        potencia_max: undefined,
      });
    }

    return pontos;
  }, [data]);

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
  const focusChartData = useMemo(() => {
    if (detail.data?.dados && detail.data.dados.length > 0) {
      return detail.data.dados.map((point) => ({
        timestamp: new Date(point.timestamp).getTime(),
        hora: format(new Date(point.timestamp), 'HH:mm'),
        potencia: point.potencia_kw,
        potencia_min: point.potencia_min,
        potencia_max: point.potencia_max,
      }));
    }
    // Enquanto detalhe carrega (ou se não há zoom), mostra slice do overview
    if (overviewChartData.length === 0) return [];
    return overviewChartData.slice(brushRange.start, brushRange.end + 1);
  }, [detail.data, overviewChartData, brushRange]);

  const stats = useMemo(() => {
    const pts = focusChartData.map(d => d.potencia).filter((p): p is number => p != null);
    if (!pts.length) return { max: 0, avg: 0, energia: 0 };
    const intervaloH = ((detail.data?.intervalo_minutos ?? data?.intervalo_minutos ?? 30)) / 60;
    return {
      max: Math.max(...pts),
      avg: pts.reduce((a, b) => a + b, 0) / pts.length,
      energia: pts.reduce((a, b) => a + b, 0) * intervaloH,
    };
  }, [focusChartData, detail.data?.intervalo_minutos, data?.intervalo_minutos]);

  // Calcula zoom window a partir dos índices do brush no overview
  const aplicarZoom = useCallback((startIdx: number, endIdx: number) => {
    if (!overviewChartData.length) return;

    const startTs = overviewChartData[startIdx]?.timestamp;
    const endTs = overviewChartData[endIdx]?.timestamp;
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

  // Callback do brush (drag manual)
  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex === undefined || range.endIndex === undefined) return;
    setBrushRange({ start: range.startIndex, end: range.endIndex });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      aplicarZoom(range.startIndex!, range.endIndex!);
    }, 500);
  }, [aplicarZoom]);

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

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      aplicarZoom(novoStart, novoEnd);
    }, 500);
  }, [brushRange, overviewChartData.length, aplicarZoom]);

  useEffect(() => {
    const el = contextContainerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const isZoomed = !!zoomWindow;
  const intervaloExibido = isZoomed
    ? (detail.data?.intervalo_minutos ?? zoomWindow?.intervalo ?? '?')
    : (data?.intervalo_minutos ?? 30);

  const handleResetZoom = () => {
    setZoomWindow(null);
    setBrushRange({ start: 0, end: overviewChartData.length - 1 });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Carregando dados do dia...</div>;
  }

  if (!data || overviewChartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Nenhum dado disponível para este dia</div>;
  }

  const focusHeight = height - 110;

  const tooltipContent = (value: number, name: string) => {
    const powerData = getPowerValue(value);
    if (name === 'potencia' || name === 'Potência') {
      return [<div className="space-y-1"><div className="flex items-baseline gap-2"><span className="text-3xl font-black">{powerData.value}</span><span className="text-xl font-bold text-muted-foreground">{powerData.unit}</span></div><div className="text-sm text-muted-foreground">Potência</div></div>, ''];
    }
    if (name === 'potencia_max' || name === 'Máxima') return [<div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Máxima:</span><span className="font-bold">{formatPower(value)}</span></div>, ''];
    if (name === 'potencia_min' || name === 'Mínima') return [<div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Mínima:</span><span className="font-bold">{formatPower(value)}</span></div>, ''];
    return [formatPower(value), name];
  };

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '2px solid hsl(var(--border))',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    padding: '12px',
    minWidth: '200px',
    opacity: 1,
  };

  return (
    <div className="space-y-3">
      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Energia</div>
          <div className="text-lg font-semibold">{formatEnergy(stats.energia)}</div>
        </div>
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Potência Média</div>
          <div className="text-lg font-semibold">{formatPower(stats.avg)}</div>
        </div>
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Pico</div>
          <div className="text-lg font-semibold">{formatPower(stats.max)}</div>
        </div>
      </div>

      {/* Gráfico de foco — exibe a janela selecionada */}
      <div className="relative">
        {detail.loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-10 rounded-lg">
            <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 text-xs font-medium shadow-md">
              <svg className="animate-spin h-3 w-3 text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Carregando resolução {intervaloExibido}min...
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={focusHeight}>
          <ComposedChart data={focusChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hora" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              domain={[0, 'auto']} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: 'hsl(var(--foreground))', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}
              formatter={tooltipContent}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {focusChartData.some(d => d.potencia_max !== undefined) && (
              <Area type="monotone" dataKey="potencia_max" stroke="none" fill="#f97316" fillOpacity={0.12} name="Faixa" legendType="none" />
            )}
            <Line type="monotone" dataKey="potencia" stroke="#f97316" strokeWidth={2.5} dot={false} name="Potência" isAnimationActive={false} connectNulls={false} />
            {focusChartData.some(d => d.potencia_max !== undefined) && (
              <Line type="monotone" dataKey="potencia_max" stroke="#f97316" strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.6} dot={false} name="Máxima" isAnimationActive={false} />
            )}
            {focusChartData.some(d => d.potencia_min !== undefined) && (
              <Line type="monotone" dataKey="potencia_min" stroke="#f97316" strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.6} dot={false} name="Mínima" isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de contexto — miniatura do dia com brush */}
      <div className="border rounded-lg p-2 bg-muted/20">
        <div className="flex items-center justify-between mb-1 px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 3H3v7h18V3z"/><path d="M21 14H3v7h18v-7z"/><path d="M12 10v4"/><path d="M8 10v4"/><path d="M16 10v4"/>
            </svg>
            {isZoomed
              ? <><span style={{ color: '#f97316' }} className="font-medium">Zoom {intervaloExibido}min/ponto</span> · Scroll ou arraste para ajustar</>
              : <>Visão geral · {intervaloExibido}min/ponto · <span className="font-medium">Arraste ou scroll para zoom</span></>}
          </div>
          {isZoomed && (
            <button
              onClick={handleResetZoom}
              className="text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-70"
              style={{ color: '#f97316' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
              Restaurar
            </button>
          )}
        </div>
        <div ref={contextContainerRef} style={{ touchAction: 'none', cursor: 'col-resize' }}>
          <ResponsiveContainer width="100%" height={65}>
            <ComposedChart data={overviewChartData} margin={{ top: 2, right: 30, left: 20, bottom: 0 }}>
              <Area
                type="monotone"
                dataKey="potencia"
                stroke="#f97316"
                strokeWidth={1.5}
                fill="#f97316"
                fillOpacity={0.25}
                dot={false}
                isAnimationActive={false}
              />
              <Brush
                dataKey="hora"
                height={24}
                stroke="#f97316"
                fill="hsl(var(--muted))"
                travellerWidth={8}
                startIndex={brushRange.start}
                endIndex={brushRange.end}
                onChange={handleBrushChange}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
