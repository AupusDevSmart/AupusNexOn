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
import { formatEnergy, formatPower, getEnergyValue, getPowerValue } from '@/utils/formatEnergy';

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

  // Tons de cinza que funcionam em light e dark mode
  const getBarColor = (energia: number) => {
    const normalizedValue = energia / stats.max;
    // Usa tons de cinza com diferentes intensidades
    if (normalizedValue > 0.8) return '#4b5563'; // gray-600
    if (normalizedValue > 0.6) return '#6b7280'; // gray-500
    if (normalizedValue > 0.4) return '#9ca3af'; // gray-400
    if (normalizedValue > 0.2) return '#d1d5db'; // gray-300
    return '#e5e7eb'; // gray-200
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
      {/* Estatísticas - Design Minimalista */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Energia Total</div>
          <div className="text-lg font-semibold">{formatEnergy(data.energia_total_kwh)}</div>
        </div>
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Média Diária</div>
          <div className="text-lg font-semibold">{formatEnergy(stats.avg)}</div>
        </div>
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Melhor Dia</div>
          <div className="text-lg font-semibold">{formatEnergy(stats.max)}</div>
        </div>
        <div className="text-center p-3 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Dias com Dados</div>
          <div className="text-lg font-semibold">{data.total_dias}</div>
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
            formatter={(value: number, name: string, props: any) => {
              if (name === 'energia' || name === 'Energia Diária') {
                const energyData = getEnergyValue(value);
                const powerData = getPowerValue(props.payload.potencia_media);

                return [
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black">
                        {energyData.value}
                      </span>
                      <span className="text-xl font-bold text-muted-foreground">
                        {energyData.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Potência Média:</span>
                      <span className="font-bold">{formatPower(props.payload.potencia_media)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Data:</span>
                      <span className="font-semibold">{new Date(props.payload.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Registros:</span>
                      <span className="font-semibold">{props.payload.registros.toLocaleString()}</span>
                    </div>
                  </div>,
                  <span className="text-lg font-bold">Energia Gerada - Dia {props.payload.dia}</span>
                ];
              }
              return [formatEnergy(value), name];
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
