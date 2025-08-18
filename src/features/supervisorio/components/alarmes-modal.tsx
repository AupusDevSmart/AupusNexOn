// src/features/supervisorio/components/alarmes-modal.tsx

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
  Bell,
  CheckCircle,
  Clock,
  Eye,
  User,
} from "lucide-react";

interface Alarme {
  id: string;
  equipamento: string;
  descricao: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  timestamp: string;
  status: "ATIVO" | "RECONHECIDO";
  responsavel?: string;
  observacoes?: string;
}

interface AlarmesModalProps {
  open: boolean;
  onClose: () => void;
  alarmes: Alarme[];
}

export function AlarmesModal({ open, onClose, alarmes }: AlarmesModalProps) {
  const handleReconhecer = (alarmeId: string) => {
    // Aqui implementaria a lógica de reconhecimento
    alert(`Alarme ${alarmeId} reconhecido!`);
  };

  const handleVerDetalhes = (alarmeId: string) => {
    // Aqui abriria uma tela de detalhes do alarme
    alert(`Abrindo detalhes do alarme ${alarmeId}`);
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "ALTA":
        return "text-red-600 bg-red-100";
      case "MEDIA":
        return "text-yellow-600 bg-yellow-100";
      case "BAIXA":
        return "text-blue-600 bg-blue-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getPrioridadeIcon = (prioridade: string) => {
    switch (prioridade) {
      case "ALTA":
        return <AlertTriangle className="h-4 w-4" />;
      case "MEDIA":
        return <Bell className="h-4 w-4" />;
      case "BAIXA":
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Alarmes do Sistema ({alarmes.length})
          </DialogTitle>
        </DialogHeader>

        {alarmes.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-600 mb-2">
              Nenhum alarme ativo
            </h3>
            <p className="text-muted-foreground">
              Todos os sistemas estão operando normalmente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alarmes.map((alarme) => (
              <Card key={alarme.id} className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={getPrioridadeColor(alarme.prioridade)}
                      >
                        {getPrioridadeIcon(alarme.prioridade)}
                        {alarme.prioridade}
                      </Badge>
                      <Badge
                        variant={
                          alarme.status === "ATIVO" ? "destructive" : "outline"
                        }
                      >
                        {alarme.status}
                      </Badge>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {new Date(alarme.timestamp).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Informações do Alarme */}
                  <div>
                    <div className="font-semibold text-lg mb-1">
                      {alarme.equipamento}
                    </div>
                    <p className="text-muted-foreground">{alarme.descricao}</p>
                  </div>

                  {/* Responsável e Observações */}
                  {(alarme.responsavel || alarme.observacoes) && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {alarme.responsavel && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Responsável:
                            </span>
                            <span className="font-medium">
                              {alarme.responsavel}
                            </span>
                          </div>
                        )}
                        {alarme.observacoes && (
                          <div className="col-span-full">
                            <span className="text-muted-foreground text-sm">
                              Observações:
                            </span>
                            <p className="text-sm mt-1 p-2 bg-muted rounded">
                              {alarme.observacoes}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Ações */}
                  <Separator />
                  <div className="flex gap-3">
                    {alarme.status === "ATIVO" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReconhecer(alarme.id)}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Reconhecer
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerDetalhes(alarme.id)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Resumo no rodapé */}
        {alarmes.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-lg font-bold text-red-600">
                  {alarmes.filter((a) => a.prioridade === "ALTA").length}
                </div>
                <div className="text-muted-foreground">Alta Prioridade</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-600">
                  {alarmes.filter((a) => a.prioridade === "MEDIA").length}
                </div>
                <div className="text-muted-foreground">Média Prioridade</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">
                  {alarmes.filter((a) => a.prioridade === "BAIXA").length}
                </div>
                <div className="text-muted-foreground">Baixa Prioridade</div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
