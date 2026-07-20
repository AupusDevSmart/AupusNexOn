/**
 * ZUSTAND STORE - DIAGRAMA UNIFILAR V2
 *
 * Gerenciamento centralizado de estado do diagrama:
 * - Equipamentos e conexões
 * - Viewport (zoom/pan)
 * - Editor (seleção, modo, etc)
 * - Sincronização com backend
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Diagrama,
  Equipment,
  Connection,
  VisualConnection,
  Barramento,
  Grupo,
  ViewportState,
  EditorState,
  EditorMode,
  Point,
  PortPosition,
  Theme,
} from '../types/diagram.types';
import { convertToVisualConnections } from '../utils/barramentoDetector';
import { CANVAS, VIEWPORT } from '../utils/diagramConstants';

// ============================================================================
// TIPOS DA STORE
// ============================================================================

// Ações reversíveis pelo Ctrl+Z (undo)
type UndoAction =
  | { kind: 'paste'; ids: string[] }
  | { kind: 'delete'; equipamentos: Equipment[]; conexoes: Connection[] }
  | { kind: 'move'; positions: Array<{ id: string; posicaoX: number; posicaoY: number }> };

interface DiagramState {
  // Dados do diagrama
  diagrama: Diagrama | null;
  equipamentos: Equipment[];
  conexoes: Connection[];
  grupos: Grupo[];

  // Dados calculados (frontend only)
  visualConnections: VisualConnection[];
  barramentos: Barramento[];

  // Viewport
  viewport: ViewportState;

  // Editor
  editor: EditorState;

  // Tema
  theme: Theme;

  // Loading/Error
  isLoading: boolean;
  error: string | null;
  errorType: 'generic' | 'not_found' | null; // Tipo de erro (404 = not_found)

  // Dirty flag (indica se há alterações não salvas)
  isDirty: boolean;

  // Clipboard (copiar/colar) — guarda equipamentos + conexões internas ao grupo copiado
  clipboard: { equipamentos: Equipment[]; conexoes: Connection[] } | null;

  // Undo (Ctrl+Z) — pilha de ações reversíveis (paste/delete/move)
  undoStack: UndoAction[];
  // Snapshot de posições no início do arraste (registra 1 entrada de undo por arraste)
  _dragStartPos: Array<{ id: string; posicaoX: number; posicaoY: number }> | null;
}

interface DiagramActions {
  // ============================================================================
  // CRUD - DIAGRAMA
  // ============================================================================

  /**
   * Carrega diagrama do backend
   */
  loadDiagrama: (diagramaId: string) => Promise<void>;

  /**
   * Cria novo diagrama vazio
   */
  createDiagrama: (unidadeId: string, nome: string, descricao?: string) => Promise<void>;

  /**
   * Salva layout completo no backend (atômico)
   */
  saveLayout: () => Promise<void>;

  /**
   * Limpa o estado (útil para unmount)
   */
  clearDiagrama: () => void;

  // ============================================================================
  // CRUD - EQUIPAMENTOS
  // ============================================================================

  /**
   * Adiciona equipamento ao diagrama
   */
  addEquipamento: (equipamento: Equipment) => void;

  /**
   * Remove equipamento do diagrama
   */
  removeEquipamento: (equipamentoId: string) => void;

  /**
   * Atualiza posição de um equipamento
   */
  updateEquipamentoPosition: (
    equipamentoId: string,
    posicaoX: number,
    posicaoY: number
  ) => void;

  /**
   * Atualiza rotação de um equipamento
   */
  updateEquipamentoRotation: (equipamentoId: string, rotacao: number) => void;

  /**
   * Atualiza offset customizado do label
   */
  updateEquipamentoLabelOffset: (equipamentoId: string, offsetX: number, offsetY: number) => void;

  // ============================================================================
  // CRUD - CONEXÕES
  // ============================================================================

  /**
   * Adiciona conexão entre dois equipamentos
   */
  addConexao: (
    equipamentoOrigemId: string,
    portaOrigem: PortPosition,
    equipamentoDestinoId: string,
    portaDestino: PortPosition
  ) => void;

  /**
   * Remove conexão
   */
  removeConexao: (conexaoId: string) => void;

  /**
   * Recalcula rotas visuais e barramentos
   */
  recalcularRotas: () => void;

  // ============================================================================
  // VIEWPORT
  // ============================================================================

  /**
   * Define zoom
   */
  setZoom: (scale: number) => void;

  /**
   * Incrementa zoom (mouse wheel)
   */
  zoomIn: () => void;

  /**
   * Decrementa zoom
   */
  zoomOut: () => void;

  /**
   * Define pan (arrastar)
   */
  setPan: (x: number, y: number) => void;

  /**
   * Inicia drag do viewport
   */
  startViewportDrag: () => void;

  /**
   * Termina drag do viewport
   */
  endViewportDrag: () => void;

  /**
   * Reseta viewport (zoom 100%, centralizado)
   */
  resetViewport: () => void;

  /**
   * Ajusta viewport automaticamente para mostrar todos os equipamentos
   */
  fitToContent: () => void;

  // ============================================================================
  // EDITOR
  // ============================================================================

  /**
   * Define modo do editor
   */
  setEditorMode: (mode: EditorMode) => void;
  setToolMode: (mode: 'move' | 'select') => void;

  /**
   * Seleciona equipamento(s)
   */
  selectEquipamento: (equipamentoId: string, multi?: boolean) => void;

  /**
   * Deseleciona todos
   */
  clearSelection: () => void;

  // ============================================================================
  // MULTI-SELEÇÃO / COPIAR-COLAR (paridade com o diagrama IoT)
  // ============================================================================

  /** Alterna um equipamento na seleção (shift/ctrl-click) */
  toggleSelectEquipamento: (equipamentoId: string) => void;

  /** Seleciona todos os equipamentos cujo CENTRO está dentro da caixa (marquee, coords de grid) */
  selectInBox: (x1: number, y1: number, x2: number, y2: number, additive?: boolean) => void;

  /** Move todos os selecionados pelo mesmo delta (em grid) */
  moveSelectionBy: (dxGrid: number, dyGrid: number) => void;

  /** Remove todos os equipamentos selecionados (e suas conexões) */
  deleteSelection: () => void;

  /** Copia os selecionados (+ conexões internas) para o clipboard */
  copySelection: () => void;

  /** Cola o clipboard: CRIA equipamentos novos no backend (/rapido), posiciona, reconecta e seleciona */
  pasteClipboard: () => Promise<void>;

  /** Apaga equipamentos DE VERDADE (backend + diagrama) e registra no undo (Ctrl+Z) */
  deleteEquipamentos: (ids: string[]) => Promise<void>;

  /** Desfaz a última ação (Ctrl+Z): colar→apaga criados, apagar→recria, mover→volta posições */
  undo: () => Promise<boolean>;

  /**
   * Seleciona conexão
   */
  selectConnection: (conexaoId: string, multi?: boolean) => void;

  /**
   * Inicia modo de conexão
   */
  startConnecting: (equipamentoId: string, porta: PortPosition) => void;

  /**
   * Finaliza conexão
   */
  finishConnecting: (equipamentoId: string, porta: PortPosition) => void;

  /**
   * Cancela conexão
   */
  cancelConnecting: () => void;

  /**
   * Inicia drag de equipamento
   */
  startDraggingEquipamento: (equipamentoId: string, offset: Point) => void;

  /**
   * Termina drag de equipamento
   */
  endDraggingEquipamento: () => void;

  // ============================================================================
  // TEMA
  // ============================================================================

  /**
   * Alterna entre light/dark
   */
  toggleTheme: () => void;

  /**
   * Define tema
   */
  setTheme: (theme: Theme) => void;

  // ============================================================================
  // GRUPOS
  // ============================================================================

  /**
   * Adiciona grupo (box tracejado)
   */
  addGrupo: (grupo: Grupo) => void;

  /**
   * Remove grupo
   */
  removeGrupo: (grupoId: string) => void;
}

type DiagramStore = DiagramState & DiagramActions;

// ============================================================================
// ESTADO INICIAL
// ============================================================================

// Gera o nome de uma cópia: incrementa o PRIMEIRO número do nome (1→2, 1.1→2.1),
// repetindo até achar um nome livre; se não houver número, adiciona "(Cópia)".
function incrementFirstNumber(nome: string): string | null {
  const m = /\d+/.exec(nome);
  if (!m) return null;
  const digits = m[0];
  const inc = String(parseInt(digits, 10) + 1);
  // preserva zeros à esquerda (ex "01" → "02")
  const rep = digits.length > inc.length && digits.startsWith('0')
    ? inc.padStart(digits.length, '0')
    : inc;
  return nome.slice(0, m.index) + rep + nome.slice(m.index + digits.length);
}

