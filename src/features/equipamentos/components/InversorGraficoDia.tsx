import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import { format } from 'date-fns';

interface GraficoDiaData {
  data: string;
  total_pontos: number;
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
}

export function InversorGraficoDia({ data, loading, height = 400 }: InversorGraficoDiaProps) {
  const chartData = useMemo(() => {
    if (!data?.dados) return [];

    return data.dados.map((point) => ({
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

    const potencias = chartData.map(d => d.potencia);
    const max = Math.max(...potencias);
    const min = Math.min(...potencias);
    const avg = potencias.reduce((acc, val) => acc + val, 0) / potencias.length;

    // Energia total (soma da potência média de cada minuto * intervalo em horas)
    const energia = chartData.reduce((acc, d) => acc + d.potencia, 0) / 60; // kWh

    return { max, min, avg, energia };
  }, [chartData]);

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

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Energia Total</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.energia.toFixed(2)} kWh</div>
        </div>
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Potência Média</div>
          <div className="text-2xl font-bold text-blue-600">{stats.avg.toFixed(2)} kW</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Pico</div>
          <div className="text-2xl font-bold text-green-600">{stats.max.toFixed(2)} kW</div>
        </div>
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Pontos</div>
          <div className="text-2xl font-bold text-purple-600">{data.total_pontos}</div>
        </div>
      </div>

      {/* Gráfico de Linha */}
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
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, name: string) => {
              if (name === 'potencia') return [`${value.toFixed(2)} kW`, 'Potência Média'];
              if (name === 'potencia_max') return [`${value.toFixed(2)} kW`, 'Máxima'];
              if (name === 'potencia_min') return [`${value.toFixed(2)} kW`, 'Mínima'];
              return [value, name];
            }}
          />
          <Legend />

          {/* Área entre min e max */}
          {chartData.some(d => d.potencia_min !== undefined) && (
            <Area
              type="monotone"
              dataKey="potencia_max"
              stroke="none"
              fill="hsl(217, 91%, 60%)"
              fillOpacity={0.1}
              name="Faixa de Variação"
            />
          )}

          <Line
            type="monotone"
            dataKey="potencia"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2}
            dot={false}
            name="Potência Média"
            isAnimationActive={false}
          />

          {/* Linhas de min/max se disponíveis */}
          {chartData.some(d => d.potencia_max !== undefined) && (
            <Line
              type="monotone"
              dataKey="potencia_max"
              stroke="hsl(142, 76%, 36%)"
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
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="Mínima"
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="text-center text-xs text-muted-foreground">
        Data: {data.data} | Agregação: 1 minuto
      </div>
    </div>
  );
}
