// src/features/supervisorio/components/urgencias-modal.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  User,
  Zap,
} from "lucide-react";

interface Urgencia {
  id: string;
  titulo: string;
  descricao: string;
  equipamento: string;
  nivelCriticidade: "CRITICA" | "MUITO_ALTA" | "ALTA";
  timestamp: string;
  tempoDecorrido: string;
  responsavelContato: string;
  telefoneEmergencia: string;
  acaoImediata: string;
  status: "ATIVA" | "EM_ATENDIMENTO" | "RESOLVIDA";
}

interface UrgenciasModalProps {
  open: boolean;
  onClose: () => void;
  urgencias: Urgencia[];
}

export function UrgenciasModal({
  open,
  onClose,
  urgencias,
}: UrgenciasModalProps) {
  const handleIniciarAtendimento = (urgenciaId: string) => {
    alert(`Iniciando atendimento da urgência ${urgenciaId}`);
  };

  const handleLigarEmergencia = (telefone: string) => {
    // Em um app real, isso poderia abrir o app de telefone
    alert(`Ligando para: ${telefone}`);
  };

  const handleMarcarResolvida = (urgenciaId: string) => {
    alert(`Urgência ${urgenciaId} marcada como resolvida!`);
  };

  const getCriticidadeColor = (nivel: string) => {
    switch (nivel) {
      case "CRITICA":
        return "text-red-600 bg-red-100 animate-pulse";
      case "MUITO_ALTA":
        return "text-red-600 bg-red-100";
      case "ALTA":
        return "text-orange-600 bg-orange-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ATIVA":
        return "text-red-600 bg-red-100";
      case "EM_ATENDIMENTO":
        return "text-yellow-600 bg-yellow-100";
      case "RESOLVIDA":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-500" />
            Situações de Urgência ({urgencias.length})
          </DialogTitle>
        </DialogHeader>

        {urgencias.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-600 mb-2">
              Nenhuma situação de urgência
            </h3>
            <p className="text-muted-foreground">
              Todos os sistemas estão operando dentro dos parâmetros normais.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {urgencias.map((urgencia) => (
              <Card
                key={urgencia.id}
                className={`border-l-4 ${
                  urgencia.nivelCriticidade === "CRITICA"
                    ? "border-l-red-500 shadow-lg"
                    : "border-l-orange-500"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={getCriticidadeColor(
                            urgencia.nivelCriticidade
                          )}
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {urgencia.nivelCriticidade.replace("_", " ")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={getStatusColor(urgencia.status)}
                        >
                          <Activity className="h-3 w-3 mr-1" />
                          {urgencia.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-lg text-red-700">
                        {urgencia.titulo}
                      </h3>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center text-sm text-muted-foreground mb-1">
                        <Clock className="h-4 w-4 mr-1" />
                        Início:{" "}
                        {new Date(urgencia.timestamp).toLocaleString("pt-BR")}
                      </div>
                      <div className="text-sm font-bold text-red-600">
                        Tempo decorrido: {urgencia.tempoDecorrido}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Equipamento e Descrição */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      Equipamento:{" "}
                      <span className="font-medium text-foreground">
                        {urgencia.equipamento}
                      </span>
                    </div>
                    <p className="text-muted-foreground mb-3">
                      {urgencia.descricao}
                    </p>

                    {/* Ação Imediata em destaque */}
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Zap className="h-5 w-5 text-red-600 mt-0.5" />
                        <div>
                          <div className="font-semibold text-red-800 mb-1">
                            AÇÃO IMEDIATA NECESSÁRIA:
                          </div>
                          <p className="text-red-700">
                            {urgencia.acaoImediata}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contatos de Emergência */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-800">
                          {urgencia.responsavelContato}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleLigarEmergencia(urgencia.telefoneEmergencia)
                        }
                        className="flex items-center gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        <Phone className="h-4 w-4" />
                        {urgencia.telefoneEmergencia}
                      </Button>
                    </div>
                  </div>

                  {/* Ações */}
                  <Separator />
                  <div className="flex flex-wrap gap-3">
                    {urgencia.status === "ATIVA" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleIniciarAtendimento(urgencia.id)}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
                      >
                        <Activity className="h-4 w-4" />
                        Iniciar Atendimento
                      </Button>
                    )}
                    {urgencia.status === "EM_ATENDIMENTO" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMarcarResolvida(urgencia.id)}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Marcar como Resolvida
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleLigarEmergencia(urgencia.telefoneEmergencia)
                      }
                      className="flex items-center gap-2 border-blue-300 text-blue-600"
                    >
                      <Phone className="h-4 w-4" />
                      Contato de Emergência
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Aviso importante no rodapé */}
        {urgencias.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">ATENÇÃO:</span>
            </div>
            <p className="text-red-700 text-sm">
              Situações de urgência requerem ação imediata. Contate o
              responsável técnico ou acione os protocolos de emergência
              estabelecidos.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center text-sm mt-4">
              <div>
                <div className="text-lg font-bold text-red-600">
                  {
                    urgencias.filter((u) => u.nivelCriticidade === "CRITICA")
                      .length
                  }
                </div>
                <div className="text-muted-foreground">Críticas</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-600">
                  {
                    urgencias.filter((u) => u.status === "EM_ATENDIMENTO")
                      .length
                  }
                </div>
                <div className="text-muted-foreground">Em Atendimento</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {urgencias.filter((u) => u.status === "RESOLVIDA").length}
                </div>
                <div className="text-muted-foreground">Resolvidas</div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
