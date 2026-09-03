// src/features/equipamentos/types/index.ts - TIPOS CORRIGIDOS COM STRING IDS
import { BaseEntity, type BaseFilters as BaseFiltersType, ModalMode } from '@/core/types/base';

// ============================================================================
// TIPOS BASE COMPATÍVEIS COM A API
// ============================================================================

export interface ProprietarioBasico {
  id: string; // CORRIGIDO: string em vez de number
  nome?: string; // Nome do proprietário (vem do backend)
  razaoSocial?: string; // Alias para nome (compatibilidade)
  cnpjCpf?: string;
  cpf_cnpj?: string; // Alias para cnpjCpf (compatibilidade com backend)
  tipo: 'pessoa_fisica' | 'pessoa_juridica';
}

export interface Planta extends BaseEntity {
  id: string; // Explícito para garantir que existe
  criadoEm: string; // Explícito para garantir que existe
  nome: string;
  cnpj: string;
  localizacao?: string;
  proprietarioId: string; // CORRIGIDO: string em vez de number
  proprietario?: ProprietarioBasico;
}

export interface Unidade extends BaseEntity {
  id: string;
  criadoEm: string;
  plantaId: string;
  nome: string;
  tipo: string;
  estado: string;
  cidade: string;
  latitude: number;
  longitude: number;
  potencia: number;
  status: string;
  planta?: {
    id: string;
    nome: string;
    proprietario?: ProprietarioBasico;
  };
}

export interface DadoTecnico {
  id?: string;
  campo: string;
  valor: string;
  tipo: string;
  unidade?: string;
}

// ============================================================================
// EQUIPAMENTO PAI - TIPO COMPATÍVEL
// ============================================================================
export interface EquipamentoPai {
  id: string; // CORRIGIDO: string em vez de number
  nome: string;
  classificacao: 'UC';
  criticidade: '1' | '2' | '3' | '4' | '5';
  criadoEm: string;
  fabricante?: string;
  modelo?: string;
  localizacao?: string;
}

// ============================================================================
// EQUIPAMENTO - COMPATÍVEL COM API
// ============================================================================
export interface Equipamento extends BaseEntity {
  // Herda id: string, createdAt: string, updatedAt: string de BaseEntity
  id: string; // Explícito para garantir que existe
  criadoEm?: string; // Opcional - nem sempre presente na resposta da API

  // Informações básicas
  nome: string;
  classificacao?: 'UC' | 'UAR';

  // Relacionamentos hierárquicos - TODOS CORRIGIDOS PARA STRING
  unidadeId?: string; // NOVO: Equipamentos UC agora pertencem a Unidades
  proprietarioId?: string;
  equipamentoPaiId?: string;

  // Referências para exibição
  proprietario?: ProprietarioBasico;
  unidade?: Unidade; // NOVO: Referência para Unidade (que contém a Planta)
  planta?: Planta; // Mantido para compatibilidade (acessível via unidade.planta)
  equipamentoPai?: EquipamentoPai;

  // Dados técnicos básicos
  fabricante?: string;
  fabricante_custom?: string; // Fabricante customizado (snake_case do backend)
  modelo?: string;
  numeroSerie?: string;
  criticidade?: '1' | '2' | '3' | '4' | '5';
  tipo?: string;
  tipoEquipamento?: string;
  // `categoria` chega como texto (o nome) por este caminho e como objeto pela
  // rota /tipos-equipamentos. Use `normalizarTipoEquipamento` antes de ler.
  tipoEquipamentoObj?: {
    id: string;
    nome: string;
    codigo?: string;
    categoria?: string | { id: string; nome: string };
    categoriaId?: string;
    fabricante?: string;
    iconeSvg?: string;
    larguraPadrao?: number;
    alturaPadrao?: number;
  };

  // Status
  status?: 'Ativo' | 'Inativo';

  // Estados operacionais
  emOperacao?: 'sim' | 'nao';
  tipoDepreciacao?: 'linear' | 'uso';

  // Datas
  dataImobilizacao?: string;
  dataInstalacao?: string;

  // Valores financeiros
  valorImobilizado?: number;
  valorDepreciacao?: number;
  valorContabil?: number;
  vidaUtil?: number;

  // Administrativo
  fornecedor?: string;
  centroCusto?: string;
  planoManutencao?: string;

  // Localização
  localizacao?: string;
  localizacaoEspecifica?: string;
  observacoes?: string;

