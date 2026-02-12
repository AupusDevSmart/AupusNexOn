/**
 * DETECTOR DE BARRAMENTOS (VIRTUAL)
 *
 * Detecta algoritmicamente quando 3+ conexões saem do mesmo ponto,
 * formando um "barramento horizontal" visual.
 *
 * IMPORTANTE: Barramentos NÃO existem no banco de dados!
 * São detectados em tempo real no frontend baseado nas conexões existentes.
 */

import {
  Barramento,
  Connection,
  Equipment,
  Point,
  VisualConnection,
} from '../types/diagram.types';
import { getPortPoint, calculateOrthogonalRoute } from './orthogonalRouting';
import { CONNECTION } from './diagramConstants';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TIPOS AUXILIARES
// ============================================================================

interface ConexoesAgrupadasPorOrigem {
  equipamentoId: string;
  porta: string;
  conexoes: VisualConnection[];
}

// ============================================================================
// DETECÇÃO DE BARRAMENTOS
// ============================================================================

/**
 * Detecta todos os barramentos em um conjunto de conexões
 *
 * Algoritmo:
 * 1. Agrupa conexões por (equipamentoOrigemId + portaOrigem)
 * 2. Se um grupo tem 3+ conexões → É um barramento
 * 3. Calcula linha horizontal do barramento
 * 4. Recalcula rotas das conexões para passarem pelo barramento
 *
 * @param conexoes - Todas as conexões do diagrama
 * @param equipamentos - Todos os equipamentos do diagrama
 * @returns Array de barramentos detectados
 */
export const detectBarramentos = (
  conexoes: Connection[],
  equipamentos: Equipment[]
): Barramento[] => {
  // 1. Criar mapa de equipamentos para acesso rápido
  const equipamentosMap = new Map<string, Equipment>();
  equipamentos.forEach(eq => equipamentosMap.set(eq.id, eq));

  // 2. Agrupar conexões por origem (equipamento + porta)
  const grupos = agruparConexoesPorOrigem(conexoes, equipamentosMap);

  // 3. Filtrar apenas grupos com 3+ conexões (barramentos)
  const barramentos: Barramento[] = [];

  for (const grupo of grupos) {
    if (grupo.conexoes.length >= CONNECTION.BARRAMENTO_MIN_CONNECTIONS) {
      const barramento = criarBarramento(grupo, equipamentosMap);
      barramentos.push(barramento);
    }
  }

  return barramentos;
};

/**
 * Agrupa conexões por ponto de origem (equipamento + porta)
 */
const agruparConexoesPorOrigem = (
  conexoes: Connection[],
  equipamentosMap: Map<string, Equipment>
): ConexoesAgrupadasPorOrigem[] => {
  const grupos = new Map<string, VisualConnection[]>();

  for (const conexao of conexoes) {
    const origem = equipamentosMap.get(conexao.equipamentoOrigemId);
    const destino = equipamentosMap.get(conexao.equipamentoDestinoId);

    if (!origem || !destino) continue; // Equipamento não encontrado

    // Chave única: equipamentoId + porta
    const chave = `${conexao.equipamentoOrigemId}:${conexao.portaOrigem}`;

    // Calcular rota ortogonal
    const pontos = calculateOrthogonalRoute(
      origem,
      conexao.portaOrigem,
      destino,
      conexao.portaDestino
    );

    const visualConexao: VisualConnection = {
      ...conexao,
      equipamentoOrigem: origem,
      equipamentoDestino: destino,
      pontos,
      isBarramento: false, // Será atualizado depois
    };

    if (!grupos.has(chave)) {
      grupos.set(chave, []);
    }

    grupos.get(chave)!.push(visualConexao);
  }

  // Converter Map para Array
  return Array.from(grupos.entries()).map(([chave, conexoes]) => {
    const [equipamentoId, porta] = chave.split(':');
    return { equipamentoId, porta, conexoes };
  });
};

/**
 * Cria um objeto Barramento a partir de um grupo de conexões
 */
const criarBarramento = (
  grupo: ConexoesAgrupadasPorOrigem,
  equipamentosMap: Map<string, Equipment>
): Barramento => {
  const equipamento = equipamentosMap.get(grupo.equipamentoId);
  if (!equipamento) {
    throw new Error(`Equipamento ${grupo.equipamentoId} não encontrado`);
  }

  // Ponto de origem do barramento
  const portaOrigem = grupo.porta as any; // PortPosition
  const pontoOrigem = getPortPoint(equipamento, portaOrigem);

  // Calcular Y do barramento (linha horizontal)
  const barramentoY =
    pontoOrigem.point.y +
    (pontoOrigem.direction === 'up'
      ? -CONNECTION.BARRAMENTO_OFFSET
      : CONNECTION.BARRAMENTO_OFFSET);

  // Calcular extensão horizontal do barramento (X mínimo e máximo)
  let xMin = pontoOrigem.point.x;
  let xMax = pontoOrigem.point.x;

  for (const conexao of grupo.conexoes) {
    const destinoX = getPortPoint(
      conexao.equipamentoDestino,
      conexao.portaDestino
    ).point.x;

    xMin = Math.min(xMin, destinoX);
    xMax = Math.max(xMax, destinoX);
  }

  // Adicionar margem
  const MARGEM = 20;
  xMin -= MARGEM;
  xMax += MARGEM;

  // Recalcular rotas das conexões para passarem pelo barramento
  const conexoesComBarramento = grupo.conexoes.map(conexao => {
    const novaRota = calcularRotaComBarramento(
      conexao,
      pontoOrigem.point,
      barramentoY
    );

    return {
      ...conexao,
      pontos: novaRota,
      isBarramento: true,
    };
  });

  return {
    id: uuidv4(),
    equipamentoOrigemId: grupo.equipamentoId,
    portaOrigem: portaOrigem,
    pontoOrigem: pontoOrigem.point,
    conexoes: conexoesComBarramento,
    y: barramentoY,
    xInicio: xMin,
    xFim: xMax,
  };
};

