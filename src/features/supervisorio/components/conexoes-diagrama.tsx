import { useEffect, useState } from "react";

// Interfaces
interface ComponenteDU {
  id: string;
  tipo: string;
  nome: string;
  posicao: { x: number; y: number };
  status: string;
  dados: any;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort: "top" | "bottom" | "left" | "right";
  toPort: "top" | "bottom" | "left" | "right";
}

interface ConexoesDiagramaProps {
  connections: Connection[];
  componentes: ComponenteDU[];
  containerRef: React.RefObject<HTMLDivElement>;
  modoEdicao?: boolean;
  connecting?: { from: string; port: string } | null;
  onRemoverConexao?: (connectionId: string) => void;
  className?: string;
}

// Função para calcular offset da porta baseado no tipo do componente
const getPortOffset = (
  tipo: string,
  port: "top" | "bottom" | "left" | "right"
) => {
  // Offsets baseados no tamanho dos símbolos de cada tipo
  const componentSizes = {
    MEDIDOR: { width: 32, height: 32 },
    TRANSFORMADOR: { width: 48, height: 32 },
    INVERSOR: { width: 32, height: 32 },
    DISJUNTOR: { width: 32, height: 16 },
    MOTOR: { width: 32, height: 32 },
    CAPACITOR: { width: 32, height: 32 },
    TSA: { width: 48, height: 40 },
    RETIFICADOR: { width: 32, height: 24 },
    BANCO_BATERIAS: { width: 40, height: 24 },
    PAINEL_PMT: { width: 40, height: 32 },
    SKID: { width: 36, height: 28 },
    SALA_COMANDO: { width: 44, height: 32 },
    SCADA: { width: 28, height: 28 },
    CFTV: { width: 28, height: 28 },
    TELECOM: { width: 28, height: 28 },
    BARRAMENTO: { width: 40, height: 12 },
  };

  const size = componentSizes[tipo] || { width: 32, height: 32 };
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;

  switch (port) {
    case "top":
      return { x: 0, y: -halfHeight };
    case "bottom":
      return { x: 0, y: halfHeight };
    case "left":
      return { x: -halfWidth, y: 0 };
    case "right":
      return { x: halfWidth, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
};

// Função para obter classes de estilo baseado no status da conexão
const getConnectionStyle = (
  fromComponent: ComponenteDU,
  toComponent: ComponenteDU,
  modoEdicao: boolean
) => {
  // Determinar a cor baseada no status dos componentes conectados
  const hasError =
    fromComponent.status === "FALHA" || toComponent.status === "FALHA";
  const hasWarning =
    fromComponent.status === "ALARME" || toComponent.status === "ALARME";

  if (hasError) {
    return {
      stroke: "stroke-red-500",
      strokeWidth: modoEdicao ? "3" : "2",
      opacity: "0.8",
    };
  } else if (hasWarning) {
    return {
      stroke: "stroke-amber-500",
      strokeWidth: modoEdicao ? "3" : "2",
      opacity: "0.8",
    };
  } else {
    return {
      stroke: "stroke-blue-600 dark:stroke-blue-400",
      strokeWidth: modoEdicao ? "2" : "2",
      opacity: "0.7",
    };
  }
};

export function ConexoesDiagrama({
  connections,
  componentes,
  containerRef,
  modoEdicao = false,
  connecting = null,
  onRemoverConexao,
  className = "",
}: ConexoesDiagramaProps) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(
    null
  );

  // Atualizar dimensões do container quando necessário
  useEffect(() => {
    const updateContainerRect = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    };

    updateContainerRect();

    // Observar mudanças no container
    const resizeObserver = new ResizeObserver(updateContainerRect);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Listener para resize da janela
    window.addEventListener("resize", updateContainerRect);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateContainerRect);
    };
  }, [containerRef]);

  // Se não há container ou conexões, não renderizar
  if (!containerRect || connections.length === 0) {
    return null;
  }

  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${className}`}
      style={{ pointerEvents: modoEdicao ? "auto" : "none" }}
    >
      {/* Definições para markers e padrões */}
      <defs>
        <marker
          id="arrowhead-normal"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            className="fill-blue-600 dark:fill-blue-400"
          />
        </marker>
        <marker
          id="arrowhead-warning"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" className="fill-amber-500" />
        </marker>
        <marker
          id="arrowhead-error"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" className="fill-red-500" />
        </marker>
      </defs>

      {/* Renderizar todas as conexões */}
      {connections.map((connection) => {
        const fromComponent = componentes.find((c) => c.id === connection.from);
        const toComponent = componentes.find((c) => c.id === connection.to);

        if (!fromComponent || !toComponent) {
          return null;
        }

        // Calcular posições dos componentes
        const fromCenterX =
          (fromComponent.posicao.x / 100) * containerRect.width;
        const fromCenterY =
          (fromComponent.posicao.y / 100) * containerRect.height;
        const toCenterX = (toComponent.posicao.x / 100) * containerRect.width;
        const toCenterY = (toComponent.posicao.y / 100) * containerRect.height;

        // Calcular offsets das portas
        const fromOffset = getPortOffset(
          fromComponent.tipo,
          connection.fromPort
        );
        const toOffset = getPortOffset(toComponent.tipo, connection.toPort);

        // Posições finais das conexões
        const fromX = fromCenterX + fromOffset.x;
        const fromY = fromCenterY + fromOffset.y;
        const toX = toCenterX + toOffset.x;
        const toY = toCenterY + toOffset.y;

        // Estilos da conexão
        const connectionStyle = getConnectionStyle(
          fromComponent,
          toComponent,
          modoEdicao
        );

        // Determinar qual marker usar
        const hasError =
          fromComponent.status === "FALHA" || toComponent.status === "FALHA";
        const hasWarning =
          fromComponent.status === "ALARME" || toComponent.status === "ALARME";
        const markerEnd = hasError
          ? "url(#arrowhead-error)"
          : hasWarning
          ? "url(#arrowhead-warning)"
          : "url(#arrowhead-normal)";

        const isHovered = hoveredConnection === connection.id;
        const isConnecting =
          connecting &&
          (connecting.from === connection.from ||
            connecting.from === connection.to);

        return (
          <g key={connection.id}>
            {/* Linha principal da conexão - SEM SETA */}
            <line
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              className={`${connectionStyle.stroke} transition-all duration-200`}
              strokeWidth={
                isHovered
                  ? Number(connectionStyle.strokeWidth) + 1
                  : connectionStyle.strokeWidth
              }
              opacity={
                isConnecting ? "0.4" : isHovered ? "1" : connectionStyle.opacity
              }
              style={{
                pointerEvents: modoEdicao ? "stroke" : "none",
                strokeDasharray: isConnecting ? "5,5" : "none",
              }}
              onMouseEnter={() =>
                modoEdicao && setHoveredConnection(connection.id)
              }
              onMouseLeave={() => modoEdicao && setHoveredConnection(null)}
              onClick={(e) => {
                if (modoEdicao && onRemoverConexao) {
                  e.stopPropagation();
                  if (window.confirm("Deseja remover esta conexão?")) {
                    onRemoverConexao(connection.id);
                  }
                }
              }}
            />

            {/* Pontos de conexão */}
            <circle
              cx={fromX}
              cy={fromY}
              r={modoEdicao ? "4" : "3"}
              className={`${connectionStyle.stroke.replace(
                "stroke-",
                "fill-"
              )} transition-all duration-200`}
              opacity={isHovered ? "1" : "0.8"}
            />
            <circle
              cx={toX}
              cy={toY}
              r={modoEdicao ? "4" : "3"}
              className={`${connectionStyle.stroke.replace(
                "stroke-",
                "fill-"
              )} transition-all duration-200`}
              opacity={isHovered ? "1" : "0.8"}
            />

            {/* Label da conexão no modo edição */}
            {modoEdicao && isHovered && (
              <g>
                {/* Fundo do label */}
                <rect
                  x={(fromX + toX) / 2 - 30}
                  y={(fromY + toY) / 2 - 12}
                  width="60"
                  height="24"
                  rx="4"
                  className="fill-background stroke-border"
                  strokeWidth="1"
                />
                {/* Texto do label */}
                <text
                  x={(fromX + toX) / 2}
                  y={(fromY + toY) / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="500"
                  className="fill-foreground"
                  style={{ pointerEvents: "none" }}
                >
                  Clique para remover
                </text>
              </g>
            )}

            {/* Indicador de conexão ativa */}
            {connecting && connecting.from === connection.from && (
              <circle
                cx={fromX}
                cy={fromY}
                r="8"
                className="fill-none stroke-amber-400 animate-ping"
                strokeWidth="2"
              />
            )}
          </g>
        );
      })}

      {/* Indicador quando está conectando */}
      {connecting && modoEdicao && (
        <text
          x={containerRect.width / 2}
          y="30"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="14"
          fontWeight="600"
          className="fill-amber-600 animate-pulse"
        >
          Clique em outro componente para completar a conexão
        </text>
      )}
    </svg>
  );
}
