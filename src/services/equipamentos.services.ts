// src/services/equipamentos.services.ts
import { api } from '@/config/api';

// ============================================================================
// TIPOS DA API (baseados nos DTOs do backend)
// ============================================================================

export interface CreateEquipamentoApiData {
  nome: string;
  classificacao: 'UC' | 'UAR';
  planta_id?: string;
  proprietario_id?: string;
  equipamento_pai_id?: string;
  fabricante?: string;
  modelo?: string;
  numero_serie?: string;
  criticidade: '1' | '2' | '3' | '4' | '5';
  tipo_equipamento?: string;
  em_operacao?: 'sim' | 'nao';
  tipo_depreciacao?: 'linear' | 'uso';
  data_imobilizacao?: string;
  data_instalacao?: string;
  valor_imobilizado?: number;
  valor_depreciacao?: number;
  valor_contabil?: number;
  vida_util?: number;
  fornecedor?: string;
  centro_custo?: string;
  plano_manutencao?: string;
  localizacao?: string;
  localizacao_especifica?: string;
  observacoes?: string;
  mcpse?: boolean;
  tuc?: string;
  a1?: string;
  a2?: string;
  a3?: string;
  a4?: string;
  a5?: string;
  a6?: string;
  dados_tecnicos?: {
    campo: string;
    valor: string;
    tipo: string;
    unidade?: string;
  }[];
}

export interface UpdateEquipamentoApiData extends Partial<CreateEquipamentoApiData> {}

export interface EquipamentoApiResponse {
  id: string;
  nome: string;
  classificacao: 'UC' | 'UAR';
  planta_id?: string;
  proprietario_id?: string;
  equipamento_pai_id?: string;
  fabricante?: string;
  modelo?: string;
  numero_serie?: string;
  criticidade: '1' | '2' | '3' | '4' | '5';
  tipo_equipamento?: string;
  em_operacao?: string;
  tipo_depreciacao?: string;
  data_imobilizacao?: Date;
  data_instalacao?: Date;
  valor_imobilizado?: number;
  valor_depreciacao?: number;
  valor_contabil?: number;
  vida_util?: number;
  fornecedor?: string;
  centro_custo?: string;
  plano_manutencao?: string;
  localizacao?: string;
  localizacao_especifica?: string;
  observacoes?: string;
  mcpse?: boolean;
  tuc?: string;
  a1?: string;
  a2?: string;
  a3?: string;
  a4?: string;
  a5?: string;
  a6?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  
  // Relacionamentos
  planta?: {
    id: string;
    nome: string;
  };
  proprietario?: {
    id: string;
    nome: string;
    cpf_cnpj: string;
  };
  equipamento_pai?: {
    id: string;
    nome: string;
    classificacao: string;
    criticidade: string;
  };
  componentes_uar?: {
    id: string;
    nome: string;
    classificacao: string;
  }[];
  dados_tecnicos?: {
    id: string;
    campo: string;
    valor: string;
    tipo: string;
    unidade?: string;
  }[];
  totalComponentes?: number;
}

export interface EquipamentosQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  unidade_id?: string;
  planta_id?: string;
  classificacao?: 'UC' | 'UAR';
  criticidade?: '1' | '2' | '3' | '4' | '5';
  equipamento_pai_id?: string;
  orderBy?: 'nome' | 'criticidade' | 'created_at' | 'fabricante' | 'valor_contabil';
  orderDirection?: 'asc' | 'desc';
}

export interface EquipamentosListApiResponse {
  data: EquipamentoApiResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PlantaEquipamentosResponse extends EquipamentosListApiResponse {
  planta: {
    id: string;
    nome: string;
    localizacao: string;
  };
}

export interface EstatisticasPlantaResponse {
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

export interface ComponentesGerenciamentoResponse {
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
  componentes: EquipamentoApiResponse[];
}

// ============================================================================
// SERVIÇO DE API
// ============================================================================

export class EquipamentosApiService {
  private readonly baseEndpoint = '/equipamentos';

  // ============================================================================
  // CRUD BÁSICO
  // ============================================================================

  async create(data: CreateEquipamentoApiData): Promise<EquipamentoApiResponse> {
  // console.log('🚀 API SERVICE: create iniciado');
  // console.log('🚀 API SERVICE: Dados para enviar:', JSON.stringify(data, null, 2));
  
  try {
    const response = await api.post<EquipamentoApiResponse>(this.baseEndpoint, data);
    // console.log('✅ API SERVICE: Resposta recebida:', response.data);
    return response.data;
  } catch (error: any) {
    // console.log('💥 API SERVICE: Erro capturado:', error);
    // console.log('💥 API SERVICE: Mensagem específica da API:', error.response?.data?.message);
    // console.log('💥 API SERVICE: Data completo:', JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
}

  async findAll(params?: EquipamentosQueryParams): Promise<EquipamentosListApiResponse> {
    const response = await api.get<EquipamentosListApiResponse>(this.baseEndpoint, {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 10,
        ...params
      }
    });
    return response.data;
  }

