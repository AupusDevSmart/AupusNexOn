// src/services/diagramas.services.ts

import { api } from '@/config/api';

// Desabilitar logs de debug em produção
const noop = () => {};
if (import.meta.env.PROD) {
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}


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
  unidadeId?: string;
  /** @deprecated usar unidadeId (compatibilidade com chamadas legadas que usam snake_case) */
  unidade_id?: string;
  nome: string;
  versao?: string;
  descricao?: string;
  ativo?: boolean;
  configuracoes?: any;
  svg_data?: any;
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
      // console.log(`📡 [DiagramasService] GET /diagramas/${diagramaId}`);
      const response = await api.get(`/diagramas/${diagramaId}`);
      const diagrama = response.data;
      // console.log('✅ [DiagramasService] Diagrama fetched:', {
      //   id: diagrama.id,
      //   nome: diagrama.nome,
      //   equipamentos: diagrama.equipamentos?.length || 0,
      //   conexoes: diagrama.conexoes?.length || 0,
      // });
      // Backend retorna { success, data, meta } ou diretamente os dados
      return diagrama;
    } catch (error: any) {
      // ⚡ Suprimir log de erro 404 (fallback inteligente no useDiagramStore vai lidar com isso)
      if (error.response?.status !== 404) {
        console.error(`❌ [DiagramasService] Error fetching diagrama ${diagramaId}:`, error);
      }
      // Preservar o erro original do Axios para detecção de 404
      if (error.response) {
        throw error; // Throw original Axios error
      }
      throw new Error(error.message || 'Erro ao buscar diagrama');
    }
  }

  /**
   * Get diagramas by unidade ID
   */
  async getDiagramasByUnidade(unidadeId: string): Promise<Diagrama[]> {
    try {
      // console.log(`📡 [DiagramasService] GET /diagramas/by-unidade/${unidadeId}`);
      const response = await api.get(`/diagramas/by-unidade/${unidadeId}`);
      const diagramas = response.data || [];
      // console.log('✅ [DiagramasService] Fetched', diagramas.length, 'diagramas');
      // if (diagramas.length > 0) {
      //   console.log('📊 [DiagramasService] Primeiro diagrama:', {
      //     id: diagramas[0].id,
      //     nome: diagramas[0].nome,
      //     equipamentos: diagramas[0].equipamentos?.length || 0,
      //     conexoes: diagramas[0].conexoes?.length || 0,
      //   });
      // }
      return Array.isArray(diagramas) ? diagramas : [];
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error fetching diagramas for unidade ${unidadeId}:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar diagramas');
    }
  }

  /**
   * Get active diagrama for unidade
   * IMPORTANTE: Este método busca primeiro a lista de diagramas (sem equipamentos),
   * depois busca o diagrama completo com equipamentos e conexões
   *
   * @returns Diagrama completo ou null se não houver diagrama ativo
   * @throws Error se houver erro na comunicação com o backend (não retorna null para erros)
   */
  async getActiveDiagrama(unidadeId: string): Promise<Diagrama | null> {
    // console.log(`📡 [DiagramasService] GET /diagramas/by-unidade/${unidadeId} (buscando ativo)`);

    // Buscar lista de diagramas (pode lançar erro de rede)
    const diagramas = await this.getDiagramasByUnidade(unidadeId);
    const ativo = diagramas.find(d => d.ativo === true);

    if (!ativo) {
      // console.log('⚠️ [DiagramasService] Nenhum diagrama ativo encontrado');
      return null; // Apenas retorna null se não houver diagrama ativo (não é um erro)
    }

    // console.log(`✅ [DiagramasService] Diagrama ativo encontrado: ${ativo.nome} (${ativo.id})`);
    // console.log(`🔄 [DiagramasService] Buscando diagrama completo com equipamentos...`);

    // Buscar o diagrama completo com equipamentos e conexões (pode lançar erro de rede)
    const diagramaCompleto = await this.getDiagrama(ativo.id);

    // console.log(`✅ [DiagramasService] Diagrama completo carregado:`, {
    //   id: diagramaCompleto.id,
    //   nome: diagramaCompleto.nome,
    //   equipamentos: diagramaCompleto.equipamentos?.length || 0,
    //   conexoes: diagramaCompleto.conexoes?.length || 0,
    // });

    return diagramaCompleto;
  }

  /**
   * Create new diagrama
   */
  async createDiagrama(dto: CreateDiagramaDto): Promise<Diagrama> {
    try {
      // console.log('📡 [DiagramasService] POST /diagramas', dto);
      const response = await api.post('/diagramas', dto);
      // console.log('✅ [DiagramasService] Diagrama created:', response.data?.id);
      return response.data;
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
      // console.log(`📡 [DiagramasService] PATCH /diagramas/${diagramaId}`, dto);
      const response = await api.patch(`/diagramas/${diagramaId}`, dto);
      // console.log('✅ [DiagramasService] Diagrama updated:', response.data?.id);
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
      // console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}`);
      await api.delete(`/diagramas/${diagramaId}`);
      // console.log('✅ [DiagramasService] Diagrama deleted:', diagramaId);
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
      // console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/equipamentos`, dto);
      const response = await api.post(`/diagramas/${diagramaId}/equipamentos`, dto);
      // console.log('✅ [DiagramasService] Equipamento added to diagrama');
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
      // console.log(`📡 [DiagramasService] PATCH /diagramas/${diagramaId}/equipamentos/${equipamentoId}`, dto);
      const response = await api.patch(`/diagramas/${diagramaId}/equipamentos/${equipamentoId}`, dto);
      // console.log('✅ [DiagramasService] Equipamento position updated');
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
      // console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}/equipamentos/${equipamentoId}`);
      await api.delete(`/diagramas/${diagramaId}/equipamentos/${equipamentoId}`);
      // console.log('✅ [DiagramasService] Equipamento removed from diagrama');
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
      // console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/conexoes`, dto);
      const response = await api.post(`/diagramas/${diagramaId}/conexoes`, dto);
      // console.log('✅ [DiagramasService] Connection created');
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
      // console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}/conexoes/${conexaoId}`);
      await api.delete(`/diagramas/${diagramaId}/conexoes/${conexaoId}`);
      // console.log('✅ [DiagramasService] Connection deleted');
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
      // console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/ativar`);
      const response = await api.post(`/diagramas/${diagramaId}/ativar`);
      // console.log('✅ [DiagramasService] Diagrama activated');
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
      // console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/equipamentos/bulk`);
      // console.log(`   📦 Adding ${equipamentos.length} equipamentos`);

      // Aumentar timeout para 2 minutos (120 segundos) para operações em lote grandes
      const response = await api.post(`/diagramas/${diagramaId}/equipamentos/bulk`, {
        equipamentos,
      }, {
        timeout: 120000, // 2 minutos
      });

      // console.log('✅ [DiagramasService] Bulk equipamentos added:', response.data);
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
      // console.log(`📡 [DiagramasService] POST /diagramas/${diagramaId}/conexoes/bulk`);
      // console.log(`   🔗 Creating ${conexoes.length} conexões`);

      // Aumentar timeout para 2 minutos (120 segundos) para operações em lote grandes
      const response = await api.post(`/diagramas/${diagramaId}/conexoes/bulk`, {
        conexoes,
      }, {
        timeout: 120000, // 2 minutos
      });

      // console.log('✅ [DiagramasService] Bulk conexões created:', response.data);
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
      // console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}/conexoes`);
      const response = await api.delete(`/diagramas/${diagramaId}/conexoes`);
      // console.log('✅ [DiagramasService] All connections removed:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error removing all connections:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao remover todas as conexões');
    }
  }

  /**
   * Remove all equipamentos from diagrama (IMMUTABILITY - Replace pattern)
   * This implements the "replace instead of modify" pattern
   */
  async removeAllEquipamentos(diagramaId: string): Promise<any> {
    try {
      // console.log(`📡 [DiagramasService] DELETE /diagramas/${diagramaId}/equipamentos (REMOVE ALL - Immutability Pattern)`);
      const response = await api.delete(`/diagramas/${diagramaId}/equipamentos`);
      // console.log('✅ [DiagramasService] All equipamentos removed:', response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error removing all equipamentos:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao remover todos os equipamentos');
    }
  }

  /**
   * NOVO V2: Save layout atomically (DELETE ALL + INSERT ALL)
   *
   * Este método implementa o salvamento atômico do layout completo.
   * Substitui todas as posições de equipamentos e conexões em uma única transação.
   *
   * Performance: ~10x mais rápido que múltiplas requisições PATCH individuais.
   *
   * @param diagramaId - ID do diagrama
   * @param dto - Layout completo (equipamentos + conexões)
   * @returns Resultado da operação com contadores
   */
  async saveLayout(diagramaId: string, dto: {
    equipamentos: Array<{
      equipamentoId: string;
      posicaoX: number;
      posicaoY: number;
      rotacao?: number;
      labelPosition?: string;
    }>;
    conexoes: Array<{
      equipamentoOrigemId: string;
      portaOrigem: string;
      equipamentoDestinoId: string;
      portaDestino: string;
    }>;
  }): Promise<{
    equipamentosAtualizados: number;
    conexoesCriadas: number;
    tempoMs: number;
  }> {
    try {
      // console.log(`📡 [DiagramasService] PUT /diagramas/${diagramaId}/layout`);
      // console.log(`   📦 Equipamentos: ${dto.equipamentos.length}`);
      // console.log(`   🔗 Conexões: ${dto.conexoes.length}`);

      const startTime = Date.now();

      const response = await api.put(`/diagramas/${diagramaId}/layout`, dto, {
        timeout: 60000, // 1 minuto (operação atômica pode demorar)
      });

      const tempoMs = Date.now() - startTime;

      // console.log(`✅ [DiagramasService] Layout saved in ${tempoMs}ms`);

      // Backend retorna { success, data: { equipamentosAtualizados, conexoesCriadas, tempoMs }, meta }
      return response.data;
    } catch (error: any) {
      console.error(`❌ [DiagramasService] Error saving layout:`, error);
      throw new Error(error.response?.data?.message || 'Erro ao salvar layout');
    }
  }
}

// ===== EXPORT SINGLETON =====

export const DiagramasService = new DiagramasServiceClass();
