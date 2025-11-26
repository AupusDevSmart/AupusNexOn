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

interface GraficoMesData {
  mes: string;
  total_dias: number;
  energia_total_kwh: number;
  dados: Array<{
    data: string;
    dia: number;
    energia_kwh: number;
    potencia_media_kw: number;
    num_registros: number;
  }>;
}

interface InversorGraficoMesProps {
  data: GraficoMesData | null;
  loading: boolean;
  height?: number;
}

export function InversorGraficoMes({ data, loading, height = 400 }: InversorGraficoMesProps) {
  console.log('🔵 [InversorGraficoMes] Renderizando com:', {
    hasData: !!data,
    loading,
    dadosLength: data?.dados?.length,
    data
  });

  const chartData = useMemo(() => {
    if (!data?.dados) {
      console.log('⚠️ [InversorGraficoMes] Sem dados para processar');
      return [];
    }

    return data.dados.map((point) => ({
      dia: `${point.dia}`,
      data: point.data,
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

  // Cores baseadas no nível de energia
  const getBarColor = (energia: number) => {
    const normalizedValue = energia / stats.max;
    if (normalizedValue > 0.8) return 'hsl(142, 76%, 36%)'; // Verde
    if (normalizedValue > 0.5) return 'hsl(45, 93%, 47%)'; // Amarelo
    if (normalizedValue > 0.2) return 'hsl(25, 95%, 53%)'; // Laranja
    return 'hsl(0, 84%, 60%)'; // Vermelho
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Carregando dados do mês...
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nenhum dado disponível para este mês
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
          <div className="text-sm text-muted-foreground mb-1">Média Diária</div>
          <div className="text-2xl font-bold text-blue-600">{stats.avg.toFixed(2)} kWh</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Melhor Dia</div>
          <div className="text-2xl font-bold text-green-600">{stats.max.toFixed(2)} kWh</div>
        </div>
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Dias com Dados</div>
          <div className="text-2xl font-bold text-purple-600">{data.total_dias}</div>
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
            dataKey="dia"
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            label={{ value: 'Dia do Mês', position: 'insideBottom', offset: -5 }}
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
                      Data: {props.payload.data}
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
            name="Energia Diária"
            radius={[8, 8, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.energia)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="text-center text-xs text-muted-foreground">
        Mês: {data.mes} | Energia total gerada no período
      </div>
    </div>
  );
}