  async findOne(id: string): Promise<EquipamentoApiResponse> {
    console.log('🌐 [API SERVICE] findOne chamado para ID:', id);
    const response = await api.get<{ success: boolean; data: EquipamentoApiResponse; meta?: any }>(`${this.baseEndpoint}/${id}`);
    console.log('🌐 [API SERVICE] Resposta completa (response):', response);
    console.log('🌐 [API SERVICE] response.data:', response.data);
    console.log('🌐 [API SERVICE] response.data.data (os dados reais):', response.data.data);

    // ✅ CORRIGIDO: A API retorna { success, data, meta }, precisamos retornar apenas o "data" interno
    const equipamento = response.data.data || response.data;
    console.log('✅ [API SERVICE] Equipamento extraído:', equipamento);
    console.log('✅ [API SERVICE] equipamento.id:', equipamento?.id);
    console.log('✅ [API SERVICE] equipamento.nome:', equipamento?.nome);
    console.log('✅ [API SERVICE] equipamento.tipo_equipamento:', equipamento?.tipo_equipamento);
    console.log('✅ [API SERVICE] equipamento.dados_tecnicos:', equipamento?.dados_tecnicos);

    return equipamento;
  }

  async update(id: string, data: UpdateEquipamentoApiData): Promise<EquipamentoApiResponse> {
    const response = await api.patch<EquipamentoApiResponse>(`${this.baseEndpoint}/${id}`, data);
    return response.data;
  }

  async remove(id: string): Promise<void> {
    await api.delete(`${this.baseEndpoint}/${id}`);
  }

  // ============================================================================
  // OPERAÇÕES ESPECÍFICAS PARA COMPONENTES
  // ============================================================================

  async findComponentesByEquipamento(equipamentoId: string): Promise<EquipamentoApiResponse[]> {
    const response = await api.get<EquipamentoApiResponse[]>(`${this.baseEndpoint}/${equipamentoId}/componentes`);
    return response.data;
  }

  async findEquipamentosUC(): Promise<{
    id: string;
    nome: string;
    fabricante?: string;
    modelo?: string;
    planta?: { id: string; nome: string };
  }[]> {
    const response = await api.get(`${this.baseEndpoint}/ucs-disponiveis`);
    return response.data;
  }

  async findUARDetalhes(uarId: string): Promise<EquipamentoApiResponse> {
    const response = await api.get<EquipamentoApiResponse>(`${this.baseEndpoint}/uar/${uarId}/detalhes`);
    return response.data;
  }

  async findComponentesParaGerenciar(ucId: string): Promise<ComponentesGerenciamentoResponse> {
    const response = await api.get<ComponentesGerenciamentoResponse>(`${this.baseEndpoint}/${ucId}/componentes/gerenciar`);
    return response.data;
  }

  async salvarComponentesUARLote(
    ucId: string, 
    componentes: Partial<CreateEquipamentoApiData & { id?: string }>[]
  ): Promise<{
    message: string;
    componentes: EquipamentoApiResponse[];
  }> {
    const response = await api.put(`${this.baseEndpoint}/${ucId}/componentes/batch`, {
      componentes
    });
    return response.data;
  }

  // ============================================================================
  // OPERAÇÕES POR PLANTA
  // ============================================================================

  async findByPlanta(plantaId: string, params?: EquipamentosQueryParams): Promise<PlantaEquipamentosResponse> {
    const response = await api.get<PlantaEquipamentosResponse>(
      `${this.baseEndpoint}/planta/${plantaId}/equipamentos`,
      { params }
    );
    return response.data;
  }

  async getEstatisticasPlanta(plantaId: string): Promise<EstatisticasPlantaResponse> {
    const response = await api.get<EstatisticasPlantaResponse>(
      `${this.baseEndpoint}/plantas/${plantaId}/estatisticas`
    );
    return response.data;
  }

  // ============================================================================
  // OPERAÇÕES POR UNIDADE
  // ============================================================================

  async findByUnidade(unidadeId: string, params?: EquipamentosQueryParams): Promise<EquipamentosListApiResponse> {
    const response = await api.get<EquipamentosListApiResponse>(
      `${this.baseEndpoint}/unidade/${unidadeId}/equipamentos`,
      { params }
    );
    return response.data;
  }
}

// Instância única do serviço
export const equipamentosApi = new EquipamentosApiService();