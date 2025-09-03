// src/features/supervisorio/components/sinoptico-diagrama.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { useCallback, useState } from "react";

// Interfaces dos tipos de dados
interface ComponenteDU {
  id: string;
  nome: string;
  tipo: string;
  status: "NORMAL" | "ALARME" | "FALHA";
  posicao: {
    x: number;
    y: number;
  };
  dados?: Record<string, any>;
}

// Componentes de ícones elétricos técnicos (mantidos do código original)
const ElectricIcons = {
  // Medidor de Energia - Círculo com display digital
  MEDIDOR: ({ className = "" }: { className?: string }) => (
    <div className={`relative ${className}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="text-current">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <circle
          cx="12"
          cy="12"
          r="6"
          stroke="currentColor"
          strokeWidth="1"
          fill="currentColor"
          fillOpacity="0.1"
        />
        <rect
          x="8"
          y="10"
          width="8"
          height="4"
          rx="1"
          stroke="currentColor"
          strokeWidth="0.5"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <line
          x1="10"
          y1="11"
          x2="10"
          y2="13"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <line
          x1="12"
          y1="11"
          x2="12"
          y2="13"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <line
          x1="14"
          y1="11"
          x2="14"
          y2="13"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  ),

  // Transformador - Dois círculos conectados
  TRANSFORMADOR: ({ className = "" }: { className?: string }) => (
    <div className={`relative ${className}`}>
      <svg width="28" height="24" viewBox="0 0 28 24" className="text-current">
        <circle
          cx="8"
          cy="12"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <circle
          cx="20"
          cy="12"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <line
          x1="14"
          y1="8"
          x2="14"
          y2="16"
          stroke="currentColor"
          strokeWidth="1"
        />
        <text
          x="8"
          y="16"
          fontSize="6"
          textAnchor="middle"
          className="fill-current"
        >
          P
        </text>
        <text
          x="20"
          y="16"
          fontSize="6"
          textAnchor="middle"
          className="fill-current"
        >
          S
        </text>
      </svg>
    </div>
  ),

  // Inversor Solar - Retângulo com onda senoidal
  INVERSOR: ({ className = "" }: { className?: string }) => (
    <div className={`relative ${className}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="text-current">
        <rect
          x="3"
          y="6"
          width="18"
          height="12"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M6 12 Q8 8 10 12 T14 12 Q16 8 18 12"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle
          cx="19"
          cy="8"
          r="2"
          stroke="currentColor"
          strokeWidth="1"
          fill="yellow"
          fillOpacity="0.8"
        />
        <path
          d="M18 7 L19 8.5 L20 7"
          stroke="currentColor"
          strokeWidth="0.5"
          fill="none"
        />
      </svg>
    </div>
  ),

  // Motor Elétrico - Círculo com M
  MOTOR: ({ className = "" }: { className?: string }) => (
    <div className={`relative ${className}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="text-current">
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <circle
          cx="12"
          cy="12"
          r="6"
          stroke="currentColor"
          strokeWidth="1"
          fill="currentColor"
          fillOpacity="0.1"
        />
        <text
          x="12"
          y="16"
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
          className="fill-current"
        >
          M
        </text>
        <line
          x1="12"
          y1="3"
          x2="12"
          y2="6"
          stroke="currentColor"
          strokeWidth="1"
        />
        <line
          x1="12"
          y1="18"
          x2="12"
          y2="21"
          stroke="currentColor"
          strokeWidth="1"
        />
        <line
          x1="3"
          y1="12"
          x2="6"
          y2="12"
          stroke="currentColor"
          strokeWidth="1"
        />
        <line
          x1="18"
          y1="12"
          x2="21"
          y2="12"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
    </div>
  ),

  // Banco de Capacitores - Duas linhas paralelas
  CAPACITOR: ({ className = "" }: { className?: string }) => (
    <div className={`relative ${className}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="text-current">
        <line
          x1="9"
          y1="4"
          x2="9"
          y2="20"
          stroke="currentColor"
          strokeWidth="3"
        />
        <line
          x1="15"
          y1="4"
          x2="15"
          y2="20"
          stroke="currentColor"
          strokeWidth="3"
        />
        <line
          x1="2"
          y1="12"
          x2="9"
          y2="12"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line
          x1="15"
          y1="12"
          x2="22"
          y2="12"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x="12"
          y="8"
          fontSize="6"
          textAnchor="middle"
          className="fill-current"
        >
          C
        </text>
      </svg>
    </div>
  ),

  // Disjuntor - Retângulo com chave
  DISJUNTOR: ({
    className = "",
    isOpen = false,
  }: {
    className?: string;
    isOpen?: boolean;
  }) => (
    <div className={`relative ${className}`}>
      <svg width="24" height="20" viewBox="0 0 24 20" className="text-current">
        <rect
          x="4"
          y="4"
          width="16"
          height="12"
          rx="1"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <line
          x1="2"
          y1="10"
          x2="4"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line
          x1="20"
          y1="10"
          x2="22"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line
          x1="8"
          y1="10"
          x2={isOpen ? "14" : "16"}
          y2={isOpen ? "6" : "10"}
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="8" cy="10" r="1" fill="currentColor" />
        <circle cx="16" cy="10" r="1" fill="currentColor" />
        <text
          x="12"
          y="14"
          fontSize="4"
          textAnchor="middle"
          className="fill-current"
        >
          DJ
        </text>
      </svg>
    </div>
  ),

  // Chave Seccionadora
  CHAVE: ({
    className = "",
    isOpen = false,
  }: {
    className?: string;
    isOpen?: boolean;
  }) => (
    <div className={`relative ${className}`}>
      <svg width="24" height="16" viewBox="0 0 24 16" className="text-current">
        <line
          x1="2"
          y1="8"
          x2="6"
          y2="8"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line
          x1="18"
          y1="8"
          x2="22"
          y2="8"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line
          x1="6"
          y1="8"
          x2={isOpen ? "16" : "18"}
          y2={isOpen ? "4" : "8"}
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="6" cy="8" r="1" fill="currentColor" />
        <circle cx="18" cy="8" r="1" fill="currentColor" />
      </svg>
    </div>
  ),

  // Painel Solar
  PAINEL_SOLAR: ({ className = "" }: { className?: string }) => (
    <div className={`relative ${className}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="text-current">
        <rect
          x="4"
          y="8"
          width="16"
          height="8"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <line
          x1="8"
          y1="8"
          x2="8"
          y2="16"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <line
          x1="12"
          y1="8"
          x2="12"
          y2="16"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <line
          x1="16"
          y1="8"
          x2="16"
          y2="16"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <line
          x1="4"
          y1="10.5"
          x2="20"
          y2="10.5"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <line
          x1="4"
          y1="13.5"
          x2="20"
          y2="13.5"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <circle
          cx="12"
          cy="4"
          r="2"
          stroke="currentColor"
          strokeWidth="1"
          fill="yellow"
          fillOpacity="0.8"
        />
        <path
          d="M11 3 L12 4.5 L13 3"
          stroke="currentColor"
          strokeWidth="0.5"
          fill="none"
        />
        <path
          d="M11 5 L12 3.5 L13 5"
          stroke="currentColor"
          strokeWidth="0.5"
          fill="none"
        />
      </svg>
    </div>
  ),

  // Default para tipos não reconhecidos
  DEFAULT: ({ className = "" }: { className?: string }) => (
    <Settings className={`h-6 w-6 ${className}`} />
  ),
};

interface SinopticoDiagramaProps {
  componentes: ComponenteDU[];
  onComponenteClick: (componente: ComponenteDU) => void;
}

export function SinopticoDiagrama({
  componentes,
  onComponenteClick,
}: SinopticoDiagramaProps) {
  // Estados apenas para funcionalidades básicas
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  // Função para abrir modal
  const handleComponentClick = useCallback(
    (componente: ComponenteDU) => {
      onComponenteClick(componente);
    },
    [onComponenteClick]
  );

  // Funções auxiliares (mantidas do código original)
  const getComponenteIcon = (tipo: string, isOpen?: boolean) => {
    const IconComponent =
      ElectricIcons[tipo as keyof typeof ElectricIcons] ||
      ElectricIcons.DEFAULT;
    return <IconComponent className="text-current" isOpen={isOpen} />;
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
        return "bg-green-100 text-green-800 border-green-200";
      case "ALARME":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "FALHA":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getContainerSize = (tipo: string) => {
    switch (tipo) {
      case "TRANSFORMADOR":
        return "p-4";
      case "INVERSOR":
        return "p-3.5";
      case "MOTOR":
        return "p-3.5";
      default:
        return "p-3";
    }
  };

  return (
    <Card className="h-full w-full">
      <CardHeader className="pb-3"></CardHeader>

      <CardContent className="p-0">
        {/* Área do Diagrama */}
        <div
          className="relative bg-muted/20 rounded-none p-4 border-0"
          style={{ height: "800px" }}
        >
          {/* SVG para linhas de conexão */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {/* Linhas originais do diagrama (mantidas) */}
            <line
              x1="10%"
              y1="50%"
              x2="90%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted-foreground"
            />
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
              className={`absolute cursor-pointer transition-all duration-300 ${
                hoveredComponent === componente.id
                  ? "scale-110 z-20"
                  : "scale-100 z-10"
              }`}
              style={{
                left: `${componente.posicao.x}%`,
                top: `${componente.posicao.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              onClick={() => handleComponentClick(componente)}
              onMouseEnter={() => setHoveredComponent(componente.id)}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Container com ícone elétrico técnico */}
              <div
                className={`
                  relative rounded-lg text-white transition-all duration-300 border-2 border-white/30
                  ${getContainerSize(componente.tipo)}
                  ${getStatusColor(componente.status)}
                  ${
                    hoveredComponent === componente.id
                      ? "shadow-xl ring-4 ring-white/50 scale-105"
                      : "shadow-lg"
                  }
                `}
              >
                {getComponenteIcon(componente.tipo, componente.dados?.isOpen)}

                {/* Indicador de status pulsante para alarmes/falhas */}
                {componente.status !== "NORMAL" && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse ring-2 ring-white shadow-md"></div>
                )}

                {/* Badge de status pequeno no canto superior esquerdo */}
                <div className="absolute -top-2 -left-2">
                  <div
                    className={`w-4 h-4 rounded-full ${getStatusColor(
                      componente.status
                    )} ring-2 ring-white`}
                  ></div>
                </div>
              </div>

              {/* Label do componente */}
              <div className="mt-3 text-center pointer-events-none">
                <div className="text-xs font-semibold text-foreground whitespace-nowrap max-w-24 truncate">
                  {componente.nome}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {componente.tipo.replace("_", " ")}
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs mt-1 ${getStatusBadgeColor(
                    componente.status
                  )} font-medium`}
                >
                  {componente.status}
                </Badge>
              </div>

              {/* Tooltip */}
              {hoveredComponent === componente.id && (
                <div className="absolute bottom-full mb-4 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur-sm p-4 border border-border rounded-lg shadow-xl whitespace-nowrap z-30 min-w-48 pointer-events-none">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold border-b pb-1">
                      {componente.nome}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>
                        <div className="font-medium">
                          {componente.tipo.replace("_", " ")}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <div
                          className={`font-medium ${
                            componente.status === "NORMAL"
                              ? "text-green-600"
                              : componente.status === "ALARME"
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {componente.status}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-blue-500 font-medium pt-1 border-t">
                      🖱️ Clique para ver detalhes técnicos
                    </div>
                  </div>
                  {/* Seta do tooltip */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border"></div>
                </div>
              )}
            </div>
          ))}

          {/* Labels das seções */}
          <div className="absolute top-2 left-4 text-xs font-semibold text-muted-foreground bg-background/80 px-2 py-1 rounded pointer-events-none">
            ENTRADA
          </div>
          <div className="absolute top-2 right-4 text-xs font-semibold text-muted-foreground bg-background/80 px-2 py-1 rounded pointer-events-none">
            GERAÇÃO
          </div>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-muted-foreground bg-background/80 px-2 py-1 rounded pointer-events-none">
            CARGAS E EQUIPAMENTOS
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
