import { useMemo, useCallback, useRef } from 'react';
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
  data: GraficoDiaData | null;
  loading: boolean;
  height?: number;
  onIntervaloChange?: (intervalo: string) => void;
}

// Mapeia % do range visível para o intervalo ideal
function calcularIntervaloIdeal(percentualVisivel: number): string {
  if (percentualVisivel > 75) return '30';
  if (percentualVisivel > 25) return '15';
  if (percentualVisivel > 5) return '5';
  return '1';
}

export function InversorGraficoDia({ data, loading, height = 400, onIntervaloChange }: InversorGraficoDiaProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoIntervaloRef = useRef<string>('30');

  const chartData = useMemo(() => {
    if (!data?.dados) return [];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioDeHoje = hoje.getTime();

    const dadosDeHoje = data.dados.filter(point => {
      const timestamp = new Date(point.timestamp).getTime();
      return timestamp >= inicioDeHoje;
    });

    return dadosDeHoje.map((point) => ({
      timestamp: new Date(point.timestamp).getTime(),
      hora: format(new Date(point.timestamp), 'HH:mm'),
      potencia: point.potencia_kw,
      potencia_min: point.potencia_min,
      potencia_max: point.potencia_max,
      leituras: point.num_leituras,
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { max: 0, min: 0, avg: 0, energia: 0 };
    }

    const potenciasValidas = chartData
      .map(d => d.potencia)
      .filter((p): p is number => p !== null && p !== undefined);

    if (potenciasValidas.length === 0) {
      return { max: 0, min: 0, avg: 0, energia: 0 };
    }

    const max = Math.max(...potenciasValidas);
    const min = Math.min(...potenciasValidas);
    const avg = potenciasValidas.reduce((acc, val) => acc + val, 0) / potenciasValidas.length;
    const intervaloHoras = (data?.intervalo_minutos || 30) / 60;
    const energia = potenciasValidas.reduce((acc, val) => acc + val, 0) * intervaloHoras;

    return { max, min, avg, energia };
  }, [chartData, data?.intervalo_minutos]);

  // Callback do Brush com debounce - calcula intervalo ideal baseado no zoom
  const handleBrushChange = useCallback((brushRange: { startIndex?: number; endIndex?: number }) => {
    if (!onIntervaloChange || !chartData.length) return;
    if (brushRange.startIndex === undefined || brushRange.endIndex === undefined) return;

    const totalPontos = chartData.length;
    const pontosVisiveis = brushRange.endIndex - brushRange.startIndex + 1;
    const percentualVisivel = (pontosVisiveis / totalPontos) * 100;

    const novoIntervalo = calcularIntervaloIdeal(percentualVisivel);

    // Só dispara se o intervalo mudou
    if (novoIntervalo === ultimoIntervaloRef.current) return;

    // Debounce de 500ms para evitar excesso de requests
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      ultimoIntervaloRef.current = novoIntervalo;
      onIntervaloChange(novoIntervalo);
    }, 500);
  }, [onIntervaloChange, chartData.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Carregando dados do dia...
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nenhum dado disponível para este dia
      </div>
    );
  }

  const intervaloAtual = data.intervalo_minutos || 30;

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Energia Total</div>
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
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Pontos</div>
          <div className="text-lg font-semibold">{data.total_pontos}</div>
        </div>
      </div>

      {/* Gráfico com Brush para zoom progressivo */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="hora"
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            label={{ value: 'Hora do Dia', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            label={{ value: 'Potência (kW)', angle: -90, position: 'insideLeft' }}
            domain={[0, 'auto']}
          />
          <Tooltip
            wrapperClassName="chart-tooltip-opaque"
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              backgroundImage: 'linear-gradient(to bottom, hsl(var(--card)), hsl(var(--card)))',
              backdropFilter: 'none',
              opacity: 1,
              border: '3px solid hsl(var(--primary))',
              borderRadius: '16px',
              boxShadow: '0 15px 50px rgba(0, 0, 0, 0.4)',
              padding: '16px',
              minWidth: '280px'
            }}
            labelStyle={{
              color: 'hsl(var(--foreground))',
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: '12px'
            }}
            formatter={(value: number, name: string) => {
              const powerData = getPowerValue(value);

              if (name === 'potencia' || name === 'Potência Média') {
                return [
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black">
                        {powerData.value}
                      </span>
                      <span className="text-xl font-bold text-muted-foreground">
                        {powerData.unit}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">Potência Média</div>
                  </div>,
                  ''
                ];
              }

              if (name === 'potencia_max' || name === 'Máxima') {
                return [
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Máxima:</span>
                    <span className="font-bold">{formatPower(value)}</span>
                  </div>,
                  ''
                ];
              }

              if (name === 'potencia_min' || name === 'Mínima') {
                return [
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Mínima:</span>
                    <span className="font-bold">{formatPower(value)}</span>
                  </div>,
                  ''
                ];
              }

              return [formatPower(value), name];
            }}
          />
          <Legend />

          {/* Área entre min e max */}
          {chartData.some(d => d.potencia_min !== undefined) && (
            <Area
              type="monotone"
              dataKey="potencia_max"
              stroke="none"
              fill="hsl(var(--muted))"
              fillOpacity={0.3}
              name="Faixa de Variação"
            />
          )}

          <Line
            type="monotone"
            dataKey="potencia"
            stroke="#6b7280"
            strokeWidth={2}
            dot={false}
            name="Potência Média"
            isAnimationActive={false}
            connectNulls={true}
          />

          {chartData.some(d => d.potencia_max !== undefined) && (
            <Line
              type="monotone"
              dataKey="potencia_max"
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="Máxima"
              isAnimationActive={false}
            />
          )}
          {chartData.some(d => d.potencia_min !== undefined) && (
            <Line
              type="monotone"
              dataKey="potencia_min"
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="Mínima"
              isAnimationActive={false}
            />
          )}

          {/* Brush para zoom progressivo - arraste para selecionar range */}
          <Brush
            dataKey="hora"
            height={30}
            stroke="hsl(var(--primary))"
            fill="hsl(var(--muted))"
            onChange={handleBrushChange}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="text-center text-xs text-muted-foreground">
        Data: {data.data} | Resolução: {intervaloAtual} min | Arraste a barra inferior para zoom (busca mais detalhes automaticamente)
      </div>
    </div>
  );
}
