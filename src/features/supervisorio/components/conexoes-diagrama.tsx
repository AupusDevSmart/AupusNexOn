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
        setContainerRect(rect);
      }
    };

    // Delay inicial para garantir que o DOM está completamente renderizado
    const timeoutId = setTimeout(updateContainerRect, 50);
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
    document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
  };
}, [containerRef]);

  if (!containerRect) {
    // console.log('❌ ConexoesDiagrama: containerRect é NULL');
    return null;
  }

  // console.log('✅ ConexoesDiagrama RENDERIZANDO:');
  // console.log('   - Número de conexões:', connections.length);
  // console.log('   - Número de componentes:', componentes.length);
  // console.log('   - Container Width:', containerRect.width);
  // console.log('   - Container Height:', containerRect.height);
  // console.log('   - Modo Edição:', modoEdicao);

  // Log de debug para cada conexão
// connections.forEach((conn, index) => {
//   const fromComp = componentes.find(c => c.id === conn.from);
//   const toComp = componentes.find(c => c.id === conn.to);

//   if (fromComp && toComp) {
//     const fromX = (fromComp.posicao.x / 100) * containerRect.width;
//     const fromY = (fromComp.posicao.y / 100) * containerRect.height;
//     const toX = (toComp.posicao.x / 100) * containerRect.width;
//     const toY = (toComp.posicao.y / 100) * containerRect.height;

//     console.log(`   📍 Conexão ${index + 1}:`, {
//       from: fromComp.nome,
//       to: toComp.nome,
//       fromPos: `(${fromX.toFixed(0)}, ${fromY.toFixed(0)})`,
//       toPos: `(${toX.toFixed(0)}, ${toY.toFixed(0)})`
//     });
//   }
// });


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

        // ===== CALCULAR CAMINHO ORTOGONAL - SEMPRE PERPENDICULAR =====
