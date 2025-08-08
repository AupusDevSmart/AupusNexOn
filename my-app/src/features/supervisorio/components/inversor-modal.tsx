// src/features/supervisorio/components/inversor-modal.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DadosInversor } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  BarChart3,
  Sun,
  Thermometer,
  TrendingUp,
  Zap,
} from "lucide-react";

interface InversorModalProps {
  open: boolean;
  onClose: () => void;
  dados: DadosInversor;
  nomeComponente: string;
}

export function InversorModal({
  open,
  onClose,
  dados,
  nomeComponente,
}: InversorModalProps) {
  const eficienciaPercent = dados.eficiencia * 100;
  const carregamentoPercent = (dados.potenciaAC / 1000) * 100; // Assumindo 1MW nominal

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-yellow-500" />
            {nomeComponente}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Status Geral */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Status Operacional
                </span>
                <Badge variant="default" className="bg-green-500">
                  NORMAL
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dados.potenciaAC.toFixed(1)} kW
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Potência AC
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dados.potenciaDC.toFixed(1)} kW
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Potência DC
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {eficienciaPercent.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Eficiência
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {dados.temperatura}°C
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Temperatura
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carregamento e Eficiência */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Carregamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Potência Atual</span>
                      <span>{carregamentoPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={carregamentoPercent} className="h-3" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Eficiência</span>
                      <span>{eficienciaPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={eficienciaPercent} className="h-3" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4" />
                  Condições
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Temperatura Interna:</span>
                    <span className="font-medium">{dados.temperatura}°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Status Ventilação:</span>
                    <Badge variant="outline" className="text-green-600">
                      Normal
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Proteção DC:</span>
                    <Badge variant="outline" className="text-green-600">
                      OK
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Isolamento:</span>
                    <Badge variant="outline" className="text-green-600">
                      Normal
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tensões MPPT */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Strings MPPT
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dados.tensoesMPPT.map((tensao, index) => (
                  <div
                    key={index}
                    className="text-center p-3 bg-muted rounded-lg"
                  >
                    <div className="text-lg font-bold text-blue-600">
                      {tensao.toFixed(1)}V
                    </div>
                    <div className="text-xs text-muted-foreground">
                      MPPT {index + 1}
                    </div>
                    <div className="text-sm font-medium text-green-600 mt-1">
                      {dados.correntePorString[index]?.toFixed(1) || "0.0"}A
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Curva de Geração */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Curva de Geração Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 flex items-end justify-between gap-1 bg-muted rounded p-4">
                {dados.curvaGeracao.slice(-12).map((ponto, index) => {
                  const altura =
                    (ponto.potencia /
                      Math.max(...dados.curvaGeracao.map((p) => p.potencia))) *
                    100;
                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className="bg-yellow-500 rounded-t min-w-[8px]"
                        style={{ height: `${altura}%` }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {ponto.hora.slice(0, 2)}h
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-yellow-600">
                    {dados.curvaGeracao
                      .reduce((acc, p) => acc + p.potencia, 0)
                      .toFixed(1)}{" "}
                    kWh
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Energia Hoje
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {Math.max(
                      ...dados.curvaGeracao.map((p) => p.potencia)
                    ).toFixed(1)}{" "}
                    kW
                  </div>
                  <div className="text-sm text-muted-foreground">Pico Hoje</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">
                    {dados.curvaGeracao[
                      dados.curvaGeracao.length - 1
                    ]?.potencia.toFixed(1) || "0.0"}{" "}
                    kW
                  </div>
                  <div className="text-sm text-muted-foreground">Atual</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
