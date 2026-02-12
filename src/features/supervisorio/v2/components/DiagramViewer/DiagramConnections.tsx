/**
 * DIAGRAM CONNECTIONS - Renderização de Conexões e Barramentos
 *
 * Responsabilidades:
 * - Renderiza todas as conexões ortogonais
 * - Renderiza barramentos horizontais (quando detectados)
 * - Aplica estilos tema-aware (branco/cinza)
 * - Gerencia seleção de conexões
 */

import React, { useMemo } from 'react';
import { useDiagramStore } from '../../hooks/useDiagramStore';
import { VisualConnection, Barramento } from '../../types/diagram.types';
import {
  pointsToSvgPathRounded,
  pointsToSvgPath,
} from '../../utils/orthogonalRouting';
import { getBarramentoPath } from '../../utils/barramentoDetector';
import { CONNECTION, getThemeColors, pixelsToGrid, gridToPixels } from '../../utils/diagramConstants';
import './DiagramConnections.css';

interface DiagramConnectionsProps {
  visualConnections: VisualConnection[];
  barramentos: Barramento[];
}

export const DiagramConnections: React.FC<DiagramConnectionsProps> = ({
  visualConnections,
  barramentos,
}) => {
  const theme = useDiagramStore(state => state.theme);
  const editor = useDiagramStore(state => state.editor);
  const selectConnection = useDiagramStore(state => state.selectConnection);
  const removeConexao = useDiagramStore(state => state.removeConexao);

  const themeColors = getThemeColors(theme);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleConnectionClick = (conexao: VisualConnection, e: React.MouseEvent) => {
    e.stopPropagation();

    // MODO CONNECTING: Criar junction point sobre a linha
    if (editor.mode === 'connecting' && editor.connectingFrom) {
      const svg = (e.target as SVGPathElement).ownerSVGElement;
      if (!svg) return;

      // Obter coordenadas do clique no SVG
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      // Encontrar o segmento de linha mais próximo do clique
      const clickPoint = { x: svgP.x, y: svgP.y };
      const { segment, closestPointOnSegment } = findClosestSegment(conexao.pontos, clickPoint);

      if (!segment) {
        console.log('[DiagramConnections] Nenhum segmento encontrado');
        return;
      }

      // Determinar se o segmento é horizontal ou vertical
      const isHorizontal = Math.abs(segment.p1.y - segment.p2.y) < 1; // Mesma coordenada Y
      const isVertical = Math.abs(segment.p1.x - segment.p2.x) < 1; // Mesma coordenada X

      let gridX: number;
      let gridY: number;

      if (isHorizontal) {
        // Segmento horizontal: usar Y da linha, snap apenas X do clique
        gridX = pixelsToGrid(svgP.x, true);
        gridY = pixelsToGrid(segment.p1.y, true); // Y fixo da linha
      } else if (isVertical) {
        // Segmento vertical: usar X da linha, snap apenas Y do clique
        gridX = pixelsToGrid(segment.p1.x, true); // X fixo da linha
        gridY = pixelsToGrid(svgP.y, true);
      } else {
        // Segmento diagonal (não deveria acontecer em linhas ortogonais)
        console.warn('[DiagramConnections] Segmento não é ortogonal, usando snap normal');
        gridX = pixelsToGrid(closestPointOnSegment.x, true);
        gridY = pixelsToGrid(closestPointOnSegment.y, true);
      }

      // Validar que o ponto está dentro dos limites do segmento
      const minX = Math.min(segment.p1.x, segment.p2.x);
      const maxX = Math.max(segment.p1.x, segment.p2.x);
      const minY = Math.min(segment.p1.y, segment.p2.y);
      const maxY = Math.max(segment.p1.y, segment.p2.y);

      const snappedX = gridToPixels(gridX);
      const snappedY = gridToPixels(gridY);

      // Adicionar margem de 1 grid unit para os limites
      const margin = 40; // 1 grid unit
      if (snappedX < minX - margin || snappedX > maxX + margin ||
          snappedY < minY - margin || snappedY > maxY + margin) {
        console.log('[DiagramConnections] Junction point fora dos limites do segmento');
        return;
      }

      // Criar junction point no store
      const { addEquipamento, finishConnecting, equipamentos } = useDiagramStore.getState();
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

      // Conectar ao junction point
      finishConnecting(junctionId, 'bottom');

      return;
    }

    // MODO EDIT: Selecionar conexão
    // Se já está selecionada e clicar novamente, deselecionar
    if (editor.selectedConnectionIds.includes(conexao.id)) {
      // Deselecionar clicando na mesma conexão
      const clearSelection = useDiagramStore.getState().clearSelection;
      clearSelection();
    } else {
      selectConnection(conexao.id);
    }
  };

  // Função auxiliar para encontrar o segmento mais próximo
  const findClosestSegment = (
    pontos: { x: number; y: number }[],
    clickPoint: { x: number; y: number }
  ) => {
    let closestSegment: { p1: { x: number; y: number }; p2: { x: number; y: number } } | null = null;
    let closestPoint = pontos[0];
    let minDistance = Infinity;

    // Para cada segmento da linha
    for (let i = 0; i < pontos.length - 1; i++) {
      const p1 = pontos[i];
      const p2 = pontos[i + 1];

      // Encontrar ponto mais próximo no segmento
      const segmentPoint = closestPointOnSegment(p1, p2, clickPoint);
      const distance = Math.hypot(segmentPoint.x - clickPoint.x, segmentPoint.y - clickPoint.y);

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = segmentPoint;
        closestSegment = { p1, p2 };
      }
    }

    return {
      segment: closestSegment,
      closestPointOnSegment: closestPoint,
      distance: minDistance,
    };
  };

  // Função auxiliar para encontrar o ponto mais próximo em uma linha ortogonal
  const findClosestPointOnPath = (pontos: { x: number; y: number }[], clickPoint: { x: number; y: number }) => {
    let closestPoint = pontos[0];
    let minDistance = Infinity;

    // Para cada segmento da linha
    for (let i = 0; i < pontos.length - 1; i++) {
      const p1 = pontos[i];
      const p2 = pontos[i + 1];

      // Encontrar ponto mais próximo no segmento
      const segmentPoint = closestPointOnSegment(p1, p2, clickPoint);
      const distance = Math.hypot(segmentPoint.x - clickPoint.x, segmentPoint.y - clickPoint.y);

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = segmentPoint;
      }
    }

    return closestPoint;
  };

  // Encontrar ponto mais próximo em um segmento de linha
  const closestPointOnSegment = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    point: { x: number; y: number }
  ) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) return p1; // Segmento é um ponto

    // Projetar o ponto no segmento
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // Clampar entre 0 e 1

    return {
      x: p1.x + t * dx,
      y: p1.y + t * dy,
    };
  };

  const handleConnectionDoubleClick = (conexaoId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (editor.mode === 'edit' && confirm('Deletar esta conexão?')) {
      removeConexao(conexaoId);
    }
  };

  // ==========================================================================
  // RENDERIZAÇÃO DE BARRAMENTO
  // ==========================================================================

  const renderBarramento = (barramento: Barramento) => {
    const path = getBarramentoPath(barramento);

    return (
      <g key={barramento.id} className="barramento">
        {/* Linha horizontal do barramento */}
        <path
          d={path}
          stroke={themeColors.barramentoColor}
          strokeWidth={CONNECTION.STROKE_WIDTH + 1}
          fill="none"
          className="barramento-line"
        />

        {/* Conexões que saem do barramento */}
        {barramento.conexoes.map(conexao => renderConexao(conexao, true))}
      </g>
    );
  };

  // ==========================================================================
  // RENDERIZAÇÃO DE CONEXÃO
  // ==========================================================================

  const renderConexao = (conexao: VisualConnection, isFromBarramento = false) => {
    // Se já foi renderizada pelo barramento, skip
    if (!isFromBarramento && conexao.isBarramento) {
      return null;
    }

    const isSelected = editor.selectedConnectionIds.includes(conexao.id);

    // Gerar path SVG com cantos arredondados
    const path = pointsToSvgPathRounded(conexao.pontos, CONNECTION.CORNER_RADIUS);

    // Cursor: pointer em modo edit, crosshair em modo connecting, default caso contrário
    const cursorStyle = editor.mode === 'edit' ? 'pointer' : editor.mode === 'connecting' ? 'crosshair' : 'default';

    return (
      <g key={conexao.id} className="connection-group">
        {/* Área de clique invisível maior (melhor UX) */}
        <path
          d={path}
          stroke="transparent"
          strokeWidth={16}
          fill="none"
          style={{ cursor: cursorStyle, pointerEvents: 'stroke' }}
          onClick={(e) => handleConnectionClick(conexao, e)}
          onDoubleClick={(e) => handleConnectionDoubleClick(conexao.id, e)}
        />

        {/* Linha visual */}
        <path
          d={path}
          stroke={isSelected ? CONNECTION.COLOR_SELECTED : themeColors.connectionLine}
          strokeWidth={isSelected ? CONNECTION.STROKE_WIDTH_SELECTED : CONNECTION.STROKE_WIDTH}
          fill="none"
          className={`connection-line ${isSelected ? 'selected' : ''}`}
          data-connection-id={conexao.id}
          style={{ pointerEvents: 'none' }}
        />
      </g>
    );
  };

  // ==========================================================================
  // SEPARAR CONEXÕES NORMAIS DAS DE BARRAMENTO
  // ==========================================================================

  const { conexoesNormais, conexoesDeBarramento } = useMemo(() => {
    const barramentoConnectionIds = new Set(
      barramentos.flatMap(b => b.conexoes.map(c => c.id))
    );

    return {
      conexoesNormais: visualConnections.filter(c => !barramentoConnectionIds.has(c.id)),
      conexoesDeBarramento: visualConnections.filter(c => barramentoConnectionIds.has(c.id)),
    };
  }, [visualConnections, barramentos]);

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  return (
    <g className="diagram-connections">
      {/* Conexões normais (sem barramento) */}
      <g className="normal-connections">
        {conexoesNormais.map(conexao => renderConexao(conexao))}
      </g>

      {/* Barramentos (com suas conexões) */}
      <g className="barramentos">
        {barramentos.map(barramento => renderBarramento(barramento))}
      </g>
    </g>
  );
};
