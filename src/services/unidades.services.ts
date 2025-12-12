import { api } from '@/config/api';
import {
  CreateUnidadeDto,
  UpdateUnidadeDto,
  Unidade as UnidadeCompleta,
} from '../features/unidades/types';
import {
  UnidadeNexon,
  FilterUnidadeDto,
  PaginatedUnidadeResponse,
  UnidadeStats,
  ImportResult,
} from '../types/unidades';

class UnidadesService {
  private readonly baseUrl = '/unidades';

  // Listar unidades com filtros e paginação
  async listarUnidades(filtros?: FilterUnidadeDto): Promise<PaginatedUnidadeResponse> {
    try {
      const params = new URLSearchParams();

      if (filtros?.search) params.append('search', filtros.search);
      if (filtros?.plantaId) params.append('plantaId', filtros.plantaId);
      if (filtros?.tipo) params.append('tipo', filtros.tipo);
      if (filtros?.status) params.append('status', filtros.status);
      if (filtros?.estado) params.append('estado', filtros.estado);
      if (filtros?.page) params.append('page', filtros.page.toString());
      if (filtros?.limit) params.append('limit', filtros.limit.toString());
      if (filtros?.orderBy) params.append('orderBy', filtros.orderBy);
      if (filtros?.orderDirection) params.append('orderDirection', filtros.orderDirection);

      console.log('🔍 [UnidadesService] Enviando requisição com params:', params.toString());

      const response = await api.get(`${this.baseUrl}?${params.toString()}`);

      console.log('📨 [UnidadesService] Resposta da API:', {
        status: response.status,
        hasData: !!response.data,
        hasNestedData: !!response.data?.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });

      // A API retorna { success: true, data: { data: [], pagination: {} } }
      return response.data.data || response.data;
    } catch (error) {
      console.error('❌ [UnidadesService] Erro ao listar unidades:', error);
      throw error;
    }
  }

