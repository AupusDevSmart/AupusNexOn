// src/features/supervisorio/components/sinoptico-graficos.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DadosGrafico } from "@/types/dtos/sinoptico-ativo";
import { Activity, Zap } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SinopticoGraficosProps {
  dadosPotencia: DadosGrafico[];
  dadosTensao: DadosGrafico[];
}

export function SinopticoGraficos({
  dadosPotencia,
  dadosTensao,
}: SinopticoGraficosProps) {
  // Formatador customizado para o tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background p-3 border border-border rounded-lg shadow-lg">
          <p className="text-sm font-medium">{`Hora: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(2)} ${
                entry.name.includes("Potência") ? "MW" : "V"
              }`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Formatador para o eixo X (tempo)
  const formatarHora = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Gráfico de Potência x Tempo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Potência x Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosPotencia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatarHora}
                  interval="preserveStartEnd"
                />
                <YAxis
                  label={{
                    value: "Potência (MW)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="potencia"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Potência"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Tensão x Tempo (com faixas PRODIST) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Tensão x Tempo (Faixas PRODIST)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosTensao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatarHora}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[200, 240]}
                  label={{
                    value: "Tensão (V)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* Faixas PRODIST para tensão 220V */}
                <ReferenceLine
                  y={231}
                  stroke="#dc2626"
                  strokeDasharray="5 5"
                  label={{ value: "Máx (231V)", position: "topLeft" }}
                />
                <ReferenceLine
                  y={220}
                  stroke="#16a34a"
                  strokeDasharray="5 5"
                  label={{ value: "Nominal (220V)", position: "topLeft" }}
                />
                <ReferenceLine
                  y={209}
                  stroke="#dc2626"
                  strokeDasharray="5 5"
                  label={{ value: "Mín (209V)", position: "topLeft" }}
                />

                <Line
                  type="monotone"
                  dataKey="tensao"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Tensão"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda das faixas PRODIST */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500"></div>
              <span>Adequada (209V - 231V)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500"></div>
              <span>Precária (202V - 209V | 231V - 233V)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500"></div>
              <span>Crítica (&lt; 202V | &gt; 233V)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
