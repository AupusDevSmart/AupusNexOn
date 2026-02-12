/**
 * ROTEAMENTO ORTOGONAL (L-SHAPE)
 *
 * Calcula caminhos ortogonais (apenas horizontal + vertical) entre dois pontos.
 * Sem diagonais, apenas linhas retas em L ou Z.
 */

import { Point, PortPosition, Equipment } from '../types/diagram.types';
import { getEquipmentSizeInPixels, gridToPixels } from './diagramConstants';

// ============================================================================
// TIPOS
// ============================================================================

interface PortPoint {
  point: Point;
  direction: 'up' | 'down' | 'left' | 'right';
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Calcula o ponto exato da porta de um equipamento
 */
export const getPortPoint = (
  equipment: Equipment,
  port: PortPosition
): PortPoint => {
  // Validar coordenadas do equipamento
  if (
    typeof equipment.posicaoX !== 'number' || typeof equipment.posicaoY !== 'number' ||
    isNaN(equipment.posicaoX) || isNaN(equipment.posicaoY) ||
    !isFinite(equipment.posicaoX) || !isFinite(equipment.posicaoY)
  ) {
    console.error('getPortPoint: equipamento com coordenadas inválidas', equipment);
    // Retornar um ponto padrão no centro do canvas
    return {
      point: { x: 960, y: 540 },
      direction: 'up',
    };
  }

  const size = getEquipmentSizeInPixels(equipment.tipo);
  const isJunctionPoint = equipment.tipo === 'JUNCTION_POINT';

  // Para junction points, TODAS as portas apontam para o centro do vértice
  if (isJunctionPoint) {
    const centerX = gridToPixels(equipment.posicaoX);
    const centerY = gridToPixels(equipment.posicaoY);

    // Todas as portas retornam exatamente o mesmo ponto (centro)
    return {
      point: { x: centerX, y: centerY },
      direction: port === 'top' ? 'up' : port === 'bottom' ? 'down' : port === 'left' ? 'left' : 'right',
    };
  }

  // Para equipamentos normais, calcular normalmente
  const baseX = gridToPixels(equipment.posicaoX);
  const baseY = gridToPixels(equipment.posicaoY);

  const centerX = baseX + size.width / 2;
  const centerY = baseY + size.height / 2;

  switch (port) {
    case 'top':
      return {
        point: { x: centerX, y: baseY },
        direction: 'up',
      };
    case 'bottom':
      return {
        point: { x: centerX, y: baseY + size.height },
        direction: 'down',
      };
    case 'left':
      return {
        point: { x: baseX, y: centerY },
        direction: 'left',
      };
    case 'right':
      return {
        point: { x: baseX + size.width, y: centerY },
        direction: 'right',
      };
  }
};

/**
 * Calcula distância entre dois pontos
 */
const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// ============================================================================
// ROTEAMENTO ORTOGONAL
// ============================================================================

/**
 * Calcula rota ortogonal (L-shape ou Z-shape) entre dois equipamentos
 *
 * Estratégia:
 * 1. Sai da porta de origem na direção correta
 * 2. Faz uma ou duas curvas de 90° (L ou Z)
 * 3. Chega na porta de destino na direção correta
 *
 * @param origem - Equipamento de origem
 * @param portaOrigem - Porta de saída
 * @param destino - Equipamento de destino
 * @param portaDestino - Porta de entrada
 * @returns Array de pontos formando o caminho ortogonal
 */
export const calculateOrthogonalRoute = (
  origem: Equipment,
  portaOrigem: PortPosition,
  destino: Equipment,
  portaDestino: PortPosition
): Point[] => {
  const start = getPortPoint(origem, portaOrigem);
  const end = getPortPoint(destino, portaDestino);

  // Distância mínima para sair do equipamento antes de fazer curva
  const MIN_OFFSET = 20;

  const pontos: Point[] = [];

  // Sempre começa no ponto da porta
  pontos.push(start.point);

  // ============================================================================
  // CASO 1: CONEXÃO SIMPLES (L-SHAPE)
  // ============================================================================

  // Se a origem é top/bottom e destino é left/right (ou vice-versa)
  // Podemos fazer uma única curva em L
  if (
    (start.direction === 'up' || start.direction === 'down') &&
    (end.direction === 'left' || end.direction === 'right')
  ) {
    // Primeiro segmento: sai verticalmente
    const offsetY = start.direction === 'up' ? -MIN_OFFSET : MIN_OFFSET;
    const midY = start.point.y + offsetY;

    pontos.push({ x: start.point.x, y: midY });

    // Segunda curva: vai horizontal até a linha do destino
    pontos.push({ x: end.point.x, y: midY });

    // Terceiro segmento: desce/sobe até o destino
    pontos.push(end.point);

    return pontos;
  }

  if (
    (start.direction === 'left' || start.direction === 'right') &&
    (end.direction === 'up' || end.direction === 'down')
  ) {
    // Primeiro segmento: sai horizontalmente
    const offsetX = start.direction === 'left' ? -MIN_OFFSET : MIN_OFFSET;
    const midX = start.point.x + offsetX;

    pontos.push({ x: midX, y: start.point.y });

    // Segunda curva: vai vertical até a linha do destino
    pontos.push({ x: midX, y: end.point.y });

    // Terceiro segmento: vai horizontal até o destino
    pontos.push(end.point);

    return pontos;
  }

  // ============================================================================
  // CASO 2: CONEXÃO PARALELA (Z-SHAPE)
  // ============================================================================

  // Ambas as portas são top/bottom (paralelas verticais)
  if (
    (start.direction === 'up' || start.direction === 'down') &&
    (end.direction === 'up' || end.direction === 'down')
  ) {
    // Sai verticalmente
    const offsetY = start.direction === 'up' ? -MIN_OFFSET : MIN_OFFSET;
    const midY = start.point.y + offsetY;

    pontos.push({ x: start.point.x, y: midY });

    // Vai horizontal até o X do destino
    pontos.push({ x: end.point.x, y: midY });

    // Desce/sobe até o destino
    pontos.push(end.point);

    return pontos;
  }

  // Ambas as portas são left/right (paralelas horizontais)
  if (
    (start.direction === 'left' || start.direction === 'right') &&
    (end.direction === 'left' || end.direction === 'right')
  ) {
    // Sai horizontalmente
    const offsetX = start.direction === 'left' ? -MIN_OFFSET : MIN_OFFSET;
    const midX = start.point.x + offsetX;

    pontos.push({ x: midX, y: start.point.y });

    // Vai vertical até o Y do destino
    pontos.push({ x: midX, y: end.point.y });

    // Vai horizontal até o destino
    pontos.push(end.point);

    return pontos;
  }

  // ============================================================================
  // CASO 3: CONEXÃO OPOSTA (U-SHAPE)
  // ============================================================================

  // Se as direções são opostas (ex: origin.right → destino.left)
  // Precisa fazer um U

  if (
    (start.direction === 'up' && end.direction === 'down') ||
    (start.direction === 'down' && end.direction === 'up')
  ) {
    // Sai verticalmente
    const offsetY = start.direction === 'up' ? -MIN_OFFSET : MIN_OFFSET;
    const midY = (start.point.y + end.point.y) / 2;

    pontos.push({ x: start.point.x, y: midY });
    pontos.push({ x: end.point.x, y: midY });
    pontos.push(end.point);

    return pontos;
  }

  if (
    (start.direction === 'left' && end.direction === 'right') ||
    (start.direction === 'right' && end.direction === 'left')
  ) {
    // Sai horizontalmente
    const offsetX = start.direction === 'left' ? -MIN_OFFSET : MIN_OFFSET;
    const midX = (start.point.x + end.point.x) / 2;

    pontos.push({ x: midX, y: start.point.y });
    pontos.push({ x: midX, y: end.point.y });
    pontos.push(end.point);

    return pontos;
  }

  // Fallback: linha reta (não deveria acontecer)
  pontos.push(end.point);
  return pontos;
};

// ============================================================================
// CONVERSÃO PARA SVG PATH
// ============================================================================

/**
 * Converte array de pontos para string SVG path
 *
 * Exemplo:
 * [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]
 * →
 * "M 0,0 L 100,0 L 100,100"
 */
export const pointsToSvgPath = (pontos: Point[]): string => {
  if (pontos.length === 0) return '';

  const [primeiro, ...resto] = pontos;

  const moveTo = `M ${primeiro.x},${primeiro.y}`;
  const lineTos = resto.map(p => `L ${p.x},${p.y}`).join(' ');

  return `${moveTo} ${lineTos}`;
};

/**
 * Converte array de pontos para string SVG path com cantos arredondados
 */
export const pointsToSvgPathRounded = (pontos: Point[], radius: number = 4): string => {
  if (pontos.length < 3) {
    return pointsToSvgPath(pontos);
  }

  // Validar que todos os pontos têm valores numéricos válidos
  const pontosValidos = pontos.filter(p =>
    typeof p.x === 'number' && typeof p.y === 'number' &&
    !isNaN(p.x) && !isNaN(p.y) &&
    isFinite(p.x) && isFinite(p.y)
  );

  if (pontosValidos.length < 2) {
    console.warn('pointsToSvgPathRounded: pontos insuficientes ou inválidos', pontos);
    return '';
  }

  if (pontosValidos.length === 2) {
    return pointsToSvgPath(pontosValidos);
  }

  let path = `M ${pontosValidos[0].x},${pontosValidos[0].y}`;

  for (let i = 1; i < pontosValidos.length - 1; i++) {
    const prev = pontosValidos[i - 1];
    const curr = pontosValidos[i];
    const next = pontosValidos[i + 1];

    // Calcular direções
    const dxPrev = curr.x - prev.x;
    const dyPrev = curr.y - prev.y;
    const dxNext = next.x - curr.x;
    const dyNext = next.y - curr.y;

    // Calcular pontos de controle para curva suave
    const lenPrev = Math.sqrt(dxPrev * dxPrev + dyPrev * dyPrev);
    const lenNext = Math.sqrt(dxNext * dxNext + dyNext * dyNext);

    // Se os pontos são muito próximos (< 0.1px), pular o arredondamento
    if (lenPrev < 0.1 || lenNext < 0.1) {
      path += ` L ${curr.x},${curr.y}`;
      continue;
    }

    const r = Math.min(radius, lenPrev / 2, lenNext / 2);

    // Ponto antes da curva
    const x1 = curr.x - (dxPrev / lenPrev) * r;
    const y1 = curr.y - (dyPrev / lenPrev) * r;

    // Ponto depois da curva
    const x2 = curr.x + (dxNext / lenNext) * r;
    const y2 = curr.y + (dyNext / lenNext) * r;

    // Validar que os pontos calculados são válidos
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
      console.warn('pointsToSvgPathRounded: valores NaN detectados', { prev, curr, next, lenPrev, lenNext });
      path += ` L ${curr.x},${curr.y}`;
      continue;
    }

    // Linha até antes da curva + quadratic bezier + linha após curva
    path += ` L ${x1},${y1}`;
    path += ` Q ${curr.x},${curr.y} ${x2},${y2}`;
  }