  // Buscar unidade por ID
  async buscarUnidade(id: string): Promise<UnidadeNexon> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      // Busca por ID retorna o objeto diretamente dentro de data
      return response.data.data || response.data;
    } catch (error) {
      console.error('❌ [UnidadesService] Erro ao buscar unidade:', error);
      throw error;
    }
  }

  // Criar nova unidade
  async criarUnidade(dados: CreateUnidadeDto): Promise<UnidadeNexon> {
    try {
      // 🔍 LOG DETALHADO - Dados antes de enviar
      console.log('🏁 [FRONTEND SERVICE - CREATE] ===== INÍCIO =====');
      console.log('📦 [FRONTEND SERVICE - CREATE] DTO completo:', JSON.stringify(dados, null, 2));
      console.log('🔑 [FRONTEND SERVICE - CREATE] concessionaria_id:', dados.concessionaria_id);
      console.log('🔍 [FRONTEND SERVICE - CREATE] Tipo:', typeof dados.concessionaria_id);
      console.log('📝 [FRONTEND SERVICE - CREATE] É undefined?', dados.concessionaria_id === undefined);
      console.log('📝 [FRONTEND SERVICE - CREATE] É null?', dados.concessionaria_id === null);
      console.log('📝 [FRONTEND SERVICE - CREATE] É string vazia?', dados.concessionaria_id === '');

      const response = await api.post(this.baseUrl, dados);

      console.log('✅ [FRONTEND SERVICE - CREATE] Resposta recebida');
      const result = response.data.data || response.data;
      console.log('🔑 [FRONTEND SERVICE - CREATE] concessionariaId na resposta:', result.concessionariaId);
      console.log('🏁 [FRONTEND SERVICE - CREATE] ===== FIM =====');

      // Exibir sucesso
      alert('Unidade cadastrada com sucesso!');

      return result;
    } catch (error) {
      console.error('❌ [UnidadesService] Erro ao criar unidade:', error);
      throw error;
    }
  }

  // Atualizar unidade
  async atualizarUnidade(id: string, dados: UpdateUnidadeDto): Promise<UnidadeNexon> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, dados);

      // Exibir sucesso
      alert('Unidade atualizada com sucesso!');

      return response.data.data || response.data;
    } catch (error) {
      console.error('❌ [UnidadesService] Erro ao atualizar unidade:', error);
      throw error;
    }
  }

  // Excluir unidade
  async excluirUnidade(id: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${id}`);

      // Exibir sucesso
      alert('Unidade excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir unidade:', error);
      throw error;
    }
  }

  // Obter estatísticas
  async obterEstatisticas(): Promise<UnidadeStats> {
    try {
      const response = await api.get(`${this.baseUrl}/stats`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('❌ [UnidadesService] Erro ao obter estatísticas:', error);
      throw error;
    }
  }

  // Importar unidades em lote
  async importarUnidades(unidades: CreateUnidadeDto[]): Promise<ImportResult> {
    try {
      const response = await api.post(`${this.baseUrl}/import`, unidades);

      const result = (response.data.data || response.data) as ImportResult;

      // Exibir resultado da importação
      const message = `Importação concluída!\n` +
        `Total processado: ${result.totalProcessed}\n` +
        `Sucessos: ${result.successful}\n` +
        `Falhas: ${result.failed}`;

      alert(message);

      return result;
    } catch (error) {
      console.error('❌ [UnidadesService] Erro ao importar unidades:', error);
      throw error;
    }
  }

  // Exportar unidades (CSV)
  async exportarCSV(filtros?: FilterUnidadeDto): Promise<void> {
    try {
      const params = new URLSearchParams();

      if (filtros?.search) params.append('search', filtros.search);
      if (filtros?.tipo) params.append('tipo', filtros.tipo);
      if (filtros?.status) params.append('status', filtros.status);
      if (filtros?.estado) params.append('estado', filtros.estado);

      const response = await api.get(`${this.baseUrl}/export/csv?${params.toString()}`, {
        responseType: 'blob',
      });

      // Criar download do arquivo
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `unidades_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('Arquivo CSV baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      throw error;
    }
  }

  // Validar dados antes de enviar
  private validarDados(dados: CreateUnidadeDto | UpdateUnidadeDto): boolean {
    if ('nome' in dados && dados.nome && dados.nome.trim().length === 0) {
      alert('Nome da unidade é obrigatório.');
      return false;
    }

    if ('potencia' in dados && dados.potencia !== undefined && dados.potencia < 0) {
      alert('Potência deve ser um valor positivo.');
      return false;
    }

    if ('latitude' in dados && dados.latitude !== undefined) {
      if (dados.latitude < -90 || dados.latitude > 90) {
        alert('Latitude deve estar entre -90 e 90.');
        return false;
      }
    }

    if ('longitude' in dados && dados.longitude !== undefined) {
      if (dados.longitude < -180 || dados.longitude > 180) {
        alert('Longitude deve estar entre -180 e 180.');
        return false;
      }
    }

    return true;
  }

  // Método público para validação
  validarDadosUnidade(dados: CreateUnidadeDto | UpdateUnidadeDto): boolean {
    return this.validarDados(dados);
  }

  // Buscar unidades por planta
  async buscarUnidadesPorPlanta(plantaId: string): Promise<UnidadeNexon[]> {
    try {
      // Limpar o plantaId de espaços extras
      const cleanPlantaId = plantaId?.trim();
      console.log(`📡 [UnidadesService] Buscando unidades da planta ${cleanPlantaId}`);

      // Tentar endpoint específico primeiro
      try {
        const response = await api.get(`${this.baseUrl}/planta/${cleanPlantaId}`);
        const data = response.data.data || response.data;
        return Array.isArray(data) ? data : [];
      } catch (err) {
        // Fallback: usar endpoint geral com filtro
        console.log('⚠️ [UnidadesService] Endpoint /planta não disponível, usando filtro');
        const response = await api.get(`${this.baseUrl}?plantaId=${cleanPlantaId}&limit=100`);

        const responseData = response.data.data || response.data;
        const data = responseData.data || responseData || [];

        return Array.isArray(data) ? data : [];
      }
    } catch (error: any) {
      console.error(`❌ [UnidadesService] Erro ao buscar unidades por planta ${plantaId}:`, error);
      // Retornar array vazio em vez de throw para não quebrar o UI
      return [];
    }
  }

  // Buscar unidades por proprietário
  async buscarUnidadesPorProprietario(proprietarioId: string): Promise<UnidadeNexon[]> {
    try {
      const cleanProprietarioId = proprietarioId?.trim();
      console.log(`📡 [UnidadesService] Buscando unidades do proprietário ${cleanProprietarioId}`);

      // Usar endpoint geral com filtro de proprietário
      const response = await api.get(`${this.baseUrl}?proprietarioId=${cleanProprietarioId}&limit=1000`);

      const responseData = response.data.data || response.data;
      const data = responseData.data || responseData || [];

      console.log(`✅ [UnidadesService] ${Array.isArray(data) ? data.length : 0} unidades encontradas`);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error(`❌ [UnidadesService] Erro ao buscar unidades por proprietário ${proprietarioId}:`, error);
      // Retornar array vazio em vez de throw para não quebrar o UI
      return [];
    }
  }

  // Buscar estatísticas de uma unidade específica
  async buscarEstatisticasUnidade(id: string): Promise<UnidadeStats> {
    try {
      const cleanId = id?.trim();
      console.log(`📡 [UnidadesService] Buscando estatísticas da unidade ${cleanId}`);

      const response = await api.get(`${this.baseUrl}/${cleanId}/estatisticas`);
      return response.data.data || response.data;
    } catch (error: any) {
      console.error(`❌ [UnidadesService] Erro ao buscar estatísticas da unidade ${id}:`, error);
      throw error;
    }
  }

  // Buscar equipamentos de uma unidade específica
  async buscarEquipamentosUnidade(
    id: string,
    filters?: { page?: number; limit?: number; search?: string }
  ): Promise<any> {
    try {
      const cleanId = id?.trim();
      console.log(`📡 [UnidadesService] Buscando equipamentos da unidade ${cleanId}`);

      const params = new URLSearchParams();
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.search) params.append('search', filters.search);

      const response = await api.get(`${this.baseUrl}/${cleanId}/equipamentos?${params.toString()}`);
      return response.data.data || response.data;
    } catch (error: any) {
      console.error(`❌ [UnidadesService] Erro ao buscar equipamentos da unidade ${id}:`, error);
      throw error;
    }
  }
}

