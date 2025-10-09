// src/features/supervisorio/utils/junctionHelpers.ts

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

interface Point {
  x: number;
  y: number;
}

interface JunctionNodeData {
  id: string;
  tipo: "JUNCTION";
  nome: string;
  posicao: { x: number; y: number };
  status: "NORMAL";
  dados: {
    isJunction: true;
  };
}

/**
 * Calcula a distância de um ponto a uma linha
 */
export function distanceToLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Detecta clique em uma edge (linha)
 */
export function detectEdgeClick(
  clickPoint: Point,
  connection: Connection,
  componentes: ComponenteDU[],
  containerRect: DOMRect,
  threshold: number = 10
): boolean {
  const fromComponent = componentes.find((c) => c.id === connection.from);
  const toComponent = componentes.find((c) => c.id === connection.to);

  if (!fromComponent || !toComponent) return false;

  const fromX = (fromComponent.posicao.x / 100) * containerRect.width;
  const fromY = (fromComponent.posicao.y / 100) * containerRect.height;
  const toX = (toComponent.posicao.x / 100) * containerRect.width;
  const toY = (toComponent.posicao.y / 100) * containerRect.height;

  const distance = distanceToLine(
    clickPoint,
    { x: fromX, y: fromY },
    { x: toX, y: toY }
  );

  return distance <= threshold;
}

/**
 * Calcula a posição do clique em relação ao container (em porcentagem)
 */
export function calculateJunctionPosition(
  clickPoint: Point,
  containerRect: DOMRect
): { x: number; y: number } {
  return {
    x: (clickPoint.x / containerRect.width) * 100,
    y: (clickPoint.y / containerRect.height) * 100,
  };
}

/**
 * Cria um novo nó de junção
 */
export function createJunctionNode(
  position: { x: number; y: number },
  existingComponents: ComponenteDU[]
): JunctionNodeData {
  // Gera ID único para o junction node
  const junctionCount = existingComponents.filter(
    (c) => c.tipo === "JUNCTION"
  ).length;
  const id = `junction-${Date.now()}-${junctionCount}`;

  return {
    id,
    tipo: "JUNCTION",
    nome: "", // Sem nome/texto visível
    posicao: position,
    status: "NORMAL",
    dados: {
      isJunction: true,
    },
  };
}

/**
 * Divide uma conexão existente em duas, inserindo um nó de junção
 */
export function splitConnectionWithJunction(
  originalConnection: Connection,
  junctionNodeId: string
): { connection1: Connection; connection2: Connection } {
  // Primeira conexão: do componente original até o junction
  const connection1: Connection = {
    id: `${originalConnection.id}-to-junction`,
    from: originalConnection.from,
    to: junctionNodeId,
    fromPort: originalConnection.fromPort,
    toPort: getOppositePort(originalConnection.fromPort), // Junction recebe na porta oposta
  };

  // Segunda conexão: do junction até o componente destino
  const connection2: Connection = {
    id: `junction-to-${originalConnection.id}`,
    from: junctionNodeId,
    to: originalConnection.to,
    fromPort: originalConnection.fromPort, // Junction envia na mesma direção
    toPort: originalConnection.toPort,
  };

  return { connection1, connection2 };
}

/**
 * Retorna a porta oposta (para conexões de entrada no junction)
 */
export function getOppositePort(
  port: "top" | "bottom" | "left" | "right"
): "top" | "bottom" | "left" | "right" {
  const opposites = {
    top: "bottom" as const,
    bottom: "top" as const,
    left: "right" as const,
    right: "left" as const,
  };
  return opposites[port];
}

/**
 * Verifica se um componente é um nó de junção
 */
export function isJunctionNode(component: ComponenteDU): boolean {
  return component.tipo === "JUNCTION" || component.dados?.isJunction === true;
}

/**
 * Remove um nó de junção e reconecta suas conexões
 */
export function removeJunctionAndReconnect(
  junctionId: string,
  connections: Connection[]
): { updatedConnections: Connection[]; removedConnectionIds: string[] } {
  // Encontra todas as conexões ligadas ao junction
  const connectedToJunction = connections.filter(
    (c) => c.from === junctionId || c.to === junctionId
  );

  if (connectedToJunction.length !== 2) {
    // Se não tiver exatamente 2 conexões, apenas remove o junction e suas conexões
    const removedIds = connectedToJunction.map((c) => c.id);
    const remaining = connections.filter(
      (c) => c.from !== junctionId && c.to !== junctionId
    );
    return { updatedConnections: remaining, removedConnectionIds: removedIds };
  }

  // Identifica as duas conexões
  const [conn1, conn2] = connectedToJunction;

  // Determina a nova conexão direta
  let newConnection: Connection;

  if (conn1.to === junctionId && conn2.from === junctionId) {
    // conn1 -> junction -> conn2
    newConnection = {
      id: `${conn1.from}-to-${conn2.to}`,
      from: conn1.from,
      to: conn2.to,
      fromPort: conn1.fromPort,
      toPort: conn2.toPort,
    };
  } else if (conn2.to === junctionId && conn1.from === junctionId) {
    // conn2 -> junction -> conn1
    newConnection = {
      id: `${conn2.from}-to-${conn1.to}`,
      from: conn2.from,
      to: conn1.to,
      fromPort: conn2.fromPort,
      toPort: conn1.toPort,
    };
  } else {
    // Caso não esperado, apenas remove as conexões
    const removedIds = connectedToJunction.map((c) => c.id);
    const remaining = connections.filter(
      (c) => c.from !== junctionId && c.to !== junctionId
    );
    return { updatedConnections: remaining, removedConnectionIds: removedIds };
  }

  // Remove as conexões antigas e adiciona a nova
  const updatedConnections = connections
    .filter((c) => c.from !== junctionId && c.to !== junctionId)
    .concat(newConnection);

  return {
    updatedConnections,
    removedConnectionIds: connectedToJunction.map((c) => c.id),
  };
}

/**
 * Obtém a posição interpolada na linha (0 = início, 1 = fim)
 */
export function getInterpolatedPosition(
  lineStart: Point,
  lineEnd: Point,
  clickPoint: Point
): number {
  const A = clickPoint.x - lineStart.x;
  const B = clickPoint.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) return 0;

  const param = dot / lenSq;
  return Math.max(0, Math.min(1, param)); // Clamp entre 0 e 1
}

/**
 * Calcula a posição do junction baseada no ponto de clique na linha
 */
export function calculateJunctionPositionOnLine(
  clickPoint: Point,
  connection: Connection,
  componentes: ComponenteDU[],
  containerRect: DOMRect
): { x: number; y: number } | null {
  const fromComponent = componentes.find((c) => c.id === connection.from);
  const toComponent = componentes.find((c) => c.id === connection.to);

  if (!fromComponent || !toComponent) return null;

  const fromX = (fromComponent.posicao.x / 100) * containerRect.width;
  const fromY = (fromComponent.posicao.y / 100) * containerRect.height;
  const toX = (toComponent.posicao.x / 100) * containerRect.width;
  const toY = (toComponent.posicao.y / 100) * containerRect.height;

  // Calcula a posição interpolada
  const t = getInterpolatedPosition(
    { x: fromX, y: fromY },
    { x: toX, y: toY },
    clickPoint
  );

  // Calcula a posição exata na linha
  const junctionX = fromX + t * (toX - fromX);
  const junctionY = fromY + t * (toY - fromY);

  // Converte para porcentagem
  return {
    x: (junctionX / containerRect.width) * 100,
    y: (junctionY / containerRect.height) * 100,
  };
}
