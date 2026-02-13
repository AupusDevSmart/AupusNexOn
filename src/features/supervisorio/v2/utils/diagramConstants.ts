/**
 * DIAGRAMA UNIFILAR V2 - CONSTANTES
 *
 * Todos os valores fixos e configurações do sistema
 */

import { ThemeColors, Theme } from '../types/diagram.types';

// ============================================================================
// CANVAS E VIEWPORT
// ============================================================================

export const CANVAS = {
  WIDTH: 1920, // Largura fixa (não responsivo)
  HEIGHT: 1080, // Altura fixa
  BACKGROUND_LIGHT: '#FFFFFF',
  BACKGROUND_DARK: '#1A1A1A',
} as const;

export const VIEWPORT = {
  MIN_SCALE: 0.05, // Zoom mínimo (5%) - permite ver área muito maior
  MAX_SCALE: 10.0, // Zoom máximo (1000%) - permite ver detalhes muito de perto
  DEFAULT_SCALE: 1.0, // Zoom inicial (100%)
  ZOOM_STEP: 0.1, // Incremento do zoom (mouse wheel)
  PAN_FRICTION: 0.95, // Suavização do pan (opcional)
} as const;

// ============================================================================
// GRID
// ============================================================================

export const GRID = {
  SIZE: 40, // Tamanho da célula do grid (pixels)
  COLOR_LIGHT: 'rgba(0, 0, 0, 0.12)', // Cor do grid (tema claro) - mais visível
  COLOR_DARK: 'rgba(255, 255, 255, 0.15)', // Cor do grid (tema escuro) - mais visível
  SNAP_ENABLED: true, // Snap to grid habilitado por padrão
} as const;

// ============================================================================
// EQUIPAMENTOS - DIMENSÕES PADRÃO
// ============================================================================

/**
 * Dimensões em unidades de grid (multiplicar por GRID.SIZE para pixels)
 */
export const EQUIPMENT_SIZES = {
  // Inversores - TODOS 2x2 (80x80px)
  INVERSOR_FRONIUS: { width: 2, height: 2 },
  INVERSOR_GROWATT: { width: 2, height: 2 },
  INVERSOR_SUNGROW: { width: 2, height: 2 },
  INVERSOR_HUAWEI: { width: 2, height: 2 },
  INVERSOR_WEG: { width: 2, height: 2 },
  INVERSOR_SOFAR: { width: 2, height: 2 },
  INVERSOR: { width: 2, height: 2 },

  // Quadros/QGBTs - TODOS 2x2 (80x80px)
  QGBT: { width: 2, height: 2 },
  QD: { width: 2, height: 2 },
  QUADRO_GERAL: { width: 2, height: 2 },
  QUADRO_DISTRIBUICAO: { width: 2, height: 2 },

  // Transformadores - 2x3 (80x120px - vertical)
  TRANSFORMADOR: { width: 2, height: 2 },
  TRAFO_REBAIXADOR: { width: 2, height: 2 },
  TRAFO: { width: 2, height: 2 },
  TRAFO_ELEVADOR: { width: 2, height: 2 },

  // Medidores - TODOS 2x2 (80x80px)
  MEDIDOR: { width: 2, height: 2 },
  MEDIDOR_ENERGIA: { width: 2, height: 2 },
  MEDIDOR_TRIFASICO: { width: 2, height: 2 },
  METER_M160: { width: 2, height: 2 },
  M160: { width: 2, height: 2 },
  METER_M300: { width: 2, height: 2 },
  M300: { width: 2, height: 2 },
  LANDIS_E750: { width: 2, height: 2 },
  A966: { width: 2, height: 2 },

  // Disjuntores - TODOS 2x2 (80x80px)
  DISJUNTOR: { width: 2, height: 2 },
  DISJUNTOR_GERAL: { width: 2, height: 2 },
  DISJUNTOR_TERMICO: { width: 2, height: 2 },
  DISJUNTOR_MAGNETOTERMICO: { width: 2, height: 2 },

  // Carregadores Elétricos - TODOS 2x2 (80x80px)
  CARREGADOR_ELETRICO: { width: 2, height: 2 },

  // Chaves - 2x4 (80x160px - vertical, SVG se ajusta automaticamente ao espaço)
  CHAVE: { width: 2, height: 4 },
  CHAVE_SECCIONADORA: { width: 2, height: 4 },
  CHAVE_FUSIVEL: { width: 2, height: 4 },

  // Cargas - TODOS 2x2 (80x80px)
  CARGA: { width: 2, height: 2 },
  MOTOR: { width: 2, height: 2 },
  ILUMINACAO: { width: 2, height: 2 },

  // Concessionária - TODOS 2x2 (80x80px)
  REDE_CONCESSIONARIA: { width: 2, height: 2 },
  REDE: { width: 2, height: 2 },
  ENTRADA_ENERGIA: { width: 2, height: 2 },
  CONCESSIONARIA: { width: 2, height: 2 },

  // Baterias - TODOS 2x2 (80x80px)
  BATERIA: { width: 2, height: 2 },
  BANCO_BATERIAS: { width: 2, height: 2 },

  // Geradores - TODOS 2x2 (80x80px)
  GERADOR: { width: 2, height: 2 },
  NOBREAK: { width: 2, height: 2 },

  // Equipamento genérico - 2x2 (80x80px)
  EQUIPAMENTO: { width: 2, height: 2 },

  // Ponto de junção (invisível, apenas para organizar conexões)
  JUNCTION_POINT: { width: 0.25, height: 0.25 }, // 10x10px - muito pequeno
  JP: { width: 0.25, height: 0.25 },
  JUNCAO: { width: 0.25, height: 0.25 },

  // Padrão para tipos desconhecidos - 2x2 (80x80px)
  DEFAULT: { width: 2, height: 2 },
} as const;

