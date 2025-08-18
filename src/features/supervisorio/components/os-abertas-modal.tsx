// src/features/supervisorio/components/os-abertas-modal.tsx

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
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  FileText,
  User,
} from "lucide-react";

interface OrdemServico {
  id: string;
  numero: string;
  titulo: string;
  descricao: string;
  equipamento: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  status: "ABERTA" | "EM_ANDAMENTO" | "AGUARDANDO_PECA" | "PAUSADA";
  dataAbertura: string;
  prazoExecucao: string;
  tecnicoResponsavel?: string;
  tempoEstimado: string;
  observacoes?: string;
  atrasada: boolean;
}

interface OSAbertasModalProps {
  open: boolean;
  onClose: () => void;
  ordens: OrdemServico[];
}

export function OSAbertasModal({ open, onClose, ordens }: OSAbertasModalProps) {
  const handleIniciarOS = (osId: string) => {
    alert(`Iniciando execução da OS ${osId}`);
  };

  const handleEditarOS = (osId: string) => {
    alert(`Abrindo edição da OS ${osId}`);
  };

  const handleVerDetalhes = (osId: string) => {
    alert(`Abrindo detalhes completos da OS ${osId}`);
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "ALTA":
        return "text-red-600 bg-red-100";
      case "MEDIA":
        return "text-yellow-600 bg-yellow-100";
      case "BAIXA":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ABERTA":
        return "text-blue-600 bg-blue-100";
      case "EM_ANDAMENTO":
        return "text-yellow-600 bg-yellow-100";
      case "AGUARDANDO_PECA":
        return "text-orange-600 bg-orange-100";
      case "PAUSADA":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const calcularDiasRestantes = (prazo: string) => {
    const hoje = new Date();
    const dataPrazo = new Date(prazo);
    const diffTime = dataPrazo.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Ordens de Serviço Abertas ({ordens.length})
          </DialogTitle>
        </DialogHeader>

        {ordens.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-600 mb-2">
              Nenhuma OS em aberto
            </h3>
            <p className="text-muted-foreground">
              Todas as ordens de serviço foram finalizadas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ordens.map((os) => {
              const diasRestantes = calcularDiasRestantes(os.prazoExecucao);
              const isAtrasada = diasRestantes < 0;
              const isUrgente = diasRestantes <= 1;

              return (
                <Card
                  key={os.id}
                  className={`border-l-4 ${
                    isAtrasada
                      ? "border-l-red-500"
                      : isUrgente
                      ? "border-l-yellow-500"
                      : "border-l-blue-500"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {os.numero}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getPrioridadeColor(os.prioridade)}
                          >
                            {os.prioridade}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getStatusColor(os.status)}
                          >
                            {os.status.replace("_", " ")}
                          </Badge>
                          {isAtrasada && (
                            <Badge
                              variant="destructive"
                              className="animate-pulse"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              ATRASADA
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg">{os.titulo}</h3>
                      </div>

                      <div className="text-right text-sm">
                        <div className="flex items-center text-muted-foreground mb-1">
                          <Calendar className="h-4 w-4 mr-1" />
                          Prazo:{" "}
                          {new Date(os.prazoExecucao).toLocaleDateString(
                            "pt-BR"
                          )}
                        </div>
                        <div
                          className={`font-medium ${
                            isAtrasada
                              ? "text-red-600"
                              : isUrgente
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {isAtrasada
                            ? `${Math.abs(diasRestantes)} dias em atraso`
                            : diasRestantes === 0
                            ? "Vence hoje!"
                            : `${diasRestantes} dias restantes`}
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
                          {os.equipamento}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{os.descricao}</p>
                    </div>

                    {/* Informações da OS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Abertura:</span>
                        <span className="font-medium">
                          {new Date(os.dataAbertura).toLocaleDateString(
                            "pt-BR"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Estimativa:
                        </span>
                        <span className="font-medium">{os.tempoEstimado}</span>
                      </div>
                      {os.tecnicoResponsavel && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Técnico:
                          </span>
                          <span className="font-medium">
                            {os.tecnicoResponsavel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Observações */}
                    {os.observacoes && (
                      <>
                        <Separator />
                        <div>
                          <span className="text-muted-foreground text-sm">
                            Observações:
                          </span>
                          <p className="text-sm mt-1 p-2 bg-muted rounded">
                            {os.observacoes}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Ações */}
                    <Separator />
                    <div className="flex flex-wrap gap-3">
                      {os.status === "ABERTA" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleIniciarOS(os.id)}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Iniciar Execução
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditarOS(os.id)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerDetalhes(os.id)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Resumo no rodapé */}
        {ordens.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-4 gap-4 text-center text-sm">
              <div>
                <div className="text-lg font-bold text-red-600">
                  {
                    ordens.filter(
                      (os) => calcularDiasRestantes(os.prazoExecucao) < 0
                    ).length
                  }
                </div>
                <div className="text-muted-foreground">Atrasadas</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-600">
                  {
                    ordens.filter(
                      (os) =>
                        calcularDiasRestantes(os.prazoExecucao) <= 1 &&
                        calcularDiasRestantes(os.prazoExecucao) >= 0
                    ).length
                  }
                </div>
                <div className="text-muted-foreground">Urgentes</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">
                  {ordens.filter((os) => os.status === "EM_ANDAMENTO").length}
                </div>
                <div className="text-muted-foreground">Em Andamento</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {ordens.filter((os) => os.prioridade === "ALTA").length}
                </div>
                <div className="text-muted-foreground">Alta Prioridade</div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
