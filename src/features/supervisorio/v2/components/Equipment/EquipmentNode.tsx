/**
 * EQUIPMENT NODE - Renderização de Equipamento no Diagrama
 *
 * Responsabilidades:
 * - Renderiza ícone SVG do equipamento
 * - Renderiza label (nome/tag)
 * - Renderiza portas de conexão (top/bottom/left/right)
 * - Gerencia drag and drop
 * - Gerencia seleção
 * - Gerencia click em portas (para conectar)
 */

import React, { MouseEvent, useMemo } from 'react';
import { Equipment, PortPosition } from '../../types/diagram.types';
import { useDiagramStore } from '../../hooks/useDiagramStore';
import {
  getEquipmentSizeInPixels,
  gridToPixels,
  PORT,
  LABEL,
  SELECTION,
  getThemeColors,
} from '../../utils/diagramConstants';
import { EquipmentIconWrapper } from '../icons/EquipmentIconFactory';
import { DiagramaPontosBox } from '@/features/supervisorio/sinoptico/components/DiagramaPontosBox';
import { useDisjuntorEstado } from '../../hooks/useDisjuntorEstado';
import './EquipmentNode.css';

interface EquipmentNodeProps {
  equipment: Equipment;
  onClick?: (equipment: Equipment) => void;
  onDoubleClick?: (equipment: Equipment) => void;
}

