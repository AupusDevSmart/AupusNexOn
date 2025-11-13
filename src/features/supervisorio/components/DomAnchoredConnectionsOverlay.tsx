/**
 * DomAnchoredConnectionsOverlay.tsx
 *
 * Componente SVG que renderiza linhas de conexão entre nós de um diagrama unifilar.
 *
 * CARACTERÍSTICAS:
 * - Mede posições reais via getBoundingClientRect() usando data-node-id
 * - Atualização contínua via requestAnimationFrame (~60 FPS)
 * - ResizeObserver para detectar mudanças de tamanho
 * - MutationObserver para detectar adição/remoção de nós
 * - Funciona em todos os modos: normal, fullscreen, pan, zoom
 *
 * PERFORMANCE & RESOURCE MANAGEMENT:
 * - cancelAnimationFrame() no unmount (evita memory leaks)
 * - ResizeObserver.disconnect() no cleanup
 * - MutationObserver.disconnect() no cleanup
 * - Guard para abas ocultas: pula cálculos quando document.hidden === true
 * - Debounce via RAF: reduz custo em resize/mutation rápidos
 *
 * HARDENING & ROBUSTEZ:
 * - Validação de dimensões: não renderiza SVG se width/height <= 0
 * - Validação de nós: ignora conexões com componentes ausentes (evita paths fantasmas)
 * - Validação de DOM: ignora nós sem getBoundingClientRect() válido
 * - Logs de diagnóstico para debugging de conexões inválidas
 *
 * CSS & STYLING:
 * - Classes previsíveis: .nexon-connections-overlay, .nexon-connection-path
 * - SEM !important - CSS limpo e previsível
 * - Dark mode support via html.dark .nexon-connection-path
 * - Estrutura: <svg><g data-layer="connections"><path /></g></svg>
 * - Estilos definidos em DomAnchoredConnectionsOverlay.css
 *
 * DEBUG MODE:
 * - Desabilitado automaticamente em produção
 * - Para ativar em desenvolvimento: window.NEXON_DEBUG = true no console
 * - Para desativar: window.NEXON_DEBUG = false
 *
 * @author NexON - Sistema de Monitoramento
 * @version 2.2.0
 */

import { useEffect, useRef, useState, useCallback } from "react";
import "./DomAnchoredConnectionsOverlay.css";

// ========================================
// DEBUG CONFIGURATION
// ========================================

/**
 * Flag de debug - Desabilita logs em produção
 * Pode ser ativado manualmente no console: window.NEXON_DEBUG = true
 */
const DEBUG = false;

/**
 * Helper para logs condicionais
 */
const debugLog = {
  group: (label: string) => {
    if (DEBUG) console.group(label);
  },
  groupCollapsed: (label: string) => {
    if (DEBUG) console.groupCollapsed(label);
  },
  groupEnd: () => {
    if (DEBUG) console.groupEnd();
  },
  log: (...args: any[]) => {
    if (DEBUG) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (DEBUG) console.warn(...args);
  },
  error: (...args: any[]) => {
    if (DEBUG) console.error(...args);
  },
  table: (data: any) => {
    if (DEBUG) console.table(data);
  },
};

// ========================================
// INTERFACES E TIPOS
// ========================================

export interface ComponenteDU {
  id: string;
  tipo: string;
  nome: string;
  posicao: { x: number; y: number };
  status: string;
  dados: any;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort: "top" | "bottom" | "left" | "right";
  toPort: "top" | "bottom" | "left" | "right";
}

export interface DomAnchoredConnectionsOverlayProps {
  connections: Connection[];
  componentes: ComponenteDU[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  modoEdicao?: boolean;
  connecting?: { from: string; port: string } | null;
  onRemoverConexao?: (connectionId: string) => void;
  onEdgeClick?: (event: React.MouseEvent, connection: Connection) => void;
  isFullscreen?: boolean;
}

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

interface ConnectionStyle {
  stroke: string;
  strokeWidth: string;
  opacity: string;
  markerId: string;
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Obtém o retângulo de um nó usando data-node-id
 * @param containerId ID do container
 * @param nodeId ID do nó (deve ter data-node-id)
 * @returns Retângulo com posições relativas ao container
 */
const getNodeRect = (
  containerId: string,
  nodeId: string
): NodeRect | null => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const nodeElement = container.querySelector(`[data-node-id="${nodeId}"]`);
  if (!nodeElement) return null;

  const containerRect = container.getBoundingClientRect();
  const nodeRect = nodeElement.getBoundingClientRect();