// Exportar instância única (singleton)
export const unidadesService = new UnidadesService();
export default unidadesService;

// ✅ EXPORTS NOMEADOS PARA COMPATIBILIDADE COM IMPORTS FUNCTION-BASED
export const getAllUnidades = (filters: FilterUnidadeDto) => unidadesService.listarUnidades(filters);
export const getUnidadeById = (id: string) => unidadesService.buscarUnidade(id);
export const createUnidade = (dados: CreateUnidadeDto) => unidadesService.criarUnidade(dados);
export const updateUnidade = (id: string, dados: UpdateUnidadeDto) => unidadesService.atualizarUnidade(id, dados);
export const deleteUnidade = (id: string) => unidadesService.excluirUnidade(id);
export const getUnidadesByPlanta = (plantaId: string) => unidadesService.buscarUnidadesPorPlanta(plantaId);
export const getUnidadesByProprietario = (proprietarioId: string) => unidadesService.buscarUnidadesPorProprietario(proprietarioId);
export const getUnidadeEstatisticas = (id: string) => unidadesService.buscarEstatisticasUnidade(id);
export const getUnidadeEquipamentos = (id: string, filters?: { page?: number; limit?: number; search?: string }) =>
  unidadesService.buscarEquipamentosUnidade(id, filters);

// ✅ TIPOS RE-EXPORTADOS
export type { UnidadeCompleta as Unidade, FilterUnidadeDto as UnidadeFilters };