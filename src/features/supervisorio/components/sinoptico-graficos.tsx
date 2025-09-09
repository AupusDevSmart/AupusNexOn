// src/features/supervisorio/components/sinoptico-graficos.tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DadosGrafico } from "@/types/dtos/sinoptico-ativo";
import { Activity, TrendingUp, Zap } from "lucide-react";
import {
  CartesianGrid,
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
            {`${entry.value.toFixed(2)}`}
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
}: SinopticoGraficosProps) {
  const dadosFormatadosPotencia = formatarDadosGrafico(dadosPotencia);
  const dadosFormatadosTensao = formatarDadosGrafico(dadosTensao);

  return (
    <div className="space-y-4 w-full">
      {/* Gráfico de Potência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Potência Ativa
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
                  value: "MW",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="potencia"
                stroke="#eab308"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* SEÇÃO REMOVIDA: Indicadores resumo de Potência */}
          {/* 
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">
                {dadosPotencia[dadosPotencia.length - 1]?.potencia.toFixed(2) ||
                  "0.00"}{" "}
                MW
              </div>
              <div className="text-sm text-muted-foreground">Atual</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {Math.max(...dadosPotencia.map((d) => d.potencia)).toFixed(2)}{" "}
                MW
              </div>
              <div className="text-sm text-muted-foreground">Máximo</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {(
                  dadosPotencia.reduce((acc, d) => acc + d.potencia, 0) /
                  dadosPotencia.length
                ).toFixed(2)}{" "}
                MW
              </div>
              <div className="text-sm text-muted-foreground">Médio</div>
            </div>
          </div>
          */}
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

          {/* SEÇÃO REMOVIDA: Indicadores resumo de Tensão */}
          {/*
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {dadosTensao[dadosTensao.length - 1]?.tensao.toFixed(1) ||
                  "0.0"}{" "}
                V
              </div>
              <div className="text-sm text-muted-foreground">Atual</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {Math.max(...dadosTensao.map((d) => d.tensao)).toFixed(1)} V
              </div>
              <div className="text-sm text-muted-foreground">Máximo</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">
                {Math.min(...dadosTensao.map((d) => d.tensao)).toFixed(1)} V
              </div>
              <div className="text-sm text-muted-foreground">Mínimo</div>
            </div>
          </div>
          */}
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

          {/* SEÇÃO REMOVIDA: Indicadores resumo de Corrente */}
          {/* Nota: O gráfico de corrente não tinha indicadores no código original */}
        </CardContent>
      </Card>
    </div>
  );
}
