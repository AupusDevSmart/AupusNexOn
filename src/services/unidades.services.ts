import { api } from '@/config/api';
import {
  UnidadeNexon,
  CreateUnidadeDto,
  UpdateUnidadeDto,
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
      if (filtros?.tipo) params.append('tipo', filtros.tipo);
      if (filtros?.status) params.append('status', filtros.status);
      if (filtros?.estado) params.append('estado', filtros.estado);
      if (filtros?.page) params.append('page', filtros.page.toString());
      if (filtros?.limit) params.append('limit', filtros.limit.toString());

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
      const response = await api.post(this.baseUrl, dados);

      // Exibir sucesso
      alert('Unidade cadastrada com sucesso!');

      return response.data.data || response.data;
    } catch (error) {
      console.error('❌ [UnidadesService] Erro ao criar unidade:', error);
      throw error;
    }
  }

  // Atualizar unidade
  async atualizarUnidade(id: string, dados: UpdateUnidadeDto): Promise<UnidadeNexon> {
    try {
      const response = await api.patch(`${this.baseUrl}/${id}`, dados);

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

    if ('localizacao' in dados && dados.localizacao) {
      const { latitude, longitude } = dados.localizacao;
      if (latitude < -90 || latitude > 90) {
        alert('Latitude deve estar entre -90 e 90.');
        return false;
      }
      if (longitude < -180 || longitude > 180) {
        alert('Longitude deve estar entre -180 e 180.');
        return false;
      }
    }

    if ('pontosMedicao' in dados && dados.pontosMedicao && dados.pontosMedicao.length === 0) {
      alert('Pelo menos um ponto de medição é obrigatório.');
      return false;
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
      console.error(`❌ [UnidadesService] Erro ao buscar unidades por planta ${cleanPlantaId}:`, error);
      // Retornar array vazio em vez de throw para não quebrar o UI
      return [];
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

// ✅ TIPOS RE-EXPORTADOS
export type { UnidadeNexon as Unidade, FilterUnidadeDto as UnidadeFilters };