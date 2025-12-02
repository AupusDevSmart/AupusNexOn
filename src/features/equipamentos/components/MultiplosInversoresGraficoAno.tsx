import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Loader2, Zap, Battery, Calendar, TrendingUp } from 'lucide-react';
import { formatNumber } from '@/utils/formatNumber';
import { formatEnergy } from '@/utils/formatEnergy';
import { useGraficoAnoMultiplosInversores } from '@/hooks/useMultiplosInversoresGraficos';

interface MultiplosInversoresGraficoAnoProps {
  equipamentosIds: string[];
  ano?: string;
  height?: number;
}

export function MultiplosInversoresGraficoAno({
  equipamentosIds,
  ano,
  height = 400,
}: MultiplosInversoresGraficoAnoProps) {
  const { dados, loading, error } = useGraficoAnoMultiplosInversores(equipamentosIds, ano);

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
          <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum dado disponível para o período selecionado</p>
        </div>
      </Card>
    );
  }

  // Calcular estatísticas
  const energiaMaxima = Math.max(...dados.dados.map(d => d.energia_kwh));
  const energiaMedia = dados.energia_total_kwh / dados.dados.length;
  const energiaMinima = Math.min(...dados.dados.filter(d => d.energia_kwh > 0).map(d => d.energia_kwh));

  // Formatar dados para o gráfico
  const chartData = dados.dados.map(d => ({
    mes: d.mes_nome.substring(0, 3), // Abreviar nome do mês
    mesCompleto: d.mes_nome,
    energia: Number(d.energia_kwh.toFixed(2)),
    potenciaMedia: Number(d.potencia_media_kw.toFixed(2)),
  }));

  // Calcular a média mensal esperada (energia total dividida por 12 meses)
  const mediaEsperada = dados.energia_total_kwh / 12;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header com estatísticas */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Energia Anual - {dados.total_inversores} Inversor{dados.total_inversores > 1 ? 'es' : ''}
            </h3>
            <span className="text-sm text-muted-foreground">
              Ano {dados.ano}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Battery className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Anual</p>
                <p className="text-lg font-semibold">{formatEnergy(dados.energia_total_kwh)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média/Mês</p>
                <p className="text-lg font-semibold">{formatEnergy(energiaMedia)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Melhor Mês</p>
                <p className="text-lg font-semibold">{formatEnergy(energiaMaxima)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meses Ativos</p>
                <p className="text-lg font-semibold">{dados.total_meses} de 12</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 12 }}
              label={{
                value: 'Mês',
                position: 'insideBottom',
                offset: -5,
                style: { fontSize: 12 },
              }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{
                value: 'Energia (kWh)',
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
              formatter={(value: number, name: string) => {
                if (name === 'Energia Total') {
                  return `${formatNumber(value, 2)} kWh`;
                }
                return `${formatNumber(value, 2)} kW`;
              }}
              labelFormatter={(label: string, payload: any[]) => {
                if (payload && payload.length > 0) {
                  return payload[0].payload.mesCompleto;
                }
                return label;
              }}
            />
            <Legend />

            <Bar
              dataKey="energia"
              fill="#10b981"
              name="Energia Total"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Linha de tendência */}
        {dados.total_meses >= 3 && (
          <div className="text-sm text-muted-foreground text-center">
            Média esperada mensal: {formatEnergy(mediaEsperada)}
          </div>
        )}
      </div>
    </Card>
  );
}