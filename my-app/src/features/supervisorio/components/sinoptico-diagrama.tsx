// src/features/supervisorio/components/sinoptico-diagrama.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComponenteDU } from "@/types/dtos/sinoptico-ativo";
import {
  Activity,
  Circle,
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-purple-500" />
          Diagrama Unifilar - Clique nos componentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="relative bg-muted/20 rounded-lg p-6"
          style={{ minHeight: "400px" }}
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
              strokeWidth="2"
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
                hoveredComponent === componente.id ? "scale-110" : "scale-100"
              }`}
              style={{
                left: `${componente.posicao.x}%`,
                top: `${componente.posicao.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 2,
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
                  hoveredComponent === componente.id ? "shadow-lg" : "shadow-md"
                }
              `}
              >
                {getComponenteIcon(componente.tipo)}

                {/* Indicador de status pulsante para alarmes/falhas */}
                {componente.status !== "NORMAL" && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>

              {/* Label do componente */}
              <div className="mt-2 text-center">
                <div className="text-xs font-medium text-foreground whitespace-nowrap">
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
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-background p-2 border border-border rounded-lg shadow-lg whitespace-nowrap z-10">
                  <div className="text-sm font-medium">{componente.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {componente.tipo}
                  </div>
                  <div className="text-xs">Status: {componente.status}</div>
                  <div className="text-xs text-blue-500">
                    Clique para detalhes
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Legenda */}
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur p-3 rounded-lg border border-border">
            <div className="text-xs font-medium mb-2">Legenda:</div>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Alarme</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Falha</span>
              </div>
            </div>
          </div>

          {/* Instruções */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur p-3 rounded-lg border border-border">
            <div className="text-xs text-muted-foreground">
              💡 Clique nos componentes para ver detalhes
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
