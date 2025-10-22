// src/services/diagramas.services.ts

import { api } from '@/config/api';

// ===== INTERFACES =====

export interface DiagramaEquipamento {
  id: string;
  equipamento_id: string;
  posicao_x: number;
  posicao_y: number;
  rotacao: number;
  largura_customizada?: number;
  altura_customizada?: number;
  equipamento?: {
    id: string;
    nome: string;
    tag?: string;
    tipo_equipamento?: string;
    status?: string;
    fabricante?: string;
    modelo?: string;
  };
}

export interface DiagramaConexao {
  id: string;
  equipamento_origem_id: string;
  porta_origem: 'top' | 'bottom' | 'left' | 'right';
  equipamento_destino_id: string;
  porta_destino: 'top' | 'bottom' | 'left' | 'right';
  tipo: string;
  cor?: string;
  espessura?: number;
}

export interface Diagrama {
  id: string;
  unidade_id: string;
  nome: string;
  versao: string;
  descricao?: string;
  ativo: boolean;
  thumbnail_url?: string;
  svg_data?: any;
  equipamentos: DiagramaEquipamento[];
  conexoes: DiagramaConexao[];
  created_at: string;
  updated_at: string;
}

export interface CreateDiagramaDto {
  unidadeId: string;
  nome: string;
  versao?: string;
  descricao?: string;
  ativo?: boolean;
  configuracoes?: any;
}

export interface UpdateDiagramaDto extends Partial<CreateDiagramaDto> {}

export interface AddEquipamentoToDiagramaDto {
  equipamentoId: string;
  posicao: {
    x: number;
    y: number;
  };
  rotacao?: number;
  dimensoes?: {
    largura: number;
    altura: number;
  };
  propriedades?: Record<string, any>;
}

export interface UpdateEquipamentoPosicaoDto {
  posicao?: {
    x: number;
    y: number;
  };
  rotacao?: number;
  dimensoes?: {
    largura: number;
    altura: number;
  };
  propriedades?: Record<string, any>;
}

export interface CreateConexaoDto {
  origem: {
    equipamentoId: string;
    porta: 'top' | 'bottom' | 'left' | 'right';
  };
  destino: {
    equipamentoId: string;
    porta: 'top' | 'bottom' | 'left' | 'right';
  };
  visual?: {
    tipoLinha?: 'solida' | 'tracejada' | 'pontilhada';
    cor?: string;
    espessura?: number;
  };
  pontosIntermediarios?: Array<{ x: number; y: number }>;
  rotulo?: string;
  ordem?: number;
}

// ===== SERVICE CLASS =====

class DiagramasServiceClass {
  /**
   * Get diagrama by ID
   */
  async getDiagrama(diagramaId: string): Promise<Diagrama> {
    try {
      console.log(`📡 [DiagramasService] GET /diagramas/${diagramaId}`);
      const response = await api.get(`/diagramas/${diagramaId}`);
      console.log('✅ [DiagramasService] Diagrama fetched:', response.data?.data?.nome || response.data?.nome);
      // Backend retorna { success, data, meta } ou diretamente os dados
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error fetching diagrama ${diagramaId}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar diagrama');
    }
  }

  /**
   * Get diagramas by unidade ID
   */
  async getDiagramasByUnidade(unidadeId: string): Promise<Diagrama[]> {
    try {
      console.log(`📡 [DiagramasService] GET /unidades/${unidadeId}/diagramas`);
      const response = await api.get(`/unidades/${unidadeId}/diagramas`);
      const diagramas = response.data?.data || response.data || [];
      console.log('✅ [DiagramasService] Fetched', diagramas.length, 'diagramas');
      return Array.isArray(diagramas) ? diagramas : [];
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error fetching diagramas for unidade ${unidadeId}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar diagramas');
    }
  }

