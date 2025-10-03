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
  junctionPoints?: string[];
}

interface JunctionPoint {
  id: string;
  position: { x: number; y: number };
  connectionId: string;
}

interface ConexoesDiagramaProps {
  connections: Connection[];
  componentes: ComponenteDU[];
  containerRef: React.RefObject<HTMLDivElement>;
  modoEdicao?: boolean;
  connecting?: { from: string; port: string } | null;
  onRemoverConexao?: (connectionId: string) => void;
  junctionPoints?: JunctionPoint[];
  onAddJunctionPoint?: (junctionPoint: JunctionPoint) => void;
  onRemoveJunctionPoint?: (junctionId: string) => void;
  onUpdateJunctionPoint?: (
    junctionId: string,
    position: { x: number; y: number }
  ) => void;
  modoAdicionarJunction?: boolean;
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
      strokeWidth: modoEdicao ? "3" : "2",
      opacity: "0.7",
    };
  }
};

// Calcular ponto mais próximo em uma linha
const getClosestPointOnLine = (
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  point: { x: number; y: number }
): { x: number; y: number } => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return lineStart;

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
        (length * length)
    )
  );

  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
};

export function ConexoesDiagrama({
  connections,
  componentes,
  containerRef,
  modoEdicao = false,
  connecting = null,
  onRemoverConexao,
  junctionPoints = [],
  onAddJunctionPoint,
  onRemoveJunctionPoint,
  onUpdateJunctionPoint,
  modoAdicionarJunction = false,
  className = "",
}: ConexoesDiagramaProps) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(
    null
  );
  const [hoveredJunction, setHoveredJunction] = useState<string | null>(null);
  const [draggingJunction, setDraggingJunction] = useState<string | null>(null);

  // Atualizar dimensões do container
  useEffect(() => {
    const updateContainerRect = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    };

    updateContainerRect();
    const resizeObserver = new ResizeObserver(updateContainerRect);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", updateContainerRect);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateContainerRect);
    };
  }, [containerRef]);

  // Handler para clique na linha (adicionar junction point)
  const handleLineClick = (
    event: React.MouseEvent<SVGLineElement>,
    connection: Connection,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => {
    if (!modoAdicionarJunction || !onAddJunctionPoint) return;

    event.stopPropagation();

    const svg = (event.target as SVGElement).ownerSVGElement;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Calcular ponto mais próximo na linha
    const closestPoint = getClosestPointOnLine(
      { x: fromX, y: fromY },
      { x: toX, y: toY },
      { x: clickX, y: clickY }
    );

    // Converter para porcentagem
    const percentX = (closestPoint.x / rect.width) * 100;
    const percentY = (closestPoint.y / rect.height) * 100;

    const newJunction: JunctionPoint = {
      id: `junction-${Date.now()}`,
      position: { x: percentX, y: percentY },
      connectionId: connection.id,
    };

    onAddJunctionPoint(newJunction);
    console.log("✅ Junction adicionado:", newJunction);
  };

  // Handler para arrastar junction point
  const handleJunctionMouseMove = (event: React.MouseEvent) => {
    if (!draggingJunction || !onUpdateJunctionPoint || !containerRect) return;

    const rect = containerRect;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    onUpdateJunctionPoint(draggingJunction, { x, y });
  };

  if (!containerRect || connections.length === 0) {
    return null;
  }

  return (
    <svg
      className={`absolute inset-0 w-full h-full z-10 ${className}`}
      style={{ pointerEvents: modoEdicao ? "auto" : "none" }}
      onMouseMove={handleJunctionMouseMove}
      onMouseUp={() => setDraggingJunction(null)}
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

      {/* Renderizar conexões */}
      {connections.map((connection) => {
        const fromComponent = componentes.find((c) => c.id === connection.from);
        const toComponent = componentes.find((c) => c.id === connection.to);

        if (!fromComponent || !toComponent) return null;

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

        const connectionStyle = getConnectionStyle(
          fromComponent,
          toComponent,
          modoEdicao
        );

        const isHovered = hoveredConnection === connection.id;

        // Obter junction points desta conexão
        const connJunctions = junctionPoints.filter(
          (jp) => jp.connectionId === connection.id
        );

        // Ordenar junction points ao longo da linha
        const sortedJunctions = [...connJunctions].sort((a, b) => {
          const aX = (a.position.x / 100) * containerRect.width;
          const aY = (a.position.y / 100) * containerRect.height;
          const bX = (b.position.x / 100) * containerRect.width;
          const bY = (b.position.y / 100) * containerRect.height;

          const distA = Math.sqrt(
            Math.pow(aX - fromX, 2) + Math.pow(aY - fromY, 2)
          );
          const distB = Math.sqrt(
            Math.pow(bX - fromX, 2) + Math.pow(bY - fromY, 2)
          );
          return distA - distB;
        });

        // Criar pontos da linha (incluindo junctions)
        const linePoints = [
          { x: fromX, y: fromY },
          ...sortedJunctions.map((jp) => ({
            x: (jp.position.x / 100) * containerRect.width,
            y: (jp.position.y / 100) * containerRect.height,
          })),
          { x: toX, y: toY },
        ];

        return (
          <g key={connection.id}>
            {/* Renderizar segmentos da linha */}
            {linePoints.slice(0, -1).map((point, index) => (
              <line
                key={`${connection.id}-segment-${index}`}
                x1={point.x}
                y1={point.y}
                x2={linePoints[index + 1].x}
                y2={linePoints[index + 1].y}
                className={`${connectionStyle.stroke} ${
                  modoAdicionarJunction ? "cursor-crosshair" : "cursor-pointer"
                } transition-all`}
                strokeWidth={isHovered ? "6" : connectionStyle.strokeWidth}
                opacity={connectionStyle.opacity}
                style={{ pointerEvents: "stroke" }}
                onMouseEnter={() => setHoveredConnection(connection.id)}
                onMouseLeave={() => setHoveredConnection(null)}
                onClick={(e) => {
                  if (modoAdicionarJunction) {
                    handleLineClick(
                      e,
                      connection,
                      point.x,
                      point.y,
                      linePoints[index + 1].x,
                      linePoints[index + 1].y
                    );
                  } else if (onRemoverConexao && modoEdicao) {
                    if (window.confirm("Deseja remover esta conexão?")) {
                      onRemoverConexao(connection.id);
                    }
                  }
                }}
              />
            ))}

            {/* Pontos de conexão */}
            <circle
              cx={fromX}
              cy={fromY}
              r="4"
              className="fill-blue-600"
              opacity="0.8"
            />
            <circle
              cx={toX}
              cy={toY}
              r="4"
              className="fill-blue-600"
              opacity="0.8"
            />

            {/* Label quando hover */}
            {modoEdicao && isHovered && (
              <g>
                <rect
                  x={(fromX + toX) / 2 - 50}
                  y={(fromY + toY) / 2 - 15}
                  width="100"
                  height="30"
                  rx="4"
                  className="fill-background stroke-border"
                  strokeWidth="1"
                />
                <text
                  x={(fromX + toX) / 2}
                  y={(fromY + toY) / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  className="fill-foreground"
                  style={{ pointerEvents: "none" }}
                >
                  {modoAdicionarJunction
                    ? "Clique para adicionar"
                    : "Clique para remover"}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Renderizar Junction Points */}
      {junctionPoints.map((junction) => {
        const junctionX = (junction.position.x / 100) * containerRect.width;
        const junctionY = (junction.position.y / 100) * containerRect.height;
        const isHovered = hoveredJunction === junction.id;

        return (
          <g key={junction.id}>
            {/* Área de hit maior */}
            <circle
              cx={junctionX}
              cy={junctionY}
              r="15"
              fill="transparent"
              className="cursor-move"
              style={{ pointerEvents: "all" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDraggingJunction(junction.id);
              }}
              onMouseEnter={() => setHoveredJunction(junction.id)}
              onMouseLeave={() => setHoveredJunction(null)}
            />

            {/* Ponto visual */}
            <circle
              cx={junctionX}
              cy={junctionY}
              r={isHovered ? "8" : "6"}
              fill="#10b981"
              stroke="#fff"
              strokeWidth="2"
              className="pointer-events-none transition-all"
            />

            {/* Botão remover */}
            {isHovered && onRemoveJunctionPoint && (
              <g
                className="cursor-pointer"
                style={{ pointerEvents: "all" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveJunctionPoint(junction.id);
                }}
              >
                <circle
                  cx={junctionX + 15}
                  cy={junctionY - 15}
                  r="8"
                  fill="#ef4444"
                  className="transition-opacity"
                />
                <line
                  x1={junctionX + 12}
                  y1={junctionY - 15}
                  x2={junctionX + 18}
                  y2={junctionY - 15}
                  stroke="white"
                  strokeWidth="2"
                  className="pointer-events-none"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* Indicador quando está no modo adicionar junction */}
      {modoAdicionarJunction && modoEdicao && (
        <text
          x={containerRect.width / 2}
          y="30"
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          className="fill-green-600 animate-pulse"
        >
          Clique em uma linha para adicionar ponto de junção
        </text>
      )}

      {/* Indicador quando está conectando */}
      {connecting && modoEdicao && !modoAdicionarJunction && (
        <text
          x={containerRect.width / 2}
          y="30"
          textAnchor="middle"
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
