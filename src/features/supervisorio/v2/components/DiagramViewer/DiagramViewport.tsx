/**
 * DIAGRAM VIEWPORT - Container com Zoom e Pan
 *
 * Responsabilidades:
 * - Renderiza SVG com tamanho fixo (1920x1080)
 * - Implementa zoom com mouse wheel
 * - Implementa pan com click+drag
 * - Renderiza grid de fundo
 * - Aplica transformações CSS (translate + scale)
 */

import React, { useRef, useCallback, useEffect, MouseEvent } from 'react';
import { useDiagramStore } from '../../hooks/useDiagramStore';
import { CANVAS, GRID, VIEWPORT, getThemeColors, pixelsToGrid } from '../../utils/diagramConstants';
import './DiagramViewport.css';

interface DiagramViewportProps {
  children: React.ReactNode;
  onBackgroundClick?: () => void;
}

export const DiagramViewport: React.FC<DiagramViewportProps> = ({ children, onBackgroundClick }) => {
  const viewport = useDiagramStore(state => state.viewport);
  const theme = useDiagramStore(state => state.theme);
  const editor = useDiagramStore(state => state.editor);
  const equipamentos = useDiagramStore(state => state.equipamentos);
  const setZoom = useDiagramStore(state => state.setZoom);
  const setPan = useDiagramStore(state => state.setPan);
  const startViewportDrag = useDiagramStore(state => state.startViewportDrag);
  const endViewportDrag = useDiagramStore(state => state.endViewportDrag);
  const updateEquipamentoPosition = useDiagramStore(state => state.updateEquipamentoPosition);
  const endDraggingEquipamento = useDiagramStore(state => state.endDraggingEquipamento);

  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const themeColors = getThemeColors(theme);

  // ==========================================================================
  // ZOOM (MOUSE WHEEL) - Usar listener nativo para evitar passive event error
  // ==========================================================================

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();

      const delta = e.deltaY > 0 ? -VIEWPORT.ZOOM_STEP : VIEWPORT.ZOOM_STEP;
      const newScale = viewport.scale + delta;

      setZoom(newScale);
    };

    // Adicionar listener com { passive: false } para permitir preventDefault
    svg.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      svg.removeEventListener('wheel', handleWheel);
    };
  }, [viewport.scale, setZoom]);

  // ==========================================================================
  // TOUCH (MOBILE) - 1 dedo = pan, 2 dedos = pinch-zoom. Listener nativo com
  // {passive:false} (o onTouchMove do React e passive, nao permite preventDefault).
  // ==========================================================================
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let mode: 'pan' | 'pinch' | null = null;
    let lastX = 0;
    let lastY = 0;
    let pinchStartDist = 1;
    let pinchStartScale = 1;
    const dist = (a: Touch, b: Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        mode = 'pinch';
        pinchStartDist = dist(e.touches[0], e.touches[1]) || 1;
        pinchStartScale = useDiagramStore.getState().viewport.scale;
        e.preventDefault();
      } else if (e.touches.length === 1 && e.target === svg) {
        // Pan so quando comeca no fundo (svg). Tocar num equipamento deixa o tap abrir o modal.
        mode = 'pan';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        startViewportDrag();
        e.preventDefault();
      }
    };

    const onMove = (e: TouchEvent) => {
      const st = useDiagramStore.getState();
      if (mode === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        st.setPan(st.viewport.x + dx, st.viewport.y + dy);
        e.preventDefault();
      } else if (mode === 'pinch' && e.touches.length === 2) {
        const d = dist(e.touches[0], e.touches[1]) || 1;
        st.setZoom(pinchStartScale * (d / pinchStartDist));
        e.preventDefault();
      }
    };

    const onEnd = () => {
      if (mode === 'pan') endViewportDrag();
      mode = null;
    };

    svg.addEventListener('touchstart', onStart, { passive: false });
    svg.addEventListener('touchmove', onMove, { passive: false });
    svg.addEventListener('touchend', onEnd);
    svg.addEventListener('touchcancel', onEnd);
    return () => {
      svg.removeEventListener('touchstart', onStart);
      svg.removeEventListener('touchmove', onMove);
      svg.removeEventListener('touchend', onEnd);
      svg.removeEventListener('touchcancel', onEnd);
    };
  }, [startViewportDrag, endViewportDrag]);

  // ==========================================================================
  // PAN (CLICK + DRAG)
  // ==========================================================================

  const handleMouseDown = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      // Apenas botão esquerdo
      if (e.button !== 0) return;

      // Apenas se clicar no SVG diretamente (áreas vazias, não em equipamentos/conexões)
      // Agora que o grid-rect tem pointer-events: none, precisamos aceitar cliques no SVG
      if (e.target !== svgRef.current) {
        return;
      }

      // ✅ Chamar callback de clique no background (desselecionar equipamentos)
      if (onBackgroundClick && editor.mode === 'view') {
        onBackgroundClick();
      }

      // MODO CONNECTING: Criar junction point onde clicou
      if (editor.mode === 'connecting' && editor.connectingFrom) {
        const svg = svgRef.current;
        if (!svg) return;

        // Obter coordenadas do clique no SVG
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        // Converter para grid (SEMPRE com snap para garantir linhas retas)
        const gridX = pixelsToGrid(svgP.x, true);
        const gridY = pixelsToGrid(svgP.y, true);

        // Criar junction point no store
        const { addEquipamento, finishConnecting } = useDiagramStore.getState();
        const junctionId = `junction-${Date.now()}`;

        // Adicionar junction point como equipamento
        addEquipamento({
          id: junctionId,
          nome: 'Ponto de Junção',
          tag: 'JP',
          tipo: 'JUNCTION_POINT',
          unidadeId: equipamentos[0]?.unidadeId || 'unknown',
          diagramaId: equipamentos[0]?.diagramaId || null,
          posicaoX: gridX,
          posicaoY: gridY,
          rotacao: 0,
          labelPosition: 'top',
          status: 'normal',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        });

        // Conectar ao junction point (porta bottom, que fica centralizada)
        finishConnecting(junctionId, 'bottom');

        e.preventDefault();
        e.stopPropagation();
        return;
      }

      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      startViewportDrag();

      e.preventDefault();
    },
    [startViewportDrag, editor.mode, editor.connectingFrom, editor.snapToGrid, equipamentos, onBackgroundClick]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      // Verificar se está arrastando um equipamento
      if (editor.draggingEquipmentId && editor.dragOffset) {
        const svg = svgRef.current;
        if (!svg) return;

        // Obter coordenadas do SVG usando getScreenCTM (mais preciso com viewBox dinâmico)
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;

        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        // Subtrair o offset do click inicial (já em coordenadas SVG)
        const equipmentX = svgP.x - editor.dragOffset.x;
        const equipmentY = svgP.y - editor.dragOffset.y;

        // Converter de pixels para grid
        const gridX = pixelsToGrid(equipmentX, editor.snapToGrid);
        const gridY = pixelsToGrid(equipmentY, editor.snapToGrid);

        // Atualizar posição do equipamento
        updateEquipamentoPosition(editor.draggingEquipmentId, gridX, gridY);
        return;
      }

      // Drag do viewport (pan)
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - lastMousePosRef.current.x;
      const deltaY = e.clientY - lastMousePosRef.current.y;

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      // Atualizar pan
      setPan(viewport.x + deltaX, viewport.y + deltaY);
    },
    [editor.draggingEquipmentId, editor.dragOffset, editor.snapToGrid, viewport.x, viewport.y, viewport.scale, setPan, updateEquipamentoPosition]
  );

  const handleMouseUp = useCallback(() => {
    // Terminar drag de equipamento
    if (editor.draggingEquipmentId) {
      endDraggingEquipamento();
    }

    // Terminar drag do viewport
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      endViewportDrag();
    }
  }, [editor.draggingEquipmentId, endDraggingEquipamento, endViewportDrag]);

  const handleMouseLeave = useCallback(() => {
    // Terminar drag de equipamento
    if (editor.draggingEquipmentId) {
      endDraggingEquipamento();
    }

    // Terminar drag do viewport
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      endViewportDrag();
    }
  }, [editor.draggingEquipmentId, endDraggingEquipamento, endViewportDrag]);

  // ==========================================================================
  // RENDERIZAÇÃO DO GRID (INFINITO)
  // ==========================================================================

  const renderGrid = () => {
    const lines: React.ReactElement[] = [];

    // Grid fixo e pequeno para melhor performance
    // Apenas 2x o canvas (suficiente com zoom ampliado)
    const gridMultiplier = 1.5;
    const minX = -(CANVAS.WIDTH as number) * gridMultiplier;
    const minY = -(CANVAS.HEIGHT as number) * gridMultiplier;
    const maxX = (CANVAS.WIDTH as number) * gridMultiplier;
    const maxY = (CANVAS.HEIGHT as number) * gridMultiplier;

    // Alinhar ao grid
    const startX = Math.floor(minX / GRID.SIZE) * GRID.SIZE;
    const startY = Math.floor(minY / GRID.SIZE) * GRID.SIZE;
    const endX = Math.ceil(maxX / GRID.SIZE) * GRID.SIZE;
    const endY = Math.ceil(maxY / GRID.SIZE) * GRID.SIZE;

    // Linhas verticais
    for (let x = startX; x <= endX; x += GRID.SIZE) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={startY}
          x2={x}
          y2={endY}
          stroke={themeColors.gridLine}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    // Linhas horizontais
    for (let y = startY; y <= endY; y += GRID.SIZE) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={startX}
          y1={y}
          x2={endX}
          y2={y}
          stroke={themeColors.gridLine}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    return lines;
  };

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  // Calcular viewBox dinâmico - otimizado para performance
  const calculateViewBox = () => {
    // ViewBox moderado (1.5x canvas) - zoom resolve o resto
    const gridMultiplier = 1.5;
    const width = (CANVAS.WIDTH as number) * gridMultiplier * 2;
    const height = (CANVAS.HEIGHT as number) * gridMultiplier * 2;
    const minX = -(CANVAS.WIDTH as number) * gridMultiplier;
    const minY = -(CANVAS.HEIGHT as number) * gridMultiplier;

    return `${minX} ${minY} ${width} ${height}`;
  };

  const viewBox = calculateViewBox();

  return (
    <div className="diagram-viewport-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Container com overflow hidden */}
      <div
        className="viewport-wrapper"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: themeColors.background,
        }}
      >
        {/* SVG com transformação (INFINITO) - Dimensões fixas para zoom consistente */}
        <svg
          ref={svgRef}
          width={CANVAS.WIDTH}
          height={CANVAS.HEIGHT}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: 'center center',
            transition: viewport.isDragging ? 'none' : 'transform 0.1s ease-out',
            touchAction: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* Fundo infinito */}
          <rect
            x={viewBox.split(' ')[0]}
            y={viewBox.split(' ')[1]}
            width={viewBox.split(' ')[2]}
            height={viewBox.split(' ')[3]}
            fill={themeColors.background}
            className="grid-rect"
            style={{
              cursor: viewport.isDragging ? 'grabbing' : 'grab',
              pointerEvents: 'none'
            }}
          />

          {/* Grid - visível em modo edit e connecting */}
          {(editor.mode === 'edit' || editor.mode === 'connecting') && (
            <g className="grid">
              {renderGrid()}
            </g>
          )}

          {/* Conteúdo (equipamentos, conexões, etc) */}
          <g className="diagram-content">{children}</g>
        </svg>
      </div>

      {/* Controles de zoom - FORA do viewport-wrapper para não serem cortados */}
      <div
        className="absolute bottom-2 right-2 z-[1000] flex items-center gap-1.5 rounded-lg bg-black/70 p-1.5 sm:bottom-5 sm:right-5 sm:gap-2 sm:p-2.5"
        style={{ pointerEvents: 'auto' }}
      >
        <button
          onClick={() => setZoom(viewport.scale + VIEWPORT.ZOOM_STEP)}
          title="Zoom In"
          className="cursor-pointer rounded bg-neutral-700 px-2 py-0.5 text-sm leading-none text-white sm:px-3 sm:py-1.5 sm:text-base"
        >
          +
        </button>
        <span className="tabular-nums text-xs text-white sm:text-sm">{Math.round(viewport.scale * 100)}%</span>
        <button
          onClick={() => setZoom(viewport.scale - VIEWPORT.ZOOM_STEP)}
          title="Zoom Out"
          className="cursor-pointer rounded bg-neutral-700 px-2 py-0.5 text-sm leading-none text-white sm:px-3 sm:py-1.5 sm:text-base"
        >
          −
        </button>
      </div>
    </div>
  );
};
