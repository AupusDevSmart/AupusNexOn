import React from 'react';
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
import { Card } from '@/components/ui/card';
import { Loader2, Zap, TrendingUp, Activity } from 'lucide-react';
import { formatNumber } from '@/utils/formatNumber';
import { useGraficoDiaMultiplosInversores } from '@/hooks/useMultiplosInversoresGraficos';

interface MultiplosInversoresGraficoDiaProps {
  equipamentosIds: string[];
  data?: string;
  height?: number;
}

export function MultiplosInversoresGraficoDia({
  equipamentosIds,
  data,
  height = 400,
}: MultiplosInversoresGraficoDiaProps) {
  const { dados, loading, error } = useGraficoDiaMultiplosInversores(equipamentosIds, data);

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </Card>
    );
  }

  if (!dados || !dados.dados || dados.dados.length === 0) {
    return (
      <Card className="p-6 flex items-center justify-center" style={{ height }}>
        <div className="text-center text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum dado disponível para o período selecionado</p>
        </div>
      </Card>
    );
  }

  // Filtrar apenas dados de hoje (00:00 até agora)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicioDeHoje = hoje.getTime();

  const dadosDeHoje = dados.dados.filter(d => {
    const timestamp = new Date(d.hora).getTime();
    return timestamp >= inicioDeHoje;
  });

  // Calcular estatísticas
  const potenciaMaxima = dadosDeHoje.length > 0 ? Math.max(...dadosDeHoje.map(d => d.potencia_kw)) : 0;
  const potenciaMedia = dadosDeHoje.length > 0
    ? dadosDeHoje.reduce((acc, d) => acc + d.potencia_kw, 0) / dadosDeHoje.length
    : 0;
  const potenciaMinima = dadosDeHoje.length > 0
    ? Math.min(...dadosDeHoje.filter(d => d.potencia_kw > 0).map(d => d.potencia_kw))
    : 0;

  // Formatar dados para o gráfico
  const chartData = dadosDeHoje.map(d => ({
    hora: new Date(d.hora).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    potencia: Number(d.potencia_kw.toFixed(2)),
    potencia_min: Number(d.potencia_min.toFixed(2)),
    potencia_max: Number(d.potencia_max.toFixed(2)),
  }));

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header com estatísticas */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Potência Total - {dados.total_inversores} Inversor{dados.total_inversores > 1 ? 'es' : ''}
            </h3>
            <span className="text-sm text-muted-foreground">
              {new Date(dados.data).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Inversores incluídos */}
          <div className="flex flex-wrap gap-2">
            {dados.inversores.map(inversor => (
              <span
                key={inversor.id}
                className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
              >
                {inversor.nome}
              </span>
            ))}
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Máxima</p>
                <p className="text-lg font-semibold">{formatNumber(potenciaMaxima, 2)} kW</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média</p>
                <p className="text-lg font-semibold">{formatNumber(potenciaMedia, 2)} kW</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mínima</p>
                <p className="text-lg font-semibold">{formatNumber(potenciaMinima, 2)} kW</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="hora"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{
                value: 'Potência (kW)',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12 },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
              }}
              formatter={(value: number) => `${formatNumber(value, 2)} kW`}
            />
            <Legend />

            {/* Área de min/max */}
            <Line
              type="monotone"
              dataKey="potencia_min"
              stroke="#94a3b8"
              strokeWidth={0.5}
              dot={false}
              name="Mínima"
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="potencia_max"
              stroke="#94a3b8"
              strokeWidth={0.5}
              dot={false}
              name="Máxima"
              strokeDasharray="5 5"
            />

            {/* Linha principal */}
            <Line
              type="monotone"
              dataKey="potencia"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Potência Total"
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}