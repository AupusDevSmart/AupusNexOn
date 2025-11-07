// src/features/supervisorio/components/connections-overlay.tsx
// ✅ COMPONENTE REESCRITO COM ARQUITETURA ROBUSTA
import { useEffect, useRef, useState, useCallback } from "react";

// ========== INTERFACES ==========
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

interface ConnectionsOverlayProps {
  connections: Connection[];
  componentes: ComponenteDU[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  modoEdicao?: boolean;
  connecting?: { from: string; port: string } | null;
  onRemoverConexao?: (connectionId: string) => void;
  onEdgeClick?: (event: React.MouseEvent, connection: Connection) => void;
}

// ========== TIPOS AUXILIARES ==========
interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface PathCoordinates {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  pathData: string;
}

// ========== FUNÇÕES AUXILIARES ==========

/**
 * Obtém o retângulo de um nó usando data-node-id
 * ✅ Usa getBoundingClientRect() para posições REAIS no DOM
 */
const getNodeRect = (
  containerId: string,
  nodeId: string
): NodeRect | null => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const nodeElement = container.querySelector(`[data-node-id="${nodeId}"]`);
  if (!nodeElement) {
    console.warn(`⚠️ Nó não encontrado: ${nodeId}`);
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const nodeRect = nodeElement.getBoundingClientRect();

  // Calcular posição relativa ao container
  const relativeX = nodeRect.left - containerRect.left;
  const relativeY = nodeRect.top - containerRect.top;

  return {
    x: relativeX,
    y: relativeY,
    width: nodeRect.width,
    height: nodeRect.height,
    centerX: relativeX + nodeRect.width / 2,
    centerY: relativeY + nodeRect.height / 2,
  };
};

/**
 * Calcula o offset da porta baseado na direção
 */
const getPortOffset = (
  rect: NodeRect,
  port: "top" | "bottom" | "left" | "right"
): { x: number; y: number } => {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  switch (port) {
    case "top":
      return { x: rect.centerX, y: rect.y };
    case "bottom":
      return { x: rect.centerX, y: rect.y + rect.height };
    case "left":
      return { x: rect.x, y: rect.centerY };
    case "right":
      return { x: rect.x + rect.width, y: rect.centerY };
    default:
      return { x: rect.centerX, y: rect.centerY };
  }
};

/**
 * Gera path SVG ortogonal (linhas retas horizontais/verticais)
 */
const generateOrthogonalPath = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromPort: string,
  toPort: string
): string => {
  const path: string[] = [];
  path.push(`M ${fromX} ${fromY}`);

  const deltaX = Math.abs(toX - fromX);
  const deltaY = Math.abs(toY - fromY);

  // Linhas quase alinhadas verticalmente
  if (
    deltaX < 10 &&
    (fromPort === "top" || fromPort === "bottom") &&
    (toPort === "top" || toPort === "bottom")
  ) {
    const avgX = (fromX + toX) / 2;
    path.push(`L ${avgX} ${fromY}`);
    path.push(`L ${avgX} ${toY}`);
    path.push(`L ${toX} ${toY}`);
  }
  // Linhas quase alinhadas horizontalmente
  else if (
    deltaY < 10 &&
    (fromPort === "left" || fromPort === "right") &&
    (toPort === "left" || toPort === "right")
  ) {
    const avgY = (fromY + toY) / 2;
    path.push(`L ${fromX} ${avgY}`);
    path.push(`L ${toX} ${avgY}`);
    path.push(`L ${toX} ${toY}`);
  }
  // Conexões verticais
  else if (
    (fromPort === "top" || fromPort === "bottom") &&
    (toPort === "top" || toPort === "bottom")
  ) {
    const midY = (fromY + toY) / 2;
    path.push(`L ${fromX} ${midY}`);
    path.push(`L ${toX} ${midY}`);
    path.push(`L ${toX} ${toY}`);
  }
  // Conexões horizontais
  else if (
    (fromPort === "left" || fromPort === "right") &&
    (toPort === "left" || toPort === "right")
  ) {
    const midX = (fromX + toX) / 2;
    path.push(`L ${midX} ${fromY}`);
    path.push(`L ${midX} ${toY}`);
    path.push(`L ${toX} ${toY}`);
  }
  // Conexões mistas (perpendiculares)
  else {
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

/**
 * Obtém cor do stroke baseado no status dos componentes
 */
const getConnectionStyle = (
  fromComponent: ComponenteDU,
  toComponent: ComponenteDU
) => {
  const hasError =
    fromComponent.status === "FALHA" || toComponent.status === "FALHA";
  const hasWarning =
    fromComponent.status === "ALARME" || toComponent.status === "ALARME";

  if (hasError) {
    return { stroke: "#ef4444", strokeWidth: "3", opacity: "0.9" };
  } else if (hasWarning) {
    return { stroke: "#f59e0b", strokeWidth: "3", opacity: "0.9" };
  } else {
    return { stroke: "#3b82f6", strokeWidth: "3", opacity: "1" };
  }
};

// ========== COMPONENTE PRINCIPAL ==========
export function ConnectionsOverlay({
  connections,
  componentes,
  containerRef,
  modoEdicao = false,
  connecting = null,
  onRemoverConexao,
  onEdgeClick,
}: ConnectionsOverlayProps) {
  const [paths, setPaths] = useState<Map<string, PathCoordinates>>(new Map());
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containerIdRef = useRef<string>(`container-${Date.now()}`);

  // ✅ FUNÇÃO PARA CALCULAR TODAS AS CONEXÕES
  const calculatePaths = useCallback(() => {
    if (!containerRef.current) return;

    const newPaths = new Map<string, PathCoordinates>();
    const containerId = containerIdRef.current;

    // Adicionar ID ao container se ainda não tiver
    if (containerRef.current && !containerRef.current.id) {
      containerRef.current.id = containerId;
    }

    connections.forEach((connection) => {
      const fromComponent = componentes.find((c) => c.id === connection.from);
      const toComponent = componentes.find((c) => c.id === connection.to);

      if (!fromComponent || !toComponent) return;

      // ✅ OBTER POSIÇÕES REAIS DOS NÓS VIA getBoundingClientRect()
      const fromRect = getNodeRect(containerId, connection.from);
      const toRect = getNodeRect(containerId, connection.to);

      if (!fromRect || !toRect) return;

      // Calcular posições das portas
      const fromPos = getPortOffset(fromRect, connection.fromPort);
      const toPos = getPortOffset(toRect, connection.toPort);

      // Gerar path SVG
      const pathData = generateOrthogonalPath(
        fromPos.x,
        fromPos.y,
        toPos.x,
        toPos.y,
        connection.fromPort,
        connection.toPort
      );

      newPaths.set(connection.id, {
        fromX: fromPos.x,
        fromY: fromPos.y,
        toX: toPos.x,
        toY: toPos.y,
        pathData,
      });
    });

    setPaths(newPaths);
  }, [connections, componentes, containerRef]);

  // ✅ ANIMATION FRAME LOOP PARA ATUALIZAÇÃO CONTÍNUA
  useEffect(() => {
    const animate = () => {
      calculatePaths();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [calculatePaths]);

  // ✅ RESIZE OBSERVER - Detecta mudanças de tamanho do container
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      console.log("📏 ResizeObserver: Container redimensionado");
      calculatePaths();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, calculatePaths]);

  // ✅ MUTATION OBSERVER - Detecta mudanças no DOM (adição/remoção de nós)
  useEffect(() => {
    if (!containerRef.current) return;

    const mutationObserver = new MutationObserver(() => {
      console.log("🔄 MutationObserver: DOM modificado");
      calculatePaths();
    });

    mutationObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => {
      mutationObserver.disconnect();
    };
  }, [containerRef, calculatePaths]);

  // ✅ LISTENER DE FULLSCREEN
  useEffect(() => {
    const handleFullscreenChange = () => {
      console.log("🖥️ Fullscreen mudou:", !!document.fullscreenElement);
      // Aguardar layout estabilizar
      setTimeout(calculatePaths, 100);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [calculatePaths]);

  // ✅ RENDERIZAR SVG
  if (!containerRef.current || paths.size === 0) {
    return null;
  }

  const containerRect = containerRef.current.getBoundingClientRect();

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${containerRect.width} ${containerRect.height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        pointerEvents: modoEdicao ? "auto" : "none",
        zIndex: 20,
        opacity: 1,
        overflow: "visible",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    >
      {/* Definições de markers para setas */}
      <defs>
        <marker
          id="arrowhead-blue"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
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

      {/* Renderizar todas as conexões */}
      {Array.from(paths.entries()).map(([connectionId, coords]) => {
        const connection = connections.find((c) => c.id === connectionId);
        if (!connection) return null;

        const fromComponent = componentes.find((c) => c.id === connection.from);
        const toComponent = componentes.find((c) => c.id === connection.to);
        if (!fromComponent || !toComponent) return null;

        const style = getConnectionStyle(fromComponent, toComponent);
        const isHovered = hoveredConnection === connectionId;

        return (
          <g key={connectionId}>
            {/* ✅ PATH PRINCIPAL COM PROPRIEDADES OBRIGATÓRIAS */}
            <path
              d={coords.pathData}
              stroke={style.stroke}
              strokeWidth={isHovered ? "5" : style.strokeWidth}
              opacity={style.opacity}
              fill="none"
              vectorEffect="non-scaling-stroke"
              className="transition-all duration-200"
              style={{
                pointerEvents: modoEdicao ? "stroke" : "none",
              }}
              onMouseEnter={() => setHoveredConnection(connectionId)}
              onMouseLeave={() => setHoveredConnection(null)}
              onClick={(e) => {
                if (!modoEdicao) return;

                if (e.ctrlKey && onEdgeClick) {
                  e.stopPropagation();
                  onEdgeClick(e, connection);
                } else if (onRemoverConexao) {
                  if (window.confirm("Deseja remover esta conexão?")) {
                    onRemoverConexao(connectionId);
                  }
                }
              }}
            />

            {/* ✅ CÍRCULOS DE CONEXÃO */}
            <circle
              cx={coords.fromX}
              cy={coords.fromY}
              r="4"
              fill={style.stroke}
              opacity="0.8"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "none" }}
            />
            <circle
              cx={coords.toX}
              cy={coords.toY}
              r="4"
              fill={style.stroke}
              opacity="0.8"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "none" }}
            />

            {/* Label de hover (apenas em modo edição) */}
            {modoEdicao && isHovered && (
              <g>
                <rect
                  x={(coords.fromX + coords.toX) / 2 - 70}
                  y={(coords.fromY + coords.toY) / 2 - 20}
                  width="140"
                  height="40"
                  rx="4"
                  fill="rgba(0, 0, 0, 0.9)"
                  stroke="#3b82f6"
                  strokeWidth="1"
                />
                <text
                  x={(coords.fromX + coords.toX) / 2}
                  y={(coords.fromY + coords.toY) / 2 - 5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fill="white"
                  style={{ pointerEvents: "none" }}
                >
                  Clique para remover
                </text>
                <text
                  x={(coords.fromX + coords.toX) / 2}
                  y={(coords.fromY + coords.toY) / 2 + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="8"
                  fill="#94a3b8"
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