const EquipmentNodeImpl: React.FC<EquipmentNodeProps> = ({ equipment, onClick, onDoubleClick }) => {
  const theme = useDiagramStore(state => state.theme);
  const editor = useDiagramStore(state => state.editor);
  const selectEquipamento = useDiagramStore(state => state.selectEquipamento);
  const toggleSelectEquipamento = useDiagramStore(state => state.toggleSelectEquipamento);
  const startDraggingEquipamento = useDiagramStore(state => state.startDraggingEquipamento);
  const endDraggingEquipamento = useDiagramStore(state => state.endDraggingEquipamento);
  const updateEquipamentoPosition = useDiagramStore(state => state.updateEquipamentoPosition);
  const updateEquipamentoLabelOffset = useDiagramStore(state => state.updateEquipamentoLabelOffset);
  const startConnecting = useDiagramStore(state => state.startConnecting);
  const finishConnecting = useDiagramStore(state => state.finishConnecting);

  const [isDraggingLabel, setIsDraggingLabel] = React.useState(false);
  const [labelDragStart, setLabelDragStart] = React.useState<{x: number; y: number} | null>(null);

  const themeColors = getThemeColors(theme);
  const size = getEquipmentSizeInPixels(equipment.tipo);

  // Status do disjuntor (vermelho=fechado / verde=aberto). O dado vem do relé
  // que lê os auxiliares 52a/52b — ver useDisjuntorEstado. Hook chamado sempre
  // (id null quando não é disjuntor) pra não quebrar a ordem dos hooks.
  const ehDisjuntor = /DISJUNTOR/i.test(
    `${equipment.categoria ?? ''} ${equipment.tipo ?? ''}`,
  );
  const { estado: estadoDisjuntor } = useDisjuntorEstado(
    ehDisjuntor ? equipment.id : null,
  );

  // Para junction points, centralizar no vértice
  const isJunctionPoint = equipment.tipo === 'JUNCTION_POINT';
  const x = isJunctionPoint
    ? gridToPixels(equipment.posicaoX) - size.width / 2
    : gridToPixels(equipment.posicaoX);
  const y = isJunctionPoint
    ? gridToPixels(equipment.posicaoY) - size.height / 2
    : gridToPixels(equipment.posicaoY);

  const isSelected = useMemo(
    () => editor.selectedEquipmentIds.includes(equipment.id),
    [editor.selectedEquipmentIds, equipment.id]
  );

  const isConnecting = editor.mode === 'connecting';
  const isDragging = editor.draggingEquipmentId === equipment.id;

  // ==========================================================================
  // DRAG AND DROP
  // ==========================================================================

  const handleMouseDown = (e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();

    // Modo VIEW: Chamar callback onClick se fornecido
    if (editor.mode === 'view') {
      if (onClick) {
        onClick(equipment);
      }
      return;
    }

    // Modo EDIT: Drag and drop
    if (editor.mode !== 'edit') return;

    // Calcular offset do mouse relativo ao equipamento usando coordenadas SVG
    const svg = (e.currentTarget.ownerSVGElement as SVGSVGElement);
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    // Offset em coordenadas SVG
    const offset = {
      x: svgP.x - x,
      y: svgP.y - y,
    };

    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    if (multi) {
      // shift/ctrl-click: alterna este equipamento na seleção (multi-seleção)
      toggleSelectEquipamento(equipment.id);
    } else if (!editor.selectedEquipmentIds.includes(equipment.id)) {
      // clique simples em item NÃO selecionado: seleção única
      selectEquipamento(equipment.id);
    }
    // clique simples em item JÁ selecionado mantém a seleção → permite arrastar o grupo todo
    startDraggingEquipamento(equipment.id, offset);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      endDraggingEquipamento();
    }
  };

  // ==========================================================================
  // PORTAS (CONEXÃO)
  // ==========================================================================

  const handlePortClick = (porta: PortPosition, e: MouseEvent) => {
    e.stopPropagation();

    console.log('[EquipmentNode] Port clicked:', {
      equipment: equipment.nome,
      porta,
      currentMode: editor.mode,
      connectingFrom: editor.connectingFrom,
    });

    if (editor.mode === 'connecting' && editor.connectingFrom) {
      // Finalizar conexão
      console.log('[EquipmentNode] Finishing connection');
      finishConnecting(equipment.id, porta);
    } else {
      // Iniciar conexão
      console.log('[EquipmentNode] Starting connection');
      startConnecting(equipment.id, porta);
    }
  };

  const renderPort = (porta: PortPosition) => {
    const portPos = PORT.POSITIONS[porta];
    const portX = portPos.x * size.width;
    const portY = portPos.y * size.height;

    return (
      <circle
        key={porta}
        cx={portX}
        cy={portY}
        r={6}
        fill={isConnecting ? PORT.COLOR_ACTIVE : PORT.COLOR}
        stroke="white"
        strokeWidth="2"
        className="equipment-port"
        onClick={e => handlePortClick(porta, e)}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  // ==========================================================================
  // LABEL DRAG
  // ==========================================================================

  // Adicionar listeners de mouse globais quando começar a arrastar
  React.useEffect(() => {
    if (!isDraggingLabel) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!labelDragStart) return;

      // Obter referência ao SVG
      const svgElement = document.querySelector<SVGSVGElement>('.diagram-viewport-container svg');
      if (!svgElement) return;

      const pt = svgElement.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;

      const svgP = pt.matrixTransform(svgElement.getScreenCTM()?.inverse());

      // Calcular delta do movimento
      const deltaX = svgP.x - labelDragStart.x;
      const deltaY = svgP.y - labelDragStart.y;

      // Atualizar offset do label
      const newOffsetX = (equipment.labelOffsetX || 0) + deltaX;
      const newOffsetY = (equipment.labelOffsetY || 0) + deltaY;

      updateEquipamentoLabelOffset(equipment.id, newOffsetX, newOffsetY);

      // Atualizar ponto de início para próximo movimento
      setLabelDragStart({ x: svgP.x, y: svgP.y });
    };

    const handleMouseUp = () => {
      setIsDraggingLabel(false);
      setLabelDragStart(null);
    };

    // Adicionar listeners ao document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLabel, labelDragStart, equipment.id, equipment.labelOffsetX, equipment.labelOffsetY, updateEquipamentoLabelOffset]);

  const handleLabelMouseDown = (e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    e.preventDefault();

    // Só permitir drag em modo edit
    if (editor.mode !== 'edit') return;

    const svg = (e.currentTarget.ownerSVGElement as SVGSVGElement);
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    setIsDraggingLabel(true);
    setLabelDragStart({ x: svgP.x, y: svgP.y });
  };

  // ==========================================================================
  // LABEL
  // ==========================================================================

  const renderLabel = () => {
    const labelText = equipment.tag || equipment.nome;

    // Posição do label baseado em labelPosition
    let labelX = size.width / 2;
    let labelY = -LABEL.OFFSET;
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';

    switch (equipment.labelPosition) {
      case 'bottom':
        labelY = size.height + LABEL.OFFSET + LABEL.FONT_SIZE;
        break;
      case 'left':
        labelX = -LABEL.OFFSET;
        labelY = size.height / 2;
        textAnchor = 'end';
        break;
      case 'right':
        labelX = size.width + LABEL.OFFSET;
        labelY = size.height / 2;
        textAnchor = 'start';
        break;
      default: // 'top'
        break;
    }

    // Aplicar offset customizado
    labelX += (equipment.labelOffsetX || 0);
    labelY += (equipment.labelOffsetY || 0);

    const isDraggable = editor.mode === 'edit';

    return (
      <g className="equipment-label-group">
        {/* Handle visual para drag (visível apenas em modo edit) */}
        {isDraggable && (
          <circle
            cx={labelX}
            cy={labelY - LABEL.FONT_SIZE / 2}
            r={4}
            fill={themeColors.labelColor}
            opacity={0.5}
            pointerEvents="none"
          />
        )}

        {/* Área clicável para drag do label */}
        <text
          x={labelX}
          y={labelY}
          fontSize={LABEL.FONT_SIZE}
          fontFamily={LABEL.FONT_FAMILY}
          fill={themeColors.labelColor}
          textAnchor={textAnchor}
          className="equipment-label"
          onMouseDown={isDraggable ? handleLabelMouseDown : undefined}
          style={{
            cursor: isDraggable ? 'move' : 'default',
            userSelect: 'none'
          }}
          pointerEvents={isDraggable ? 'auto' : 'none'}
        >
          {labelText}
        </text>
      </g>
    );
  };

  // ==========================================================================
  // ÍCONE
  // ==========================================================================

  const renderIcon = () => {
    return (
      <foreignObject width={size.width} height={size.height} pointerEvents="none">
        <EquipmentIconWrapper
          categoria={equipment.categoria} // Usar categoria primeiro (ex: "CHAVE", "INVERSOR_PV")
          tipo={equipment.tipo} // Fallback para tipo se categoria não existir
          width={size.width}
          height={size.height}
          color={themeColors.iconColor}
        />
      </foreignObject>
    );
  };

  // ==========================================================================
  // STATUS DO DISJUNTOR (aberto/fechado)
  // ==========================================================================
  // O ícone do disjuntor é um <img> estático (não aceita recolorir), então o
  // status vai num ANEL em volta do nó + um rótulo escrito — que é o que dá pra
  // ler de longe num sinóptico.
  const renderStatusDisjuntor = () => {
    if (!ehDisjuntor || estadoDisjuntor === 'sem_fonte') return null;

    const cor =
      estadoDisjuntor === 'fechado'
        ? '#ef4444' // vermelho = fechado (energizado / passando corrente)
        : estadoDisjuntor === 'aberto'
          ? '#22c55e' // verde = aberto (seccionado)
          : '#9ca3af'; // cinza = indeterminado (sinais iguais / sem leitura ainda)
    const texto =
      estadoDisjuntor === 'fechado'
        ? 'FECHADO'
        : estadoDisjuntor === 'aberto'
          ? 'ABERTO'
          : '—';
    const larguraBadge = 62;

    return (
      <g pointerEvents="none" className="disjuntor-status">
        {/* Anel em volta do equipamento */}
        <rect
          x={-4}
          y={-4}
          width={size.width + 8}
          height={size.height + 8}
          rx={5}
          fill="none"
          stroke={cor}
          strokeWidth={3}
        />
        {/* Rótulo escrito, logo abaixo do nó */}
        <rect
          x={size.width / 2 - larguraBadge / 2}
          y={size.height + 6}
          width={larguraBadge}
          height={16}
          rx={3}
          fill={cor}
        />
        <text
          x={size.width / 2}
          y={size.height + 18}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill="#ffffff"
          style={{ userSelect: 'none' }}
        >
          {texto}
        </text>
      </g>
    );
  };

  // ==========================================================================
  // SELEÇÃO
  // ==========================================================================

  const renderSelectionBox = () => {
    if (!isSelected) return null;

    return (
      <rect
        x={-2}
        y={-2}
        width={size.width + 4}
        height={size.height + 4}
        fill="none"
        stroke={SELECTION.COLOR}
        strokeWidth={SELECTION.STROKE_WIDTH}
        strokeDasharray="4 2"
        className="selection-box"
        pointerEvents="none"
      />
    );
  };

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  return (
    <g
      className={`equipment-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      transform={`translate(${x}, ${y})`}
    >
      {/* Seleção */}
      {renderSelectionBox()}

      {/* Área de clique invisível (apenas sobre o equipamento, não sobre todo o espaço) */}
      <rect
        x={0}
        y={0}
        width={size.width}
        height={size.height}
        fill="transparent"
        style={{ cursor: editor.mode === 'edit' ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onDoubleClick={onDoubleClick ? () => onDoubleClick(equipment) : undefined}
      />

      {/* Ícone (ocultar junction points no modo view) */}
      {!(isJunctionPoint && editor.mode === 'view') && renderIcon()}

      {/* Status aberto/fechado do disjuntor */}
      {renderStatusDisjuntor()}

      {/* Label (ocultar para junction points no modo view) */}
      {!(isJunctionPoint && editor.mode === 'view') && renderLabel()}

      {/* Caixas de dados (R8) — apenas no modo view e fora de junction points */}
      {editor.mode === 'view' && !isJunctionPoint && (
        <DiagramaPontosBox equipment={equipment} />
      )}

      {/* Portas (visíveis no modo edit ou connecting) */}
      {(editor.mode === 'edit' || editor.mode === 'connecting') && (
        <g className="ports">
          {isJunctionPoint ? (
            // Ponto de juncao: UM unico no central que recebe ligacao das 4 direcoes
            // (todas as portas da juncao convergem no centro — ver getPortPoint).
            <circle
              cx={size.width / 2}
              cy={size.height / 2}
              r={6}
              fill={isConnecting ? PORT.COLOR_ACTIVE : PORT.COLOR}
              stroke="white"
              strokeWidth="2"
              className="equipment-port"
              onClick={e => handlePortClick('bottom', e)}
              style={{ cursor: 'pointer' }}
            />
          ) : (
            <>
              {renderPort('top')}
              {renderPort('bottom')}
              {renderPort('left')}
              {renderPort('right')}
            </>
          )}
        </g>
      )}
    </g>
  );
};

// Memo: durante o arrasto so o no movido (e as conexoes) re-renderiza — os demais
// nos sao pulados (props estaveis), eliminando o re-render de todos os icones por frame.
export const EquipmentNode = React.memo(EquipmentNodeImpl);
