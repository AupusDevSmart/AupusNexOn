// src/features/supervisorio/components/pivo/pivo-modal.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Droplets,
  Activity,
  Clock,
  Settings,
  Power,
  PlayCircle,
  StopCircle,
  RotateCw,
  Gauge,
} from "lucide-react";
import { useState } from "react";

export interface DadosPivo {
  status: "NORMAL" | "ALARME" | "FALHA" | "DESLIGADO";
  operando: boolean;
  velocidadeRotacao: number; // RPM
  pressaoAgua: number; // bar
  vazaoAgua: number; // m³/h
  areaIrrigada: number; // hectares
  tempoOperacao: string;
  setorAtual: number; // graus (0-360)
  umidadeSolo?: number; // %
  modoOperacao: "AUTOMATICO" | "MANUAL";
  ultimaManutencao?: string;
}

interface PivoModalProps {
  open: boolean;
  onClose: () => void;
  dados: DadosPivo;
  nomeComponente: string;
  // Funções de controle (serão implementadas futuramente)
  onLigar?: () => void;
  onDesligar?: () => void;
  onIniciarIrrigacao?: () => void;
  onPararIrrigacao?: () => void;
  onAlterarVelocidade?: (velocidade: number) => void;
  onAlterarModo?: (modo: "AUTOMATICO" | "MANUAL") => void;
}

export function PivoModal({
  open,
  onClose,
  dados,
  nomeComponente,
  onLigar,
  onDesligar,
  onIniciarIrrigacao,
  onPararIrrigacao,
  onAlterarVelocidade,
  onAlterarModo,
}: PivoModalProps) {
  const [modoLocal, setModoLocal] = useState(dados.modoOperacao);

  const getStatusBadge = (status: string) => {
    const badges = {
      NORMAL: <Badge className="bg-green-500">Em Operação</Badge>,
      ALARME: <Badge className="bg-yellow-500">Alerta</Badge>,
      FALHA: <Badge className="bg-red-500">Falha</Badge>,
      DESLIGADO: <Badge className="bg-gray-500">Desligado</Badge>,
    };
    return badges[status as keyof typeof badges] || badges.DESLIGADO;
  };

  const handleToggleModo = () => {
    const novoModo = modoLocal === "AUTOMATICO" ? "MANUAL" : "AUTOMATICO";
    setModoLocal(novoModo);
    onAlterarModo?.(novoModo);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-cyan-500" />
            {nomeComponente}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status e Controles Principais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Power className="h-4 w-4" />
                Status e Controle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Status Atual:</span>
                {getStatusBadge(dados.status)}
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium">Irrigando:</span>
                <Badge variant={dados.operando ? "default" : "secondary"}>
                  {dados.operando ? "SIM" : "NÃO"}
                </Badge>
              </div>

              <Separator />

              {/* Controles */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={dados.status === "DESLIGADO" ? "default" : "outline"}
                  className="w-full"
                  onClick={onLigar}
                  disabled={dados.status !== "DESLIGADO"}
                >
                  <Power className="h-4 w-4 mr-2" />
                  Ligar Pivô
                </Button>

                <Button
                  variant={dados.status !== "DESLIGADO" ? "destructive" : "outline"}
                  className="w-full"
                  onClick={onDesligar}
                  disabled={dados.status === "DESLIGADO"}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Desligar Pivô
                </Button>

                <Button
                  variant={!dados.operando ? "default" : "outline"}
                  className="w-full"
                  onClick={onIniciarIrrigacao}
                  disabled={dados.operando || dados.status === "DESLIGADO"}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Iniciar Irrigação
                </Button>

                <Button
                  variant={dados.operando ? "default" : "outline"}
                  className="w-full"
                  onClick={onPararIrrigacao}
                  disabled={!dados.operando}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Parar Irrigação
                </Button>
              </div>

              {/* Modo de Operação */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <Label htmlFor="modo-operacao">Modo Automático</Label>
                </div>
                <Switch
                  id="modo-operacao"
                  checked={modoLocal === "AUTOMATICO"}
                  onCheckedChange={handleToggleModo}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dados Operacionais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Parâmetros Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Velocidade de Rotação */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <RotateCw className="h-4 w-4 text-cyan-500" />
                    <span className="text-sm font-medium">Velocidade</span>
                  </div>
                  <p className="text-2xl font-bold">{dados.velocidadeRotacao}</p>
                  <p className="text-xs text-muted-foreground">RPM</p>
                </div>

                {/* Pressão da Água */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Pressão</span>
                  </div>
                  <p className="text-2xl font-bold">{dados.pressaoAgua}</p>
                  <p className="text-xs text-muted-foreground">bar</p>
                </div>

                {/* Vazão */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="h-4 w-4 text-cyan-500" />
                    <span className="text-sm font-medium">Vazão</span>
                  </div>
                  <p className="text-2xl font-bold">{dados.vazaoAgua}</p>
                  <p className="text-xs text-muted-foreground">m³/h</p>
                </div>

                {/* Área Irrigada */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Área</span>
                  </div>
                  <p className="text-2xl font-bold">{dados.areaIrrigada}</p>
                  <p className="text-xs text-muted-foreground">hectares</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações Adicionais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Informações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-sm text-muted-foreground">Tempo de Operação:</span>
                  <span className="text-sm font-medium">{dados.tempoOperacao}</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2">
                  <span className="text-sm text-muted-foreground">Setor Atual:</span>
                  <span className="text-sm font-medium">{dados.setorAtual}°</span>
                </div>
                {dados.umidadeSolo !== undefined && (
                  <>
                    <Separator />
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-muted-foreground">Umidade do Solo:</span>
                      <span className="text-sm font-medium">{dados.umidadeSolo}%</span>
                    </div>
                  </>
                )}
                {dados.ultimaManutencao && (
                  <>
                    <Separator />
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-muted-foreground">Última Manutenção:</span>
                      <span className="text-sm font-medium">{dados.ultimaManutencao}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação Secundários */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              <Clock className="h-4 w-4 mr-2" />
              Histórico
            </Button>
            <Button variant="outline" className="flex-1">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
            <Button variant="outline" className="flex-1">
              <Activity className="h-4 w-4 mr-2" />
              Diagnóstico
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}