  // TAG e MQTT
  tag?: string;
  mqttHabilitado?: boolean;
  mqtt_habilitado?: boolean; // snake_case do backend
  topicoMqtt?: string;
  topico_mqtt?: string; // snake_case do backend

  // Automacao (PR3) — equipamento expoe pontos (comando/status/medicao) para integracao com TONs.
  // Ver tipos PontoEquipamento abaixo + service equipamento-pontos.
  automacao?: boolean;

  // Campos MCPSE
  mcpse?: boolean;
  mcpseAtivo?: boolean;
  tuc?: string;
  a1?: string;
  a2?: string;
  a3?: string;
  a4?: string;
  a5?: string;
  a6?: string;

  // Foto (servida em /uploads/equipamentos/<filename> pelo backend)
  fotoUrl?: string;

  // Dados técnicos dinâmicos
  dadosTecnicos?: DadoTecnico[];

  // Componentes UAR (apenas para UC)
  componentesUAR?: Equipamento[];
  totalComponentes?: number;
}

// ============================================================================
// PONTOS DE AUTOMACAO (PR3)
// ============================================================================

/**
 * Tipos validos de ponto. comando = dispara acao (TON->equipamento);
 * status = leitura binaria; medicao = leitura analogica.
 * MVP atual opera so 'comando'. status/medicao ficam reservados.
 */
export const PONTO_TIPOS = ['comando', 'status', 'medicao'] as const;
export type PontoTipo = (typeof PONTO_TIPOS)[number];

/**
 * Ponto exposto por um equipamento (linha de equipamento_pontos no backend).
 * Cada equipamento com `automacao=true` pode ter N pontos. Nome eh unico
 * dentro do equipamento (UNIQUE em backend).
 */
