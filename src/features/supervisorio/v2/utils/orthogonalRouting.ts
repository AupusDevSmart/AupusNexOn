/**
 * ROTEAMENTO ORTOGONAL (L-SHAPE)
 *
 * Calcula caminhos ortogonais (apenas horizontal + vertical) entre dois pontos.
 * Sem diagonais, apenas linhas retas em L ou Z.
 */

import { Point, PortPosition, Equipment } from '../types/diagram.types';
import { getEquipmentSizeInPixels, gridToPixels, GRID } from './diagramConstants';

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

  // Roteador direcao-aware: a linha SAI reta da porta de origem E ENTRA reta na
  // porta de destino (perpendicular as faces), com todas as dobras no grid.
  const off = GRID.SIZE; // 1 celula de afastamento antes de virar
  const snap = (v: number) => Math.round(v / GRID.SIZE) * GRID.SIZE;
  const dirVec = (d: 'up' | 'down' | 'left' | 'right') =>
    d === 'up' ? { x: 0, y: -1 } :
    d === 'down' ? { x: 0, y: 1 } :
    d === 'left' ? { x: -1, y: 0 } :
    { x: 1, y: 0 };

  const S = start.point;
  const E = end.point;
  const dS = dirVec(start.direction);
  const dE = dirVec(end.direction);

  // Troncos: um passo perpendicular pra fora de cada porta (garante saida/entrada retas).
  const S1 = { x: snap(S.x + dS.x * off), y: snap(S.y + dS.y * off) };
  const E1 = { x: snap(E.x + dE.x * off), y: snap(E.y + dE.y * off) };

  const pontos: Point[] = [S, S1];

  const sHoriz = dS.x !== 0; // origem sai na horizontal?
  const eHoriz = dE.x !== 0; // destino entra na horizontal?

  if (sHoriz && !eHoriz) {
    // origem horizontal + destino vertical -> "L": vai ate o X do destino e sobe/desce reto
    pontos.push({ x: E1.x, y: S1.y });
  } else if (!sHoriz && eHoriz) {
    // origem vertical + destino horizontal -> "L": sobe/desce ate o Y do destino e vai reto
    pontos.push({ x: S1.x, y: E1.y });
  } else if (sHoriz && eHoriz) {
    // ambos horizontais -> "Z" com trecho vertical no meio (no grid)
    const midX = snap((S1.x + E1.x) / 2);
    pontos.push({ x: midX, y: S1.y });
    pontos.push({ x: midX, y: E1.y });
  } else {
    // ambos verticais -> "Z" com trecho horizontal no meio (no grid)
    const midY = snap((S1.y + E1.y) / 2);
    pontos.push({ x: S1.x, y: midY });
    pontos.push({ x: E1.x, y: midY });
  }

  pontos.push(E1, E);

  return simplifyOrthogonal(pontos);
};

/**
 * Remove pontos duplicados e funde segmentos colineares — elimina "dobras
 * fantasma" (ex.: o tronco que sai colinear com o primeiro segmento vira reta).
 */
const simplifyOrthogonal = (pts: Point[]): Point[] => {
  const dedup: Point[] = [];
  for (const p of pts) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) {
      dedup.push(p);
    }
  }

  // So funde o ponto do meio se ele estiver ENTRE os vizinhos (redundante mesmo).
  // Se a linha "volta" (nao-monotonica), mantem o ponto: e o degrau de 1 celula que
  // garante sair/entrar reto na frente da porta antes de virar.
  const between = (m: number, p: number, q: number) =>
    m >= Math.min(p, q) - 0.01 && m <= Math.max(p, q) + 0.01;

  const out: Point[] = [];
  for (let i = 0; i < dedup.length; i++) {
    if (i > 0 && i < dedup.length - 1) {
      const a = dedup[i - 1];
      const b = dedup[i];
      const c = dedup[i + 1];
      const redundanteH =
        Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01 && between(b.x, a.x, c.x);
      const redundanteV =
        Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01 && between(b.y, a.y, c.y);
      if (redundanteH || redundanteV) continue;
    }
    out.push(dedup[i]);
  }
  return out;
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