function nextCopyName(nome: string, taken: Set<string>): string {
  if (/\d/.test(nome)) {
    let candidate = nome;
    for (let i = 0; i < 9999; i++) {
      const next = incrementFirstNumber(candidate);
      if (next == null) break;
      candidate = next;
      if (!taken.has(candidate)) return candidate;
    }
  }
  const base = `${nome} (Cópia)`;
  if (!taken.has(base)) return base;
  for (let i = 2; i < 9999; i++) {
    const c = `${nome} (Cópia ${i})`;
    if (!taken.has(c)) return c;
  }
  return base;
}

const initialState: DiagramState = {
  diagrama: null,
  equipamentos: [],
  conexoes: [],
  grupos: [],
  visualConnections: [],
  barramentos: [],

  viewport: {
    x: 0,
    y: 0,
    scale: VIEWPORT.DEFAULT_SCALE,
    isDragging: false,
  },

  editor: {
    mode: 'view',
    toolMode: 'move',
    selectedEquipmentIds: [],
    selectedConnectionIds: [],
    connectingFrom: null,
    connectingToLine: null,
    draggingEquipmentId: null,
    dragOffset: null,
    showGrid: true,
    snapToGrid: true,
  },

  theme: 'light',
  isLoading: false,
  error: null,
  errorType: null,
  isDirty: false,
  clipboard: null,
  undoStack: [],
  _dragStartPos: null,
};

// ============================================================================
// STORE
// ============================================================================

