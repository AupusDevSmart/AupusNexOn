// src/services/concessionarias.services.ts

import { api } from '@/config/api';
import type { ApiResponse } from '@/types/base';

// ✅ INTERFACES

export interface TarifasA4Verde {
  tusd_d?: number;
  tusd_p?: number;
  tusd_fp?: number;
  te_d?: number;
  te_p?: number;
  te_fp?: number;
}

export interface TarifasA3aVerde {
  tusd_d?: number;
  tusd_p?: number;
  tusd_fp?: number;
  te_d?: number;
  te_p?: number;
  te_fp?: number;
}

export interface TarifasB {
  tusd_valor?: number;
  te_valor?: number;
}

export interface AnexoConcessionaria {
  id: string;
  concessionaria_id: string;
  nome_original: string;
  nome_arquivo: string;
  caminho: string;
  mime_type: string;
  tamanho: number;
  descricao?: string;
  created_at: string;
}

export interface ConcessionariaResponse {
  id: string;
  nome: string;
  estado: string;
  data_inicio: string;
  data_validade: string;
  a4_verde: TarifasA4Verde;
  a3a_verde: TarifasA3aVerde;
  b: TarifasB;
  anexos: AnexoConcessionaria[];
  created_at: string;
  updated_at: string;
}

export interface FindAllConcessionariasParams {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface CreateConcessionariaDto {
  nome: string;
  estado: string;
  data_inicio: string;
  data_validade: string;
  a4_verde?: TarifasA4Verde;
  a3a_verde?: TarifasA3aVerde;
  b?: TarifasB;
}

export interface UpdateConcessionariaDto extends Partial<CreateConcessionariaDto> {}

// ✅ SERVICE CLASS

class ConcessionariasServiceClass {
  /**
   * Get all concessionarias with pagination and filters
   */
  async getAllConcessionarias(params: FindAllConcessionariasParams = {}): Promise<ApiResponse<ConcessionariaResponse>> {
    try {
      const queryParams = new URLSearchParams();

      if (params.search) queryParams.append('search', params.search);
      if (params.estado) queryParams.append('estado', params.estado);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.orderBy) queryParams.append('orderBy', params.orderBy);
      if (params.orderDirection) queryParams.append('orderDirection', params.orderDirection);

      const response = await api.get(`/concessionarias?${queryParams.toString()}`);

      // Normalize response
      const responseData = response.data?.data || response.data;
      const data = responseData?.data || responseData || [];
      const pagination = responseData?.pagination || response.data?.pagination || {
        page: params.page || 1,
        limit: params.limit || 10,
        total: Array.isArray(data) ? data.length : 0,
        pages: Math.ceil((Array.isArray(data) ? data.length : 0) / (params.limit || 10)),
      };

      return {
        data: Array.isArray(data) ? data : [],
        pagination,
      };
    } catch (error: any) {
      console.error('❌ [ConcessionariasService] Error fetching concessionarias:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar concessionárias');
    }
  }