  /**
   * Get active diagrama for unidade
   */
  async getActiveDiagrama(unidadeId: string): Promise<Diagrama | null> {
    try {
      console.log(`📡 [DiagramasService] GET /unidades/${unidadeId}/diagramas (ativo)`);
      const diagramas = await this.getDiagramasByUnidade(unidadeId);
      const ativo = diagramas.find(d => d.ativo === true);
      console.log('✅ [DiagramasService] Active diagrama:', ativo?.nome || 'none');
      return ativo || null;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error fetching active diagrama:`, error);
      return null;
    }
  }

  /**
   * Create new diagrama
   */
  async createDiagrama(dto: CreateDiagramaDto): Promise<Diagrama> {
    try {
      console.log('📡 [DiagramasService] POST /diagramas', dto);
      const response = await api.post('/diagramas', dto);
      console.log('✅ [DiagramasService] Diagrama created:', response.data?.data?.id);
      return response.data.data; // Backend retorna { success, data, meta }
    } catch (error: any) {
      console.error('❌ [DiagramasService] Error creating diagrama:', error);
      throw new Error(error.response?.data?.message || 'Erro ao criar diagrama');
    }
  }

  /**
   * Update diagrama
   */
  async updateDiagrama(diagramaId: string, dto: UpdateDiagramaDto): Promise<Diagrama> {
    try {
      console.log(`📡 [DiagramasService] PATCH /diagramas/${diagramaId}`, dto);
      const response = await api.patch(`/diagramas/${diagramaId}`, dto);
      console.log('✅ [DiagramasService] Diagrama updated:', response.data?.id);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error updating diagrama ${diagramaId}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao atualizar diagrama');
    }
  }

  /**
   * Delete diagrama
   */
  async deleteDiagrama(diagramaId: string): Promise<void> {
    try {
      console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}`);
      await api.delete(`/diagramas/${diagramaId}`);
      console.log('✅ [DiagramasService] Diagrama deleted:', diagramaId);
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error deleting diagrama ${diagramaId}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao excluir diagrama');
    }
  }

  /**
   * Add equipamento to diagrama
   */
  async addEquipamento(diagramaId: string, dto: AddEquipamentoToDiagramaDto): Promise<DiagramaEquipamento> {
    try {
      console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/equipamentos`, dto);
      const response = await api.post(`/diagramas/${diagramaId}/equipamentos`, dto);
      console.log('✅ [DiagramasService] Equipamento added to diagrama');
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error adding equipamento to diagrama:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao adicionar equipamento');
    }
  }

  /**
   * Update equipamento position in diagrama
   */
  async updateEquipamentoPosicao(
    diagramaId: string,
    equipamentoId: string,
    dto: UpdateEquipamentoPosicaoDto
  ): Promise<DiagramaEquipamento> {
    try {
      console.log(`📡 [DiagramasService] PATCH /diagramas/${diagramaId}/equipamentos/${equipamentoId}`, dto);
      const response = await api.patch(`/diagramas/${diagramaId}/equipamentos/${equipamentoId}`, dto);
      console.log('✅ [DiagramasService] Equipamento position updated');
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error updating equipamento position:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao atualizar posição');
    }
  }

  /**
   * Remove equipamento from diagrama
   */
  async removeEquipamento(diagramaId: string, equipamentoId: string): Promise<void> {
    try {
      console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}/equipamentos/${equipamentoId}`);
      await api.delete(`/diagramas/${diagramaId}/equipamentos/${equipamentoId}`);
      console.log('✅ [DiagramasService] Equipamento removed from diagrama');
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error removing equipamento:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao remover equipamento');
    }
  }

  /**
   * Create connection between equipamentos
   */
  async createConexao(diagramaId: string, dto: CreateConexaoDto): Promise<DiagramaConexao> {
    try {
      console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/conexoes`, dto);
      const response = await api.post(`/diagramas/${diagramaId}/conexoes`, dto);
      console.log('✅ [DiagramasService] Connection created');
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error creating connection:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao criar conexão');
    }
  }

  /**
   * Delete connection
   */
  async deleteConexao(diagramaId: string, conexaoId: string): Promise<void> {
    try {
      console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}/conexoes/${conexaoId}`);
      await api.delete(`/diagramas/${diagramaId}/conexoes/${conexaoId}`);
      console.log('✅ [DiagramasService] Connection deleted');
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error deleting connection:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao excluir conexão');
    }
  }

  /**
   * Activate diagrama (set as active for unidade)
   */
  async activateDiagrama(diagramaId: string): Promise<Diagrama> {
    try {
      console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/ativar`);
      const response = await api.post(`/diagramas/${diagramaId}/ativar`);
      console.log('✅ [DiagramasService] Diagrama activated');
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error activating diagrama:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao ativar diagrama');
    }
  }

  /**
   * Add multiple equipamentos to diagrama at once
   */
  async addEquipamentosBulk(diagramaId: string, equipamentos: AddEquipamentoToDiagramaDto[]): Promise<any> {
    try {
      console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/equipamentos/bulk`);
      console.log(`   📦 Adding ${equipamentos.length} equipamentos`);
      const response = await api.post(`/diagramas/${diagramaId}/equipamentos/bulk`, {
        equipamentos,
      });
      console.log('✅ [DiagramasService] Bulk equipamentos added:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error adding bulk equipamentos:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao adicionar equipamentos em lote');
    }
  }

  /**
   * Create multiple conexões at once
   */
  async createConexoesBulk(diagramaId: string, conexoes: CreateConexaoDto[]): Promise<any> {
    try {
      console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/conexoes/bulk`);
      console.log(`   🔗 Creating ${conexoes.length} conexões`);
      const response = await api.post(`/diagramas/${diagramaId}/conexoes/bulk`, {
        conexoes,
      });
      console.log('✅ [DiagramasService] Bulk conexões created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error creating bulk conexões:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao criar conexões em lote');
    }
  }

  /**
   * Remove all connections from a diagrama
   */
  async removeAllConnections(diagramaId: string): Promise<any> {
    try {
      console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}/conexoes`);
      const response = await api.delete(`/diagramas/${diagramaId}/conexoes`);
      console.log('✅ [DiagramasService] All connections removed:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error removing all connections:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao remover todas as conexões');
    }
  }
}

// ===== EXPORT SINGLETON =====

export const DiagramasService = new DiagramasServiceClass();