const calculateOrthogonalPath = () => {
  // DEBUG: Log dos valores para entender o problema (comentado)
  // console.log('🔍 DEBUG Conexão:', {
  //   from: fromComponent.nome,
  //   to: toComponent.nome,
  //   fromPort: connection.fromPort,
  //   toPort: connection.toPort,
  //   centers: {
  //     fromCenter: { x: fromCenterX, y: fromCenterY },
  //     toCenter: { x: toCenterX, y: toCenterY }
  //   },
  //   ports: {
  //     fromPort: { x: fromX, y: fromY },
  //     toPort: { x: toX, y: toY }
  //   },
  //   offsets: {
  //     fromOffset,
  //     toOffset
  //   },
  //   deltas: {
  //     'toX - toCenterX': (toX - toCenterX).toFixed(2),
  //     'toY - toCenterY': (toY - toCenterY).toFixed(2)
  //   }
  // });

  const path: string[] = [];
  const fromPort = connection.fromPort;
  const toPort = connection.toPort;

  // Começar no ponto de origem
  path.push(`M ${fromX} ${fromY}`);

  // Distância mínima de afastamento dos componentes (em pixels)
  const OFFSET = 20;

  // ✅ REGRA PRINCIPAL: Linha SEMPRE chega perpendicular à porta de destino
  // E deve parar EXATAMENTE acima/abaixo/ao lado do centro do equipamento

  // Caso 1: Ambas as portas são verticais (top/bottom)
  if ((fromPort === 'top' || fromPort === 'bottom') &&
      (toPort === 'top' || toPort === 'bottom')) {

    // ✅ USAR toCenterX (centro real) ao invés de toX (porta com offset)!

    // Se estão perfeitamente alinhados verticalmente
    if (Math.abs(fromX - toCenterX) < 5) {
      // Linha reta vertical passando pelo centro
      // console.log('  📐 V->V alinhados: linha reta');
      path.push(`L ${toCenterX} ${toY}`);
    } else {
      // Determinar onde fazer a dobra baseado nas portas
      if (fromPort === 'bottom' && toPort === 'top') {
        // Saindo por baixo, entrando por cima
        const dobra = Math.min(fromY + OFFSET, toY - OFFSET);
        // console.log(`  📐 V->V (bottom->top): dobra=${dobra}, toCenterX=${toCenterX}, toX=${toX}`);
        path.push(`L ${fromX} ${dobra}`);       // Desce um pouco
        path.push(`L ${toCenterX} ${dobra}`);   // Vai para o CENTRO X real do equipamento
        path.push(`L ${toCenterX} ${toY}`);     // Desce reto pelo centro até a porta
      }
      else if (fromPort === 'top' && toPort === 'bottom') {
        // Saindo por cima, entrando por baixo
        const dobra = Math.max(fromY - OFFSET, toY + OFFSET);
        path.push(`L ${fromX} ${dobra}`);       // Sobe um pouco
        path.push(`L ${toCenterX} ${dobra}`);   // Vai para o CENTRO X real
        path.push(`L ${toCenterX} ${toY}`);     // Desce reto pelo centro
      }
      else if (fromPort === 'bottom' && toPort === 'bottom') {
        // Ambos por baixo - fazer arco por baixo
        const dobra = Math.max(fromY, toY) + OFFSET;
        path.push(`L ${fromX} ${dobra}`);       // Desce além dos dois
        path.push(`L ${toCenterX} ${dobra}`);   // Vai para o CENTRO X real
        path.push(`L ${toCenterX} ${toY}`);     // Sobe reto pelo centro
      }
      else if (fromPort === 'top' && toPort === 'top') {
        // Ambos por cima - fazer arco por cima
        const dobra = Math.min(fromY, toY) - OFFSET;
        path.push(`L ${fromX} ${dobra}`);       // Sobe além dos dois
        path.push(`L ${toCenterX} ${dobra}`);   // Vai para o CENTRO X real
        path.push(`L ${toCenterX} ${toY}`);     // Desce reto pelo centro
      }
    }
  }

  // Caso 2: Ambas as portas são horizontais (left/right)
  else if ((fromPort === 'left' || fromPort === 'right') &&
           (toPort === 'left' || toPort === 'right')) {

    // ✅ USAR toCenterY (centro real) ao invés de toY (porta com offset)!

    // Se estão perfeitamente alinhados horizontalmente
    if (Math.abs(fromY - toCenterY) < 5) {
      // Linha reta horizontal passando pelo centro
      path.push(`L ${toX} ${toCenterY}`);
    } else {
      // Determinar onde fazer a dobra baseado nas portas
      if (fromPort === 'right' && toPort === 'left') {
        // Saindo pela direita, entrando pela esquerda
        const dobra = Math.min(fromX + OFFSET, toX - OFFSET);
        path.push(`L ${dobra} ${fromY}`);       // Vai pra direita
        path.push(`L ${dobra} ${toCenterY}`);   // Vai para o CENTRO Y real
        path.push(`L ${toX} ${toCenterY}`);     // Vai reto pelo centro até a porta
      }
      else if (fromPort === 'left' && toPort === 'right') {
        // Saindo pela esquerda, entrando pela direita
        const dobra = Math.max(fromX - OFFSET, toX + OFFSET);
        path.push(`L ${dobra} ${fromY}`);       // Vai pra esquerda
        path.push(`L ${dobra} ${toCenterY}`);   // Vai para o CENTRO Y real
        path.push(`L ${toX} ${toCenterY}`);     // Vai reto pelo centro
      }
      else if (fromPort === 'right' && toPort === 'right') {
        // Ambos pela direita - fazer arco pela direita
        const dobra = Math.max(fromX, toX) + OFFSET;
        path.push(`L ${dobra} ${fromY}`);       // Vai além dos dois
        path.push(`L ${dobra} ${toCenterY}`);   // Vai para o CENTRO Y real
        path.push(`L ${toX} ${toCenterY}`);     // Volta pelo centro
      }
      else if (fromPort === 'left' && toPort === 'left') {
        // Ambos pela esquerda - fazer arco pela esquerda
        const dobra = Math.min(fromX, toX) - OFFSET;
        path.push(`L ${dobra} ${fromY}`);       // Vai além dos dois
        path.push(`L ${dobra} ${toCenterY}`);   // Vai para o CENTRO Y real
        path.push(`L ${toX} ${toCenterY}`);     // Volta pelo centro
      }
    }
  }

  // Caso 3: Origem horizontal (left/right) → Destino vertical (top/bottom)
  else if ((fromPort === 'left' || fromPort === 'right') &&
           (toPort === 'top' || toPort === 'bottom')) {

    // ✅ Usar toCenterX para linha descer pelo centro
    // console.log(`  📐 H->V: fromPort=${fromPort}, toPort=${toPort}`);
    // console.log(`    Usando toCenterX=${toCenterX} (centro) ao invés de toX=${toX}`);
    // console.log(`    Path: M ${fromX} ${fromY} -> L ${toCenterX} ${fromY} -> L ${toCenterX} ${toY}`);

    // Caminho simples em L - horizontal depois vertical
    path.push(`L ${toCenterX} ${fromY}`);    // Vai horizontal até o centro X do destino
    path.push(`L ${toCenterX} ${toY}`);      // Desce/sobe pelo centro até a porta
  }

  // Caso 4: Origem vertical (top/bottom) → Destino horizontal (left/right)
  else if ((fromPort === 'top' || fromPort === 'bottom') &&
           (toPort === 'left' || toPort === 'right')) {

    // ✅ Usar toCenterY para linha ir pelo centro
    // Caminho simples em L - vertical depois horizontal
    path.push(`L ${fromX} ${toCenterY}`);    // Desce/sobe até o centro Y do destino
    path.push(`L ${toX} ${toCenterY}`);      // Vai horizontal pelo centro até a porta
  }

  const finalPath = path.join(' ');
  // console.log(`  ✅ Path final: ${finalPath}`);
  // console.log('---');
  return finalPath;
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
              className={`${connectionStyle.stroke} cursor-pointer transition-all`}
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
                  x={(fromX + toX) / 2 - 70}
                  y={(fromY + toY) / 2 - 20}
                  width="140"
                  height="40"
                  rx="4"
                  className="fill-background stroke-border"
                  strokeWidth="1"
                />
                <text
                  x={(fromX + toX) / 2}
                  y={(fromY + toY) / 2 - 5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9"
                  className="fill-foreground"
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
                  className="fill-muted-foreground"
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
          className="fill-amber-600 animate-pulse"
        >
          Clique em outro componente para completar a conexão
        </text>
      )}
    </svg>
  );
}
