// src/services/equipamentos.services.ts

import { api } from '@/config/api';
import type { ApiResponse } from '@/types/base';

// ===== INTERFACES =====

export interface TipoEquipamento {
  id: string;
  codigo: string;
  nome: string;
  categoria: 'GERACAO' | 'DISTRIBUICAO' | 'PROTECAO' | 'MEDICAO' | 'CONTROLE';
  larguraPadrao: number;
  alturaPadrao: number;
  iconeSvg?: string;
  propriedadesSchema?: any;
  createdAt: string;
}

export interface Equipamento {
  id: string;
  nome: string;
  tag?: string;
  classificacao: 'UC' | 'UAR';
  unidade_id?: string;
  planta_id?: string;
  equipamento_pai_id?: string;
  tipo_equipamento_id?: string;
  status?: 'NORMAL' | 'ALARME' | 'FALHA' | 'MANUTENCAO';
  fabricante?: string;
  modelo?: string;
  numero_serie?: string;
  criticidade?: string;
  localizacao?: string;
  posicao_x?: number;
  posicao_y?: number;
  rotacao?: number;
  largura_customizada?: number;
  altura_customizada?: number;
  propriedades?: any;
  mqtt_habilitado?: boolean;
  topico_mqtt?: string;
  noDiagrama?: boolean;
  diagramaId?: string | null;
  tipoEquipamento?: TipoEquipamento;
  unidade?: {
    id: string;
    nome: string;
    planta?: {
      id: string;
      nome: string;
    };
  };
  totalComponentes?: number;
  created_at: string;
  updated_at: string;
}

export interface EquipamentoFilters {
  search?: string;
  unidade_id?: string;
  classificacao?: 'UC' | 'UAR';
  criticidade?: string;
  equipamento_pai_id?: string;
  semDiagrama?: boolean;
  tipo?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface CreateEquipamentoDto {
  nome: string;
  tag?: string;
  classificacao: 'UC' | 'UAR';
  unidade_id?: string;
  planta_id?: string;
  equipamento_pai_id?: string;
  tipo_equipamento_id?: string;
  status?: string;
  fabricante?: string;
  modelo?: string;
  numero_serie?: string;
  criticidade?: string;
  localizacao?: string;
  propriedades?: any;
}

export interface UpdateEquipamentoDto extends Partial<CreateEquipamentoDto> {}

export interface ConfigurarMqttDto {
  topico_mqtt: string;
  mqtt_habilitado: boolean;
}

// ===== SERVICE CLASS =====

class EquipamentosServiceClass {
  /**
   * Get all equipamentos with filters
   */
  async getAllEquipamentos(filters: EquipamentoFilters = {}): Promise<ApiResponse<Equipamento>> {
    try {
      const params = new URLSearchParams();

      if (filters.search) params.append('search', filters.search);
      if (filters.unidade_id) params.append('unidade_id', filters.unidade_id);
      if (filters.classificacao) params.append('classificacao', filters.classificacao);
      if (filters.criticidade) params.append('criticidade', filters.criticidade);
      if (filters.equipamento_pai_id) params.append('equipamento_pai_id', filters.equipamento_pai_id);
      if (filters.semDiagrama !== undefined) params.append('semDiagrama', String(filters.semDiagrama));
      if (filters.tipo) params.append('tipo', filters.tipo);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.orderBy) params.append('orderBy', filters.orderBy);
      if (filters.orderDirection) params.append('orderDirection', filters.orderDirection);

      console.log('📡 [EquipamentosService] GET /equipamentos with params:', params.toString());

      const response = await api.get(`/equipamentos?${params.toString()}`);

      // Normalize response
      const data = response.data?.data || response.data || [];
      const pagination = response.data?.pagination || {
        page: filters.page || 1,
        limit: filters.limit || 10,
        total: Array.isArray(data) ? data.length : 0,
        totalPages: Math.ceil((Array.isArray(data) ? data.length : 0) / (filters.limit || 10)),
      };

      console.log('✅ [EquipamentosService] Fetched', data.length, 'equipamentos');

      return {
        data: Array.isArray(data) ? data : [],
        pagination,
        meta: response.data?.meta,
      };
    } catch (error: any) {
      console.error('❌ [EquipamentosService] Error fetching equipamentos:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar equipamentos');
    }
  }