export interface PontoEquipamento {
  id: string;
  equipamento_id: string;
  tipo: PontoTipo;
  nome: string;
  unidade?: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Payload para criar ponto. equipamento_id vem do path (`/equipamentos/:id/pontos`).
 */
export interface CreatePontoEquipamentoInput {
  tipo: PontoTipo;
  nome: string;
  unidade?: string;
  ordem?: number;
  ativo?: boolean;
}

export type UpdatePontoEquipamentoInput = Partial<CreatePontoEquipamentoInput>;

// ============================================================================
// FORMULÁRIOS E FILTROS
// ============================================================================
export interface EquipamentoFormData {
  nome: string;
  classificacao: 'UC' | 'UAR';
  proprietarioId?: string; // CORRIGIDO: string
  plantaId?: string; // Mantido para seleção cascata (não enviado para API)
  unidadeId?: string; // NOVO: Usado para criar/atualizar equipamento
  equipamentoPaiId?: string; // CORRIGIDO: string
  fabricante?: string;
  modelo?: string;
  numeroSerie?: string;
  criticidade: '1' | '2' | '3' | '4' | '5';
  tipo?: string;
  tipoEquipamento?: string;
  status?: 'Ativo' | 'Inativo';
  emOperacao?: 'sim' | 'nao';
  tipoDepreciacao?: 'linear' | 'uso';
  dataImobilizacao?: string;
  dataInstalacao?: string;
  valorImobilizado?: number;
  valorDepreciacao?: number;
  valorContabil?: number;
  vidaUtil?: number;
  fornecedor?: string;
  centroCusto?: string;
  planoManutencao?: string;
  localizacao?: string;
  localizacaoEspecifica?: string;
  observacoes?: string;
  tag?: string;
  mqttHabilitado?: boolean;
  topicoMqtt?: string;
  mcpse?: boolean;
  mcpseAtivo?: boolean;
  tuc?: string;
  a1?: string;
  a2?: string;
  a3?: string;
  a4?: string;
  a5?: string;
  a6?: string;
  fotoUrl?: string;
  dadosTecnicos?: DadoTecnico[];
}

export interface EquipamentosFilters extends BaseFiltersType {
  proprietarioId: string;
  plantaId: string; // Mantido para filtro por planta (busca em unidade.plantaId)
  unidadeId?: string; // NOVO: Filtro direto por unidade
  criticidade: string;
  classificacao: string;
  equipamentoPaiId?: string;
  semPlano?: boolean; // Filtrar apenas equipamentos sem plano de manutenção
  page?: number;
  limit?: number;
  search?: string;
}

export interface ModalState {
  isOpen: boolean;
  mode: ModalMode;
  equipamento: Equipamento | null;
}

export interface ComponenteModalState {
  isOpen: boolean;
  mode: ModalMode;
  equipamentoPai: Equipamento | null;
  componentes: Equipamento[];
  editingComponente: Equipamento | null;
}

// ============================================================================
// RESPOSTAS DA API
// ============================================================================
export interface EquipamentosListResponse {
  data: Equipamento[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PlantaEquipamentosResponse extends EquipamentosListResponse {
  planta: {
    id: string;
    nome: string;
    localizacao: string;
  };
}

export interface EstatisticasPlanta {
  planta: {
    id: string;
    nome: string;
    localizacao: string;
  };
  totais: {
    equipamentos: number;
    equipamentosUC: number;
    componentesUAR: number;
  };
  porCriticidade: Record<string, number>;
  financeiro: {
    valorTotalContabil: number;
  };
}

export interface ComponentesGerenciamento {
  equipamentoUC: {
    id: string;
    nome: string;
    fabricante?: string;
    modelo?: string;
    planta?: {
      id: string;
      nome: string;
    };
    proprietario?: {
      id: string;
      nome: string;
    };
  };
  componentes: Equipamento[];
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================
export const validateEquipamentoData = (data: EquipamentoFormData): { 
  valid: boolean; 
  errors: string[] 
} => {
  const errors: string[] = [];
  
  if (!data.nome?.trim()) {
    errors.push('Nome do equipamento é obrigatório');
  }
  
  if (!data.criticidade) {
    errors.push('Criticidade é obrigatória');
  }
  
  if (!data.classificacao) {
    errors.push('Classificação (UC/UAR) é obrigatória');
  }
  
  if (data.classificacao === 'UC' && !data.unidadeId) {
    errors.push('Equipamento UC deve ter uma unidade');
  }
  
  if (data.classificacao === 'UAR' && !data.equipamentoPaiId) {
    errors.push('Componente UAR deve ter um equipamento pai');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// ============================================================================
// UTILITÁRIOS - ATUALIZADOS PARA STRING IDS
// ============================================================================
export const isUC = (equipamento: Equipamento): boolean => {
  return equipamento.classificacao === 'UC';
};

export const isUAR = (equipamento: Equipamento): boolean => {
  return equipamento.classificacao === 'UAR';
};

export const getUARsByUC = (equipamentos: Equipamento[], ucId: string): Equipamento[] => {
  return equipamentos.filter(eq => 
    eq.classificacao === 'UAR' && eq.equipamentoPaiId === ucId
  );
};

export const getUCsByPlanta = (equipamentos: Equipamento[], plantaId: string): Equipamento[] => {
  return equipamentos.filter(eq =>
    eq.classificacao === 'UC' && eq.unidade?.plantaId === plantaId
  );
};

export const getEquipamentoWithComponentes = (
  equipamento: Equipamento, 
  allEquipamentos: Equipamento[]
): Equipamento => {
  if (equipamento.classificacao === 'UC') {
    const componentesUAR = getUARsByUC(allEquipamentos, (equipamento as BaseEntity).id);
    return {
      ...equipamento,
      componentesUAR,
      totalComponentes: componentesUAR.length
    };
  }
  return equipamento;
};

// ============================================================================
// CONFIGURAÇÕES DE CRITICIDADE
// ============================================================================
export const getCriticidadeConfig = (criticidade: string) => {
  const configs: Record<string, { color: string; label: string; icon: string }> = {
    '5': { 
      color: 'bg-red-100 text-red-800 border-red-200', 
      label: 'Muito Alta', 
      icon: 'alert-triangle' 
    },
    '4': { 
      color: 'bg-orange-100 text-orange-800 border-orange-200', 
      label: 'Alta', 
      icon: 'alert-triangle' 
    },
    '3': { 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
      label: 'Média', 
      icon: 'alert-circle' 
    },
    '2': { 
      color: 'bg-blue-100 text-blue-800 border-blue-200', 
      label: 'Baixa', 
      icon: 'check-circle' 
    },
    '1': { 
      color: 'bg-green-100 text-green-800 border-green-200', 
      label: 'Muito Baixa', 
      icon: 'check-circle' 
    }
  };
  return configs[criticidade] || configs['3'];
};

// Re-exportar tipos base
export { type ModalMode };

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};