/**
 * Recalcula a rota de uma conexão para passar pelo barramento horizontal
 *
 * Estratégia:
 * 1. Sai do equipamento origem
 * 2. Desce/sobe até o barramento (linha horizontal)
 * 3. Vai horizontal até o X do destino
 * 4. Desce/sobe até o equipamento destino
 */
const calcularRotaComBarramento = (
  conexao: VisualConnection,
  pontoOrigem: Point,
  barramentoY: number
): Point[] => {
  const pontoDestino = getPortPoint(
    conexao.equipamentoDestino,
    conexao.portaDestino
  ).point;

  const pontos: Point[] = [];

  // 1. Ponto de origem
  pontos.push(pontoOrigem);

  // 2. Desce/sobe até o barramento
  pontos.push({ x: pontoOrigem.x, y: barramentoY });

  // 3. Vai horizontal até o X do destino
  pontos.push({ x: pontoDestino.x, y: barramentoY });

  // 4. Desce/sobe até o destino
  pontos.push(pontoDestino);

  return pontos;
};

// ============================================================================
// CONVERSÃO DE CONEXÕES PARA VISUAL
// ============================================================================

/**
 * Converte conexões simples (do backend) para conexões visuais com roteamento
 *
 * Esta função:
 * 1. Popula equipamentos de origem/destino
 * 2. Calcula rotas ortogonais
 * 3. Detecta e processa barramentos
 */
export const convertToVisualConnections = (
  conexoes: Connection[],
  equipamentos: Equipment[]
): {
  visualConnections: VisualConnection[];
  barramentos: Barramento[];
} => {
  // 1. Criar mapa de equipamentos
  const equipamentosMap = new Map<string, Equipment>();
  equipamentos.forEach(eq => equipamentosMap.set(eq.id, eq));

  // 2. Detectar barramentos
  const barramentos = detectBarramentos(conexoes, equipamentos);

  // 3. Criar set de IDs de conexões que pertencem a barramentos
  const conexoesComBarramentoIds = new Set<string>();
  barramentos.forEach(barramento => {
    barramento.conexoes.forEach(conn => {
      conexoesComBarramentoIds.add(conn.id);
    });
  });

  // 4. Processar conexões
  const visualConnections: VisualConnection[] = [];

  for (const conexao of conexoes) {
    const origem = equipamentosMap.get(conexao.equipamentoOrigemId);
    const destino = equipamentosMap.get(conexao.equipamentoDestinoId);

    if (!origem || !destino) continue;

    // Se a conexão pertence a um barramento, usar rota já calculada
    if (conexoesComBarramentoIds.has(conexao.id)) {
      const barramentoDaConexao = barramentos.find(b =>
        b.conexoes.some(c => c.id === conexao.id)
      );

      if (barramentoDaConexao) {
        const conexaoDoBarramento = barramentoDaConexao.conexoes.find(
          c => c.id === conexao.id
        )!;

        visualConnections.push(conexaoDoBarramento);
        continue;
      }
    }

    // Conexão normal (sem barramento)
    const pontos = calculateOrthogonalRoute(
      origem,
      conexao.portaOrigem,
      destino,
      conexao.portaDestino
    );

    visualConnections.push({
      ...conexao,
      equipamentoOrigem: origem,
      equipamentoDestino: destino,
      pontos,
      isBarramento: false,
    });
  }

  return { visualConnections, barramentos };
};

// ============================================================================
// RENDERIZAÇÃO DE BARRAMENTO (SVG PATH)
// ============================================================================

/**
 * Gera o caminho SVG da linha horizontal do barramento
 */
export const getBarramentoPath = (barramento: Barramento): string => {
  return `M ${barramento.xInicio},${barramento.y} L ${barramento.xFim},${barramento.y}`;
};

/**
 * Verifica se um ponto está próximo de um barramento (para hover/click)
 */
export const isPointNearBarramento = (
  point: Point,
  barramento: Barramento,
  threshold: number = 5
): boolean => {
  // Verifica se está na faixa X do barramento
  if (point.x < barramento.xInicio || point.x > barramento.xFim) {
    return false;
  }

  // Verifica se está próximo do Y do barramento
  return Math.abs(point.y - barramento.y) <= threshold;
};