  // Posição relativa ao container
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
 * Gera path SVG ortogonal (linhas retas em ângulos de 90°)
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
  path.push(`M ${fromX.toFixed(2)} ${fromY.toFixed(2)}`);

  const deltaX = Math.abs(toX - fromX);
  const deltaY = Math.abs(toY - fromY);

  // Componentes quase alinhados verticalmente
  if (
    deltaX < 10 &&
    (fromPort === "top" || fromPort === "bottom") &&
    (toPort === "top" || toPort === "bottom")
  ) {
    const avgX = (fromX + toX) / 2;
    path.push(`L ${avgX.toFixed(2)} ${fromY.toFixed(2)}`);
    path.push(`L ${avgX.toFixed(2)} ${toY.toFixed(2)}`);
    path.push(`L ${toX.toFixed(2)} ${toY.toFixed(2)}`);
  }
  // Componentes quase alinhados horizontalmente
  else if (
    deltaY < 10 &&
    (fromPort === "left" || fromPort === "right") &&
    (toPort === "left" || toPort === "right")
  ) {
    const avgY = (fromY + toY) / 2;
    path.push(`L ${fromX.toFixed(2)} ${avgY.toFixed(2)}`);
    path.push(`L ${toX.toFixed(2)} ${avgY.toFixed(2)}`);
    path.push(`L ${toX.toFixed(2)} ${toY.toFixed(2)}`);
  }
  // Conexões verticais (top/bottom → top/bottom)
  else if (
    (fromPort === "top" || fromPort === "bottom") &&
    (toPort === "top" || toPort === "bottom")
  ) {
    const midY = (fromY + toY) / 2;
    path.push(`L ${fromX.toFixed(2)} ${midY.toFixed(2)}`);
    path.push(`L ${toX.toFixed(2)} ${midY.toFixed(2)}`);
    path.push(`L ${toX.toFixed(2)} ${toY.toFixed(2)}`);
  }
  // Conexões horizontais (left/right → left/right)
  else if (
    (fromPort === "left" || fromPort === "right") &&
    (toPort === "left" || toPort === "right")
  ) {
    const midX = (fromX + toX) / 2;
    path.push(`L ${midX.toFixed(2)} ${fromY.toFixed(2)}`);
    path.push(`L ${midX.toFixed(2)} ${toY.toFixed(2)}`);
    path.push(`L ${toX.toFixed(2)} ${toY.toFixed(2)}`);
  }
  // Conexões mistas (perpendiculares)
  else {
    if (fromPort === "right" || fromPort === "left") {
      const midX =
        fromPort === "right"
          ? Math.max(fromX, toX) + 20
          : Math.min(fromX, toX) - 20;
      path.push(`L ${midX.toFixed(2)} ${fromY.toFixed(2)}`);
      path.push(`L ${midX.toFixed(2)} ${toY.toFixed(2)}`);
    } else {
      const midY =
        fromPort === "bottom"
          ? Math.max(fromY, toY) + 20
          : Math.min(fromY, toY) - 20;
      path.push(`L ${fromX.toFixed(2)} ${midY.toFixed(2)}`);
      path.push(`L ${toX.toFixed(2)} ${midY.toFixed(2)}`);
    }
    path.push(`L ${toX.toFixed(2)} ${toY.toFixed(2)}`);
  }