export const useDiagramStore = create<DiagramStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========================================================================
      // DIAGRAMA
      // ========================================================================

      loadDiagrama: async (diagramaIdOrUnidadeId: string) => {
        // Log removido
        // Log removido

        set({ isLoading: true, error: null, errorType: null });

        try {
          const { equipamentosApi } = await import('@/services/equipamentos.services');
          const { DiagramasService } = await import('@/services/diagramas.services');

          // Buscar diagrama ativo da unidade
          const diagramaRaw = await DiagramasService.getActiveDiagrama(diagramaIdOrUnidadeId);

          if (!diagramaRaw) {
            set({
              isLoading: false,
              error: 'Diagrama não encontrado',
              errorType: 'not_found',
            });
            return;
          }

          console.log('[loadDiagrama] 🔍 DEBUG - DiagramaRaw do backend:', {
            id: diagramaRaw.id,
            equipamentos: diagramaRaw.equipamentos?.length,
            conexoes: diagramaRaw.conexoes?.length,
            conexoesDetalhes: diagramaRaw.conexoes?.map((c: any) => ({
              id: c.id,
              origem_tipo: c.origem_tipo,
              origem_grid: c.origem_grid_x != null ? `(${c.origem_grid_x},${c.origem_grid_y})` : null,
              destino_tipo: c.destino_tipo,
              destino_grid: c.destino_grid_x != null ? `(${c.destino_grid_x},${c.destino_grid_y})` : null,
            }))
          });

          // Buscar TODOS os equipamentos da unidade para pegar dados completos
          // API tem limite de 100 itens por página, então fazemos paginação
          const unidadeId = diagramaRaw.unidade_id || (diagramaRaw as unknown as { unidadeId?: string }).unidadeId;

          if (!unidadeId) {
            throw new Error('Diagrama não possui unidade_id definido');
          }

          let allEquipamentos: any[] = [];
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const equipamentosResponse = await equipamentosApi.findByUnidade(unidadeId, {
              limit: 100,
              page
            });

            // A resposta pode vir em diferentes formatos:
            // - { data: { data: [...], pagination: {...} } } OU
            // - { data: [...] }
            let pageData: any[] = [];

            const responseAny = equipamentosResponse as unknown as { data: unknown };
            if (Array.isArray(responseAny.data)) {
              // Formato 1: response.data é array direto
              pageData = responseAny.data as any[];
            } else if ((responseAny.data as { data?: unknown })?.data && Array.isArray((responseAny.data as { data?: unknown }).data)) {
              // Formato 2: response.data.data é o array
              pageData = (responseAny.data as { data: any[] }).data;
            } else {
              pageData = [];
            }

            allEquipamentos = [...allEquipamentos, ...pageData];

            // Se recebeu menos de 100, não há mais páginas
            hasMore = pageData.length === 100;
            page++;
          }

          // Mapear posições dos equipamentos do diagrama
          const posicoesMap = new Map<string, any>();

          if (diagramaRaw.equipamentos && Array.isArray(diagramaRaw.equipamentos)) {
            diagramaRaw.equipamentos.forEach((eqDiagrama: any) => {
              // Tentar pegar ID do equipamento (pode vir como equipamento.id ou equipamento_id ou id)
              let equipId = eqDiagrama.equipamento?.id || eqDiagrama.equipamento_id || eqDiagrama.id;

              // IMPORTANTE: Trimizar o ID para remover espaços em branco
              if (equipId) {
                equipId = equipId.trim();
              }

              if (equipId) {
                posicoesMap.set(equipId, {
                  posicaoX: eqDiagrama.posicao_x,
                  posicaoY: eqDiagrama.posicao_y,
                  rotacao: eqDiagrama.rotacao || 0,
                  labelPosition: eqDiagrama.label_position || 'top',
                  labelOffsetX: eqDiagrama.label_offset_x,
                  labelOffsetY: eqDiagrama.label_offset_y,
                });
              }
            });
          }

          // Mapear equipamentos da API para o formato V2
          const posicoesOcupadas = new Map<string, number>();

          const equipamentosUnicos: Equipment[] = allEquipamentos
            .filter((eq: any) => {
              const hasEq = !!eq;
              const hasId = !!eq?.id;
              const hasInMap = eq?.id ? posicoesMap.has(eq.id.trim()) : false;

              return hasEq && hasId && hasInMap;
            })
            .map((eq: any) => {
              const pos = posicoesMap.get(eq.id.trim())!;

              // 🔍 DEBUG: Log detalhado do equipamento P666
              if (eq.nome?.includes('P666') || eq.tag?.includes('P666')) {
                console.log('[loadDiagrama] 🔍 DEBUG P666 - Dados do equipamento:', {
                  id: eq.id,
                  nome: eq.nome,
                  tag: eq.tag,
                  tipo_equipamento: eq.tipo_equipamento,
                  tipo_equipamento_id: eq.tipo_equipamento_id,
                  tipoEquipamento: eq.tipoEquipamento,
                  tipo_equipamento_rel: eq.tipo_equipamento_rel,
                  mqtt_habilitado: eq.mqtt_habilitado,
                  topico_mqtt: eq.topico_mqtt,
                  tipo_equipamento_rel_completo: JSON.stringify(eq.tipo_equipamento_rel, null, 2),
                  tipoEquipamento_completo: JSON.stringify(eq.tipoEquipamento, null, 2),
                });
              }

              return {
                id: eq.id.trim(), // Normalizar ID
                nome: eq.nome,
                tag: eq.tag || eq.numero_serie || '',
                // ✅ CORRIGIDO: Usar codigo do tipoEquipamento (ex: "INVERSOR_FRONIUS", "M160_SCHNEIDER")
                // Fallback para tipo_equipamento genérico se tipoEquipamento não existir
                tipo: eq.tipoEquipamento?.codigo || eq.tipo_equipamento_rel?.codigo || eq.tipo_equipamento || 'EQUIPAMENTO',
                // ✅ Categoria do equipamento. A tabela categorias_equipamentos tem só id+nome
                // (sem codigo) — entao usamos `nome` como fonte primaria, com fallback pra
                // `codigo` caso o backend passe a expor algum dia.
                categoria: eq.tipoEquipamento?.categoria?.nome
                  || eq.tipoEquipamento?.categoria?.codigo
                  || eq.tipo_equipamento_rel?.categoria?.nome
                  || eq.tipo_equipamento_rel?.categoria?.codigo,
                unidadeId: unidadeId,
                diagramaId: diagramaRaw.id.trim(), // Normalizar ID
                posicaoX: pos.posicaoX,
                posicaoY: pos.posicaoY,
                rotacao: pos.rotacao,
                labelPosition: pos.labelPosition,
                labelOffsetX: pos.labelOffsetX,
                labelOffsetY: pos.labelOffsetY,
                mqttHabilitado: eq.mqtt_habilitado,
                topicoMqtt: eq.topico_mqtt,
                automacao: eq.automacao === true,
                status: eq.status || 'normal',
                createdAt: new Date(diagramaRaw.created_at),
                updatedAt: new Date(diagramaRaw.updated_at),
                deletedAt: null,
                dados: eq, // Guardar equipamento completo para uso em modais
              };
            });

          const equipamentosEspalhados = equipamentosUnicos.map(eq => {
            const posKey = `${eq.posicaoX},${eq.posicaoY}`;
            const contador = posicoesOcupadas.get(posKey) || 0;
            posicoesOcupadas.set(posKey, contador + 1);

            // Se há mais de um equipamento na mesma posição, espalhar em grid
            if (contador > 0) {
              const offset = contador * 3; // 3 unidades de grid = 120px
              return {
                ...eq,
                posicaoX: eq.posicaoX + offset,
                posicaoY: eq.posicaoY,
              };
            }

            return eq;
          });

          // Log removido

          const conexoes: Connection[] = (diagramaRaw.conexoes || [])
            .filter((conn: any) => {
              // Validar conexão: deve ter origem E destino (equipamento OU junction)
              // Aceitar AMBOS os formatos: novo (origem.tipo) e legado (equipamento_origem_id)

              const hasOrigem =
                // Formato legado
                conn.equipamento_origem_id ||
                // Formato novo com objeto origem
                (conn.origem && (
                  (conn.origem.tipo === 'equipamento' && conn.origem.equipamentoId) ||
                  (conn.origem.tipo === 'junction' && conn.origem.gridPoint)
                )) ||
                // Formato direto (campos na raiz)
                (conn.origem_tipo === 'junction' && conn.origem_grid_x != null && conn.origem_grid_y != null);

              const hasDestino =
                // Formato legado
                conn.equipamento_destino_id ||
                // Formato novo com objeto destino
                (conn.destino && (
                  (conn.destino.tipo === 'equipamento' && conn.destino.equipamentoId) ||
                  (conn.destino.tipo === 'junction' && conn.destino.gridPoint)
                )) ||
                // Formato direto (campos na raiz)
                (conn.destino_tipo === 'junction' && conn.destino_grid_x != null && conn.destino_grid_y != null);

              const isValid = conn.id && hasOrigem && hasDestino;
              if (!isValid) {
                return false; // Filtrar conexões inválidas
              }

              return true; // Aceitar conexão válida
            })
            .map((conn: any) => {
              // Mapear conexões válidas para o formato V2
              const junctionPointsRecriados: Equipment[] = [];
              const junctionPointIdMap = new Map<string, string>();

              let equipamentoOrigemId: string | undefined;
              let equipamentoDestinoId: string | undefined;
              let portaOrigem: PortPosition;
              let portaDestino: PortPosition;

              // Detectar formato (novo vs legado)
              const isNewFormat = conn.origem && conn.destino;

              // ===== PROCESSAR ORIGEM =====
              if (isNewFormat && conn.origem) {
                portaOrigem = conn.origem.porta;

                if (conn.origem.tipo === 'junction' && conn.origem.gridPoint) {
                  // Formato novo: origem.gridPoint
                  const key = `${conn.origem.gridPoint.x},${conn.origem.gridPoint.y}`;

                  if (!junctionPointIdMap.has(key)) {
                    const junctionId = `junction-${conn.origem.gridPoint.x}-${conn.origem.gridPoint.y}`;
                    junctionPointIdMap.set(key, junctionId);

                    junctionPointsRecriados.push({
                      id: junctionId,
                      nome: 'Ponto de Junção',
                      tag: 'JP',
                      tipo: 'JUNCTION_POINT',
                      unidadeId: unidadeId,
                      diagramaId: diagramaRaw.id.trim(),
                      posicaoX: conn.origem.gridPoint.x,
                      posicaoY: conn.origem.gridPoint.y,
                      rotacao: 0,
                      labelPosition: 'top',
                      status: 'normal',
                      createdAt: new Date(diagramaRaw.created_at),
                      updatedAt: new Date(diagramaRaw.updated_at),
                      deletedAt: null,
                    });
                  }

                  equipamentoOrigemId = junctionPointIdMap.get(key);
                } else {
                  // Formato novo: origem.equipamentoId
                  equipamentoOrigemId = conn.origem.equipamentoId;
                }
              } else {
                // Formato legado: campos diretos na raiz
                portaOrigem = conn.porta_origem;

                if (conn.origem_tipo === 'junction' && conn.origem_grid_x != null && conn.origem_grid_y != null) {
                  const key = `${conn.origem_grid_x},${conn.origem_grid_y}`;

                  if (!junctionPointIdMap.has(key)) {
                    const junctionId = `junction-${conn.origem_grid_x}-${conn.origem_grid_y}`;
                    junctionPointIdMap.set(key, junctionId);

                    junctionPointsRecriados.push({
                      id: junctionId,
                      nome: 'Ponto de Junção',
                      tag: 'JP',
                      tipo: 'JUNCTION_POINT',
                      unidadeId: unidadeId,
                      diagramaId: diagramaRaw.id.trim(),
                      posicaoX: conn.origem_grid_x,
                      posicaoY: conn.origem_grid_y,
                      rotacao: 0,
                      labelPosition: 'top',
                      status: 'normal',
                      createdAt: new Date(diagramaRaw.created_at),
                      updatedAt: new Date(diagramaRaw.updated_at),
                      deletedAt: null,
                    });
                  }

                  equipamentoOrigemId = junctionPointIdMap.get(key);
                } else {
                  equipamentoOrigemId = conn.equipamento_origem_id;
                }
              }

              // ===== PROCESSAR DESTINO =====
              if (isNewFormat && conn.destino) {
                portaDestino = conn.destino.porta;

                if (conn.destino.tipo === 'junction' && conn.destino.gridPoint) {
                  // Formato novo: destino.gridPoint
                  const key = `${conn.destino.gridPoint.x},${conn.destino.gridPoint.y}`;

                  if (!junctionPointIdMap.has(key)) {
                    const junctionId = `junction-${conn.destino.gridPoint.x}-${conn.destino.gridPoint.y}`;
                    junctionPointIdMap.set(key, junctionId);

                    junctionPointsRecriados.push({
                      id: junctionId,
                      nome: 'Ponto de Junção',
                      tag: 'JP',
                      tipo: 'JUNCTION_POINT',
                      unidadeId: unidadeId,
                      diagramaId: diagramaRaw.id.trim(),
                      posicaoX: conn.destino.gridPoint.x,
                      posicaoY: conn.destino.gridPoint.y,
                      rotacao: 0,
                      labelPosition: 'top',
                      status: 'normal',
                      createdAt: new Date(diagramaRaw.created_at),
                      updatedAt: new Date(diagramaRaw.updated_at),
                      deletedAt: null,
                    });
                  }

                  equipamentoDestinoId = junctionPointIdMap.get(key);
                } else {
                  // Formato novo: destino.equipamentoId
                  equipamentoDestinoId = conn.destino.equipamentoId;
                }
              } else {
                // Formato legado: campos diretos na raiz
                portaDestino = conn.porta_destino;

                if (conn.destino_tipo === 'junction' && conn.destino_grid_x != null && conn.destino_grid_y != null) {
                  const key = `${conn.destino_grid_x},${conn.destino_grid_y}`;

                  if (!junctionPointIdMap.has(key)) {
                    const junctionId = `junction-${conn.destino_grid_x}-${conn.destino_grid_y}`;
                    junctionPointIdMap.set(key, junctionId);

                    junctionPointsRecriados.push({
                      id: junctionId,
                      nome: 'Ponto de Junção',
                      tag: 'JP',
                      tipo: 'JUNCTION_POINT',
                      unidadeId: unidadeId,
                      diagramaId: diagramaRaw.id.trim(),
                      posicaoX: conn.destino_grid_x,
                      posicaoY: conn.destino_grid_y,
                      rotacao: 0,
                      labelPosition: 'top',
                      status: 'normal',
                      createdAt: new Date(diagramaRaw.created_at),
                      updatedAt: new Date(diagramaRaw.updated_at),
                      deletedAt: null,
                    });
                  }

                  equipamentoDestinoId = junctionPointIdMap.get(key);
                } else {
                  equipamentoDestinoId = conn.equipamento_destino_id;
                }
              }

              return {
                id: conn.id.trim(),
                diagramaId: diagramaRaw.id.trim(),
                equipamentoOrigemId: equipamentoOrigemId?.trim(),
                portaOrigem,
                equipamentoDestinoId: equipamentoDestinoId?.trim(),
                portaDestino,
                createdAt: new Date(conn.created_at || diagramaRaw.created_at),
                updatedAt: new Date(conn.updated_at || diagramaRaw.updated_at),
                deletedAt: null,
              };
            });

          // ✅ CRITICAL: Coletar todos junction points criados durante o mapeamento das conexões
          const allJunctionPoints: Equipment[] = [];
          type RawConexao = {
            origem?: { tipo?: string; gridPoint?: { x: number; y: number }; equipamentoId?: string; porta?: string };
            destino?: { tipo?: string; gridPoint?: { x: number; y: number }; equipamentoId?: string; porta?: string };
            origem_tipo?: string;
            origem_grid_x?: number | null;
            origem_grid_y?: number | null;
            destino_tipo?: string;
            destino_grid_x?: number | null;
            destino_grid_y?: number | null;
          };
          conexoes.forEach((_, idx) => {
            const connRaw = (diagramaRaw.conexoes || [])[idx] as unknown as RawConexao | undefined;
            if (!connRaw) return;

            // Recriar junction points usando a mesma lógica
            const junctionPointIdMap = new Map<string, Equipment>();

            // Processar origem
            if (connRaw.origem?.tipo === 'junction' && connRaw.origem.gridPoint) {
              const key = `${connRaw.origem.gridPoint.x},${connRaw.origem.gridPoint.y}`;
              if (!junctionPointIdMap.has(key)) {
                const jp: Equipment = {
                  id: `junction-${connRaw.origem.gridPoint.x}-${connRaw.origem.gridPoint.y}`,
                  nome: 'Ponto de Junção',
                  tag: 'JP',
                  tipo: 'JUNCTION_POINT',
                  unidadeId: unidadeId,
                  diagramaId: diagramaRaw.id.trim(),
                  posicaoX: connRaw.origem.gridPoint.x,
                  posicaoY: connRaw.origem.gridPoint.y,
                  rotacao: 0,
                  labelPosition: 'top',
                  status: 'normal',
                  createdAt: new Date(diagramaRaw.created_at),
                  updatedAt: new Date(diagramaRaw.updated_at),
                  deletedAt: null,
                };
                junctionPointIdMap.set(key, jp);
                allJunctionPoints.push(jp);
              }
            } else if (connRaw.origem_tipo === 'junction' && connRaw.origem_grid_x != null && connRaw.origem_grid_y != null) {
              const key = `${connRaw.origem_grid_x},${connRaw.origem_grid_y}`;
              if (!junctionPointIdMap.has(key)) {
                const jp: Equipment = {
                  id: `junction-${connRaw.origem_grid_x}-${connRaw.origem_grid_y}`,
                  nome: 'Ponto de Junção',
                  tag: 'JP',
                  tipo: 'JUNCTION_POINT',
                  unidadeId: unidadeId,
                  diagramaId: diagramaRaw.id.trim(),
                  posicaoX: connRaw.origem_grid_x,
                  posicaoY: connRaw.origem_grid_y,
                  rotacao: 0,
                  labelPosition: 'top',
                  status: 'normal',
                  createdAt: new Date(diagramaRaw.created_at),
                  updatedAt: new Date(diagramaRaw.updated_at),
                  deletedAt: null,
                };
                junctionPointIdMap.set(key, jp);
                allJunctionPoints.push(jp);
              }
            }

            // Processar destino
            if (connRaw.destino?.tipo === 'junction' && connRaw.destino.gridPoint) {
              const key = `${connRaw.destino.gridPoint.x},${connRaw.destino.gridPoint.y}`;
              if (!junctionPointIdMap.has(key)) {
                const jp: Equipment = {
                  id: `junction-${connRaw.destino.gridPoint.x}-${connRaw.destino.gridPoint.y}`,
                  nome: 'Ponto de Junção',
                  tag: 'JP',
                  tipo: 'JUNCTION_POINT',
                  unidadeId: unidadeId,
                  diagramaId: diagramaRaw.id.trim(),
                  posicaoX: connRaw.destino.gridPoint.x,
                  posicaoY: connRaw.destino.gridPoint.y,
                  rotacao: 0,
                  labelPosition: 'top',
                  status: 'normal',
                  createdAt: new Date(diagramaRaw.created_at),
                  updatedAt: new Date(diagramaRaw.updated_at),
                  deletedAt: null,
                };
                junctionPointIdMap.set(key, jp);
                allJunctionPoints.push(jp);
              }
            } else if (connRaw.destino_tipo === 'junction' && connRaw.destino_grid_x != null && connRaw.destino_grid_y != null) {
              const key = `${connRaw.destino_grid_x},${connRaw.destino_grid_y}`;
              if (!junctionPointIdMap.has(key)) {
                const jp: Equipment = {
                  id: `junction-${connRaw.destino_grid_x}-${connRaw.destino_grid_y}`,
                  nome: 'Ponto de Junção',
                  tag: 'JP',
                  tipo: 'JUNCTION_POINT',
                  unidadeId: unidadeId,
                  diagramaId: diagramaRaw.id.trim(),
                  posicaoX: connRaw.destino_grid_x,
                  posicaoY: connRaw.destino_grid_y,
                  rotacao: 0,
                  labelPosition: 'top',
                  status: 'normal',
                  createdAt: new Date(diagramaRaw.created_at),
                  updatedAt: new Date(diagramaRaw.updated_at),
                  deletedAt: null,
                };
                junctionPointIdMap.set(key, jp);
                allJunctionPoints.push(jp);
              }
            }
          });

          // Remover duplicatas dos junction points (usar Map por key)
          const junctionPointsUnicos = Array.from(
            new Map(
              allJunctionPoints.map(jp => [`${jp.posicaoX},${jp.posicaoY}`, jp])
            ).values()
          );

          console.log('[loadDiagrama] ✅ Junction points recriados:', junctionPointsUnicos.length, junctionPointsUnicos);
          console.log('[loadDiagrama] 🔍 Equipamentos espalhados:', equipamentosEspalhados.length);
          console.log('[loadDiagrama] 🔍 Total equipamentos no diagrama:', [...equipamentosEspalhados, ...junctionPointsUnicos].length);

          // Construir objeto diagrama completo COM junction points
          const diagramaRawExtra = diagramaRaw as unknown as { unidadeId?: string; grupos?: Grupo[] };
          const diagrama: Diagrama = {
            id: diagramaRaw.id.trim(),
            unidadeId: diagramaRawExtra.unidadeId || diagramaRaw.unidade_id,
            nome: diagramaRaw.nome,
            descricao: diagramaRaw.descricao,
            equipamentos: [...equipamentosEspalhados, ...junctionPointsUnicos], // ✅ INCLUIR junction points
            conexoes,
            grupos: diagramaRawExtra.grupos || [],
            createdAt: new Date(diagramaRaw.created_at),
            updatedAt: new Date(diagramaRaw.updated_at),
            deletedAt: null,
          };

          // Calcular conexões visuais e barramentos
          // ⚡ IMPORTANTE: Passar TODOS os equipamentos, incluindo junction points
          const todosEquipamentos = [...equipamentosEspalhados, ...junctionPointsUnicos];
          console.log('[loadDiagrama] 🔍 Passando para convertToVisualConnections:', {
            totalEquipamentos: todosEquipamentos.length,
            junctionPoints: todosEquipamentos.filter(eq => eq.tipo === 'JUNCTION_POINT').length,
            conexoes: conexoes.length
          });

          const { visualConnections, barramentos } = convertToVisualConnections(
            conexoes,
            todosEquipamentos  // ⚡ FIX: Passar junction points também
          );

          set({
            diagrama,
            equipamentos: diagrama.equipamentos,
            conexoes: diagrama.conexoes,
            grupos: diagrama.grupos || [],
            visualConnections,
            barramentos,
            isLoading: false,
            errorType: null,
            isDirty: false,
          });

          // Auto-fit ao carregar diagrama (após 300ms para garantir que o SVG renderizou)
          setTimeout(() => {
            get().fitToContent();
          }, 300);
        } catch (error: any) {
          console.error('[useDiagramStore] ❌ Error loading diagrama:', error);
          // Log removido

          // Detectar erro 404 (diagrama não existe)
          // Axios error object tem error.response.status
          const is404 = error?.response?.status === 404;

          // Log removido

          set({
            error: error?.response?.data?.message || error?.message || 'Erro desconhecido',
            errorType: is404 ? 'not_found' : 'generic',
            isLoading: false,
          });
        }
      },

      createDiagrama: async (unidadeId: string, nome: string, descricao?: string) => {
        set({ isLoading: true, error: null, errorType: null });

        try {
          // Importar serviço de API
          const { DiagramasService } = await import('@/services/diagramas.services');

          // Criar diagrama vazio no backend
          const diagramaRaw = await DiagramasService.createDiagrama({
            unidadeId,
            nome,
            descricao,
            ativo: true,
          });

          // Converter para formato V2
          const diagramaRawExtra = diagramaRaw as unknown as { unidadeId?: string };
          const diagrama: Diagrama = {
            id: diagramaRaw.id.trim(), // Remover espaços em branco
            unidadeId: diagramaRawExtra.unidadeId || diagramaRaw.unidade_id,
            nome: diagramaRaw.nome,
            descricao: diagramaRaw.descricao,
            equipamentos: [],
            conexoes: [],
            grupos: [],
            createdAt: new Date(diagramaRaw.created_at),
            updatedAt: new Date(diagramaRaw.updated_at),
            deletedAt: null,
          };

          set({
            diagrama,
            equipamentos: [],
            conexoes: [],
            grupos: [],
            visualConnections: [],
            barramentos: [],
            isLoading: false,
            isDirty: false,
          });
        } catch (error: any) {
          console.error('[useDiagramStore] Error creating diagrama:', error);
          set({
            error: error instanceof Error ? error.message : 'Erro ao criar diagrama',
            errorType: 'generic',
            isLoading: false,
          });
          throw error; // Re-throw para o componente tratar
        }
      },

      saveLayout: async () => {
        const { diagrama, equipamentos, conexoes } = get();

        if (!diagrama) {
          throw new Error('Nenhum diagrama carregado');
        }

        set({ isLoading: true, error: null });

        try {
          // Importar serviço de API
          const { DiagramasService } = await import('@/services/diagramas.services');

// Desabilitar logs de debug em produção
const noop = () => {};
if (import.meta.env.PROD) {
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}


          // Filtrar equipamentos: REMOVER junction points (eles são virtuais, salvos apenas nas conexões)
          // TAMBÉM remover equipamentos que ainda não foram associados ao diagrama no backend
          const equipamentosReais = equipamentos.filter(eq => {
            // Remover junction points
            if (eq.tipo === 'JUNCTION_POINT') return false;

            // Remover equipamentos recém-criados que ainda não foram associados ao diagrama
            // Quando um equipamento é criado via "Criar Equipamento Rápido", ele ainda não tem diagrama_id
            // Verificar tanto no objeto raiz quanto nos dados
            const eqExtra = eq as unknown as { dados?: { diagrama_id?: string; diagramaId?: string } };
            const temDiagramaAssociado =
              eq.diagramaId ||
              eqExtra.dados?.diagrama_id ||
              eqExtra.dados?.diagramaId;

            if (!temDiagramaAssociado) {
              console.log('[saveLayout] ⚠️ Equipamento ignorado (não associado ao diagrama):', eq.id.trim(), eq.nome);
              return false;
            }

            return true;
          });

          // Filtrar conexões: remover conexões órfãs ou inválidas
          const conexoesValidasParaSalvar = conexoes.filter(conn => {
            // ⚡ IMPORTANTE: Trimizar IDs antes de comparar (equipamentos já foram trimizados na linha 436)
            const origemEq = equipamentos.find(eq => eq.id === conn.equipamentoOrigemId?.trim());
            const destinoEq = equipamentos.find(eq => eq.id === conn.equipamentoDestinoId?.trim());

            // 🚨 FILTRO CRÍTICO: Se origem OU destino não existe, conexão está órfã
            if (!origemEq || !destinoEq) {
              console.log('[saveLayout] ⚠️ Conexão órfã removida:', {
                id: conn.id,
                origem: conn.equipamentoOrigemId?.trim(),
                destino: conn.equipamentoDestinoId?.trim(),
                origemExiste: !!origemEq,
                destinoExiste: !!destinoEq,
                motivo: !origemEq ? 'origem não existe' : 'destino não existe'
              });
              return false; // ❌ Remover conexão órfã
            }

            // Verificar se a conexão é temporária
            const isConexaoTemporaria = conn.id.startsWith('temp-');

            // Se for temporária, verificar se os equipamentos são válidos
            if (isConexaoTemporaria) {
              const origemValida = origemEq.tipo === 'JUNCTION_POINT' || !origemEq.id.startsWith('temp-');
              const destinoValido = destinoEq.tipo === 'JUNCTION_POINT' || !destinoEq.id.startsWith('temp-');

              if (!origemValida || !destinoValido) {
                console.log('[saveLayout] ⚠️ Conexão temporária inválida removida:', {
                  id: conn.id,
                  origemValida,
                  destinoValido
                });
                return false; // ❌ Remover conexão temporária inválida
              }
            }

            return true; // ✅ Conexão válida
          });

          console.log('[saveLayout] 🔍 Debug equipamentos:', {
            totalEquipamentos: equipamentos.length,
            junctionPoints: equipamentos.filter(eq => eq.tipo === 'JUNCTION_POINT').map(jp => ({
              id: jp.id,
              pos: `(${jp.posicaoX}, ${jp.posicaoY})`
            })),
            equipamentosReais: equipamentosReais.map(eq => ({ id: eq.id, nome: eq.nome }))
          });

          console.log('[saveLayout] 🔍 Debug conexões:', {
            totalConexoes: conexoes.length,
            conexoesValidas: conexoesValidasParaSalvar.length,
            conexoesRemovidas: conexoes.length - conexoesValidasParaSalvar.length,
            conexoesRemovidasDetalhes: conexoes.filter(c => !conexoesValidasParaSalvar.includes(c)),
            conexoesDetalhadas: conexoes.map(c => ({
              id: c.id,
              origem: c.equipamentoOrigemId,
              destino: c.equipamentoDestinoId
            }))
          });

          // Converter conexões: substituir junction points por gridPoints
          const conexoesConvertidas = conexoesValidasParaSalvar.map(conn => {
            // ⚡ IMPORTANTE: Trimizar IDs antes de comparar (equipamentos já foram trimizados na linha 436)
            // Verificar se origem é junction point
            const origemEq = equipamentos.find(eq => eq.id === conn.equipamentoOrigemId?.trim());
            const isOrigemJunction = origemEq?.tipo === 'JUNCTION_POINT';

            // Verificar se destino é junction point
            const destinoEq = equipamentos.find(eq => eq.id === conn.equipamentoDestinoId?.trim());
            const isDestinoJunction = destinoEq?.tipo === 'JUNCTION_POINT';

            return {
              origem: {
                tipo: isOrigemJunction ? 'junction' as const : 'equipamento' as const,
                equipamentoId: isOrigemJunction ? undefined : conn.equipamentoOrigemId?.trim(),
                gridPoint: isOrigemJunction ? { x: origemEq.posicaoX, y: origemEq.posicaoY } : undefined,
                porta: conn.portaOrigem!,
              },
              destino: {
                tipo: isDestinoJunction ? 'junction' as const : 'equipamento' as const,
                equipamentoId: isDestinoJunction ? undefined : conn.equipamentoDestinoId?.trim(),
                gridPoint: isDestinoJunction ? { x: destinoEq.posicaoX, y: destinoEq.posicaoY } : undefined,
                porta: conn.portaDestino!,
              },
            };
          });

          // Montar DTO para endpoint atômico
          const dto = {
            equipamentos: equipamentosReais.map(eq => ({
              equipamentoId: eq.id.trim(), // Normalizar ID
              posicaoX: eq.posicaoX,
              posicaoY: eq.posicaoY,
              rotacao: eq.rotacao,
              labelPosition: eq.labelPosition,
              labelOffsetX: eq.labelOffsetX,
              labelOffsetY: eq.labelOffsetY,
            })),
            conexoes: conexoesConvertidas,
          };

          console.log('[saveLayout] 📤 PAYLOAD sendo enviado:', {
            diagramaId: diagrama.id.trim(),
            totalEquipamentos: dto.equipamentos.length,
            totalConexoes: dto.conexoes.length,
            equipamentosIds: dto.equipamentos.map(e => e.equipamentoId),
            conexoes: dto.conexoes.map(c => ({
              origem: c.origem,
              destino: c.destino
            }))
          });

          // Chamar endpoint atômico (DELETE ALL + INSERT ALL)
          const resultado = await DiagramasService.saveLayout(diagrama.id.trim(), dto as unknown as Parameters<typeof DiagramasService.saveLayout>[1]);

          // Sucesso: resetar loading e dirty flag
          set({
            isLoading: false,
            isDirty: false,
          });
        } catch (error) {
          console.error('[useDiagramStore] Error saving layout:', error);
          set({
            error: error instanceof Error ? error.message : 'Erro ao salvar',
            isLoading: false,
          });
        }
      },

      clearDiagrama: () => {
        set(initialState);
      },

      // ========================================================================
      // EQUIPAMENTOS
      // ========================================================================

      addEquipamento: (equipamento: Equipment) => {
        set(state => {
          // ⚡ IMPORTANTE: Trimizar ID ao adicionar equipamento (previne trailing spaces)
          const equipamentoNormalizado = {
            ...equipamento,
            id: equipamento.id?.trim(),
            diagramaId: equipamento.diagramaId?.trim(),
            unidadeId: equipamento.unidadeId?.trim(),
          };

          // Verificar se equipamento já existe (evitar duplicatas)
          const jaExiste = state.equipamentos.some(eq => eq.id === equipamentoNormalizado.id);

          if (jaExiste) {
            return state; // Não adicionar duplicata
          }

          return {
            equipamentos: [...state.equipamentos, equipamentoNormalizado],
            isDirty: true,
          };
        });

        // Recalcular rotas
        get().recalcularRotas();
      },

      removeEquipamento: (equipamentoId: string) => {
        set(state => ({
          equipamentos: state.equipamentos.filter(eq => eq.id !== equipamentoId),
          // Remover conexões relacionadas
          conexoes: state.conexoes.filter(
            conn =>
              conn.equipamentoOrigemId !== equipamentoId &&
              conn.equipamentoDestinoId !== equipamentoId
          ),
          isDirty: true,
        }));

        // Auto-deletar junction points órfãos (sem conexões)
        setTimeout(() => {
          const { equipamentos, conexoes } = get();

          // Encontrar junction points que não têm mais conexões
          const junctionPointsOrfaos = equipamentos.filter(eq => {
            if (eq.tipo !== 'JUNCTION_POINT') return false;

            // Verificar se tem alguma conexão conectada a este junction point
            const temConexao = conexoes.some(
              conn => conn.equipamentoOrigemId === eq.id || conn.equipamentoDestinoId === eq.id
            );

            return !temConexao; // Órfão = não tem conexão
          });

          // Remover junction points órfãos
          if (junctionPointsOrfaos.length > 0) {
            console.log('[removeEquipamento] 🗑️ Removendo junction points órfãos:', junctionPointsOrfaos.map(jp => jp.id));

            set(state => ({
              equipamentos: state.equipamentos.filter(
                eq => !junctionPointsOrfaos.find(jp => jp.id === eq.id)
              ),
            }));
          }
        }, 100);

        get().recalcularRotas();
      },

      updateEquipamentoPosition: (
        equipamentoId: string,
        posicaoX: number,
        posicaoY: number
      ) => {
        set(state => ({
          equipamentos: state.equipamentos.map(eq =>
            eq.id === equipamentoId ? { ...eq, posicaoX, posicaoY } : eq
          ),
          isDirty: true,
        }));

        get().recalcularRotas();
      },

      updateEquipamentoRotation: (equipamentoId: string, rotacao: number) => {
        set(state => ({
          equipamentos: state.equipamentos.map(eq =>
            eq.id === equipamentoId ? { ...eq, rotacao } : eq
          ),
          isDirty: true,
        }));

        get().recalcularRotas();
      },

      updateEquipamentoLabelOffset: (equipamentoId: string, offsetX: number, offsetY: number) => {
        set(state => ({
          equipamentos: state.equipamentos.map(eq =>
            eq.id === equipamentoId ? { ...eq, labelOffsetX: offsetX, labelOffsetY: offsetY } : eq
          ),
          isDirty: true,
        }));

        // Não precisa recalcular rotas, apenas offset visual do label
      },

      // ========================================================================
      // CONEXÕES
      // ========================================================================

      addConexao: (
        equipamentoOrigemId: string,
        portaOrigem: PortPosition,
        equipamentoDestinoId: string,
        portaDestino: PortPosition
      ) => {
        // ⚡ IMPORTANTE: Trimizar IDs ao criar conexão (previne trailing spaces)
        const novaConexao: Connection = {
          id: `temp-${Date.now()}`, // ID temporário (backend vai gerar o real)
          diagramaId: get().diagrama?.id?.trim() || '',
          equipamentoOrigemId: equipamentoOrigemId?.trim(),
          portaOrigem,
          equipamentoDestinoId: equipamentoDestinoId?.trim(),
          portaDestino,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        set(state => ({
          conexoes: [...state.conexoes, novaConexao],
          isDirty: true,
        }));

        get().recalcularRotas();
      },

      removeConexao: (conexaoId: string) => {
        set(state => ({
          conexoes: state.conexoes.filter(conn => conn.id !== conexaoId),
          isDirty: true,
        }));

        // Auto-deletar junction points órfãos (sem conexões)
        setTimeout(() => {
          const { equipamentos, conexoes } = get();

          // Encontrar junction points que não têm mais conexões
          const junctionPointsOrfaos = equipamentos.filter(eq => {
            if (eq.tipo !== 'JUNCTION_POINT') return false;

            // Verificar se tem alguma conexão conectada a este junction point
            const temConexao = conexoes.some(
              conn => conn.equipamentoOrigemId === eq.id || conn.equipamentoDestinoId === eq.id
            );

            return !temConexao; // Órfão = não tem conexão
          });

          // Remover junction points órfãos
          if (junctionPointsOrfaos.length > 0) {
            console.log('[removeConexao] 🗑️ Removendo junction points órfãos:', junctionPointsOrfaos.map(jp => jp.id));

            set(state => ({
              equipamentos: state.equipamentos.filter(
                eq => !junctionPointsOrfaos.find(jp => jp.id === eq.id)
              ),
            }));
          }
        }, 100); // Pequeno delay para garantir que o estado foi atualizado

        get().recalcularRotas();
      },

      recalcularRotas: () => {
        const { equipamentos, conexoes } = get();

        const { visualConnections, barramentos } = convertToVisualConnections(
          conexoes,
          equipamentos
        );

        set({ visualConnections, barramentos });
      },

      // ========================================================================
      // VIEWPORT
      // ========================================================================

      setZoom: (scale: number) => {
        const clampedScale = Math.max(
          VIEWPORT.MIN_SCALE,
          Math.min(VIEWPORT.MAX_SCALE, scale)
        );

        set(state => ({
          viewport: { ...state.viewport, scale: clampedScale },
        }));
      },

      zoomIn: () => {
        const currentScale = get().viewport.scale;
        get().setZoom(currentScale + VIEWPORT.ZOOM_STEP);
      },

      zoomOut: () => {
        const currentScale = get().viewport.scale;
        get().setZoom(currentScale - VIEWPORT.ZOOM_STEP);
      },

      setPan: (x: number, y: number) => {
        set(state => ({
          viewport: { ...state.viewport, x, y },
        }));
      },

      startViewportDrag: () => {
        set(state => ({
          viewport: { ...state.viewport, isDragging: true },
        }));
      },

      endViewportDrag: () => {
        set(state => ({
          viewport: { ...state.viewport, isDragging: false },
        }));
      },

      resetViewport: () => {
        set(state => ({
          viewport: {
            x: 0,
            y: 0,
            scale: VIEWPORT.DEFAULT_SCALE,
            isDragging: false,
          },
        }));
      },

      fitToContent: () => {
        const { equipamentos } = get();

        if (equipamentos.length === 0) {
          set({
            viewport: { x: 0, y: 0, scale: VIEWPORT.DEFAULT_SCALE, isDragging: false },
          });
          return;
        }

        // Equipamentos em GRID UNITS (1 cell = 40px no espaço SVG, todos 2x2).
        const GRID_SIZE = 40;
        const EQUIPMENT_SIZE_GRID = 2;

        // Bbox em pixels SVG (coords do viewBox, NÃO pixels CSS).
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        equipamentos.forEach(eq => {
          const x = eq.posicaoX * GRID_SIZE;
          const y = eq.posicaoY * GRID_SIZE;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          const x2 = x + EQUIPMENT_SIZE_GRID * GRID_SIZE;
          const y2 = y + EQUIPMENT_SIZE_GRID * GRID_SIZE;
          if (x2 > maxX) maxX = x2;
          if (y2 > maxY) maxY = y2;
        });

        const contentWidth = Math.max(maxX - minX, 1);
        const contentHeight = Math.max(maxY - minY, 1);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Dimensões reais do container (varia quando painel de gráficos abre).
        const viewportEl = document.querySelector('.diagram-viewport-container');
        const viewportWidth = viewportEl?.clientWidth ?? CANVAS.WIDTH;
        const viewportHeight = viewportEl?.clientHeight ?? CANVAS.HEIGHT;

        // viewBox eh 3x o CANVAS (gridMultiplier=1.5 * 2 em
        // DiagramViewport.calculateViewBox). 1 px SVG → 1/3 px CSS.
        const SVG_TO_CSS = 1 / 3;

        // Fit clássico: encolhe ate caber, com 10% de margem visual.
        const PADDING = 0.9;
        const fitScaleX = (viewportWidth * PADDING) / (contentWidth * SVG_TO_CSS);
        const fitScaleY = (viewportHeight * PADDING) / (contentHeight * SVG_TO_CSS);
        const fitScale = Math.min(fitScaleX, fitScaleY);

        const clampedScale = Math.max(
          VIEWPORT.MIN_SCALE,
          Math.min(VIEWPORT.MAX_SCALE, fitScale),
        );

        // Pan: transform aplicado eh
        //   translate(-50%, -50%) translate(panX, panY) scale(S)
        // SVG centralizado por translate(-50%, -50%) sobre top:50% left:50%.
        // viewBox tem origem (0,0) no centro. Ponto SVG (cx,cy) aparece em
        // (cx * SVG_TO_CSS * S, cy * SVG_TO_CSS * S) off-center em CSS pixels.
        // Pra trazer o centro do conteudo pro centro: anular esse offset.
        const panX = -centerX * SVG_TO_CSS * clampedScale;
        const panY = -centerY * SVG_TO_CSS * clampedScale;

        set({
          viewport: { x: panX, y: panY, scale: clampedScale, isDragging: false },
        });
      },

      // ========================================================================
      // EDITOR
      // ========================================================================

      setEditorMode: (mode: EditorMode) => {
        set(state => ({
          editor: { ...state.editor, mode },
        }));
      },

      setToolMode: (toolMode: 'move' | 'select') => {
        set(state => ({
          editor: { ...state.editor, toolMode },
        }));
      },

      selectEquipamento: (equipamentoId: string, multi: boolean = false) => {
        set(state => ({
          editor: {
            ...state.editor,
            selectedEquipmentIds: multi
              ? [...state.editor.selectedEquipmentIds, equipamentoId]
              : [equipamentoId],
          },
        }));
      },

      clearSelection: () => {
        set(state => ({
          editor: {
            ...state.editor,
            selectedEquipmentIds: [],
            selectedConnectionIds: [],
          },
        }));
      },

      // ======================================================================
      // MULTI-SELEÇÃO / COPIAR-COLAR
      // ======================================================================

      toggleSelectEquipamento: (equipamentoId: string) => {
        set(state => {
          const sel = state.editor.selectedEquipmentIds;
          const next = sel.includes(equipamentoId)
            ? sel.filter(id => id !== equipamentoId)
            : [...sel, equipamentoId];
          return { editor: { ...state.editor, selectedEquipmentIds: next, selectedConnectionIds: [] } };
        });
      },

      selectInBox: (x1, y1, x2, y2, additive = false) => {
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        set(state => {
          const dentro = state.equipamentos
            .filter(eq =>
              eq.tipo !== 'JUNCTION_POINT' &&
              eq.posicaoX >= minX && eq.posicaoX <= maxX &&
              eq.posicaoY >= minY && eq.posicaoY <= maxY
            )
            .map(eq => eq.id);
          const base = additive ? state.editor.selectedEquipmentIds : [];
          const next = Array.from(new Set([...base, ...dentro]));
          return { editor: { ...state.editor, selectedEquipmentIds: next, selectedConnectionIds: [] } };
        });
      },

      moveSelectionBy: (dxGrid, dyGrid) => {
        if (dxGrid === 0 && dyGrid === 0) return;
        set(state => ({
          equipamentos: state.equipamentos.map(eq =>
            state.editor.selectedEquipmentIds.includes(eq.id)
              ? { ...eq, posicaoX: eq.posicaoX + dxGrid, posicaoY: eq.posicaoY + dyGrid }
              : eq
          ),
          isDirty: true,
        }));
        get().recalcularRotas();
      },

      deleteSelection: () => {
        const ids = [...get().editor.selectedEquipmentIds];
        if (ids.length === 0) return;
        ids.forEach(id => get().removeEquipamento(id));
        set(state => ({ editor: { ...state.editor, selectedEquipmentIds: [] } }));
      },

      copySelection: () => {
        const { equipamentos, conexoes, editor } = get();
        const ids = new Set(editor.selectedEquipmentIds);
        if (ids.size === 0) return;
        const eqs = equipamentos
          .filter(eq => ids.has(eq.id) && eq.tipo !== 'JUNCTION_POINT')
          .map(eq => ({ ...eq }));
        const conns = conexoes
          .filter(c => ids.has((c.equipamentoOrigemId ?? '').trim()) && ids.has((c.equipamentoDestinoId ?? '').trim()))
          .map(c => ({ ...c }));
        set({ clipboard: { equipamentos: eqs, conexoes: conns } });
      },

      pasteClipboard: async () => {
        const { clipboard, diagrama } = get();
        if (!clipboard || clipboard.equipamentos.length === 0 || !diagrama) return;

        const { equipamentosApi } = await import('@/services/equipamentos.services');
        const OFFSET = 3; // deslocamento em células de grid (visível, sem sobrepor)
        const idMap: Record<string, string> = {};
        const novosIds: string[] = [];
        // Nomes já em uso (evita nome duplicado ao incrementar número / gerar "(Cópia)")
        const taken = new Set(get().equipamentos.map(e => (e.nome ?? '').trim()));

        for (const eq of clipboard.equipamentos) {
          const tipoEqId = (eq as unknown as { dados?: { tipo_equipamento_id?: string } })
            .dados?.tipo_equipamento_id;
          if (!tipoEqId) {
            console.warn('[pasteClipboard] sem tipo_equipamento_id, ignorado:', eq.nome);
            continue;
          }
          try {
            const nomeCopia = nextCopyName((eq.nome ?? '').trim(), taken);
            taken.add(nomeCopia);
            const resp = await equipamentosApi.criarEquipamentoRapido(
              diagrama.unidadeId,
              tipoEqId,
              nomeCopia
            );
            const novo = resp.data as unknown as {
              id: string; nome: string; tag?: string; numero_serie?: string;
              mqtt_habilitado?: boolean; topico_mqtt?: string; automacao?: boolean;
            };
            const novoId = novo.id.trim(); // IDs do backend podem vir com espaço; o store trima
            const novoEq = {
              id: novoId,
              nome: novo.nome,
              tag: novo.tag || novo.numero_serie || '',
              tipo: eq.tipo,
              categoria: eq.categoria,
              unidadeId: diagrama.unidadeId,
              diagramaId: diagrama.id,
              posicaoX: eq.posicaoX + OFFSET,
              posicaoY: eq.posicaoY + OFFSET,
              rotacao: eq.rotacao,
              labelPosition: eq.labelPosition,
              labelOffsetX: eq.labelOffsetX,
              labelOffsetY: eq.labelOffsetY,
              largura: eq.largura,
              altura: eq.altura,
              mqttHabilitado: novo.mqtt_habilitado,
              topicoMqtt: novo.topico_mqtt,
              automacao: novo.automacao === true,
              status: 'normal' as const,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              dados: { ...novo, tipo_equipamento_id: tipoEqId },
            } as unknown as Equipment;
            get().addEquipamento(novoEq);
            idMap[eq.id.trim()] = novoId;
            novosIds.push(novoId);
          } catch (err) {
            console.error('[pasteClipboard] erro ao criar equipamento:', eq.nome, err);
          }
        }

        // Recriar conexões internas ao grupo colado (remap de IDs antigos -> novos)
        for (const c of clipboard.conexoes) {
          const o = idMap[(c.equipamentoOrigemId ?? '').trim()];
          const d = idMap[(c.equipamentoDestinoId ?? '').trim()];
          if (o && d && c.portaOrigem && c.portaDestino) {
            get().addConexao(o, c.portaOrigem, d, c.portaDestino);
          }
        }

        // Empilhar offset do clipboard pro próximo Ctrl+V (ainda NÃO mexe na seleção)
        set(state => ({
          clipboard: state.clipboard
            ? {
                equipamentos: state.clipboard.equipamentos.map(e => ({
                  ...e, posicaoX: e.posicaoX + OFFSET, posicaoY: e.posicaoY + OFFSET,
                })),
                conexoes: state.clipboard.conexoes,
              }
            : null,
        }));

        // Persiste: associa os novos equipamentos ao diagrama + salva posições/conexões
        try {
          await get().saveLayout();
        } catch (err) {
          console.error('[pasteClipboard] erro ao salvar layout após colar:', err);
        }

        // DEPOIS de persistir (evita re-render do saveLayout atropelar): selecionar os
        // colados e trocar pra ferramenta Mover, pra arrastar já mover o grupo inteiro
        // sem o marquee do modo Selecionar limpar a seleção.
        set(state => ({
          editor: {
            ...state.editor,
            selectedEquipmentIds: novosIds,
            selectedConnectionIds: [],
            toolMode: 'move',
          },
        }));
        console.warn('[pasteClipboard] colados e selecionados:', novosIds.length, novosIds);

        // Registra no undo (Ctrl+Z apaga os equipamentos criados)
        if (novosIds.length > 0) {
          set(state => ({
            undoStack: [...state.undoStack.slice(-49), { kind: 'paste', ids: [...novosIds] }],
          }));
        }
      },

      deleteEquipamentos: async (ids) => {
        const alvo = ids.map(id => (id ?? '').trim()).filter(Boolean);
        if (alvo.length === 0) return;
        const setAlvo = new Set(alvo);
        const { equipamentos, conexoes } = get();

        // Captura pro undo ANTES de remover: equipamentos + conexões que tocam algum deles
        const equipamentosRemovidos = equipamentos.filter(eq => setAlvo.has(eq.id)).map(e => ({ ...e }));
        const conexoesRemovidas = conexoes
          .filter(c => setAlvo.has((c.equipamentoOrigemId ?? '').trim()) || setAlvo.has((c.equipamentoDestinoId ?? '').trim()))
          .map(c => ({ ...c }));

        // Apaga no backend (soft-delete) os registros reais; junction point é virtual
        const { equipamentosApi } = await import('@/services/equipamentos.services');
        for (const eq of equipamentosRemovidos) {
          if (eq.tipo === 'JUNCTION_POINT') continue;
          try {
            await equipamentosApi.remove(eq.id);
          } catch (err) {
            console.error('[deleteEquipamentos] erro ao apagar no backend:', eq.nome, err);
          }
        }

        // Remove do diagrama (local) + registra undo
        alvo.forEach(id => get().removeEquipamento(id));
        set(state => ({
          undoStack: [
            ...state.undoStack.slice(-49),
            { kind: 'delete', equipamentos: equipamentosRemovidos, conexoes: conexoesRemovidas },
          ],
          editor: {
            ...state.editor,
            selectedEquipmentIds: state.editor.selectedEquipmentIds.filter(id => !setAlvo.has(id)),
          },
        }));

        try { await get().saveLayout(); } catch (err) { console.error('[deleteEquipamentos] saveLayout:', err); }
      },

      undo: async () => {
        const stack = get().undoStack;
        if (stack.length === 0) return false;
        const action = stack[stack.length - 1];
        set(state => ({ undoStack: state.undoStack.slice(0, -1) }));

        // MOVER: volta as posições anteriores
        if (action.kind === 'move') {
          action.positions.forEach(p => get().updateEquipamentoPosition(p.id, p.posicaoX, p.posicaoY));
          try { await get().saveLayout(); } catch (e) { console.error('[undo move] saveLayout:', e); }
          return true;
        }

        // COLAR: apaga os equipamentos que foram criados
        if (action.kind === 'paste') {
          const { equipamentosApi } = await import('@/services/equipamentos.services');
          for (const id of action.ids) {
            try { await equipamentosApi.remove(id); } catch (e) { console.error('[undo paste] remove:', id, e); }
            get().removeEquipamento(id);
          }
          set(state => ({ editor: { ...state.editor, selectedEquipmentIds: [], selectedConnectionIds: [] } }));
          try { await get().saveLayout(); } catch (e) { console.error('[undo paste] saveLayout:', e); }
          return true;
        }

        // APAGAR: recria os equipamentos (modo rápido) e reconecta
        if (action.kind === 'delete') {
          const { diagrama } = get();
          if (!diagrama) return false;
          const { equipamentosApi } = await import('@/services/equipamentos.services');
          const idMap: Record<string, string> = {};
          const restauradosIds: string[] = [];

          for (const eq of action.equipamentos) {
            if (eq.tipo === 'JUNCTION_POINT') continue; // virtual — volta via reconexão
            const tipoEqId = (eq as unknown as { dados?: { tipo_equipamento_id?: string } }).dados?.tipo_equipamento_id;
            if (!tipoEqId) continue;
            try {
              const resp = await equipamentosApi.criarEquipamentoRapido(diagrama.unidadeId, tipoEqId, (eq.nome ?? '').trim());
              const novo = resp.data as unknown as {
                id: string; nome: string; mqtt_habilitado?: boolean; topico_mqtt?: string; automacao?: boolean;
              };
              const novoId = novo.id.trim();
              get().addEquipamento({
                ...eq,
                id: novoId,
                nome: novo.nome,
                diagramaId: diagrama.id,
                unidadeId: diagrama.unidadeId,
                dados: { ...(eq as unknown as { dados?: object }).dados, ...novo, tipo_equipamento_id: tipoEqId },
              } as unknown as Equipment);
              idMap[eq.id.trim()] = novoId;
              restauradosIds.push(novoId);
            } catch (e) {
              console.error('[undo delete] recriar:', eq.nome, e);
            }
          }

          // Reconecta: endpoints deletados remapeiam pro novo id; sobreviventes mantêm o id
          for (const c of action.conexoes) {
            const o = idMap[(c.equipamentoOrigemId ?? '').trim()] ?? (c.equipamentoOrigemId ?? '').trim();
            const d = idMap[(c.equipamentoDestinoId ?? '').trim()] ?? (c.equipamentoDestinoId ?? '').trim();
            const existeO = get().equipamentos.some(e => e.id === o);
            const existeD = get().equipamentos.some(e => e.id === d);
            if (existeO && existeD && c.portaOrigem && c.portaDestino) {
              get().addConexao(o, c.portaOrigem, d, c.portaDestino);
            }
          }

          set(state => ({
            editor: { ...state.editor, selectedEquipmentIds: restauradosIds, selectedConnectionIds: [], toolMode: 'move' },
          }));
          try { await get().saveLayout(); } catch (e) { console.error('[undo delete] saveLayout:', e); }
          return true;
        }

        return false;
      },

      selectConnection: (conexaoId: string, multi: boolean = false) => {
        set(state => ({
          editor: {
            ...state.editor,
            // Limpar seleção de equipamentos ao selecionar conexão
            selectedEquipmentIds: [],
            selectedConnectionIds: multi
              ? [...state.editor.selectedConnectionIds, conexaoId]
              : [conexaoId],
          },
        }));
      },

      startConnecting: (equipamentoId: string, porta: PortPosition) => {
        console.log('[startConnecting] Iniciando conexão:', { equipamentoId, porta });

        set(state => ({
          editor: {
            ...state.editor,
            mode: 'connecting',
            connectingFrom: {
              equipamentoId,
              porta,
            },
          },
        }));
      },

      finishConnecting: (equipamentoId: string, porta: PortPosition) => {
        const { editor } = get();

        console.log('[finishConnecting] Finalizando conexão:', {
          equipamentoId,
          porta,
          connectingFrom: editor.connectingFrom
        });

        if (!editor.connectingFrom) {
          console.warn('[finishConnecting] Não há conexão em andamento!');
          return;
        }

        // Criar a conexão
        get().addConexao(
          editor.connectingFrom.equipamentoId,
          editor.connectingFrom.porta,
          equipamentoId,
          porta
        );

        console.log('[finishConnecting] Conexão criada com sucesso!');

        // Resetar modo
        set(state => ({
          editor: {
            ...state.editor,
            mode: 'edit',
            connectingFrom: null,
          },
        }));
      },

      cancelConnecting: () => {
        set(state => ({
          editor: {
            ...state.editor,
            mode: 'edit',
            connectingFrom: null,
          },
        }));
      },

      startDraggingEquipamento: (equipamentoId: string, offset: Point) => {
        set(state => ({
          // snapshot das posições atuais pra registrar 1 undo caso o arraste mude algo
          _dragStartPos: state.equipamentos.map(e => ({ id: e.id, posicaoX: e.posicaoX, posicaoY: e.posicaoY })),
          editor: {
            ...state.editor,
            draggingEquipmentId: equipamentoId,
            dragOffset: offset,
          },
        }));
      },

      endDraggingEquipamento: () => {
        // Se o arraste mudou alguma posição, registra 1 entrada de undo (posições antigas)
        const { _dragStartPos, equipamentos } = get();
        if (_dragStartPos) {
          const atual = new Map(equipamentos.map(e => [e.id, e]));
          const mudou = _dragStartPos.filter(p => {
            const e = atual.get(p.id);
            return e && (e.posicaoX !== p.posicaoX || e.posicaoY !== p.posicaoY);
          });
          if (mudou.length > 0) {
            set(state => ({
              undoStack: [...state.undoStack.slice(-49), { kind: 'move', positions: mudou.map(p => ({ ...p })) }],
            }));
          }
        }
        set(state => ({
          _dragStartPos: null,
          editor: {
            ...state.editor,
            draggingEquipmentId: null,
            dragOffset: null,
          },
        }));
      },

      // ========================================================================
      // TEMA
      // ========================================================================

      toggleTheme: () => {
        set(state => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        }));
      },

      setTheme: (theme: Theme) => {
        set({ theme });
      },

      // ========================================================================
      // GRUPOS
      // ========================================================================

      addGrupo: (grupo: Grupo) => {
        set(state => ({
          grupos: [...state.grupos, grupo],
          isDirty: true,
        }));
      },

      removeGrupo: (grupoId: string) => {
        set(state => ({
          grupos: state.grupos.filter(g => g.id !== grupoId),
          isDirty: true,
        }));
      },
    }),
    { name: 'DiagramStore' }
  )
);
