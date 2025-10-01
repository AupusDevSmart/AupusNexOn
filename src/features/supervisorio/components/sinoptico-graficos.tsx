// src/features/supervisorio/components/sinoptico-graficos.tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DadosGrafico } from "@/types/dtos/sinoptico-ativo";
import { Activity, TrendingUp, Zap } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SinopticoGraficosProps {
  dadosPotencia: DadosGrafico[];
  dadosTensao: DadosGrafico[];
  valorContratado?: number;
  percentualAdicional?: number;
}

// Função para formatar dados para o gráfico
const formatarDadosGrafico = (dados: DadosGrafico[]) => {
  return dados.map((item) => ({
    ...item,
    hora: new Date(item.timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
};

// Função para adicionar linhas de referência (valor contratado e adicional)
const adicionarLinhasReferencia = (
  dados: DadosGrafico[],
  valorContratado: number,
  percentualAdicional: number
) => {
  const valorAdicional = valorContratado * (1 + percentualAdicional / 100);
  
  return dados.map((item) => ({
    ...item,
    hora: new Date(item.timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    valorContratado: valorContratado,
    valorAdicional: valorAdicional,
  }));
};

// Componente customizado para o Tooltip
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium">{`Hora: ${label}`}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value.toFixed(2)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function SinopticoGraficos({
  dadosPotencia,
  dadosTensao,
  valorContratado = 2500,
  percentualAdicional = 5,
}: SinopticoGraficosProps) {
  const dadosFormatadosPotencia = adicionarLinhasReferencia(
    dadosPotencia,
    valorContratado,
    percentualAdicional
  );
  const dadosFormatadosTensao = formatarDadosGrafico(dadosTensao);

  return (
    <div className="space-y-4 w-full">
      {/* Gráfico de Demanda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Demanda
            <Badge variant="outline" className="ml-auto">
              Últimas 24h
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dadosFormatadosPotencia}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="hora" fontSize={12} interval="preserveStartEnd" />
              <YAxis
                fontSize={12}
                label={{
                  value: "kW",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
              />
              
              {/* Linha 1: Demanda Real (Potência) */}
              <Line
                type="monotone"
                dataKey="potencia"
                name="Demanda Real"
                stroke="#eab308"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              
              {/* Linha 2: Valor Contratado */}
              <Line
                type="monotone"
                dataKey="valorContratado"
                name="Valor Contratado"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
              
              {/* Linha 3: Valor Contratado + Adicional */}
              <Line
                type="monotone"
                dataKey="valorAdicional"
                name={`Contratado + ${percentualAdicional}%`}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Tensão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Tensão
            <Badge variant="outline" className="ml-auto">
              Últimas 24h
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dadosFormatadosTensao}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="hora" fontSize={12} interval="preserveStartEnd" />
              <YAxis
                fontSize={12}
                domain={["dataMin - 5", "dataMax + 5"]}
                label={{
                  value: "V",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="tensao"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Corrente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Corrente
            <Badge variant="outline" className="ml-auto">
              Últimas 24h
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dadosFormatadosTensao}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="hora" fontSize={12} interval="preserveStartEnd" />
              <YAxis
                fontSize={12}
                label={{
                  value: "A",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="corrente"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}