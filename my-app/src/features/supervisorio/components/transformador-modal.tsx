// src/features/supervisorio/components/transformador-modal.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { DadosTransformador } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Settings,
  Thermometer,
  TrendingUp,
  Zap,
} from "lucide-react";

interface TransformadorModalProps {
  open: boolean;
  onClose: () => void;
  dados: DadosTransformador;
  nomeComponente: string;
}

export function TransformadorModal({
  open,
  onClose,
  dados,
  nomeComponente,
}: TransformadorModalProps) {
  const carregamentoPercent = dados.carregamento;
  const temperaturaStatus =
    dados.temperatura > 80
      ? "ALTA"
      : dados.temperatura > 60
      ? "NORMAL"
      : "BAIXA";
  const temperaturaColor =
    dados.temperatura > 80
      ? "text-red-600"
      : dados.temperatura > 60
      ? "text-yellow-600"
      : "text-green-600";

  const eficiencia = (dados.potencias.ativa / dados.potencias.aparente) * 100;
  const fatorPotencia = dados.potencias.ativa / dados.potencias.aparente;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-500" />
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
                  <CheckCircle className="h-4 w-4 mr-1" />
                  NORMAL
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {carregamentoPercent.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Carregamento
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${temperaturaColor}`}>
                    {dados.temperatura}°C
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Temperatura
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {eficiencia.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Eficiência
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {fatorPotencia.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Fator de Potência
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carregamento e Temperatura */}
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
                      <span>Carregamento Atual</span>
                      <span>{carregamentoPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={carregamentoPercent} className="h-3" />
                    {carregamentoPercent > 90 && (
                      <div className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Alto carregamento
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Potência Nominal:</span>
                      <span className="font-medium">2500 kVA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Potência Atual:</span>
                      <span className="font-medium">
                        {(carregamentoPercent * 25).toFixed(0)} kVA
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4" />
                  Monitoramento Térmico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div
                      className={`text-3xl font-bold ${temperaturaColor} mb-1`}
                    >
                      {dados.temperatura}°C
                    </div>
                    <Badge variant="outline" className={temperaturaColor}>
                      {temperaturaStatus}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Limite Normal:</span>
                      <span className="text-green-600">≤ 60°C</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limite Alerta:</span>
                      <span className="text-yellow-600">60-80°C</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Limite Crítico:</span>
                      <span className="text-red-600">&gt; 80°C</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tensões e Correntes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Tensões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {(dados.tensoes.primario / 1000).toFixed(1)} kV
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Primário
                      </div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">
                        {dados.tensoes.secundario}V
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Secundário
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-1">
                      Relação de Transformação
                    </div>
                    <div className="text-lg font-bold text-purple-600">
                      {(
                        dados.tensoes.primario / dados.tensoes.secundario
                      ).toFixed(0)}
                      :1
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Correntes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {dados.correntes.primario.toFixed(1)}A
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Primário
                      </div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">
                        {dados.correntes.secundario.toFixed(0)}A
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Secundário
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Corrente Nominal Primário:</span>
                      <span className="font-medium">104.2A</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Corrente Nominal Secundário:</span>
                      <span className="font-medium">3789A</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Potências */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Potências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-600 mb-1">
                    {(dados.potencias.ativa / 1000).toFixed(1)} MW
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Potência Ativa
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={(dados.potencias.ativa / 2500000) * 100}
                      className="h-2"
                    />
                  </div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600 mb-1">
                    {(dados.potencias.reativa / 1000).toFixed(1)} MVAr
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Potência Reativa
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={(dados.potencias.reativa / 1000000) * 100}
                      className="h-2"
                    />
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-xl font-bold text-purple-600 mb-1">
                    {(dados.potencias.aparente / 1000).toFixed(1)} MVA
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Potência Aparente
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={(dados.potencias.aparente / 2500000) * 100}
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status dos Sistemas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Status dos Sistemas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Isolamento:</span>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Normal
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Comutador:</span>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Normal
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Proteção Gás:</span>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Normal
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Nível Óleo:</span>
                  <Badge variant="outline" className="text-green-600">
                    Normal
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Refrigeração:</span>
                  <Badge variant="outline" className="text-green-600">
                    Ativo
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Para-raios:</span>
                  <Badge variant="outline" className="text-green-600">
                    Normal
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
