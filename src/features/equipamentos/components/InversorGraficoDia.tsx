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
import { formatEnergy, formatPower, getEnergyValue, getPowerValue } from '@/utils/formatEnergy';

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
  console.log('🔵 [InversorGraficoDia] Renderizando com:', {
    hasData: !!data,
    loading,
    dadosLength: data?.dados?.length,
    data
  });

  const chartData = useMemo(() => {
    if (!data?.dados) {
      console.log('⚠️ [InversorGraficoDia] Sem dados para processar');
      return [];
    }

    console.log('📊 [InversorGraficoDia] Processando dados:', data.dados.length, 'pontos');

    // Filtrar apenas dados de hoje (00:00 até agora)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioDeHoje = hoje.getTime();

    const dadosDeHoje = data.dados.filter(point => {
      const timestamp = new Date(point.timestamp).getTime();
      return timestamp >= inicioDeHoje;
    });

    const processed = dadosDeHoje.map((point) => ({
      timestamp: new Date(point.timestamp).getTime(),
      hora: format(new Date(point.timestamp), 'HH:mm'),
      potencia: point.potencia_kw,
      potencia_min: point.potencia_min,
      potencia_max: point.potencia_max,
      leituras: point.num_leituras,
    }));
    console.log('✅ [InversorGraficoDia] Dados processados:', processed.length, 'pontos (apenas de hoje)');
    return processed;
  }, [data]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { max: 0, min: 0, avg: 0, energia: 0 };
    }

    // Filtrar apenas valores não-null para estatísticas
    const potenciasValidas = chartData
      .map(d => d.potencia)
      .filter((p): p is number => p !== null && p !== undefined);

    if (potenciasValidas.length === 0) {
      return { max: 0, min: 0, avg: 0, energia: 0 };
    }

    const max = Math.max(...potenciasValidas);
    const min = Math.min(...potenciasValidas);
    const avg = potenciasValidas.reduce((acc, val) => acc + val, 0) / potenciasValidas.length;

    // Energia total (soma da potência média de cada minuto * intervalo em horas)
    const energia = potenciasValidas.reduce((acc, val) => acc + val, 0) / 60; // kWh

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
      {/* Estatísticas - Design Minimalista */}
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

          {/* Linhas de min/max se disponíveis */}
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
        </ComposedChart>
      </ResponsiveContainer>

      <div className="text-center text-xs text-muted-foreground">
        Data: {data.data} | Agregação: 1 minuto
      </div>
    </div>
  );
}
