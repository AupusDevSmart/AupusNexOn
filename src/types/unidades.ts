// Tipos baseados na API
export enum TipoUnidadeNexon {
  UFV = 'UFV',
  Carga = 'Carga',
  Motor = 'Motor',
  Inversor = 'Inversor',
  Transformador = 'Transformador',
}

export enum StatusUnidadeNexon {
  ATIVO = 'ativo',
  INATIVO = 'inativo',
}

export interface LocalizacaoUnidade {
  estado: string;
  cidade: string;
  latitude: number;
  longitude: number;
}

export interface UnidadeNexon {
  id: string;
  nome: string;
  tipo: TipoUnidadeNexon;
  localizacao: LocalizacaoUnidade;
  potencia: number;
  status: StatusUnidadeNexon;
  pontosMedicao: string[];
  dataCadastro: string;
  ultimaAtualizacao: string;
}

// DTOs para requisições
export interface CreateUnidadeDto {
  nome: string;
  tipo: TipoUnidadeNexon;
  localizacao: LocalizacaoUnidade;
  potencia: number;
  status?: StatusUnidadeNexon;
  pontosMedicao: string[];
}

export interface UpdateUnidadeDto {
  nome?: string;
  tipo?: TipoUnidadeNexon;
  localizacao?: LocalizacaoUnidade;
  potencia?: number;
  status?: StatusUnidadeNexon;
  pontosMedicao?: string[];
}

export interface FilterUnidadeDto {
  search?: string;
  tipo?: TipoUnidadeNexon;
  status?: StatusUnidadeNexon;
  estado?: string;
  page?: number;
  limit?: number;
}

// Resposta paginada
export interface PaginatedUnidadeResponse {
  data: UnidadeNexon[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Estatísticas
export interface UnidadeStats {
  total: number;
  ativas: number;
  inativas: number;
  porTipo: Array<{
    tipo: TipoUnidadeNexon;
    quantidade: number;
  }>;
}

// Resposta de importação
export interface ImportResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: Array<{
    success: boolean;
    data?: UnidadeNexon;
    error?: string;
  }>;
}