// ============================================================================
// CONEXÕES - ESTILOS
// ============================================================================

export const CONNECTION = {
  STROKE_WIDTH: 4, // Espessura da linha (pixels) - mais grossa
  STROKE_WIDTH_SELECTED: 5, // Espessura quando selecionada

  // Cores (tema-aware)
  COLOR_LIGHT: '#374151', // Cinza escuro para tema claro
  COLOR_DARK: '#FFFFFF', // Branco para tema escuro
  COLOR_SELECTED: '#3B82F6', // Azul quando selecionada
  COLOR_HOVER: '#60A5FA', // Azul claro no hover

  // Barramento
  BARRAMENTO_OFFSET: 40, // Distância vertical do barramento (pixels)
  BARRAMENTO_MIN_CONNECTIONS: 3, // Mínimo de conexões para detectar barramento

  // Roteamento
  ROUTING_TYPE: 'orthogonal' as const, // Sempre L-shape
  CORNER_RADIUS: 4, // Raio dos cantos (pixels) - opcional
} as const;

// ============================================================================
// LABELS
// ============================================================================

export const LABEL = {
  FONT_SIZE: 12, // Tamanho da fonte (pixels)
  FONT_FAMILY: 'Inter, system-ui, sans-serif',
  OFFSET: 8, // Distância do equipamento (pixels)

  // Cores (tema-aware)
  COLOR_LIGHT: '#1F2937', // Texto escuro para tema claro
  COLOR_DARK: '#F3F4F6', // Texto claro para tema escuro
} as const;

// ============================================================================
// GRUPOS (DASHED BOXES)
// ============================================================================

export const GROUP = {
  STROKE_WIDTH: 2,
  STROKE_DASHARRAY: '8 4', // Linha tracejada (8px linha, 4px espaço)

  // Cores padrão
  COLOR_LIGHT: '#9CA3AF', // Cinza médio
  COLOR_DARK: '#6B7280',

  PADDING: 20, // Padding interno (pixels)
  CORNER_RADIUS: 8, // Raio dos cantos (pixels)

  // Label do grupo
  LABEL_FONT_SIZE: 14,
  LABEL_OFFSET: 12, // Distância da borda superior
} as const;

// ============================================================================
// SELEÇÃO
// ============================================================================

export const SELECTION = {
  COLOR: '#3B82F6', // Azul
  STROKE_WIDTH: 2,
  FILL_OPACITY: 0.1, // Fundo semi-transparente

  // Bounding box
  HANDLE_SIZE: 8, // Tamanho dos handles de resize (pixels)
  HANDLE_COLOR: '#FFFFFF',
  HANDLE_STROKE: '#3B82F6',
} as const;

// ============================================================================
// TEMAS
// ============================================================================

