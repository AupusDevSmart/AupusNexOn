// src/features/supervisorio/components/medidor-modal.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DadosMedidor } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  BarChart3,
  Gauge,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

interface MedidorModalProps {
  open: boolean;
  onClose: () => void;
  dados: DadosMedidor;
  nomeComponente: string;
}

export function MedidorModal({
  open,
  onClose,
  dados,
  nomeComponente,
}: MedidorModalProps) {
  const formatarEnergia = (valor: number) => {
    if (valor >= 1000) {
      return `${(valor / 1000).toFixed(2)} MWh`;
    }
    return `${valor.toFixed(2)} kWh`;
  };

  const formatarDemanda = (valor: number) => {
    if (valor >= 1000) {
      return `${(valor / 1000).toFixed(2)} MW`;
    }
    return `${valor.toFixed(2)} kW`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            {nomeComponente} - Medidor de Energia
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seção UFER e Demanda */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gauge className="h-5 w-5 text-green-500" />
                Demanda e UFER
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-700">
                      UFER
                    </span>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-xl font-bold text-green-800">
                    {dados.ufer.toFixed(3)}
                  </div>
                  <div className="text-xs text-green-600">
                    Fator de Energia Reativa
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700">
                      Demanda
                    </span>
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-xl font-bold text-blue-800">
                    {formatarDemanda(dados.demanda)}
                  </div>
                  <div className="text-xs text-blue-600">
                    Demanda Ativa Atual
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção Energia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-purple-500" />
                Energia Acumulada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-red-700">
                      Consumida
                    </span>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="text-xl font-bold text-red-800">
                    {formatarEnergia(dados.energiaConsumida)}
                  </div>
                  <div className="text-xs text-red-600">
                    Energia Consumida Total
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-700">
                      Injetada
                    </span>
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-bold text-emerald-800">
                    {formatarEnergia(dados.energiaInjetada)}
                  </div>
                  <div className="text-xs text-emerald-600">
                    Energia Injetada Total
                  </div>
                </div>
              </div>

              {/* Saldo Energético */}
              <div className="p-3 bg-muted rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Saldo Energético</span>
                  <Badge
                    variant={
                      dados.energiaInjetada > dados.energiaConsumida
                        ? "default"
                        : "secondary"
                    }
                  >
                    {dados.energiaInjetada > dados.energiaConsumida
                      ? "Positivo"
                      : "Negativo"}
                  </Badge>
                </div>
                <div className="text-lg font-bold">
                  {formatarEnergia(
                    Math.abs(dados.energiaInjetada - dados.energiaConsumida)
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tensões por Fase */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-yellow-500" />
                Tensões por Fase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(dados.tensaoFases).map(([fase, tensao]) => (
                  <div
                    key={fase}
                    className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                  >
                    <div className="text-xs font-medium text-yellow-700 mb-1">
                      Fase {fase.toUpperCase()}
                    </div>
                    <div className="text-lg font-bold text-yellow-800">
                      {tensao.toFixed(1)}
                    </div>
                    <div className="text-xs text-yellow-600">V</div>
                  </div>
                ))}
              </div>

              {/* Desequilíbrio de Tensão */}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-2">
                  Desequilíbrio de Tensão
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Máx:{" "}
                    {Math.max(...Object.values(dados.tensaoFases)).toFixed(1)}V
                    | Mín:{" "}
                    {Math.min(...Object.values(dados.tensaoFases)).toFixed(1)}V
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      Math.abs(
                        Math.max(...Object.values(dados.tensaoFases)) -
                          Math.min(...Object.values(dados.tensaoFases))
                      ) <= 2
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {Math.abs(
                      Math.max(...Object.values(dados.tensaoFases)) -
                        Math.min(...Object.values(dados.tensaoFases))
                    ).toFixed(1)}
                    V
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Correntes por Fase */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-orange-500" />
                Correntes por Fase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(dados.correnteFases).map(([fase, corrente]) => (
                  <div
                    key={fase}
                    className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200"
                  >
                    <div className="text-xs font-medium text-orange-700 mb-1">
                      Fase {fase.toUpperCase()}
                    </div>
                    <div className="text-lg font-bold text-orange-800">
                      {corrente.toFixed(1)}
                    </div>
                    <div className="text-xs text-orange-600">A</div>
                  </div>
                ))}
              </div>

              {/* Corrente Total */}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Corrente Total</span>
                  <div className="text-lg font-bold">
                    {Object.values(dados.correnteFases)
                      .reduce((a, b) => a + b, 0)
                      .toFixed(1)}{" "}
                    A
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
