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

import React, { useRef, useCallback, useEffect, useState, MouseEvent } from 'react';
import { useDiagramStore } from '../../hooks/useDiagramStore';
import { CANVAS, GRID, VIEWPORT, getThemeColors, pixelsToGrid, gridToPixels, PORT } from '../../utils/diagramConstants';
import { getPortPoint } from '../../utils/orthogonalRouting';
import { grupoIdDoNo, montarVisao, posicaoRealDoArraste } from '../../utils/grupos';
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
  const moveSelectionBy = useDiagramStore(state => state.moveSelectionBy);
  const selectInBox = useDiagramStore(state => state.selectInBox);

  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Caixa de seleção (marquee) — coords de grid
  const marqueeRef = useRef(false);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Ponta da linha "elastica" (rubber-band) enquanto conecta — coords SVG.
  const [connMouse, setConnMouse] = useState<{ x: number; y: number } | null>(null);

  // Zerar a linha elastica quando nao ha conexao em andamento (evita flash ao reiniciar).
  useEffect(() => {
    if (!editor.connectingFrom) setConnMouse(null);
  }, [editor.connectingFrom]);

  const themeColors = getThemeColors(theme);

  // ==========================================================================
  // SCROLL — listener nativo ({passive:false} permite preventDefault)
  //   scroll → zoom no ponto do mouse (pedido do dono: o NEXON-31 tinha trocado por
  //            mover a tela; voltou a ser zoom)
  //   scroll lateral / Shift+scroll → move para os lados
  //   Ctrl/⌘+scroll ou pinça do trackpad → zoom no ponto do mouse
  //   mover a tela continua no arraste (vazio, Espaço+arraste, botão do meio)
  // Lê o estado FRESCO do store (o listener é registrado uma vez).
  // ==========================================================================

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const zoomNoCursor = (e: globalThis.WheelEvent, fator: number) => {
      const st = useDiagramStore.getState();
      const { x, y, scale } = st.viewport;
      const novo = Math.max(VIEWPORT.MIN_SCALE, Math.min(VIEWPORT.MAX_SCALE, scale * fator));
      if (novo === scale) return;
      // Ponto sob o cursor fica parado: o svg está centrado no wrapper e escala pelo centro
      const wrap = svg.parentElement?.getBoundingClientRect();
      const cx = wrap ? e.clientX - (wrap.left + wrap.width / 2) : 0;
      const cy = wrap ? e.clientY - (wrap.top + wrap.height / 2) : 0;
      const k = novo / scale;
      useDiagramStore.setState({
        viewport: { ...st.viewport, scale: novo, x: cx - (cx - x) * k, y: cy - (cy - y) * k, animando: false },
      });
    };

    const handleWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      // deltaMode 1 = linhas (mouse antigo): converte para pixels
      const px = e.deltaMode === 1 ? 16 : 1;
      const dx = e.deltaX * px;
      const dy = e.deltaY * px;

      const st = useDiagramStore.getState();
      if (!e.ctrlKey && !e.metaKey) {
        if (e.shiftKey && dx === 0) { st.setPan(st.viewport.x - dy, st.viewport.y); return; }
        // Gesto lateral (roda lateral / dois dedos para o lado) continua movendo.
        if (Math.abs(dx) > Math.abs(dy)) { st.setPan(st.viewport.x - dx, st.viewport.y); return; }
      }
      // Pinça do trackpad chega como ctrl+wheel com deltas pequenos (zoom contínuo);
      // um "clique" da roda do mouse vem grande (~100): passo fixo de 15%.
      const fator = Math.abs(dy) >= 40 ? (dy < 0 ? 1.15 : 1 / 1.15) : Math.exp(-dy * 0.01);
      zoomNoCursor(e, fator);
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      svg.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // ==========================================================================
  // ESPAÇO SEGURADO = mão (move a tela em qualquer ferramenta, até sobre equipamento)
  // ==========================================================================
  const espacoRef = useRef(false);
  const [espaco, setEspaco] = useState(false);
  // Só vale com o mouse sobre o diagrama: fora dele o espaço segue normal (botões, página)
  const sobreRef = useRef(false);
  useEffect(() => {
    const emCampo = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || emCampo(e.target) || !sobreRef.current) return;
      e.preventDefault(); // não rola a página
      if (!espacoRef.current) { espacoRef.current = true; setEspaco(true); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      espacoRef.current = false;
      setEspaco(false);
    };
    const blur = () => { espacoRef.current = false; setEspaco(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  /** Botão do meio ou espaço+arraste: pan antes de qualquer filho (equipamento, bloco) pegar o clique. */
  const handleMouseDownCapture = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (e.button !== 1 && !(e.button === 0 && espacoRef.current)) return;
      e.preventDefault(); // evita o autoscroll do botão do meio
      e.stopPropagation();
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      startViewportDrag();
    },
    [startViewportDrag]
  );

  // ==========================================================================
  // TOUCH (MOBILE) - 1 dedo = pan, 2 dedos = pinch-zoom. Listener nativo com
  // {passive:false} (o onTouchMove do React e passive, nao permite preventDefault).
  // ==========================================================================
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // 'toque': um dedo pousou e ainda não andou. Vira 'pan' depois de 8px; se
    // soltar antes, era um toque e o clique segue para o equipamento.
    let mode: 'toque' | 'pan' | 'pinch' | null = null;
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
      } else if (e.touches.length === 1) {
        // Arrastar vale de qualquer ponto (linha, barra, equipamento): num
        // diagrama denso quase nunca sobra fundo livre para começar no svg.
        mode = 'toque';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        if (e.target === svg) e.preventDefault();
      }
    };

    const onMove = (e: TouchEvent) => {
      const st = useDiagramStore.getState();
      if (mode === 'toque' && e.touches.length === 1) {
        const andou = Math.hypot(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
        if (andou < 8) return;
        mode = 'pan';
        startViewportDrag();
      }
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

      // MODO EDIT: arrastar no vazio com a ferramenta SELEÇÃO, ou Shift+arrastar com
      // qualquer ferramenta = caixa de seleção. Senão o arrastar em vazio faz PAN.
      if (editor.mode === 'edit' && (editor.toolMode === 'select' || e.shiftKey)) {
        const svg = svgRef.current;
        if (svg) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX; pt.y = e.clientY;
          const p = pt.matrixTransform(svg.getScreenCTM()?.inverse());
          const gx = pixelsToGrid(p.x, false);
          const gy = pixelsToGrid(p.y, false);
          marqueeRef.current = true;
          setMarquee({ x1: gx, y1: gy, x2: gx, y2: gy });
          // Shift com a ferramenta Seleção soma à seleção; com Mover, Shift é o próprio atalho
          if (!(e.shiftKey && editor.toolMode === 'select')) useDiagramStore.getState().clearSelection();
        }
        e.preventDefault();
        return;
      }

      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      startViewportDrag();

      e.preventDefault();
    },
    [startViewportDrag, editor.mode, editor.toolMode, editor.connectingFrom, editor.snapToGrid, equipamentos, onBackgroundClick]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      // Linha "elastica": enquanto conecta, a ponta segue o cursor (coords SVG).
      if (editor.mode === 'connecting' && editor.connectingFrom) {
        const svg = svgRef.current;
        if (svg) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const p = pt.matrixTransform(svg.getScreenCTM()?.inverse());
          setConnMouse({ x: p.x, y: p.y });
        }
      }

      // Atualiza a caixa de seleção (marquee)
      if (marqueeRef.current) {
        const svg = svgRef.current;
        if (svg) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX; pt.y = e.clientY;
          const p = pt.matrixTransform(svg.getScreenCTM()?.inverse());
          setMarquee(m => (m ? { ...m, x2: pixelsToGrid(p.x, false), y2: pixelsToGrid(p.y, false) } : m));
        }
        return;
      }

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

        // Converter de pixels para grid. Membro de grupo aberto pode estar deslocado
        // só na tela (grupos abertos se afastam): volta para a posição real.
        const { x: gridX, y: gridY } = posicaoRealDoArraste(
          editor.draggingEquipmentId,
          pixelsToGrid(equipmentX, editor.snapToGrid),
          pixelsToGrid(equipmentY, editor.snapToGrid),
          useDiagramStore.getState().deslocamentoVisual,
        );

        // Bloco de grupo recolhido (NEXON-31): move só o bloco
        const dragId = editor.draggingEquipmentId;
        const grupoArrastado = grupoIdDoNo(dragId);
        if (grupoArrastado) {
          useDiagramStore.getState().moverCardGrupo(grupoArrastado, gridX, gridY);
          return;
        }

        // Multi-seleção: se o item arrastado faz parte dela, move todos pelo mesmo delta
        if (editor.selectedEquipmentIds.length > 1 && editor.selectedEquipmentIds.includes(dragId)) {
          const eqAtual = equipamentos.find(eq2 => eq2.id === dragId);
          if (eqAtual) {
            const dx = gridX - eqAtual.posicaoX;
            const dy = gridY - eqAtual.posicaoY;
            if (dx !== 0 || dy !== 0) moveSelectionBy(dx, dy);
          }
        } else {
          updateEquipamentoPosition(dragId, gridX, gridY);
        }
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
    [editor.draggingEquipmentId, editor.dragOffset, editor.snapToGrid, editor.mode, editor.connectingFrom, editor.selectedEquipmentIds, equipamentos, viewport.x, viewport.y, viewport.scale, setPan, updateEquipamentoPosition, moveSelectionBy]
  );

  const handleMouseUp = useCallback(() => {
    // Finalizar caixa de seleção (marquee)
    if (marqueeRef.current) {
      marqueeRef.current = false;
      setMarquee(m => {
        if (m) {
          const moved = Math.abs(m.x2 - m.x1) > 0.2 || Math.abs(m.y2 - m.y1) > 0.2;
          if (moved) selectInBox(m.x1, m.y1, m.x2, m.y2, true);
        }
        return null;
      });
      return;
    }

    // Terminar drag de equipamento
    if (editor.draggingEquipmentId) {
      endDraggingEquipamento();
    }

    // Terminar drag do viewport
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      endViewportDrag();
    }
  }, [editor.draggingEquipmentId, endDraggingEquipamento, endViewportDrag, selectInBox]);

  const handleMouseLeave = useCallback(() => {
    // Cancelar caixa de seleção se o mouse sair
    if (marqueeRef.current) {
      marqueeRef.current = false;
      setMarquee(null);
    }
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
    <div
      className="diagram-viewport-container"
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onMouseEnter={() => { sobreRef.current = true; }}
      onMouseLeave={() => { sobreRef.current = false; }}
    >
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
            // Foco animado (abrir/fechar grupo) usa transição longa; o resto continua ágil
            transition: viewport.isDragging
              ? 'none'
              : viewport.animando
                ? 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)'
                : 'transform 0.1s ease-out',
            touchAction: 'none',
            cursor: editor.draggingEquipmentId || (espaco && viewport.isDragging)
              ? 'grabbing'
              : espaco
                ? 'grab'
                : undefined,
          }}
          onMouseDownCapture={handleMouseDownCapture}
          onAuxClick={e => e.preventDefault()}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* Sombra sutil dos nós (profundidade estilo IoT) — retirada no export */}
          <defs>
            <filter id="unifilar-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#0f172a" floodOpacity="0.25" />
            </filter>
          </defs>

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
          <g className="diagram-content">
            {children}
            {marquee && (
              <rect
                x={gridToPixels(Math.min(marquee.x1, marquee.x2))}
                y={gridToPixels(Math.min(marquee.y1, marquee.y2))}
                width={gridToPixels(Math.abs(marquee.x2 - marquee.x1))}
                height={gridToPixels(Math.abs(marquee.y2 - marquee.y1))}
                fill="rgba(59,130,246,0.12)"
                stroke="#3B82F6"
                strokeWidth={1}
                strokeDasharray="4 3"
                pointerEvents="none"
                rx={2}
              />
            )}

            {/* Linha "elastica" (rubber-band): da porta de origem ate o cursor */}
            {editor.mode === 'connecting' && editor.connectingFrom && connMouse && (() => {
              const fromId = editor.connectingFrom!.equipamentoId;
              // Bloco de grupo recolhido não está em `equipamentos`: monta o nó dele
              const fromEq = grupoIdDoNo(fromId)
                ? (() => {
                    const st = useDiagramStore.getState();
                    return montarVisao(st.equipamentos, st.conexoes, st.grupos, new Set(st.gruposAbertos)).equipamentos.find(e => e.id === fromId);
                  })()
                : (() => {
                    const eq = equipamentos.find(e => e.id === fromId);
                    const d = eq && useDiagramStore.getState().deslocamentoVisual.get(fromId);
                    return eq && d ? { ...eq, posicaoX: eq.posicaoX + d.dx, posicaoY: eq.posicaoY + d.dy } : eq;
                  })();
              if (!fromEq) return null;
              const start = getPortPoint(fromEq, editor.connectingFrom!.porta).point;
              return (
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={connMouse.x}
                  y2={connMouse.y}
                  stroke={PORT.COLOR_ACTIVE}
                  strokeWidth={3}
                  strokeDasharray="8 5"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              );
            })()}
          </g>
        </svg>
      </div>

      {/* Controles de zoom — discretos (sem caixa): icones + percentual em cor
          muted, tema-aware, com hover sutil. */}
      <div
        className="absolute bottom-2 right-2 z-[1000] flex items-center gap-0.5 sm:bottom-3 sm:right-3"
        style={{ pointerEvents: 'auto' }}
      >
        <button
          onClick={() => setZoom(viewport.scale + VIEWPORT.ZOOM_STEP)}
          title="Zoom In"
          aria-label="Aproximar"
          className="flex h-6 w-6 touch:h-10 touch:w-10 touch:text-xl cursor-pointer items-center justify-center rounded-sm text-base leading-none text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          +
        </button>
        <span className="px-0.5 tabular-nums text-[10px] touch:text-xs text-muted-foreground/60">
          {Math.round(viewport.scale * 100)}%
        </span>
        <button
          onClick={() => setZoom(viewport.scale - VIEWPORT.ZOOM_STEP)}
          title="Zoom Out"
          aria-label="Afastar"
          className="flex h-6 w-6 touch:h-10 touch:w-10 touch:text-xl cursor-pointer items-center justify-center rounded-sm text-base leading-none text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          −
        </button>
      </div>
    </div>
  );
};