  return path.join(" ");
};

/**
 * Obtém estilo da conexão baseado no status dos componentes
 */
const getConnectionStyle = (
  fromComponent: ComponenteDU,
  toComponent: ComponenteDU
): ConnectionStyle => {
  const hasError =
    fromComponent.status === "FALHA" || toComponent.status === "FALHA";
  const hasWarning =
    fromComponent.status === "ALARME" || toComponent.status === "ALARME";

  if (hasError) {
    return {
      stroke: "#ef4444",
      strokeWidth: "3",
      opacity: "0.9",
      markerId: "arrowhead-error",
    };
  } else if (hasWarning) {
    return {
      stroke: "#f59e0b",
      strokeWidth: "3",
      opacity: "0.9",
      markerId: "arrowhead-warning",
    };
  } else {
    return {
      stroke: "#3b82f6",
      strokeWidth: "3",
      opacity: "1",
      markerId: "arrowhead-blue",
    };
  }
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

export function DomAnchoredConnectionsOverlay({
  connections,
  componentes,
  containerRef,
  modoEdicao = false,
  connecting = null,
  onRemoverConexao,
  onEdgeClick,
  isFullscreen = false,
}: DomAnchoredConnectionsOverlayProps) {
  // ========== STATE ==========
  const [paths, setPaths] = useState<Map<string, PathCoordinates>>(new Map());
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  // ========== REFS ==========
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containerIdRef = useRef<string>(`nexon-diagram-${Date.now()}`);
  const lastDiagnosticLogRef = useRef<number>(0); // Throttle diagnostic logs
  const scheduleRef = useRef<number | null>(null); // Debounce RAF

  // ========== DEBOUNCE HELPER ==========
  /**
   * Debounce leve via requestAnimationFrame
   * Evita múltiplos cálculos em resize/mutation rápidos
   */
  const scheduleCalculation = useCallback((fn: () => void) => {
    if (scheduleRef.current) {
      cancelAnimationFrame(scheduleRef.current);
    }
    scheduleRef.current = requestAnimationFrame(fn);
  }, []);

  // ========== CALCULAR PATHS ==========
  const calculatePaths = useCallback(() => {
    if (!containerRef.current) {
      debugLog.warn('⚠️ DomAnchoredConnectionsOverlay: containerRef.current is null');
      return;
    }

    // Atualizar dimensões do container
    const rect = containerRef.current.getBoundingClientRect();

    // 🛡️ HARDENING: Não renderizar SVG com dimensões inválidas
    if (rect.width <= 0 || rect.height <= 0) {
      debugLog.warn('⚠️ Container tem dimensões inválidas:', {
        width: rect.width,
        height: rect.height,
      });
      return;
    }

    setContainerDimensions({ width: rect.width, height: rect.height });

    // ✅ USAR O ID EXISTENTE DO CONTAINER OU ADICIONAR UM SE NÃO EXISTIR
    let containerId = containerRef.current.id;
    if (!containerId) {
      containerId = containerIdRef.current;
      containerRef.current.id = containerId;
      debugLog.log('✅ DomAnchoredConnectionsOverlay: Assigned container ID:', containerId);
    }

    // 🔍 DIAGNÓSTICO: Verificar hierarquia e elementos (throttled a 1x por segundo)
    const now = Date.now();
    if (connections.length > 0 && now - lastDiagnosticLogRef.current > 1000) {
      lastDiagnosticLogRef.current = now;

      const firstConnection = connections[0];
      const container = document.getElementById(containerId);
      const nodeElement = container?.querySelector(`[data-node-id="${firstConnection.from}"]`);

      debugLog.groupCollapsed('🔬 DomAnchoredConnectionsOverlay - Diagnóstico de Hierarquia');

      if (!container) {
        debugLog.error('❌ Container não encontrado com ID:', containerId);
      } else if (!nodeElement) {
        debugLog.warn('⚠️ Nó não encontrado:', firstConnection.from);
        debugLog.log('📦 Container:', container);
        debugLog.log('👶 Container children:', container.children.length);
        debugLog.log('🔍 Procurando data-node-id:', firstConnection.from);

        // Listar todos os elementos com data-node-id
        const allNodes = container.querySelectorAll('[data-node-id]');
        debugLog.log('📊 Nós encontrados com data-node-id:', allNodes.length);
        if (allNodes.length === 0) {
          debugLog.error('❌ PROBLEMA: Nenhum elemento com data-node-id encontrado no container!');
          debugLog.log('💡 Possível causa: Nós não renderizados ou em container diferente');
        } else {
          allNodes.forEach((node, idx) => {
            debugLog.log(`   [${idx}] data-node-id="${node.getAttribute('data-node-id')}"`);
          });
        }
      } else {
        const nodeRect = nodeElement.getBoundingClientRect();
        debugLog.log('✅ Nó encontrado com sucesso:', firstConnection.from);
        debugLog.log('📐 Dimensões:', {
          nodeRect: { width: nodeRect.width, height: nodeRect.height },
          containerRect: { width: rect.width, height: rect.height }
        });
      }

      debugLog.log('📊 Total de conexões:', connections.length);
      debugLog.log('📊 Total de componentes:', componentes.length);
      debugLog.groupEnd();
    }

    const newPaths = new Map<string, PathCoordinates>();

    connections.forEach((connection) => {
      const fromComponent = componentes.find((c) => c.id === connection.from);
      const toComponent = componentes.find((c) => c.id === connection.to);

      // 🛡️ HARDENING: Ignorar conexões com nós ausentes (evita paths "fantasmas")
      if (!fromComponent || !toComponent) {
        debugLog.warn('⚠️ Conexão ignorada - componente não encontrado:', {
          connectionId: connection.id,
          from: connection.from,
          to: connection.to,
          fromExists: !!fromComponent,
          toExists: !!toComponent,
        });
        return;
      }

      // Obter posições reais dos nós
      const fromRect = getNodeRect(containerId, connection.from);
      const toRect = getNodeRect(containerId, connection.to);

      // 🛡️ HARDENING: Ignorar se nós não têm rect válido no DOM
      if (!fromRect || !toRect) {
        debugLog.warn('⚠️ Conexão ignorada - nó não encontrado no DOM:', {
          connectionId: connection.id,
          from: connection.from,
          to: connection.to,
          fromRectExists: !!fromRect,
          toRectExists: !!toRect,
        });
        return;
      }

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

  // ========== FORCE RECALC WHEN CONTAINER REF CHANGES ==========
  useEffect(() => {
    if (containerRef.current) {
      calculatePaths();
    }
  }, [containerRef.current, calculatePaths]);

  // ========== ANIMATION FRAME LOOP ==========
  useEffect(() => {
    const animate = () => {
      // ⚡ PERFORMANCE: Pular trabalho pesado quando aba está oculta
      if (document.hidden) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      calculatePaths();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      // Cleanup animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Cleanup debounce schedule
      if (scheduleRef.current) {
        cancelAnimationFrame(scheduleRef.current);
      }
    };
  }, [calculatePaths]);

  // ========== RESIZE OBSERVER ==========
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // 🛡️ HARDENING: Debounce via RAF para reduzir custo em resize rápido
      scheduleCalculation(calculatePaths);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, calculatePaths, scheduleCalculation]);

  // ========== MUTATION OBSERVER ==========
  useEffect(() => {
    if (!containerRef.current) return;

    const mutationObserver = new MutationObserver(() => {
      // 🛡️ HARDENING: Debounce via RAF para reduzir custo em mutações rápidas
      scheduleCalculation(calculatePaths);
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
  }, [containerRef, calculatePaths, scheduleCalculation]);

  // ========== FULLSCREEN LISTENER ==========
  useEffect(() => {
    const handleFullscreenChange = () => {
      setTimeout(() => {
        calculatePaths();
      }, 100);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
    };
  }, [calculatePaths, connections.length, componentes.length]);

  // ========== 🔍 DIAGNÓSTICO DE VISIBILIDADE SVG/PATH ==========
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!svgRef.current) {
        debugLog.warn('⚠️ SVG Ref não disponível');
        return;
      }

      const svg = svgRef.current;
      const svgComputedStyle = window.getComputedStyle(svg);
      const firstPath = svg.querySelector('path.nexon-connection-path');

      debugLog.groupCollapsed('🔍 DIAGNÓSTICO DE VISIBILIDADE - SVG & PATHS');

      // SVG Element
      debugLog.log('📊 SVG Element:', {
        existe: !!svg,
        className: svg.className.baseVal || svg.className,
        viewBox: svg.getAttribute('viewBox'),
      });

      // SVG Computed Style
      debugLog.log('🎨 SVG Computed Style:', {
        display: svgComputedStyle.display,
        visibility: svgComputedStyle.visibility,
        opacity: svgComputedStyle.opacity,
        position: svgComputedStyle.position,
        zIndex: svgComputedStyle.zIndex,
        pointerEvents: svgComputedStyle.pointerEvents,
        width: svgComputedStyle.width,
        height: svgComputedStyle.height,
      });

      // SVG Bounding Rect
      const svgRect = svg.getBoundingClientRect();
      debugLog.log('📐 SVG Bounding Rect:', {
        width: svgRect.width.toFixed(1),
        height: svgRect.height.toFixed(1),
        x: svgRect.x.toFixed(1),
        y: svgRect.y.toFixed(1),
        isVisible: svgRect.width > 0 && svgRect.height > 0,
      });

      // Paths
      const allPaths = svg.querySelectorAll('path.nexon-connection-path');
      debugLog.log('🔗 Total de Paths encontrados:', allPaths.length);

      if (firstPath) {
        const pathComputedStyle = window.getComputedStyle(firstPath);
        const pathRect = firstPath.getBoundingClientRect();

        debugLog.log('🎯 Primeiro Path - Atributos:', {
          d: firstPath.getAttribute('d')?.substring(0, 50) + '...',
          stroke: firstPath.getAttribute('stroke'),
          strokeWidth: firstPath.getAttribute('strokeWidth'),
          opacity: firstPath.getAttribute('opacity'),
          fill: firstPath.getAttribute('fill'),
        });

        debugLog.log('🎨 Primeiro Path - Computed Style:', {
          stroke: pathComputedStyle.stroke,
          strokeWidth: pathComputedStyle.strokeWidth,
          opacity: pathComputedStyle.opacity,
          fill: pathComputedStyle.fill,
          display: pathComputedStyle.display,
          visibility: pathComputedStyle.visibility,
          pointerEvents: pathComputedStyle.pointerEvents,
        });

        debugLog.log('📐 Primeiro Path - Bounding Rect:', {
          width: pathRect.width.toFixed(1),
          height: pathRect.height.toFixed(1),
          x: pathRect.x.toFixed(1),
          y: pathRect.y.toFixed(1),
        });

        // ✅ Verificações de Visibilidade
        const checks = {
          'SVG existe': !!svg,
          'SVG tem dimensões': svgRect.width > 0 && svgRect.height > 0,
          'SVG display !== none': svgComputedStyle.display !== 'none',
          'SVG visibility !== hidden': svgComputedStyle.visibility !== 'hidden',
          'SVG opacity > 0': parseFloat(svgComputedStyle.opacity) > 0,
          'Path existe': !!firstPath,
          'Path tem atributo d': !!firstPath.getAttribute('d'),
          'Path stroke definido': !!pathComputedStyle.stroke && pathComputedStyle.stroke !== 'none',
          'Path strokeWidth > 0': parseFloat(pathComputedStyle.strokeWidth) > 0,
          'Path opacity > 0': parseFloat(pathComputedStyle.opacity) > 0,
          'Path display !== none': pathComputedStyle.display !== 'none',
          'Path visibility !== hidden': pathComputedStyle.visibility !== 'hidden',
        };

        debugLog.log('\n✅ Checklist de Visibilidade:');
        Object.entries(checks).forEach(([check, passed]) => {
          debugLog.log(`  ${passed ? '✅' : '❌'} ${check}`);
        });

        const allPassed = Object.values(checks).every(v => v);
        if (allPassed) {
          debugLog.log('\n🎉 TODOS OS CHECKS PASSARAM - Paths DEVEM estar visíveis!');
        } else {
          debugLog.error('\n❌ PROBLEMA DETECTADO - Algum check falhou!');
        }
      } else {
        debugLog.warn('⚠️ Nenhum path encontrado no SVG!');
        debugLog.log('💡 Verifique se paths estão sendo renderizados (componentes/conexões)');
      }

      debugLog.groupEnd();
    }, 200); // Delay para garantir renderização completa

    return () => clearTimeout(timeout);
  }, [paths, connections, componentes]);


  // ========== RENDER ==========
  // Não renderizar se não houver dimensões válidas E não houver paths calculados
  if ((containerDimensions.width === 0 || containerDimensions.height === 0) && paths.size === 0) {
    return null;
  }

  // Usar dimensões calculadas ou mínimas se não houver
  const svgWidth = containerDimensions.width || 1920;
  const svgHeight = containerDimensions.height || 1080;

  return (
    <svg
      ref={svgRef}
      className="nexon-connections-overlay"
      data-edit-mode={modoEdicao}
      data-fullscreen={isFullscreen}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ========== DEFS (MARKERS) ========== */}
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

      {/* ========== CONEXÕES ========== */}
      <g data-layer="connections">
        {Array.from(paths.entries()).map(([connectionId, coords]) => {
        const connection = connections.find((c) => c.id === connectionId);
        if (!connection) return null;

        const fromComponent = componentes.find((c) => c.id === connection.from);
        const toComponent = componentes.find((c) => c.id === connection.to);
        if (!fromComponent || !toComponent) return null;

        const style = getConnectionStyle(fromComponent, toComponent);
        const isHovered = hoveredConnection === connectionId;

        return (
          <g key={connectionId} className="nexon-connection-group">
            {/* PATH PRINCIPAL */}
            <path
              className="nexon-connection-path"
              d={coords.pathData}
              stroke={style.stroke !== "#3b82f6" ? style.stroke : undefined}
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

            {/* CÍRCULOS DE CONEXÃO - Apenas no modo de edição */}
            {modoEdicao && (
              <>
                <circle
                  className="nexon-connection-point"
                  cx={coords.fromX}
                  cy={coords.fromY}
                  r="4"
                  fill={style.stroke}
                  style={{ pointerEvents: 'none' }}
                />
                <circle
                  className="nexon-connection-point"
                  cx={coords.toX}
                  cy={coords.toY}
                  r="4"
                  fill={style.stroke}
                  style={{ pointerEvents: 'none' }}
                />
              </>
            )}

          </g>
        );
      })}
      </g>

      {/* ========== INDICADOR DE CONEXÃO EM ANDAMENTO ========== */}
      {connecting && modoEdicao && (
        <text
          x={containerDimensions.width / 2}
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

export default DomAnchoredConnectionsOverlay;