  /**
   * Get concessionaria by ID
   */
  async getConcessionaria(id: string): Promise<ConcessionariaResponse> {
    try {
      console.log(`📡 [ConcessionariasService] GET /concessionarias/${id}`);
      const response = await api.get<{ success: boolean; data: ConcessionariaResponse; meta?: any }>(`/concessionarias/${id}`);

      const concessionaria = response.data.data || response.data;
      console.log('✅ [ConcessionariasService] Concessionaria fetched:', concessionaria?.nome);

      return concessionaria;
    } catch (error: any) {
      console.error(`❌ [ConcessionariasService] Error fetching concessionaria ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar concessionária');
    }
  }

  /**
   * Create new concessionaria
   */
  async createConcessionaria(dto: CreateConcessionariaDto): Promise<ConcessionariaResponse> {
    try {
      console.log('📡 [ConcessionariasService] POST /concessionarias', dto);
      const response = await api.post<{ success: boolean; data: ConcessionariaResponse; meta?: any }>('/concessionarias', dto);

      const concessionaria = response.data.data || response.data;
      console.log('✅ [ConcessionariasService] Concessionaria created:', concessionaria?.id);

      return concessionaria;
    } catch (error: any) {
      console.error('❌ [ConcessionariasService] Error creating concessionaria:', error);
      throw new Error(error.response?.data?.message || 'Erro ao criar concessionária');
    }
  }

  /**
   * Update concessionaria
   */
  async updateConcessionaria(id: string, dto: UpdateConcessionariaDto): Promise<ConcessionariaResponse> {
    try {
      console.log(`📡 [ConcessionariasService] PATCH /concessionarias/${id}`, dto);
      const response = await api.patch<{ success: boolean; data: ConcessionariaResponse; meta?: any }>(`/concessionarias/${id}`, dto);

      const concessionaria = response.data.data || response.data;
      console.log('✅ [ConcessionariasService] Concessionaria updated:', concessionaria?.id);

      return concessionaria;
    } catch (error: any) {
      console.error(`❌ [ConcessionariasService] Error updating concessionaria ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao atualizar concessionária');
    }
  }

  /**
   * Delete concessionaria
   */
  async deleteConcessionaria(id: string): Promise<void> {
    try {
      console.log(`📡 [ConcessionariasService] DELETE /concessionarias/${id}`);
      await api.delete(`/concessionarias/${id}`);
      console.log('✅ [ConcessionariasService] Concessionaria deleted:', id);
    } catch (error: any) {
      console.error(`❌ [ConcessionariasService] Error deleting concessionaria ${id}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao excluir concessionária');
    }
  }

  /**
   * Upload anexo para concessionaria
   */
  async uploadAnexo(concessionariaId: string, file: File, descricao?: string): Promise<AnexoConcessionaria> {
    try {
      console.log(`📡 [ConcessionariasService] POST /concessionarias/${concessionariaId}/anexos`);

      const formData = new FormData();
      formData.append('file', file);
      if (descricao) {
        formData.append('descricao', descricao);
      }

      const response = await api.post<{ success: boolean; data: AnexoConcessionaria }>(
        `/concessionarias/${concessionariaId}/anexos`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const anexo = response.data.data || response.data;
      console.log('✅ [ConcessionariasService] Anexo uploaded:', anexo?.id);

      return anexo;
    } catch (error: any) {
      console.error(`❌ [ConcessionariasService] Error uploading anexo:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao fazer upload do anexo');
    }
  }

  /**
   * Get anexos de uma concessionaria
   */
  async getAnexos(concessionariaId: string): Promise<AnexoConcessionaria[]> {
    try {
      console.log(`📡 [ConcessionariasService] GET /concessionarias/${concessionariaId}/anexos`);
      const response = await api.get<{ success: boolean; data: AnexoConcessionaria[] }>(
        `/concessionarias/${concessionariaId}/anexos`
      );

      const anexos = response.data.data || response.data || [];
      console.log('✅ [ConcessionariasService] Anexos fetched:', anexos.length);

      return Array.isArray(anexos) ? anexos : [];
    } catch (error: any) {
      console.error(`❌ [ConcessionariasService] Error fetching anexos:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar anexos');
    }
  }

  /**
   * Download anexo
   */
  async downloadAnexo(anexoId: string): Promise<Blob> {
    try {
      console.log(`📡 [ConcessionariasService] GET /concessionarias/anexos/${anexoId}/download`);
      const response = await api.get(`/concessionarias/anexos/${anexoId}/download`, {
        responseType: 'blob',
      });

      return response.data;
    } catch (error: any) {
      console.error(`❌ [ConcessionariasService] Error downloading anexo:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao baixar anexo');
    }
  }

  /**
   * Delete anexo
   */
  async deleteAnexo(anexoId: string): Promise<void> {
    try {
      console.log(`📡 [ConcessionariasService] DELETE /concessionarias/anexos/${anexoId}`);
      await api.delete(`/concessionarias/anexos/${anexoId}`);
      console.log('✅ [ConcessionariasService] Anexo deleted:', anexoId);
    } catch (error: any) {
      console.error(`❌ [ConcessionariasService] Error deleting anexo:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao excluir anexo');
    }
  }

  /**
   * Get list of estados (UFs)
   */
  getEstados(): Array<{ value: string; label: string }> {
    return [
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
  }
}

// ✅ EXPORT SINGLETON INSTANCE

export const ConcessionariasService = new ConcessionariasServiceClass();