  /**
   * Get equipamentos by unidade ID
   */
  async getEquipamentosByUnidade(unidadeId: string, filters: Omit<EquipamentoFilters, 'unidade_id'> = {}): Promise<ApiResponse<Equipamento>> {
    try {
      console.log(`📡 [EquipamentosService] GET /unidades/${unidadeId}/equipamentos`);
      console.log(`   📋 Filters:`, filters);

      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.classificacao) params.append('classificacao', filters.classificacao);
      if (filters.semDiagrama !== undefined) params.append('semDiagrama', String(filters.semDiagrama));
      if (filters.tipo) params.append('tipo', filters.tipo);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      console.log(`   🔗 URL: /unidades/${unidadeId}/equipamentos?${params.toString()}`);

      const response = await api.get(`/unidades/${unidadeId}/equipamentos?${params.toString()}`);

      console.log(`   📦 Response structure:`, {
        hasData: !!response.data,
        hasDataData: !!response.data?.data,
        hasPagination: !!response.data?.pagination,
        hasMeta: !!response.data?.meta,
      });

      const data = response.data?.data?.data || response.data?.data || response.data || [];
      const pagination = response.data?.data?.pagination || response.data?.pagination || {
        page: filters.page || 1,
        limit: filters.limit || 10,
        total: Array.isArray(data) ? data.length : 0,
        totalPages: Math.ceil((Array.isArray(data) ? data.length : 0) / (filters.limit || 10)),
      };

      console.log('✅ [EquipamentosService] Fetched', data.length, 'equipamentos for unidade');
      console.log('   📊 Pagination:', pagination);

      // Log detalhado dos equipamentos UC
      const equipamentosUC = data.filter((e: Equipamento) => e.classificacao === 'UC');
      console.log('   🔧 Equipamentos UC:', equipamentosUC.length);
      equipamentosUC.forEach((eq: Equipamento, idx: number) => {
        console.log(`      [${idx + 1}] ${eq.nome}`);
        console.log(`          - Tipo: ${eq.tipoEquipamento?.codigo || 'SEM TIPO'}`);
        console.log(`          - ID: ${eq.id}`);
      });

      return {
        data: Array.isArray(data) ? data : [],
        pagination,
        meta: response.data?.data?.meta || response.data?.meta,
      };
    } catch (error: any) {
      console.error(`❌ [EquipamentosService] Error fetching equipamentos for unidade ${unidadeId}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar equipamentos');
    }
  }

  /**
   * Get equipamento by ID
   */
  async getEquipamento(id: string): Promise<Equipamento> {
    try {
      console.log(`📡 [EquipamentosService] GET /equipamentos/${id}`);
      const response = await api.get(`/equipamentos/${id}`);
      console.log('✅ [EquipamentosService] Equipamento fetched:', response.data?.nome);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [EquipamentosService] Error fetching equipamento ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar equipamento');
    }
  }

  /**
   * Create new equipamento
   */
  async createEquipamento(dto: CreateEquipamentoDto): Promise<Equipamento> {
    try {
      console.log('📡 [EquipamentosService] POST /equipamentos', dto);
      const response = await api.post('/equipamentos', dto);
      console.log('✅ [EquipamentosService] Equipamento created:', response.data?.id);
      return response.data;
    } catch (error: any) {
      console.error('❌ [EquipamentosService] Error creating equipamento:', error);
      throw new Error(error.response?.data?.message || 'Erro ao criar equipamento');
    }
  }

  /**
   * Update equipamento
   */
  async updateEquipamento(id: string, dto: UpdateEquipamentoDto): Promise<Equipamento> {
    try {
      console.log(`📡 [EquipamentosService] PATCH /equipamentos/${id}`, dto);
      const response = await api.patch(`/equipamentos/${id}`, dto);
      console.log('✅ [EquipamentosService] Equipamento updated:', response.data?.id);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [EquipamentosService] Error updating equipamento ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao atualizar equipamento');
    }
  }

  /**
   * Delete equipamento
   */
  async deleteEquipamento(id: string): Promise<void> {
    try {
      console.log(`📡 [EquipamentosService] DELETE /equipamentos/${id}`);
      await api.delete(`/equipamentos/${id}`);
      console.log('✅ [EquipamentosService] Equipamento deleted:', id);
    } catch (error: any) {
      console.error(`❌ [EquipamentosService] Error deleting equipamento ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao excluir equipamento');
    }
  }

  /**
   * Configure MQTT for equipamento
   */
  async configurarMqtt(id: string, dto: ConfigurarMqttDto): Promise<Equipamento> {
    try {
      console.log(`📡 [EquipamentosService] POST /equipamentos/${id}/mqtt`, dto);
      const response = await api.post(`/equipamentos/${id}/mqtt`, dto);
      console.log('✅ [EquipamentosService] MQTT configured for equipamento');
      return response.data;
    } catch (error: any) {
      console.error(`❌ [EquipamentosService] Error configuring MQTT:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao configurar MQTT');
    }
  }

  /**
   * Create visual component (BARRAMENTO or PONTO) for diagrams
   */
  async criarComponenteVisual(unidadeId: string, tipo: 'BARRAMENTO' | 'PONTO', nome?: string): Promise<{ id: string; nome: string; tipo_equipamento: string }> {
    try {
      console.log(`📡 [EquipamentosService] POST /equipamentos/virtual/${unidadeId}/${tipo}`, { nome });
      const response = await api.post(`/equipamentos/virtual/${unidadeId}/${tipo}`, { nome });
      console.log('✅ [EquipamentosService] Componente visual criado:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [EquipamentosService] Error creating componente visual:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao criar componente visual');
    }
  }

  /**
   * Get tipos de equipamentos
   */
  async getTiposEquipamentos(categoria?: string, search?: string): Promise<TipoEquipamento[]> {
    try {
      const params = new URLSearchParams();
      if (categoria) params.append('categoria', categoria);
      if (search) params.append('search', search);

      console.log('📡 [EquipamentosService] GET /tipos-equipamentos');
      const response = await api.get(`/tipos-equipamentos?${params.toString()}`);

      const data = response.data?.data || response.data || [];
      console.log('✅ [EquipamentosService] Fetched', data.length, 'tipos de equipamentos');

      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error('❌ [EquipamentosService] Error fetching tipos de equipamentos:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar tipos de equipamentos');
    }
  }
}

// ===== EXPORT SINGLETON =====

export const EquipamentosService = new EquipamentosServiceClass();
