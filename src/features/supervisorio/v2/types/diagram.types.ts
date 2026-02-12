/**
 * DIAGRAMA UNIFILAR V2 - TIPOS CENTRALIZADOS
 *
 * Tipos simplificados conforme nova arquitetura:
 * - Backend armazena apenas origem → destino
 * - Frontend calcula roteamento visual
 * - Sem barramento e pontos de junção no banco
 */

// ============================================================================
// EQUIPAMENTOS
// ============================================================================

export type PortPosition = 'top' | 'bottom' | 'left' | 'right';

export type LabelPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface Equipment {
  id: string;
  nome: string;
  tag: string;
  tipo: string;
  categoria?: string; // Categoria do equipamento (ex: "CHAVE", "INVERSOR_PV", "MEDIDOR_SSU")
  unidadeId: string;
  diagramaId: string | null;

  // Posicionamento (coordenadas de grid)
  posicaoX: number;
  posicaoY: number;
  rotacao: number; // 0, 90, 180, 270
  labelPosition: LabelPosition;

  // Offset customizado do label (em pixels, relativo à posição padrão)
  labelOffsetX?: number;
  labelOffsetY?: number;

  // Dimensões (definidas por tipo no constants)
  largura?: number;
  altura?: number;

  // Status operacional
  status?: 'normal' | 'alerta' | 'falha' | 'desconhecido';

  // MQTT
  mqttHabilitado?: boolean;
  topicoMqtt?: string;

  // Metadados
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ============================================================================
// CONEXÕES
// ============================================================================

/**
 * Origem ou destino de uma conexão
 * Pode ser um equipamento OU um junction point (ponto de junção)
 */
export interface OrigemDestino {
  tipo: 'equipamento' | 'junction';
  equipamentoId?: string; // Se tipo = 'equipamento'
  gridPoint?: Point; // Se tipo = 'junction'
  porta: PortPosition;
}

export interface Connection {
  id: string;
  diagramaId: string;

  // ===== OPÇÃO 1: Formato legado (compatibilidade) =====
  // Origem
  equipamentoOrigemId?: string;
  portaOrigem?: PortPosition;

  // Destino
  equipamentoDestinoId?: string;
  portaDestino?: PortPosition;

  // ===== OPÇÃO 2: Formato novo (junction point support) =====
  origem?: OrigemDestino;
  destino?: OrigemDestino;

  // Metadados
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Conexão visual com roteamento calculado
 */
export interface VisualConnection extends Connection {
  // Equipamentos populados
  equipamentoOrigem: Equipment;
  equipamentoDestino: Equipment;

  // Pontos calculados (coordenadas absolutas em pixels)
  pontos: Point[];

  // Flag para barramento horizontal
  isBarramento: boolean;
}

// ============================================================================
// BARRAMENTO (VIRTUAL - NÃO EXISTE NO BANCO)
// ============================================================================

/**
 * Barramento detectado algoritmicamente
 * Quando 3+ conexões saem do mesmo ponto
 */
export interface Barramento {
  id: string; // UUID temporário (frontend only)
  equipamentoOrigemId: string;
  portaOrigem: PortPosition;
  pontoOrigem: Point; // Coordenadas absolutas

  // Conexões que fazem parte deste barramento
  conexoes: VisualConnection[];

  // Linha horizontal do barramento
  y: number; // Coordenada Y fixa
  xInicio: number;
  xFim: number;
}

// ============================================================================
// GRUPOS (BOXES TRACEJADOS)
// ============================================================================

export interface Grupo {
  id: string;
  nome: string;
  diagramaId: string;

  // Área delimitada (coordenadas de grid)
  x: number;
  y: number;
  largura: number;
  altura: number;

  // Estilo
  cor?: string; // Cor da borda (tema-aware)

  // Metadados
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ============================================================================
// DIAGRAMA COMPLETO
// ============================================================================

export interface Diagrama {
  id: string;
  unidadeId: string;
  nome: string;
  descricao?: string;

  // Relacionamentos
  equipamentos: Equipment[];
  conexoes: Connection[];
  grupos: Grupo[];

  // Metadados
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ============================================================================
// VIEWPORT (ESTADO DE VISUALIZAÇÃO)
// ============================================================================

export interface ViewportState {
  x: number; // Pan horizontal (pixels)
  y: number; // Pan vertical (pixels)
  scale: number; // Zoom (0.1 a 2.0)
  isDragging: boolean;
}

// ============================================================================
// EDITOR STATE (MODO EDIÇÃO)
// ============================================================================

export type EditorMode = 'view' | 'edit' | 'connecting' | 'connecting-to-line';

export interface EditorState {
  mode: EditorMode;
  selectedEquipmentIds: string[];
  selectedConnectionIds: string[];

  // Modo de conexão normal (equipamento → equipamento)
  connectingFrom: {
    equipamentoId: string;
    porta: PortPosition;
  } | null;

  // Modo de conexão a linha (equipamento → linha existente)
  connectingToLine: {
    equipamentoId: string;
    porta: PortPosition;
    targetConnectionId: string | null; // Conexão alvo quando hover sobre linha
  } | null;

  // Arraste de equipamento
  draggingEquipmentId: string | null;
  dragOffset: Point | null;

  // Grid snap
  showGrid: boolean;
  snapToGrid: boolean;
}

// ============================================================================
// LAYOUT SAVE DTO (PARA ENDPOINT ATÔMICO)
// ============================================================================

export interface EquipamentoLayoutDto {
  equipamentoId: string;
  posicaoX: number;
  posicaoY: number;
  rotacao?: number;
  labelPosition?: LabelPosition;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

/**
 * DTO para origem/destino de conexão (com junction point support)
 */
export interface OrigemDestinoDto {
  tipo: 'equipamento' | 'junction';
  equipamentoId?: string;
  gridPoint?: Point;
  porta: PortPosition;
}

export interface ConexaoLayoutDto {
  origem: OrigemDestinoDto;
  destino: OrigemDestinoDto;
}

export interface SaveLayoutDto {
  equipamentos: EquipamentoLayoutDto[];
  conexoes: ConexaoLayoutDto[];
}

// ============================================================================
// TEMA (DARK/LIGHT)
// ============================================================================

export type Theme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  gridLine: string;
  connectionLine: string;
  iconColor: string;
  labelColor: string;
  selectionColor: string;
  barramentoColor: string;
  groupBorder: string;
}
