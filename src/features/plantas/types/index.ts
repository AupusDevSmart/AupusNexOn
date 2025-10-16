// src/features/plantas/types/index.ts - ATUALIZADO PARA API
import { BaseEntity, type BaseFilters as BaseFiltersType, ModalMode } from '@/types/base';

export interface Endereco {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

// ✅ ATUALIZADO: Tipo simplificado do proprietário para uso nas plantas (compatível com API)
export interface ProprietarioBasico {
  id: string; // ✅ String para compatibilidade com API
  nome: string;
  cpf_cnpj: string;
  tipo: 'pessoa_fisica' | 'pessoa_juridica';
}

// ✅ ATUALIZADO: Interface Planta compatível com API Response
export interface Planta extends BaseEntity {
  nome: string;
  cnpj: string;
  localizacao: string;
  horarioFuncionamento: string;
  endereco: Endereco;
  
  // Relacionamento com proprietário
  proprietarioId: string; // ✅ String para compatibilidade com API
  proprietario?: ProprietarioBasico;
  
  // Timestamps da API
  criadoEm: string; // ✅ ISO string da API
  atualizadoEm: string; // ✅ ISO string da API
}

// ✅ NOVO: Interface para dados do formulário (formato interno do frontend)
export interface PlantaFormData {
  nome: string;
  cnpj: string;
  localizacao: string;
  horarioFuncionamento: string;
  endereco: Endereco;
  proprietarioId: string; // ✅ String para compatibilidade
}

// ✅ ATUALIZADO: Filtros compatíveis com API
export interface PlantasFilters {
  search: string;
  proprietarioId: string;
  page: number;
  limit: number;
}

// ✅ INTERFACES DE ESTADO DO MODAL
export interface ModalState {
  isOpen: boolean;
  mode: ModalMode;
  planta: Planta | null;
}

// ✅ RE-EXPORTS
export { type ModalMode };

// ✅ INTERFACE DE PAGINAÇÃO (compatível com API)
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ✅ NOVOS TIPOS PARA TRANSFORMAÇÃO DE DADOS

// Tipo para converter dados da API para o formato interno
export type PlantaApiToInternal = (apiPlanta: any) => Planta;

// Tipo para converter dados internos para formato da API
export type PlantaInternalToApi = (internalPlanta: PlantaFormData) => any;

// ✅ UTILITIES TYPES

// Extract apenas os campos editáveis da Planta
export type EditablePlantaFields = Pick<Planta, 
  'nome' | 'cnpj' | 'localizacao' | 'horarioFuncionamento' | 'endereco' | 'proprietarioId'
>;

// Campos obrigatórios para criação
export type RequiredPlantaFields = Required<EditablePlantaFields>;

// Campos opcionais para atualização
export type OptionalPlantaFields = Partial<EditablePlantaFields>;

// ✅ ENUMS E CONSTANTES

export const PLANTAS_ORDER_BY_OPTIONS = [
  'nome',
  'cnpj', 
  'localizacao',
  'cidade',
  'criadoEm',
  'proprietario'
] as const;

export type PlantasOrderBy = typeof PLANTAS_ORDER_BY_OPTIONS[number];

export const PLANTAS_ORDER_DIRECTION_OPTIONS = ['asc', 'desc'] as const;
export type PlantasOrderDirection = typeof PLANTAS_ORDER_DIRECTION_OPTIONS[number];

// ✅ INTERFACE DE QUERY PARAMS PARA API
export interface PlantasQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  proprietarioId?: string;
  orderBy?: PlantasOrderBy;
  orderDirection?: PlantasOrderDirection;
}

// ✅ RESPONSE TYPES ESPECÍFICOS PARA API

export interface PlantaApiResponse {
  id: string;
  nome: string;
  cnpj: string;
  localizacao: string;
  horarioFuncionamento: string;
  endereco: Endereco;
  proprietarioId: string;
  proprietario?: ProprietarioBasico;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PaginatedPlantasResponse {
  data: PlantaApiResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ✅ FORM VALIDATION TYPES

export interface PlantaValidationErrors {
  nome?: string;
  cnpj?: string;
  proprietarioId?: string;
  horarioFuncionamento?: string;
  localizacao?: string;
  endereco?: {
    logradouro?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
}

// ✅ STATUS E LOADING STATES

export interface PlantasLoadingState {
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error?: string;
}

export interface PlantaOperationResult {
  success: boolean;
  data?: Planta;
  error?: string;
}

// ✅ HOOK RETURN TYPES

export interface UsePlantasResult {
  plantas: Planta[];
  pagination: Pagination;
  loading: PlantasLoadingState;
  filters: PlantasFilters;
  
  // Actions
  fetchPlantas: (params?: PlantasQueryParams) => Promise<void>;
  createPlanta: (data: PlantaFormData) => Promise<PlantaOperationResult>;
  updatePlanta: (id: string, data: Partial<PlantaFormData>) => Promise<PlantaOperationResult>;
  setFilters: (filters: Partial<PlantasFilters>) => void;
  handlePageChange: (page: number) => void;
}

export interface UsePlantaDetailsResult {
  planta: Planta | null;
  loading: boolean;
  error?: string;
  
  // Actions
  fetchPlanta: (id: string) => Promise<void>;
  updatePlanta: (data: Partial<PlantaFormData>) => Promise<PlantaOperationResult>;
  refresh: () => Promise<void>;
}