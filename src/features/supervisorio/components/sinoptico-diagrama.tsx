// src/features/supervisorio/components/sinoptico-diagrama.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ComponenteDU } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  Circle,
  Info,
  Settings,
  Square,
  Triangle,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface SinopticoDiagramaProps {
  componentes: ComponenteDU[];
  onComponenteClick: (componente: ComponenteDU) => void;
}

export function SinopticoDiagrama({
  componentes,
  onComponenteClick,
}: SinopticoDiagramaProps) {
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  const getComponenteIcon = (tipo: string) => {
    switch (tipo) {
      case "MEDIDOR":
        return <Activity className="h-6 w-6" />;
      case "TRANSFORMADOR":
        return <Square className="h-8 w-8" />;
      case "INVERSOR":
        return <Zap className="h-6 w-6" />;
      case "MOTOR":
        return <Circle className="h-6 w-6" />;
      case "CAPACITOR":
        return <Triangle className="h-6 w-6" />;
      case "DISJUNTOR":
        return <Settings className="h-6 w-6" />;
      default:
        return <Activity className="h-6 w-6" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "bg-green-500 hover:bg-green-600";
      case "ALARME":
        return "bg-yellow-500 hover:bg-yellow-600";
      case "FALHA":
        return "bg-red-500 hover:bg-red-600";
      default:
        return "bg-gray-500 hover:bg-gray-600";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "bg-green-100 text-green-800";
      case "ALARME":
        return "bg-yellow-100 text-yellow-800";
      case "FALHA":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-purple-500" />
          Diagrama Unifilar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Área do Diagrama */}
        <div
          className="relative bg-muted/20 rounded-lg p-6 border-2 border-dashed border-muted-foreground/20"
          style={{ height: "350px" }}
        >
          {/* SVG para linhas de conexão */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {/* Linha principal horizontal */}
            <line
              x1="10%"
              y1="50%"
              x2="90%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted-foreground"
            />

            {/* Linhas verticais de conexão */}
            <line
              x1="20%"
              y1="30%"
              x2="20%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
            <line
              x1="35%"
              y1="70%"
              x2="35%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
            <line
              x1="50%"
              y1="30%"
              x2="50%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
            <line
              x1="65%"
              y1="70%"
              x2="65%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
            <line
              x1="80%"
              y1="30%"
              x2="80%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
          </svg>

          {/* Componentes clicáveis */}
          {componentes.map((componente) => (
            <div
              key={componente.id}
              className={`absolute cursor-pointer transition-all duration-200 ${
                hoveredComponent === componente.id
                  ? "scale-110 z-20"
                  : "scale-100 z-10"
              }`}
              style={{
                left: `${componente.posicao.x}%`,
                top: `${componente.posicao.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              onClick={() => onComponenteClick(componente)}
              onMouseEnter={() => setHoveredComponent(componente.id)}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Círculo de status com ícone */}
              <div
                className={`
                relative p-3 rounded-full text-white transition-all duration-200
                ${getStatusColor(componente.status)}
                ${
                  hoveredComponent === componente.id
                    ? "shadow-lg ring-4 ring-white/50"
                    : "shadow-md"
                }
              `}
              >
                {getComponenteIcon(componente.tipo)}

                {/* Indicador de status pulsante para alarmes/falhas */}
                {componente.status !== "NORMAL" && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></div>
                )}
              </div>

              {/* Label do componente */}
              <div className="mt-2 text-center">
                <div className="text-xs font-medium text-foreground whitespace-nowrap max-w-20 truncate">
                  {componente.nome}
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs mt-1 ${getStatusBadgeColor(
                    componente.status
                  )}`}
                >
                  {componente.status}
                </Badge>
              </div>

              {/* Tooltip no hover */}
              {hoveredComponent === componente.id && (
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-background p-3 border border-border rounded-lg shadow-lg whitespace-nowrap z-30">
                  <div className="text-sm font-medium">{componente.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    Tipo: {componente.tipo}
                  </div>
                  <div className="text-xs">Status: {componente.status}</div>
                  <div className="text-xs text-blue-500 font-medium">
                    🖱️ Clique para ver detalhes
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* Legenda */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Info className="h-4 w-4" />
            Legenda:
          </div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <span>Alarme</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span>Falha</span>
            </div>
          </div>
        </div>

        {/* Resumo dos Status */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-50 border border-green-200 p-2 rounded">
            <div className="text-lg font-bold text-green-600">
              {componentes.filter((c) => c.status === "NORMAL").length}
            </div>
            <div className="text-xs text-green-700">Normais</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-2 rounded">
            <div className="text-lg font-bold text-yellow-600">
              {componentes.filter((c) => c.status === "ALARME").length}
            </div>
            <div className="text-xs text-yellow-700">Alarmes</div>
          </div>
          <div className="bg-red-50 border border-red-200 p-2 rounded">
            <div className="text-lg font-bold text-red-600">
              {componentes.filter((c) => c.status === "FALHA").length}
            </div>
            <div className="text-xs text-red-700">Falhas</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
