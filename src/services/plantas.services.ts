// src/services/plantas.services.ts

import { api } from '@/config/api';
import type { ApiResponse } from '@/types/base';

// ✅ INTERFACES

export interface Endereco {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface ProprietarioBasico {
  id: string;
  nome: string;
  cpf_cnpj: string;
  tipo: 'pessoa_fisica' | 'pessoa_juridica';
}

export interface PlantaResponse {
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

export interface FindAllPlantasParams {
  page?: number;
  limit?: number;
  search?: string;
  proprietarioId?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface CreatePlantaDto {
  nome: string;
  cnpj: string;
  localizacao: string;
  horario_funcionamento: string;
  proprietario_id: string;
  endereco: {
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
}

export interface UpdatePlantaDto extends Partial<CreatePlantaDto> {}

// ✅ SERVICE CLASS

class PlantasServiceClass {
  /**
   * Get all plantas with pagination and filters
   */
  async getAllPlantas(params: FindAllPlantasParams = {}): Promise<ApiResponse<PlantaResponse>> {
    try {
      const queryParams = new URLSearchParams();

      if (params.search) queryParams.append('search', params.search);
      if (params.proprietarioId && params.proprietarioId !== 'all') {
        queryParams.append('proprietarioId', params.proprietarioId);
      }
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.orderBy) queryParams.append('orderBy', params.orderBy);
      if (params.orderDirection) queryParams.append('orderDirection', params.orderDirection);

      const response = await api.get(`/plantas?${queryParams.toString()}`);

      // Normalize response - handle nested data structure from backend
      // Backend returns: { success: true, data: { data: [...plantas], pagination: {...} } }
      const responseData = response.data?.data || response.data;
      const data = responseData?.data || responseData || [];
      const pagination = responseData?.pagination || response.data?.pagination || {
        page: params.page || 1,
        limit: params.limit || 10,
        total: Array.isArray(data) ? data.length : 0,
        totalPages: Math.ceil((Array.isArray(data) ? data.length : 0) / (params.limit || 10)),
      };

      return {
        data: Array.isArray(data) ? data : [],
        pagination,
      };
    } catch (error: any) {
      console.error('❌ [PlantasService] Error fetching plantas:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar plantas');
    }
  }

  /**
   * Get planta by ID
   */
  async getPlanta(id: string): Promise<PlantaResponse> {
    try {
      console.log(`📡 [PlantasService] GET /plantas/${id}`);
      const response = await api.get<{ success: boolean; data: PlantaResponse; meta?: any }>(`/plantas/${id}`);

      // ✅ CORRIGIDO: A API retorna { success, data, meta }, extrair apenas o "data"
      const planta = response.data.data || response.data;
      console.log('✅ [PlantasService] Planta fetched:', planta?.nome);

      return planta;
    } catch (error: any) {
      console.error(`❌ [PlantasService] Error fetching planta ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar planta');
    }
  }

  /**
   * Create new planta
   */
  async createPlanta(dto: CreatePlantaDto): Promise<PlantaResponse> {
    try {
      console.log('📡 [PlantasService] POST /plantas', dto);
      const response = await api.post<{ success: boolean; data: PlantaResponse; meta?: any }>('/plantas', dto);

      // ✅ CORRIGIDO: Extrair dados do caminho correto
      const planta = response.data.data || response.data;
      console.log('✅ [PlantasService] Planta created:', planta?.id);

      return planta;
    } catch (error: any) {
      console.error('❌ [PlantasService] Error creating planta:', error);
      throw new Error(error.response?.data?.message || 'Erro ao criar planta');
    }
  }

  /**
   * Update planta
   */
  async updatePlanta(id: string, dto: UpdatePlantaDto): Promise<PlantaResponse> {
    try {
      console.log(`📡 [PlantasService] PATCH /plantas/${id}`, dto);
      const response = await api.patch<{ success: boolean; data: PlantaResponse; meta?: any }>(`/plantas/${id}`, dto);

      // ✅ CORRIGIDO: Extrair dados do caminho correto
      const planta = response.data.data || response.data;
      console.log('✅ [PlantasService] Planta updated:', planta?.id);

      return planta;
    } catch (error: any) {
      console.error(`❌ [PlantasService] Error updating planta ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao atualizar planta');
    }
  }

  /**
   * Delete planta
   */
  async deletePlanta(id: string): Promise<void> {
    try {
      console.log(`📡 [PlantasService] DELETE /plantas/${id}`);
      await api.delete(`/plantas/${id}`);
      console.log('✅ [PlantasService] Planta deleted:', id);
    } catch (error: any) {
      console.error(`❌ [PlantasService] Error deleting planta ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao excluir planta');
    }
  }

  /**
   * Get proprietarios (usuarios with roles: admin, gerente, or proprietário)
   */
  async getProprietarios(): Promise<ProprietarioBasico[]> {
    try {
      console.log('📡 [PlantasService] GET /usuarios (proprietarios) - buscando TODOS os usuarios');

      // Buscar TODOS os usuários com roles válidas (não apenas os que têm plantas)
      const response = await api.get('/usuarios', {
        params: {
          roles: ['admin', 'gerente', 'proprietario'].join(','),
          limit: 1000 // Get all proprietarios
        }
      });

      // A API retorna { success: true, data: { data: [...usuarios], pagination: {} } }
      const usuariosData = response.data.data || response.data;
      const usuarios = usuariosData.data || usuariosData || [];

      console.log('🔍 [PlantasService] Response structure:', {
        hasData: !!response.data,
        hasDataData: !!response.data?.data,
        hasDataDataData: !!response.data?.data?.data,
        usuariosLength: Array.isArray(usuarios) ? usuarios.length : 0
      });

      // Transform to ProprietarioBasico format
      const proprietarios: ProprietarioBasico[] = usuarios.map((user: any) => ({
        id: user.id,
        nome: user.nome || user.name || 'Nome não informado',
        cpf_cnpj: user.cpf_cnpj || user.cpf || user.cnpj || 'Não informado',
        tipo: user.tipo || (user.cpf ? 'pessoa_fisica' : 'pessoa_juridica')
      }));

      console.log('✅ [PlantasService] Proprietarios fetched from /usuarios:', proprietarios.length);
      return proprietarios;
    } catch (error: any) {
      console.error('❌ [PlantasService] Error fetching proprietarios:', error);

      // Return empty array instead of throwing to prevent blocking the UI
      console.warn('⚠️ [PlantasService] Returning empty proprietarios list');
      return [];
    }
  }
}

// ✅ EXPORT SINGLETON INSTANCE

export const PlantasService = new PlantasServiceClass();
