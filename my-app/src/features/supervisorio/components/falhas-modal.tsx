// src/features/supervisorio/components/falhas-modal.tsx

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
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  User,
  Wrench,
  XCircle,
} from "lucide-react";

interface Falha {
  id: string;
  equipamento: string;
  descricao: string;
  causaProvavel: string;
  status: "ATIVA" | "EM_REPARO" | "RESOLVIDA";
  timestamp: string;
  tempoInatividade: string;
  tecnicoResponsavel?: string;
  acaoCorretiva?: string;
  observacoes?: string;
}

interface FalhasModalProps {
  open: boolean;
  onClose: () => void;
  falhas: Falha[];
}

export function FalhasModal({ open, onClose, falhas }: FalhasModalProps) {
  const handleIniciarReparo = (falhaId: string) => {
    alert(`Iniciando reparo da falha ${falhaId}`);
  };

  const handleMarcarResolvida = (falhaId: string) => {
    alert(`Falha ${falhaId} marcada como resolvida!`);
  };

  const handleGerarOS = (falhaId: string) => {
    alert(`Gerando Ordem de Serviço para falha ${falhaId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ATIVA":
        return "text-red-600 bg-red-100";
      case "EM_REPARO":
        return "text-yellow-600 bg-yellow-100";
      case "RESOLVIDA":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ATIVA":
        return <XCircle className="h-4 w-4" />;
      case "EM_REPARO":
        return <Wrench className="h-4 w-4" />;
      case "RESOLVIDA":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Falhas do Sistema ({falhas.length})
          </DialogTitle>
        </DialogHeader>

        {falhas.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-600 mb-2">
              Nenhuma falha ativa
            </h3>
            <p className="text-muted-foreground">
              Todos os equipamentos estão funcionando corretamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {falhas.map((falha) => (
              <Card key={falha.id} className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={getStatusColor(falha.status)}
                      >
                        {getStatusIcon(falha.status)}
                        {falha.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-sm text-muted-foreground mb-1">
                        <Clock className="h-4 w-4 mr-1" />
                        Início:{" "}
                        {new Date(falha.timestamp).toLocaleString("pt-BR")}
                      </div>
                      <div className="text-sm font-medium text-red-600">
                        Inativo há: {falha.tempoInatividade}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Informações da Falha */}
                  <div>
                    <div className="font-semibold text-lg mb-1">
                      {falha.equipamento}
                    </div>
                    <p className="text-muted-foreground mb-2">
                      {falha.descricao}
                    </p>
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                        <div>
                          <div className="font-medium text-orange-800 text-sm mb-1">
                            Causa Provável:
                          </div>
                          <p className="text-orange-700 text-sm">
                            {falha.causaProvavel}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Técnico e Ações */}
                  {(falha.tecnicoResponsavel || falha.acaoCorretiva) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        {falha.tecnicoResponsavel && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Técnico:
                            </span>
                            <span className="font-medium">
                              {falha.tecnicoResponsavel}
                            </span>
                          </div>
                        )}
                        {falha.acaoCorretiva && (
                          <div>
                            <span className="text-muted-foreground text-sm">
                              Ação Corretiva:
                            </span>
                            <p className="text-sm mt-1 p-3 bg-blue-50 border border-blue-200 rounded">
                              {falha.acaoCorretiva}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Observações */}
                  {falha.observacoes && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-muted-foreground text-sm">
                          Observações:
                        </span>
                        <p className="text-sm mt-1 p-2 bg-muted rounded">
                          {falha.observacoes}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Ações */}
                  <Separator />
                  <div className="flex flex-wrap gap-3">
                    {falha.status === "ATIVA" && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleIniciarReparo(falha.id)}
                          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700"
                        >
                          <Wrench className="h-4 w-4" />
                          Iniciar Reparo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGerarOS(falha.id)}
                          className="flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Gerar OS
                        </Button>
                      </>
                    )}
                    {falha.status === "EM_REPARO" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMarcarResolvida(falha.id)}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Marcar como Resolvida
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Estatísticas no rodapé */}
        {falhas.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-lg font-bold text-red-600">
                  {falhas.filter((f) => f.status === "ATIVA").length}
                </div>
                <div className="text-muted-foreground">Ativas</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-600">
                  {falhas.filter((f) => f.status === "EM_REPARO").length}
                </div>
                <div className="text-muted-foreground">Em Reparo</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {falhas.filter((f) => f.status === "RESOLVIDA").length}
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
