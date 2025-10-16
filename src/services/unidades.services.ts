// src/services/unidades.services.ts

import { api } from '@/config/api';
import type { ApiResponse } from '@/types/base';

export interface Unidade {
  id: string;
  plantaId: string;
  nome: string;
  tipo: string;
  potencia: number;
  status: string;
  estado: string;
  cidade: string;
  latitude: number;
  longitude: number;
  pontosMedicao?: string[];
  planta?: {
    id: string;
    nome: string;
    localizacao?: string;
  };
  createdAt: string;
  updatedAt: string;
  // Optional fields
  descricao?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
}

export interface UnidadeFilters {
  search?: string;
  plantaId?: string;
  tipo?: string;
  status?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface CreateUnidadeDto {
  planta_id: string;
  nome: string;
  tipo: string;
  potencia: number;
  status: string;
  estado: string;
  cidade: string;
  latitude: number;
  longitude: number;
  pontos_medicao?: string[];
  descricao?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
}

export interface UpdateUnidadeDto extends Partial<CreateUnidadeDto> {}

/**
 * Get all unidades with filters
 */
export async function getAllUnidades(filters: UnidadeFilters): Promise<ApiResponse<Unidade>> {
  try {
    const params = new URLSearchParams();

    if (filters.search) params.append('search', filters.search);
    if (filters.plantaId) params.append('plantaId', filters.plantaId);
    if (filters.tipo) params.append('tipo', filters.tipo);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.orderBy) params.append('orderBy', filters.orderBy);
    if (filters.orderDirection) params.append('orderDirection', filters.orderDirection);

    console.log('📡 [UnidadesService] GET /unidades with params:', params.toString());

    const response = await api.get(`/unidades?${params.toString()}`);

    // Normalize response
    const data = response.data?.data || response.data || [];
    const pagination = response.data?.pagination || {
      page: filters.page || 1,
      limit: filters.limit || 10,
      total: Array.isArray(data) ? data.length : 0,
      totalPages: Math.ceil((Array.isArray(data) ? data.length : 0) / (filters.limit || 10)),
    };

    return {
      data: Array.isArray(data) ? data : [],
      pagination,
    };
  } catch (error: any) {
    console.error('❌ [UnidadesService] Error fetching unidades:', error);
    throw new Error(error.response?.data?.message || 'Erro ao buscar unidades');
  }
}

/**
 * Get unidade by ID
 */
export async function getUnidadeById(id: string): Promise<Unidade> {
  try {
    console.log(`📡 [UnidadesService] GET /unidades/${id}`);
    const response = await api.get(`/unidades/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`❌ [UnidadesService] Error fetching unidade ${id}:`, error);
    throw new Error(error.response?.data?.message || 'Erro ao buscar unidade');
  }
}

/**
 * Create new unidade
 */
export async function createUnidade(dto: CreateUnidadeDto): Promise<Unidade> {
  try {
    console.log('📡 [UnidadesService] POST /unidades', dto);
    const response = await api.post('/unidades', dto);
    return response.data;
  } catch (error: any) {
    console.error('❌ [UnidadesService] Error creating unidade:', error);
    throw new Error(error.response?.data?.message || 'Erro ao criar unidade');
  }
}

/**
 * Update unidade
 */
export async function updateUnidade(id: string, dto: UpdateUnidadeDto): Promise<Unidade> {
  try {
    console.log(`📡 [UnidadesService] PATCH /unidades/${id}`, dto);
    const response = await api.patch(`/unidades/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error(`❌ [UnidadesService] Error updating unidade ${id}:`, error);
    throw new Error(error.response?.data?.message || 'Erro ao atualizar unidade');
  }
}

/**
 * Delete unidade
 */
export async function deleteUnidade(id: string): Promise<void> {
  try {
    console.log(`📡 [UnidadesService] DELETE /unidades/${id}`);
    await api.delete(`/unidades/${id}`);
  } catch (error: any) {
    console.error(`❌ [UnidadesService] Error deleting unidade ${id}:`, error);
    throw new Error(error.response?.data?.message || 'Erro ao excluir unidade');
  }
}
