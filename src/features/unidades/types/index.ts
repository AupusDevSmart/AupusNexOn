// src/features/unidades/types/index.ts

// ===== ENUMS =====

export enum TipoUnidade {
  UFV = 'UFV',
  Carga = 'Carga',
  Motor = 'Motor',
  Inversor = 'Inversor',
  Transformador = 'Transformador',
}

export enum StatusUnidade {
  ATIVO = 'ativo',
  INATIVO = 'inativo',
}

// ===== TIPOS BASE =====

/**
 * Interface Unidade (Response da API)
 */
export interface Unidade {
  id: string;
  plantaId: string;
  nome: string;
  tipo: TipoUnidade;

  // Localização
  estado: string;
  cidade: string;
  latitude: number;
  longitude: number;

  potencia: number;
  status: StatusUnidade;
  pontosMedicao?: any; // JSON

  // Timestamps
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;

  // Relacionamentos
  planta?: {
    id: string;
    nome: string;
    localizacao?: string;
  };
}

// ===== DTOs DE CRIAÇÃO/ATUALIZAÇÃO =====

/**
 * DTO para criar unidade (snake_case para API)
 */
export interface CreateUnidadeDto {
  planta_id: string;
  nome: string;
  tipo: TipoUnidade;
  estado: string;
  cidade: string;
  latitude: number;
  longitude: number;
  potencia: number;
  status: StatusUnidade;
  pontos_medicao?: any;
}

/**
 * DTO para atualizar unidade
 */
export interface UpdateUnidadeDto extends Partial<CreateUnidadeDto> {}

// ===== FILTROS E QUERIES =====

/**
 * Filtros para busca de unidades
 */
export interface UnidadeFilters {
  page?: number;
  limit?: number;
  search?: string;
  plantaId?: string; // Backend espera camelCase
  tipo?: TipoUnidade;
  status?: StatusUnidade;
  estado?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

// ===== RESPOSTAS DA API =====

/**
 * Response paginado da API de unidades
 */
export interface UnidadesResponse {
  data: Unidade[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Estatísticas de uma unidade
 */
export interface UnidadeEstatisticas {
  unidade: {
    id: string;
    nome: string;
    planta: {
      id: string;
      nome: string;
      localizacao?: string;
    };
  };
  totais: {
    equipamentos: number;
  };
  porCriticidade: Record<string, number>;
  financeiro?: Record<string, number>;
}

/**
 * Response de equipamentos de uma unidade
 */
export interface UnidadeEquipamentosResponse {
  data: any[]; // TODO: tipar com Equipamento quando disponível
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unidade: {
    id: string;
    nome: string;
    planta: {
      id: string;
      nome: string;
      localizacao?: string;
    };
  };
}

// ===== FORMULÁRIO =====

/**
 * Dados do formulário (camelCase)
 */
export interface UnidadeFormData {
  plantaId: string;
  nome: string;
  tipo: TipoUnidade;
  estado: string;
  cidade: string;
  latitude: number | string;
  longitude: number | string;
  potencia: number | string;
  status: StatusUnidade;
  pontosMedicao?: string; // JSON como string no form
}

// ===== UTILITÁRIOS DE CONVERSÃO =====

/**
 * Converter FormData para DTO da API
 */
export const formDataToDto = (formData: UnidadeFormData): CreateUnidadeDto => ({
  planta_id: formData.plantaId,
  nome: formData.nome,
  tipo: formData.tipo,
  estado: formData.estado,
  cidade: formData.cidade,
  latitude: typeof formData.latitude === 'string' ? parseFloat(formData.latitude) : formData.latitude,
  longitude: typeof formData.longitude === 'string' ? parseFloat(formData.longitude) : formData.longitude,
  potencia: typeof formData.potencia === 'string' ? parseFloat(formData.potencia) : formData.potencia,
  status: formData.status,
  pontos_medicao: formData.pontosMedicao ? JSON.parse(formData.pontosMedicao) : undefined,
});

/**
 * Converter Unidade da API para FormData
 */
export const unidadeToFormData = (unidade: Unidade): UnidadeFormData => ({
  plantaId: unidade.plantaId,
  nome: unidade.nome,
  tipo: unidade.tipo,
  estado: unidade.estado,
  cidade: unidade.cidade,
  latitude: unidade.latitude,
  longitude: unidade.longitude,
  potencia: unidade.potencia,
  status: unidade.status,
  pontosMedicao: unidade.pontosMedicao ? JSON.stringify(unidade.pontosMedicao, null, 2) : '',
});

/**
 * Valores padrão do formulário
 */
export const defaultUnidadeFormValues: UnidadeFormData = {
  plantaId: '',
  nome: '',
  tipo: TipoUnidade.Carga,
  estado: '',
  cidade: '',
  latitude: '',
  longitude: '',
  potencia: '',
  status: StatusUnidade.ATIVO,
  pontosMedicao: '',
};

// Estados do Brasil
export const ESTADOS_BRASIL = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];