  // Linha final
  const ultimo = pontosValidos[pontosValidos.length - 1];
  path += ` L ${ultimo.x},${ultimo.y}`;

  return path;
};

// ============================================================================
// DETECÇÃO DE COLISÃO (OPCIONAL)
// ============================================================================

/**
 * Verifica se uma linha passa por cima de um equipamento
 * (Útil para evitar roteamento por cima de outros equipamentos)
 */
export const lineIntersectsEquipment = (
  p1: Point,
  p2: Point,
  equipment: Equipment
): boolean => {
  const size = getEquipmentSizeInPixels(equipment.tipo);
  const equipX = gridToPixels(equipment.posicaoX);
  const equipY = gridToPixels(equipment.posicaoY);

  // Bounding box do equipamento
  const left = equipX;
  const right = equipX + size.width;
  const top = equipY;
  const bottom = equipY + size.height;

  // Verifica se a linha (horizontal ou vertical) intersecta o retângulo
  if (p1.x === p2.x) {
    // Linha vertical
    const x = p1.x;
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    return x >= left && x <= right && maxY >= top && minY <= bottom;
  }

  if (p1.y === p2.y) {
    // Linha horizontal
    const y = p1.y;
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);

    return y >= top && y <= bottom && maxX >= left && minX <= right;
  }

  return false;
};
