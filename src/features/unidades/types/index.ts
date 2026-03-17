// src/features/unidades/types/index.ts

// ===== ENUMS =====

export enum TipoUnidade {
  UFV = 'UFV',
  PCH = 'PCH',
  OUTRO = 'OUTRO',
}

export enum StatusUnidade {
  ATIVO = 'ativo',
  INATIVO = 'inativo',
}

export enum GrupoUnidade {
  A = 'A',
  B = 'B',
}

export enum SubgrupoUnidade {
  A4_VERDE = 'A4_VERDE',
  A3a_VERDE = 'A3a_VERDE',
  B = 'B',
}

export enum TipoUnidadeEnergia {
  CARGA = 'Carga',
  GERACAO = 'Geração',
  CARGA_E_GERACAO = 'Carga e Geração',
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

  // Novos campos
  irrigante?: boolean;
  grupo?: GrupoUnidade;
  subgrupo?: SubgrupoUnidade;
  tipoUnidade?: TipoUnidadeEnergia;
  demandaCarga?: number;
  demandaGeracao?: number;
  concessionariaId?: string;
  numeroUc?: string; // ✅ Número da Unidade Consumidora
  tensaoNominal?: number; // Tensão nominal em V

  // Timestamps
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;

  // Relacionamentos
  planta?: {
    id: string;
    nome: string;
    localizacao?: string;
    proprietario?: {
      id: string;
      nome: string;
      email: string;
    };
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
  irrigante?: boolean;
  grupo?: GrupoUnidade;
  subgrupo?: SubgrupoUnidade;
  tipo_unidade?: TipoUnidadeEnergia;
  demanda_carga?: number;
  demanda_geracao?: number;
  concessionaria_id?: string;
  numero_uc?: string; // ✅ Número da Unidade Consumidora
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
  proprietarioId?: string; // Filtro por proprietário (apenas admin/super_admin)
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
  proprietarioId?: string; // ✅ ID do proprietário (para filtrar plantas)
  nome: string;
  tipo: TipoUnidade;
  estado: string;
  cidade: string;
  latitude: number | string;
  longitude: number | string;
  potencia: number | string;
  status: StatusUnidade;
  pontosMedicao?: string; // JSON como string no form
  irrigante?: boolean;
  grupo?: GrupoUnidade;
  subgrupo?: SubgrupoUnidade;
  tipoUnidade?: TipoUnidadeEnergia;
  demandaCarga?: number | string;
  demandaGeracao?: number | string;
  concessionariaId?: string | undefined; // Explicitly allow undefined
  numeroUc?: string; // ✅ Número da Unidade Consumidora
}

// ===== UTILITÁRIOS DE CONVERSÃO =====

/**
 * Converter FormData para DTO da API
 */
export const formDataToDto = (formData: UnidadeFormData): CreateUnidadeDto => {
  // 🔍 LOG DETALHADO - FormData recebido
  console.log('🏁 [formDataToDto] ===== INÍCIO =====');
  console.log('📦 [formDataToDto] FormData completo:', JSON.stringify(formData, null, 2));
  console.log('🔑 [formDataToDto] concessionariaId no formData:', formData.concessionariaId);
  console.log('🔍 [formDataToDto] Tipo:', typeof formData.concessionariaId);
  console.log('📝 [formDataToDto] É undefined?', formData.concessionariaId === undefined);
  console.log('📝 [formDataToDto] É null?', formData.concessionariaId === null);
  console.log('📝 [formDataToDto] É string vazia?', formData.concessionariaId === '');

  // Helper to safely parse JSON or return undefined
  const parsePontosMedicao = (value?: string | any) => {
    // Se já é array ou objeto, retorna direto
    if (Array.isArray(value)) return value.length > 0 ? value : undefined;
    if (typeof value === 'object' && value !== null) return value;

    // Se não é string ou é vazio, retorna undefined
    if (!value || typeof value !== 'string' || value.trim() === '') return undefined;

    // Tenta fazer parse da string
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Erro ao fazer parse de pontosMedicao:', error);
      return undefined;
    }
  };

  // Processar concessionaria_id
  let concessionariaId: string | undefined = undefined;
  if (formData.concessionariaId && typeof formData.concessionariaId === 'string' && formData.concessionariaId.trim() !== '') {
    concessionariaId = formData.concessionariaId.trim();
  }

  console.log('🔑 [formDataToDto] concessionaria_id processado:', concessionariaId);

