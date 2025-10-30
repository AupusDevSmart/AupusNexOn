// src/features/supervisorio/components/evento-detalhes-modal.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { LogEvento } from "@/types/dtos/logs-eventos";
import {
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  MapPin,
  Settings,
  User,
} from "lucide-react";
import { formatarDataHoraBR } from "@/lib/utils/date-formatters";

interface EventoDetalhesModalProps {
  evento: LogEvento | null;
  open: boolean;
  onClose: () => void;
  onAssociarOS: (evento: LogEvento) => void;
  onMarcarReconhecido: (evento: LogEvento) => void;
}

export function EventoDetalhesModal({
  evento,
  open,
  onClose,
  onAssociarOS,
  onMarcarReconhecido,
}: EventoDetalhesModalProps) {
  if (!evento) return null;

  const getSeveridadeColor = (severidade: string) => {
    switch (severidade) {
      case "CRITICA":
        return "bg-red-100 text-red-800";
      case "ALTA":
        return "bg-orange-100 text-orange-800";
      case "MEDIA":
        return "bg-yellow-100 text-yellow-800";
      case "BAIXA":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTipoEventoColor = (tipo: string) => {
    switch (tipo) {
      case "TRIP":
        return "bg-red-500 text-white";
      case "URGENCIA":
        return "bg-orange-500 text-white";
      case "ALARME":
        return "bg-yellow-500 text-white";
      case "MANUTENCAO":
        return "bg-blue-500 text-white";
      case "INFORMATIVO":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Detalhes do Evento - {evento.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cabeçalho do Evento */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <h3 className="font-semibold text-lg">{evento.ativo}</h3>
              <p className="text-muted-foreground">{evento.mensagem}</p>
            </div>
            <div className="flex gap-2">
              <Badge className={getTipoEventoColor(evento.tipoEvento)}>
                {evento.tipoEvento}
              </Badge>
              <Badge
                variant="outline"
                className={getSeveridadeColor(evento.severidade)}
              >
                {evento.severidade}
              </Badge>
            </div>
          </div>

          {/* Informações Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">DATA/HORA</p>
                  <p className="text-sm text-muted-foreground">
                    {formatarDataHoraBR(evento.dataHora)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Usuário</p>
                  <p className="text-sm text-muted-foreground">
                    {evento.usuario}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {evento.localizacao && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Localização</p>
                    <p className="text-sm text-muted-foreground">
                      {evento.localizacao}
                    </p>
                  </div>
                </div>
              )}

              {evento.equipamento && (
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Equipamento</p>
                    <p className="text-sm text-muted-foreground">
                      {evento.equipamento}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Status e OS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Status do Evento</span>
              </div>
              {evento.reconhecido ? (
                <Badge
                  variant="outline"
                  className="bg-green-100 text-green-800"
                >
                  Reconhecido
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-yellow-100 text-yellow-800"
                >
                  Pendente
                </Badge>
              )}
            </div>

            {evento.osAssociada && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    Ordem de Serviço Associada
                  </p>
                  <Badge
                    variant="outline"
                    className="bg-blue-100 text-blue-800"
                  >
                    OS: {evento.osAssociada}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Informações de Auditoria */}
          {(evento.categoriaAuditoria || evento.ip) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Informações de Auditoria</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {evento.categoriaAuditoria && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Categoria
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {evento.categoriaAuditoria}
                      </Badge>
                    </div>
                  )}
                  {evento.ip && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Endereço IP
                      </p>
                      <p className="text-sm mt-1">{evento.ip}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Detalhes Adicionais */}
          {evento.detalhes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Detalhes Adicionais</h4>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{evento.detalhes}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {!evento.osAssociada && (
            <Button variant="outline" onClick={() => onAssociarOS(evento)}>
              <FileText className="mr-2 h-4 w-4" />
              Associar OS
            </Button>
          )}
          {!evento.reconhecido && (
            <Button onClick={() => onMarcarReconhecido(evento)}>
              Marcar como Reconhecido
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
