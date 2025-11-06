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
} from 'recharts';
import { format } from 'date-fns';

interface PowerDataPoint {
  timestamp: string;
  dados: {
    power?: {
      active_total?: number;
    };
  };
}

interface InversorPowerChartProps {
  data: PowerDataPoint[];
  height?: number;
}

export function InversorPowerChart({ data, height = 300 }: InversorPowerChartProps) {
  const chartData = useMemo(() => {
    return data
      .map((point) => ({
        timestamp: new Date(point.timestamp).getTime(),
        time: format(new Date(point.timestamp), 'HH:mm'),
        power: point.dados?.power?.active_total ? point.dados.power.active_total / 1000 : 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  const maxPower = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map((d) => d.power));
  }, [chartData]);

  const minPower = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.min(...chartData.map((d) => d.power));
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nenhum dado histórico disponível
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
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
          dataKey="time"
          className="text-xs"
          tick={{ fill: 'currentColor' }}
          tickFormatter={(value) => value}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: 'currentColor' }}
          domain={[minPower * 0.95, maxPower * 1.05]}
          tickFormatter={(value) => `${value.toFixed(0)} kW`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number) => [`${value.toFixed(2)} kW`, 'Potência Ativa']}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="power"
          stroke="hsl(217, 91%, 60%)"
          strokeWidth={2}
          dot={false}
          name="Potência Ativa (kW)"
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