export const THEMES: Record<Theme, ThemeColors> = {
  light: {
    background: CANVAS.BACKGROUND_LIGHT,
    gridLine: GRID.COLOR_LIGHT,
    connectionLine: CONNECTION.COLOR_LIGHT,
    iconColor: '#1F2937', // Ícones escuros
    labelColor: LABEL.COLOR_LIGHT,
    selectionColor: SELECTION.COLOR,
    barramentoColor: CONNECTION.COLOR_LIGHT,
    groupBorder: GROUP.COLOR_LIGHT,
  },
  dark: {
    background: CANVAS.BACKGROUND_DARK,
    gridLine: GRID.COLOR_DARK,
    connectionLine: CONNECTION.COLOR_DARK,
    iconColor: '#E5E7EB', // Ícones claros (um pouco menos brilhante)
    labelColor: LABEL.COLOR_DARK,
    selectionColor: SELECTION.COLOR,
    barramentoColor: CONNECTION.COLOR_DARK,
    groupBorder: GROUP.COLOR_DARK,
  },
} as const;

// ============================================================================
// ANIMAÇÕES
// ============================================================================

export const ANIMATION = {
  DURATION: 200, // Duração padrão (ms)
  EASING: 'cubic-bezier(0.4, 0, 0.2, 1)', // Easing function

  // Zoom suave
  ZOOM_DURATION: 150,

  // Pan suave
  PAN_DURATION: 100,
} as const;

// ============================================================================
// ÍCONES SVG - CONFIGURAÇÃO
// ============================================================================

export const ICON = {
  STROKE_WIDTH: 1.5, // Espessura padrão dos traços
  USE_CURRENT_COLOR: true, // Usar currentColor para monocromaticidade

  // Status colors (opcional - só se quiser mostrar status)
  STATUS_NORMAL: '#10B981', // Verde
  STATUS_ALERTA: '#F59E0B', // Amarelo
  STATUS_FALHA: '#EF4444', // Vermelho
  STATUS_DESCONHECIDO: '#6B7280', // Cinza
} as const;

// ============================================================================
// PORTAS (CONEXÃO)
// ============================================================================

export const PORT = {
  SIZE: 8, // Tamanho visual da porta (círculo)
  COLOR: '#3B82F6', // Azul
  COLOR_HOVER: '#60A5FA',
  COLOR_ACTIVE: '#2563EB', // Azul escuro (durante conexão)

  // Posições relativas (percentual)
  POSITIONS: {
    top: { x: 0.5, y: 0 },
    bottom: { x: 0.5, y: 1 },
    left: { x: 0, y: 0.5 },
    right: { x: 1, y: 0.5 },
  },
} as const;

// ============================================================================
// PERFORMANCE
// ============================================================================

export const PERFORMANCE = {
  // Virtualização (se tiver muitos equipamentos)
  ENABLE_VIRTUALIZATION: false, // Desabilitado por padrão (canvas fixo pequeno)
  VIRTUALIZATION_THRESHOLD: 100, // Número de equipamentos para ativar

  // Debounce
  SAVE_DEBOUNCE_MS: 1000, // Debounce ao salvar layout (1 segundo)
  SEARCH_DEBOUNCE_MS: 300, // Debounce na busca

  // Throttle
  PAN_THROTTLE_MS: 16, // ~60fps
  ZOOM_THROTTLE_MS: 16,
} as const;

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Converte coordenadas de grid para pixels
 */
export const gridToPixels = (gridUnits: number): number => {
  return gridUnits * GRID.SIZE;
};

/**
 * Converte pixels para coordenadas de grid (com snap)
 */
export const pixelsToGrid = (pixels: number, snap: boolean = true): number => {
  if (snap) {
    return Math.round(pixels / GRID.SIZE);
  }
  return pixels / GRID.SIZE;
};

/**
 * Obtém dimensões de equipamento em pixels
 */
export const getEquipmentSizeInPixels = (tipo: string): { width: number; height: number } => {
  const tipoUpper = tipo.toUpperCase().replace(/[^A-Z_]/g, '_');
  const size = EQUIPMENT_SIZES[tipoUpper as keyof typeof EQUIPMENT_SIZES] || EQUIPMENT_SIZES.DEFAULT;

  return {
    width: gridToPixels(size.width),
    height: gridToPixels(size.height),
  };
};

/**
 * Obtém cores do tema atual
 */
export const getThemeColors = (theme: Theme): ThemeColors => {
  return THEMES[theme];
};
