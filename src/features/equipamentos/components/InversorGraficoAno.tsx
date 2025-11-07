import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface GraficoAnoData {
  ano: number;
  total_meses: number;
  energia_total_kwh: number;
  dados: Array<{
    mes: string;
    mes_numero: number;
    mes_nome: string;
    energia_kwh: number;
    potencia_media_kw: number;
    num_registros: number;
  }>;
}

interface InversorGraficoAnoProps {
  data: GraficoAnoData | null;
  loading: boolean;
  height?: number;
}

export function InversorGraficoAno({ data, loading, height = 400 }: InversorGraficoAnoProps) {
  const chartData = useMemo(() => {
    if (!data?.dados) return [];

    return data.dados.map((point) => ({
      mes: point.mes_nome.substring(0, 3), // Abreviação (Jan, Fev, etc)
      mes_completo: point.mes_nome,
      mes_numero: point.mes_numero,
      energia: point.energia_kwh,
      potencia_media: point.potencia_media_kw,
      registros: point.num_registros,
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { max: 0, min: 0, avg: 0 };
    }

    const energias = chartData.map(d => d.energia);
    const max = Math.max(...energias);
    const min = Math.min(...energias);
    const avg = energias.reduce((acc, val) => acc + val, 0) / energias.length;

    return { max, min, avg };
  }, [chartData]);

  // Cores baseadas no nível de energia (escala de verde a vermelho)
  const getBarColor = (energia: number) => {
    const normalizedValue = energia / stats.max;
    if (normalizedValue > 0.8) return 'hsl(142, 76%, 36%)'; // Verde escuro
    if (normalizedValue > 0.6) return 'hsl(142, 70%, 45%)'; // Verde
    if (normalizedValue > 0.4) return 'hsl(45, 93%, 47%)'; // Amarelo
    if (normalizedValue > 0.2) return 'hsl(25, 95%, 53%)'; // Laranja
    return 'hsl(0, 84%, 60%)'; // Vermelho
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Carregando dados do ano...
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nenhum dado disponível para este ano
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Energia Total</div>
          <div className="text-2xl font-bold text-yellow-600">{data.energia_total_kwh.toFixed(2)} kWh</div>
        </div>
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Média Mensal</div>
          <div className="text-2xl font-bold text-blue-600">{stats.avg.toFixed(2)} kWh</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Melhor Mês</div>
          <div className="text-2xl font-bold text-green-600">{stats.max.toFixed(2)} kWh</div>
        </div>
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Meses com Dados</div>
          <div className="text-2xl font-bold text-purple-600">{data.total_meses}</div>
        </div>
      </div>

      {/* Gráfico de Barras */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
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
            dataKey="mes"
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            label={{ value: 'Mês', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            label={{ value: 'Energia (kWh)', angle: -90, position: 'insideLeft' }}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, name: string, props: any) => {
              if (name === 'energia') {
                return [
                  <>
                    <div>{value.toFixed(2)} kWh</div>
                    <div className="text-xs text-muted-foreground">
                      Potência média: {props.payload.potencia_media.toFixed(2)} kW
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Mês: {props.payload.mes_completo}
                    </div>
                  </>,
                  'Energia Gerada'
                ];
              }
              return [value, name];
            }}
          />
          <Legend />
          <Bar
            dataKey="energia"
            name="Energia Mensal"
            radius={[8, 8, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.energia)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="text-center text-xs text-muted-foreground">
        Ano: {data.ano} | Energia total gerada no período
      </div>
    </div>
  );
}