  const dto: any = {
    planta_id: formData.plantaId,
    nome: formData.nome,
    tipo: formData.tipo,
    estado: formData.estado,
    cidade: formData.cidade,
    latitude: typeof formData.latitude === 'string' ? parseFloat(formData.latitude) : formData.latitude,
    longitude: typeof formData.longitude === 'string' ? parseFloat(formData.longitude) : formData.longitude,
    potencia: typeof formData.potencia === 'string' ? parseFloat(formData.potencia) : formData.potencia,
    status: formData.status,
    irrigante: formData.irrigante,
    grupo: formData.grupo,
    subgrupo: formData.subgrupo,
    tipo_unidade: formData.tipoUnidade,
  };

  // ✅ CORREÇÃO: Adicionar propriedades opcionais apenas se tiverem valor
  // Isso evita que undefined seja enviado e removido pelo JSON.stringify/axios
  if (parsePontosMedicao(formData.pontosMedicao)) {
    dto.pontos_medicao = parsePontosMedicao(formData.pontosMedicao);
  }

  if (formData.demandaCarga) {
    dto.demanda_carga = typeof formData.demandaCarga === 'string' ? parseFloat(formData.demandaCarga) : formData.demandaCarga;
  }

  if (formData.demandaGeracao) {
    dto.demanda_geracao = typeof formData.demandaGeracao === 'string' ? parseFloat(formData.demandaGeracao) : formData.demandaGeracao;
  }

  // ✅ CRÍTICO: Só adicionar concessionaria_id se houver valor
  if (concessionariaId) {
    dto.concessionaria_id = concessionariaId;
    console.log('✅ [formDataToDto] concessionaria_id ADICIONADO ao DTO:', concessionariaId);
  } else {
    console.log('⚠️ [formDataToDto] concessionaria_id NÃO adicionado (undefined/null/empty)');
  }

  // ✅ Adicionar numero_uc se houver valor
  if (formData.numeroUc && formData.numeroUc.trim() !== '') {
    dto.numero_uc = formData.numeroUc.trim();
  }

  console.log('📦 [formDataToDto] DTO final:', JSON.stringify(dto, null, 2));
  console.log('🔑 [formDataToDto] concessionaria_id no DTO:', dto.concessionaria_id);
  console.log('🔍 [formDataToDto] Propriedade existe?', 'concessionaria_id' in dto);
  console.log('🏁 [formDataToDto] ===== FIM =====');

  return dto;
};

/**
 * Converter Unidade da API para FormData
 */
export const unidadeToFormData = (unidade: Unidade): UnidadeFormData => {
  // Helper to safely stringify pontosMedicao
  const stringifyPontosMedicao = (value: any) => {
    if (!value) return '';
    try {
      // If it's already a string, return it
      if (typeof value === 'string') return value;
      // If it's an array or object, stringify it
      return JSON.stringify(value, null, 2);
    } catch (error) {
      console.warn('Erro ao serializar pontosMedicao:', error);
      return '';
    }
  };

  return {
    plantaId: unidade.plantaId,
    proprietarioId: unidade.planta?.proprietario?.id || undefined, // ✅ ID do proprietário da planta
    nome: unidade.nome,
    tipo: unidade.tipo,
    estado: unidade.estado,
    cidade: unidade.cidade,
    latitude: unidade.latitude,
    longitude: unidade.longitude,
    potencia: unidade.potencia,
    status: unidade.status,
    pontosMedicao: stringifyPontosMedicao(unidade.pontosMedicao),
    irrigante: unidade.irrigante,
    grupo: unidade.grupo,
    subgrupo: unidade.subgrupo,
    tipoUnidade: unidade.tipoUnidade,
    demandaCarga: unidade.demandaCarga,
    demandaGeracao: unidade.demandaGeracao,
    concessionariaId: unidade.concessionariaId || undefined, // Convert empty string or null to undefined
    numeroUc: unidade.numeroUc || undefined, // ✅ Número da Unidade Consumidora
  };
};

/**
 * Valores padrão do formulário
 */
export const defaultUnidadeFormValues: UnidadeFormData = {
  plantaId: '',
  nome: '',
  tipo: TipoUnidade.UFV,
  estado: '',
  cidade: '',
  latitude: '',
  longitude: '',
  potencia: '',
  status: StatusUnidade.ATIVO,
  pontosMedicao: '',
  irrigante: false,
  grupo: undefined,
  subgrupo: undefined,
  tipoUnidade: undefined,
  demandaCarga: '',
  demandaGeracao: '',
  concessionariaId: undefined, // undefined instead of empty string
  numeroUc: '', // ✅ Número da Unidade Consumidora
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
