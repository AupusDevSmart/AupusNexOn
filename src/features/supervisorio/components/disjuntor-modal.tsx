// src/features/supervisorio/components/disjuntor-modal.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DadosDisjuntor } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Power,
  Shield,
  Zap,
} from "lucide-react";

interface DisjuntorModalProps {
  open: boolean;
  onClose: () => void;
  dados: DadosDisjuntor;
  nomeComponente: string;
}

export function DisjuntorModal({
  open,
  onClose,
  dados,
  nomeComponente,
}: DisjuntorModalProps) {
  const statusColor =
    dados.status === "FECHADO" ? "text-green-600" : "text-red-600";
  const statusBadgeVariant =
    dados.status === "FECHADO" ? "default" : "destructive";
  const molaColor =
    dados.estadoMola === "ARMADO" ? "text-green-600" : "text-orange-600";

  const handleOperacao = (acao: "abrir" | "fechar") => {
    // Aqui você implementaria a lógica de comando real
    alert(`Comando ${acao} enviado para ${nomeComponente}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Power className="h-5 w-5 text-blue-500" />
            {nomeComponente}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Status Principal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Status Operacional
                </span>
                <Badge
                  variant={statusBadgeVariant}
                  className={dados.status === "FECHADO" ? "bg-green-500" : ""}
                >
                  {dados.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${statusColor} mb-2`}>
                    {dados.status === "FECHADO" ? "●" : "○"}
                  </div>
                  <div className="text-sm text-muted-foreground">Contatos</div>
                  <div className="font-medium">{dados.status}</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${molaColor} mb-2`}>
                    <Shield className="h-6 w-6 mx-auto" />
                  </div>
                  <div className="text-sm text-muted-foreground">Mola</div>
                  <div className="font-medium">{dados.estadoMola}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    {dados.corrente.toFixed(0)}A
                  </div>
                  <div className="text-sm text-muted-foreground">Corrente</div>
                  <div className="font-medium">Atual</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Power className="h-4 w-4" />
                Controles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 justify-center">
                <Button
                  variant={
                    dados.status === "ABERTO" ? "outline" : "destructive"
                  }
                  onClick={() => handleOperacao("abrir")}
                  disabled={dados.status === "ABERTO"}
                  className="flex items-center gap-2"
                >
                  <Power className="h-4 w-4" />
                  Abrir
                </Button>
                <Button
                  variant={dados.status === "FECHADO" ? "outline" : "default"}
                  onClick={() => handleOperacao("fechar")}
                  disabled={
                    dados.status === "FECHADO" ||
                    dados.estadoMola === "DESARMADO"
                  }
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Power className="h-4 w-4" />
                  Fechar
                </Button>
              </div>
              {dados.estadoMola === "DESARMADO" && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Mola desarmada - Necessário armar antes de fechar
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proteções */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Sistema de Proteção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sobrecorrente (50/51):</span>
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Normal
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Diferencial (87):</span>
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Normal
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sobretensão (59):</span>
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Normal
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Subtensão (27):</span>
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Normal
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Frequência (81):</span>
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Normal
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Bloqueio:</span>
                    <Badge variant="outline" className="text-gray-600">
                      Inativo
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico e Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Última Operação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Data/Hora:
                    </span>
                    <span className="font-medium">
                      {new Date(dados.ultimaOperacao).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tipo:</span>
                    <span className="font-medium">Fechamento Manual</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Usuário:
                    </span>
                    <span className="font-medium">Sistema</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Estatísticas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total de Operações:
                    </span>
                    <span className="font-medium text-blue-600">
                      {dados.numeroOperacoes.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Operações este mês:
                    </span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Última manutenção:
                    </span>
                    <span className="font-medium">15/06/2024</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Medições Atuais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Medições Elétricas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {dados.corrente.toFixed(0)}A
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Corrente L1
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {(dados.corrente * 0.98).toFixed(0)}A
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Corrente L2
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {(dados.corrente * 1.02).toFixed(0)}A
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Corrente L3
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
