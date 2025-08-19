// src/features/supervisorio/components/sinoptico-header.tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AtivoData, StatusRede } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Gauge,
  Zap,
} from "lucide-react";

interface SinopticoHeaderProps {
  ativo: AtivoData;
  statusRede: StatusRede;
}

export function SinopticoHeader({ ativo, statusRede }: SinopticoHeaderProps) {
  const getStatusRedeIcon = () => {
    return statusRede.status === "NORMAL" ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-red-500" />
    );
  };

  const getStatusRedeColor = () => {
    return statusRede.status === "NORMAL"
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-red-100 text-red-800 border-red-200";
  };

  const getStatusAtivoColor = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "bg-green-100 text-green-800";
      case "ALARME":
        return "bg-yellow-100 text-yellow-800";
      case "URGENCIA":
        return "bg-orange-100 text-orange-800";
      case "TRIP":
        return "bg-red-100 text-red-800";
      case "MANUTENCAO":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatarTempo = (tempo?: string) => {
    if (!tempo) return "";
    const agora = new Date();
    const tempoFalta = new Date(tempo);
    const diffMs = agora.getTime() - tempoFalta.getTime();
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHoras}h ${diffMinutos}m`;
  };

  return (
    <Card className="mb-6 w-full">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* Status da Rede */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">{getStatusRedeIcon()}</div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Status da Rede
              </div>
              <Badge variant="outline" className={getStatusRedeColor()}>
                {statusRede.status === "NORMAL" ? "Normal" : "Falta de Energia"}
              </Badge>
              {statusRede.status === "FALTA_ENERGIA" &&
                statusRede.tempoFalta && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Há {formatarTempo(statusRede.tempoFalta)}
                    {statusRede.protocoloFalta && (
                      <span className="ml-2">
                        Protocolo: {statusRede.protocoloFalta}
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Status do Ativo */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Status do Ativo
              </div>
              <Badge
                variant="outline"
                className={getStatusAtivoColor(ativo.status)}
              >
                {ativo.status}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">
                Atualizado:{" "}
                {new Date(ativo.ultimaAtualizacao).toLocaleTimeString("pt-BR")}
              </div>
            </div>
          </div>

          {/* Informações da Rede */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Zap className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Tensão da Rede
              </div>
              <div className="text-lg font-bold text-foreground">
                {statusRede.tensaoRede.toFixed(1)} V
              </div>
              <div className="text-xs text-muted-foreground">
                {statusRede.frequencia.toFixed(2)} Hz
              </div>
            </div>
          </div>

          {/* Potência do Ativo */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Gauge className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Potência Atual
              </div>
              <div className="text-lg font-bold text-foreground">
                {(ativo.potencia / 1000).toFixed(1)} MW
              </div>
              <div className="text-xs text-muted-foreground">
                {ativo.corrente.toFixed(1)} A | {ativo.tensao.toFixed(0)} V
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
