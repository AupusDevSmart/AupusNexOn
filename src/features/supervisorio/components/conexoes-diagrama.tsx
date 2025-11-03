// src/features/supervisorio/components/conexoes-diagrama.tsx
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
  onEdgeClick?: (event: React.MouseEvent, connection: Connection) => void;
  className?: string;
}

// Função para calcular offset da porta
const getPortOffset = (
  tipo: string,
  port: "top" | "bottom" | "left" | "right"
) => {
  const componentSizes: Record<string, { width: number; height: number }> = {
    MEDIDOR: { width: 32, height: 32 },
    TRANSFORMADOR: { width: 48, height: 32 },
    INVERSOR: { width: 32, height: 32 },
    DISJUNTOR: { width: 32, height: 16 },
    DISJUNTOR_FECHADO: { width: 32, height: 16 },
    DISJUNTOR_ABERTO: { width: 32, height: 16 },
    PONTO: { width: 12, height: 12 },
    MOTOR: { width: 32, height: 32 },
    CAPACITOR: { width: 32, height: 32 },
    CHAVE_FUSIVEL: { width: 48, height: 32 },
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
    JUNCTION: { width: 10, height: 10 }, // Junction node - muito pequeno
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

// Função para obter estilo da conexão
const getConnectionStyle = (
  fromComponent: ComponenteDU,
  toComponent: ComponenteDU,
  modoEdicao: boolean
) => {
  const hasError =
    fromComponent.status === "FALHA" || toComponent.status === "FALHA";
  const hasWarning =
    fromComponent.status === "ALARME" || toComponent.status === "ALARME";

  if (hasError) {
    return {
      stroke: "#ef4444", // red-500 - COR SÓLIDA
      strokeWidth: modoEdicao ? "3" : "2",
      opacity: "0.8",
    };
  } else if (hasWarning) {
    return {
      stroke: "#f59e0b", // amber-500 - COR SÓLIDA
      strokeWidth: modoEdicao ? "3" : "2",
      opacity: "0.8",
    };
  } else {
    return {
      stroke: "#3b82f6", // blue-600 - COR SÓLIDA AZUL
      strokeWidth: modoEdicao ? "3" : "2",
      opacity: "0.9",
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
  onEdgeClick,
  className = "",
}: ConexoesDiagramaProps) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(
    null
  );

  // Atualizar dimensões do container
  useEffect(() => {
    const updateContainerRect = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        console.log('📏 Container rect:', { width: rect.width, height: rect.height });
        setContainerRect(rect);
      } else {
        console.warn('⚠️ containerRef.current is NULL');
      }
    };

    // Delay inicial para garantir que o DOM está completamente renderizado
    const timeoutId = setTimeout(updateContainerRect, 200);
    updateContainerRect();

    const resizeObserver = new ResizeObserver(updateContainerRect);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", updateContainerRect);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateContainerRect);
    };
  }, [containerRef]);

  // Forçar atualização quando componentes ou conexões mudam
  useEffect(() => {
    const updateContainerRect = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    };

    // Pequeno delay para garantir que o layout foi atualizado
    const timeoutId = setTimeout(updateContainerRect, 100);

    return () => clearTimeout(timeoutId);
  }, [componentes.length, connections.length, containerRef]);

  // Listener para detectar mudanças de fullscreen e recalcular dimensões
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (containerRef.current) {
        const recalculate = () => {
          setContainerRect(containerRef.current!.getBoundingClientRect());
        };

        recalculate();
        setTimeout(recalculate, 50);
        setTimeout(recalculate, 150);
        setTimeout(recalculate, 300);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
    };
  }, [containerRef]);

  if (!containerRect) {
    return null;
  }

  return (
    <svg
      className={`absolute inset-0 w-full h-full z-20 ${className}`}
      style={{
        pointerEvents: modoEdicao ? "auto" : "none",
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Definições de markers */}
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
            fill="#3b82f6"
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
          <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
        </marker>
        <marker
          id="arrowhead-error"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
      </defs>

      {/* Renderizar conexões */}
      {connections.map((connection) => {
        const fromComponent = componentes.find((c) => c.id === connection.from);
        const toComponent = componentes.find((c) => c.id === connection.to);

        if (!fromComponent || !toComponent) {
          return null;
        }

        // Calcular posições
        const fromCenterX =
          (fromComponent.posicao.x / 100) * containerRect.width;
        const fromCenterY =
          (fromComponent.posicao.y / 100) * containerRect.height;
        const toCenterX = (toComponent.posicao.x / 100) * containerRect.width;
        const toCenterY = (toComponent.posicao.y / 100) * containerRect.height;

        const fromOffset = getPortOffset(
          fromComponent.tipo,
          connection.fromPort
        );
        const toOffset = getPortOffset(toComponent.tipo, connection.toPort);

        const fromX = fromCenterX + fromOffset.x;
        const fromY = fromCenterY + fromOffset.y;
        const toX = toCenterX + toOffset.x;
        const toY = toCenterY + toOffset.y;

        // ===== CALCULAR CAMINHO ORTOGONAL MELHORADO =====
        const calculateOrthogonalPath = () => {
          const path: string[] = [];

          // Começar no ponto de origem
          path.push(`M ${fromX} ${fromY}`);

          // Determinar direção baseado nas portas
          const fromPort = connection.fromPort;
          const toPort = connection.toPort;

          // Calcular diferenças
          const deltaX = Math.abs(toX - fromX);
          const deltaY = Math.abs(toY - fromY);

          // SE COMPONENTES ESTÃO QUASE ALINHADOS VERTICALMENTE (diferença X < 10px)
          if (
            deltaX < 10 &&
            (fromPort === "top" || fromPort === "bottom") &&
            (toPort === "top" || toPort === "bottom")
          ) {
            // LINHA RETA VERTICAL - usa o X médio para garantir alinhamento perfeito
            const avgX = (fromX + toX) / 2;
            path.push(`L ${avgX} ${fromY}`);
            path.push(`L ${avgX} ${toY}`);
            path.push(`L ${toX} ${toY}`);
          }
          // SE COMPONENTES ESTÃO QUASE ALINHADOS HORIZONTALMENTE (diferença Y < 10px)
          else if (
            deltaY < 10 &&
            (fromPort === "left" || fromPort === "right") &&
            (toPort === "left" || toPort === "right")
          ) {
            // LINHA RETA HORIZONTAL - usa o Y médio para garantir alinhamento perfeito
            const avgY = (fromY + toY) / 2;
            path.push(`L ${fromX} ${avgY}`);
            path.push(`L ${toX} ${avgY}`);
            path.push(`L ${toX} ${toY}`);
          }
          // Vertical (top/bottom) - conexão em sequência vertical
          else if (
            (fromPort === "top" || fromPort === "bottom") &&
            (toPort === "top" || toPort === "bottom")
          ) {
            const midY = (fromY + toY) / 2;
            path.push(`L ${fromX} ${midY}`); // Linha vertical até meio
            path.push(`L ${toX} ${midY}`); // Linha horizontal
            path.push(`L ${toX} ${toY}`); // Linha vertical até destino
          }
          // Horizontal (left/right) - conexão em sequência horizontal
          else if (
            (fromPort === "left" || fromPort === "right") &&
            (toPort === "left" || toPort === "right")
          ) {
            const midX = (fromX + toX) / 2;
            path.push(`L ${midX} ${fromY}`); // Linha horizontal até meio
            path.push(`L ${midX} ${toY}`); // Linha vertical
            path.push(`L ${toX} ${toY}`); // Linha horizontal até destino
          }
          // Misto (perpendicular)
          else {
            // Calcula ponto intermediário baseado nas portas
            if (fromPort === "right" || fromPort === "left") {
              const midX =
                fromPort === "right"
                  ? Math.max(fromX, toX) + 20
                  : Math.min(fromX, toX) - 20;
              path.push(`L ${midX} ${fromY}`);
              path.push(`L ${midX} ${toY}`);
            } else {
              const midY =
                fromPort === "bottom"
                  ? Math.max(fromY, toY) + 20
                  : Math.min(fromY, toY) - 20;
              path.push(`L ${fromX} ${midY}`);
              path.push(`L ${toX} ${midY}`);
            }
            path.push(`L ${toX} ${toY}`);
          }

          return path.join(" ");
        };
        // ================================================

        const pathData = calculateOrthogonalPath();

        const connectionStyle = getConnectionStyle(
          fromComponent,
          toComponent,
          modoEdicao
        );

        const isHovered = hoveredConnection === connection.id;

        return (
          <g key={connection.id}>
            {/* Linha de conexão ORTOGONAL */}
            <path
              d={pathData}
              stroke={connectionStyle.stroke}
              className="cursor-pointer transition-all"
              strokeWidth={isHovered ? "6" : connectionStyle.strokeWidth}
              opacity={connectionStyle.opacity}
              fill="none"
              style={{ pointerEvents: "stroke" }}
              onMouseEnter={() => setHoveredConnection(connection.id)}
              onMouseLeave={() => setHoveredConnection(null)}
              onClick={(e) => {
                if (!modoEdicao) return;

                // Ctrl + Click = Criar junction invisível
                if (e.ctrlKey && onEdgeClick) {
                  e.stopPropagation();
                  onEdgeClick(e, connection);
                }
                // Click normal = Remover conexão
                else if (onRemoverConexao) {
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
              r="4"
              fill="#3b82f6"
              opacity="0.8"
            />
            <circle
              cx={toX}
              cy={toY}
              r="4"
              fill="#3b82f6"
              opacity="0.8"
            />

            {/* Label quando hover */}
            {modoEdicao && isHovered && (
              <g>
                <rect
                  x={(fromX + toX) / 2 - 70}
                  y={(fromY + toY) / 2 - 20}
                  width="140"
                  height="40"
                  rx="4"
                  fill="hsl(var(--background))"
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                />
                <text
                  x={(fromX + toX) / 2}
                  y={(fromY + toY) / 2 - 5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9"
                  fill="hsl(var(--foreground))"
                  style={{ pointerEvents: "none" }}
                >
                  Clique para remover
                </text>
                <text
                  x={(fromX + toX) / 2}
                  y={(fromY + toY) / 2 + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="8"
                  fill="hsl(var(--muted-foreground))"
                  style={{ pointerEvents: "none" }}
                >
                  Ctrl+Click = Junção
                </text>
              </g>
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
          fontSize="14"
          fontWeight="600"
          fill="#d97706"
          className="animate-pulse"
        >
          Clique em outro componente para completar a conexão
        </text>
      )}
    </svg>
  );
}
