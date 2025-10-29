// src/features/equipamentos/hooks/useEquipamentos.ts - CORRIGIDO PARA SUA API
import { useState, useCallback } from 'react';
import { 
  equipamentosApi, 
  EquipamentoApiResponse, 
  CreateEquipamentoApiData, 
  UpdateEquipamentoApiData,
  EquipamentosQueryParams,
  EstatisticasPlantaResponse 
} from '@/services/equipamentos.services';
import { 
  Equipamento,
  EquipamentosFilters 
} from '../types';

// ============================================================================
// TRANSFORMAÇÕES CORRIGIDAS PARA SUA API
// ============================================================================

export const transformApiToFrontend = (apiEquipamento: EquipamentoApiResponse): Equipamento => {
  const safeDateFormat = (date?: Date | string): string | undefined => {
    if (!date) return undefined;
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toISOString().split('T')[0];
    } catch {
      return undefined;
    }
  };

  const getTipoPessoa = (cpfCnpj?: string): 'pessoa_fisica' | 'pessoa_juridica' => {
    if (!cpfCnpj) return 'pessoa_fisica';
    return cpfCnpj.includes('/') || cpfCnpj.length > 14 ? 'pessoa_juridica' : 'pessoa_fisica';
  };

  return {
    id: apiEquipamento.id,
    criadoEm: apiEquipamento.created_at?.toString() || new Date().toISOString(),
    atualizadoEm: apiEquipamento.updated_at?.toString() || new Date().toISOString(),

    // Dados básicos
    nome: apiEquipamento.nome || '',
    classificacao: apiEquipamento.classificacao || 'UC',
    // TODO: Atualizar para unidade_id quando backend for migrado para nova estrutura
    unidadeId: apiEquipamento.planta_id, // Temporariamente usando planta_id até backend suportar unidades
    proprietarioId: apiEquipamento.proprietario_id,
    equipamentoPaiId: apiEquipamento.equipamento_pai_id,
    
    // Dados técnicos
    fabricante: apiEquipamento.fabricante,
    modelo: apiEquipamento.modelo,
    numeroSerie: apiEquipamento.numero_serie,
    criticidade: apiEquipamento.criticidade || '3',
    tipo: apiEquipamento.tipo_equipamento,
    
    // Estados operacionais
    emOperacao: apiEquipamento.em_operacao as 'sim' | 'nao' | undefined,
    tipoDepreciacao: apiEquipamento.tipo_depreciacao as 'linear' | 'uso' | undefined,
    
    // Datas
    dataImobilizacao: safeDateFormat(apiEquipamento.data_imobilizacao),
    dataInstalacao: safeDateFormat(apiEquipamento.data_instalacao),
    
    // Valores financeiros
    valorImobilizado: apiEquipamento.valor_imobilizado,
    valorDepreciacao: apiEquipamento.valor_depreciacao,
    valorContabil: apiEquipamento.valor_contabil,
    vidaUtil: apiEquipamento.vida_util,
    
    // Administrativo
    fornecedor: apiEquipamento.fornecedor,
    centroCusto: apiEquipamento.centro_custo,
    planoManutencao: apiEquipamento.plano_manutencao,
    
    // Localização
    localizacao: apiEquipamento.localizacao,
    localizacaoEspecifica: apiEquipamento.localizacao_especifica,
    observacoes: apiEquipamento.observacoes,
    
    // Campos MCPSE
    mcpse: apiEquipamento.mcpse,
    tuc: apiEquipamento.tuc,
    a1: apiEquipamento.a1,
    a2: apiEquipamento.a2,
    a3: apiEquipamento.a3,
    a4: apiEquipamento.a4,
    a5: apiEquipamento.a5,
    a6: apiEquipamento.a6,
    
    // Relacionamentos
    unidade: apiEquipamento.unidade ? {
      id: apiEquipamento.unidade.id,
      nome: apiEquipamento.unidade.nome || 'Unidade não informada',
      planta: apiEquipamento.unidade.planta ? {
        id: apiEquipamento.unidade.planta.id,
        nome: apiEquipamento.unidade.planta.nome || 'Planta não informada',
        proprietario: apiEquipamento.unidade.planta.proprietario ? {
          id: apiEquipamento.unidade.planta.proprietario.id,
          nome: apiEquipamento.unidade.planta.proprietario.nome || 'Proprietário não informado',
          cpf_cnpj: apiEquipamento.unidade.planta.proprietario.cpf_cnpj || '',
          tipo: apiEquipamento.unidade.planta.proprietario.tipo || 'pessoa_juridica'
        } : undefined
      } : undefined
    } : undefined,

    proprietario: apiEquipamento.proprietario ? {
      id: apiEquipamento.proprietario.id,
      razaoSocial: apiEquipamento.proprietario.nome || 'Nome não informado',
      cnpjCpf: apiEquipamento.proprietario.cpf_cnpj || '',
      tipo: getTipoPessoa(apiEquipamento.proprietario.cpf_cnpj)
    } : undefined,

    planta: apiEquipamento.planta ? {
      id: apiEquipamento.planta.id,
      nome: apiEquipamento.planta.nome || 'Planta não informada',
      cnpj: '',
      proprietarioId: apiEquipamento.proprietario_id || '',
      localizacao: (apiEquipamento.planta as any).localizacao,
      criadoEm: apiEquipamento.created_at?.toString() || new Date().toISOString()
    } : undefined,
    
    equipamentoPai: apiEquipamento.equipamento_pai ? {
      id: apiEquipamento.equipamento_pai.id,
      nome: apiEquipamento.equipamento_pai.nome || 'Equipamento pai não informado',
      classificacao: 'UC',
      criticidade: apiEquipamento.equipamento_pai.criticidade as '1' | '2' | '3' | '4' | '5' || '3',
      criadoEm: apiEquipamento.created_at?.toString() || new Date().toISOString(),
      fabricante: (apiEquipamento.equipamento_pai as any).fabricante,
      modelo: (apiEquipamento.equipamento_pai as any).modelo,
      localizacao: (apiEquipamento.equipamento_pai as any).localizacao
    } : undefined,
    
    componentesUAR: apiEquipamento.componentes_uar?.map(comp => ({
      id: comp.id,
      nome: comp.nome || 'Componente sem nome',
      classificacao: 'UAR' as const,
      criticidade: '3' as const,
      criadoEm: apiEquipamento.created_at?.toString() || new Date().toISOString(),
      totalComponentes: 0
    })) || [],
    
    dadosTecnicos: apiEquipamento.dados_tecnicos?.map(dt => ({
      id: dt.id,
      campo: dt.campo,
      valor: dt.valor || '',
      tipo: dt.tipo,
      unidade: dt.unidade
    })) || [],
    
    totalComponentes: apiEquipamento.totalComponentes || apiEquipamento.componentes_uar?.length || 0
  };
};

// NOVA TRANSFORMAÇÃO: Frontend -> API (SEM PERDER DADOS)
export const transformFrontendToApi = (equipamento: any): CreateEquipamentoApiData => {
  console.log('TRANSFORM: Dados de entrada:', equipamento);

  // Se já vem no formato da API (do modal), usar direto
  // Verificar por unidade_id OU planta_id (nova estrutura ou antiga)
  if (equipamento.classificacao && (equipamento.unidade_id || equipamento.planta_id)) {
    console.log('TRANSFORM: Dados já estão no formato da API');
    return equipamento as CreateEquipamentoApiData;
  }

  // Senão, transformar do formato do frontend
  const apiData: CreateEquipamentoApiData = {
    nome: equipamento.nome,
    classificacao: equipamento.classificacao || 'UC',
    criticidade: equipamento.criticidade || '3',

    // IDs - usar tanto os nomes com underscore quanto sem
    // Priorizar unidade_id sobre planta_id (nova estrutura)
    unidade_id: equipamento.unidade_id || equipamento.unidadeId,
    planta_id: equipamento.planta_id || equipamento.plantaId,
    proprietario_id: equipamento.proprietario_id || equipamento.proprietarioId,
    equipamento_pai_id: equipamento.equipamento_pai_id || equipamento.equipamentoPaiId,
    
    // Campos técnicos básicos
    fabricante: equipamento.fabricante,
    modelo: equipamento.modelo,
    numero_serie: equipamento.numero_serie || equipamento.numeroSerie,
    tipo_equipamento: equipamento.tipo_equipamento || equipamento.tipo,
    
    // Estados operacionais
    em_operacao: equipamento.em_operacao || equipamento.emOperacao,
    tipo_depreciacao: equipamento.tipo_depreciacao || equipamento.tipoDepreciacao,
    
    // Datas
    data_imobilizacao: equipamento.data_imobilizacao || equipamento.dataImobilizacao,
    data_instalacao: equipamento.data_instalacao || equipamento.dataInstalacao,
    
    // Valores financeiros
    valor_imobilizado: equipamento.valor_imobilizado || equipamento.valorImobilizado,
    valor_depreciacao: equipamento.valor_depreciacao || equipamento.valorDepreciacao,
    valor_contabil: equipamento.valor_contabil || equipamento.valorContabil,
    vida_util: equipamento.vida_util || equipamento.vidaUtil,
    
    // Administrativo
    fornecedor: equipamento.fornecedor,
    centro_custo: equipamento.centro_custo || equipamento.centroCusto,
    plano_manutencao: equipamento.plano_manutencao || equipamento.planoManutencao,
    
    // Localização
    localizacao: equipamento.localizacao,
    localizacao_especifica: equipamento.localizacao_especifica || equipamento.localizacaoEspecifica,
    observacoes: equipamento.observacoes,
    
    // MCPSE
    mcpse: equipamento.mcpse,
    tuc: equipamento.tuc,
    a1: equipamento.a1,
    a2: equipamento.a2,
    a3: equipamento.a3,
    a4: equipamento.a4,
    a5: equipamento.a5,
    a6: equipamento.a6,
    
    // Dados técnicos
    dados_tecnicos: equipamento.dados_tecnicos || equipamento.dadosTecnicos
  };
  
  console.log('TRANSFORM: Dados de saída:', apiData);
  return apiData;
};

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export interface UseEquipamentosReturn {
  // Estados
  loading: boolean;
  error: string | null;
  
  // Dados
  equipamentos: Equipamento[];
  equipamentosUC: Equipamento[];
  componentesUAR: Equipamento[];
  totalPages: number;
  currentPage: number;
  total: number;
  
  // Operações CRUD
  createEquipamento: (data: any) => Promise<Equipamento>;
  updateEquipamento: (id: string, data: any) => Promise<Equipamento>;
  deleteEquipamento: (id: string) => Promise<void>;
  getEquipamento: (id: string) => Promise<Equipamento>;
  
  // Operações de listagem
  fetchEquipamentos: (params?: EquipamentosFilters) => Promise<Equipamento[]>;
  fetchEquipamentosByPlanta: (plantaId: string, params?: EquipamentosFilters) => Promise<{
    equipamentos: Equipamento[];
    planta: { id: string; nome: string; localizacao: string };
  }>;
  
  // Operações específicas para componentes
  fetchComponentesByEquipamento: (equipamentoId: string) => Promise<Equipamento[]>;
  fetchEquipamentosUCDisponiveis: () => Promise<Array<{
    id: string;
    nome: string;
    fabricante?: string;
    modelo?: string;
    planta?: { id: string; nome: string };
  }>>;
  
  // Gerenciamento em lote de componentes
  fetchComponentesParaGerenciar: (ucId: string) => Promise<{
    equipamentoUC: any;
    componentes: Equipamento[];
  }>;
  salvarComponentesUARLote: (ucId: string, componentes: any[]) => Promise<{
    message: string;
    componentes: Equipamento[];
  }>;
  
  // Estatísticas
  getEstatisticasPlanta: (plantaId: string) => Promise<EstatisticasPlantaResponse>;
  
  // Utilitários
  clearError: () => void;
  refreshData: () => Promise<void>;
}

export function useEquipamentos(): UseEquipamentosReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastFilters, setLastFilters] = useState<EquipamentosFilters | undefined>();

  // Separar equipamentos UC e componentes UAR
  const equipamentosUC = equipamentos.filter(eq => eq.classificacao === 'UC');
  const componentesUAR = equipamentos.filter(eq => eq.classificacao === 'UAR');

  const handleError = useCallback((err: any, context?: string) => {
    let message = 'Erro desconhecido';
    
    if (err?.response?.data?.message) {
      message = err.response.data.message;
    } else if (err?.message) {
      message = err.message;
    } else if (typeof err === 'string') {
      message = err;
    }

    console.error(`Erro na API de equipamentos${context ? ` (${context})` : ''}:`, err);
    setError(message);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshData = useCallback(async () => {
    if (lastFilters) {
      await fetchEquipamentos(lastFilters);
    }
  }, [lastFilters]);

  // ============================================================================
  // OPERAÇÕES CRUD
  // ============================================================================

  const createEquipamento = useCallback(async (data: any): Promise<Equipamento> => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('HOOK: Criando equipamento com dados:', data);
      
      const apiData = transformFrontendToApi(data);
      console.log('HOOK: Dados transformados para API:', apiData);
      
      const response = await equipamentosApi.create(apiData);
      console.log('HOOK: Resposta da API:', response);
      
      const equipamento = transformApiToFrontend(response);
      console.log('HOOK: Equipamento transformado:', equipamento);
      
      // Atualizar lista local
      setEquipamentos(prev => [equipamento, ...prev]);
      setTotal(prev => prev + 1);
      
      return equipamento;
    } catch (err) {
      handleError(err, 'createEquipamento');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const updateEquipamento = useCallback(async (id: string, data: any): Promise<Equipamento> => {
    try {
      setLoading(true);
      setError(null);
      
      const apiData = transformFrontendToApi(data);
      const response = await equipamentosApi.update(id, apiData as UpdateEquipamentoApiData);
      const equipamento = transformApiToFrontend(response);
      
      // Atualizar lista local
      setEquipamentos(prev => prev.map(eq => {
        return eq.id === id ? equipamento : eq;
      }));
      
      return equipamento;
    } catch (err) {
      handleError(err, 'updateEquipamento');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const deleteEquipamento = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      await equipamentosApi.remove(id);
      
      // Remover da lista local
      setEquipamentos(prev => prev.filter(eq => eq.id !== id));
      setTotal(prev => Math.max(0, prev - 1));
      
    } catch (err) {
      handleError(err, 'deleteEquipamento');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getEquipamento = useCallback(async (id: string): Promise<Equipamento> => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 [HOOK] getEquipamento chamado com ID:', id);
      const response = await equipamentosApi.findOne(id);
      console.log('📦 [HOOK] Resposta da API (response):', response);
      console.log('📦 [HOOK] response.id:', response.id);
      console.log('📦 [HOOK] response.nome:', response.nome);
      console.log('📦 [HOOK] response.tipo_equipamento:', response.tipo_equipamento);
      console.log('📦 [HOOK] response.dados_tecnicos:', response.dados_tecnicos);

      const transformed = transformApiToFrontend(response);
      console.log('✨ [HOOK] Equipamento transformado:', transformed);

      return transformed;

    } catch (err) {
      console.error('❌ [HOOK] Erro em getEquipamento:', err);
      handleError(err, 'getEquipamento');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // ============================================================================
  // OPERAÇÕES DE LISTAGEM
  // ============================================================================

  const fetchEquipamentos = useCallback(async (filters?: EquipamentosFilters): Promise<Equipamento[]> => {
    try {
      setLoading(true);
      setError(null);
      setLastFilters(filters);
      
      // Filtros hierárquicos: unidade tem prioridade sobre planta
      // Se unidade está selecionada, não enviamos planta_id
      const hasUnidade = filters?.unidadeId && filters.unidadeId !== 'all';
      const hasPlanta = filters?.plantaId && filters.plantaId !== 'all';

      const params: EquipamentosQueryParams = {
        page: filters?.page || 1,
        limit: filters?.limit || 10,
        search: filters?.search || undefined,
        classificacao: (filters?.classificacao !== 'all' ? filters?.classificacao : undefined) as 'UC' | 'UAR' | undefined,
        criticidade: (filters?.criticidade !== 'all' ? filters?.criticidade : undefined) as '1' | '2' | '3' | '4' | '5' | undefined,
        // Se unidade está selecionada, usar apenas unidade_id
        // Caso contrário, usar planta_id se disponível
        unidade_id: hasUnidade ? filters.unidadeId : undefined,
        planta_id: hasUnidade ? undefined : (hasPlanta ? filters.plantaId : undefined)
      };
      
      const response = await equipamentosApi.findAll(params);

      // A API retorna: { success: true, data: { data: [], pagination: {} }, meta: {} }
      // Então precisamos acessar response.data.data
      const equipamentosTransformados = response.data.data.map(transformApiToFrontend);

      setEquipamentos(equipamentosTransformados);
      setTotalPages(response.data.pagination.pages);
      setCurrentPage(response.data.pagination.page);
      setTotal(response.data.pagination.total);
      
      return equipamentosTransformados;
      
    } catch (err) {
      handleError(err, 'fetchEquipamentos');
      return [];
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const fetchEquipamentosByPlanta = useCallback(async (plantaId: string, filters?: EquipamentosFilters) => {
    try {
      setLoading(true);
      setError(null);
      
      const params: EquipamentosQueryParams = {
        page: filters?.page || 1,
        limit: filters?.limit || 10,
        search: filters?.search || undefined,
        classificacao: (filters?.classificacao !== 'all' ? filters?.classificacao : undefined) as 'UC' | 'UAR' | undefined,
        criticidade: (filters?.criticidade !== 'all' ? filters?.criticidade : undefined) as '1' | '2' | '3' | '4' | '5' | undefined,
      };
      
      const response = await equipamentosApi.findByPlanta(plantaId, params);

      // A API retorna: { success: true, data: { data: [], pagination: {}, planta: {} }, meta: {} }
      const equipamentosTransformados = response.data.data.map(transformApiToFrontend);

      setEquipamentos(equipamentosTransformados);
      setTotalPages(response.data.pagination.pages);
      setCurrentPage(response.data.pagination.page);
      setTotal(response.data.pagination.total);

      return {
        equipamentos: equipamentosTransformados,
        planta: response.data.planta
      };
      
    } catch (err) {
      handleError(err, 'fetchEquipamentosByPlanta');
      return {
        equipamentos: [],
        planta: { id: '', nome: '', localizacao: '' }
      };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // ============================================================================
  // OPERAÇÕES ESPECÍFICAS PARA COMPONENTES
  // ============================================================================

  const fetchComponentesByEquipamento = useCallback(async (equipamentoId: string): Promise<Equipamento[]> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await equipamentosApi.findComponentesByEquipamento(equipamentoId);
      return response.map(transformApiToFrontend);
      
    } catch (err) {
      handleError(err, 'fetchComponentesByEquipamento');
      return [];
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const fetchEquipamentosUCDisponiveis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      return await equipamentosApi.findEquipamentosUC();
      
    } catch (err) {
      handleError(err, 'fetchEquipamentosUCDisponiveis');
      return [];
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const fetchComponentesParaGerenciar = useCallback(async (ucId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await equipamentosApi.findComponentesParaGerenciar(ucId);

      return {
        equipamentoUC: response.equipamentoUC,
        componentes: (response.componentes || []).map(transformApiToFrontend)
      };

    } catch (err) {
      handleError(err, 'fetchComponentesParaGerenciar');
      return {
        equipamentoUC: null,
        componentes: []
      };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const salvarComponentesUARLote = useCallback(async (ucId: string, componentes: any[]) => {
    try {
      setLoading(true);
      setError(null);

      const componentesApi = componentes.map(comp => transformFrontendToApi(comp));

      const response = await equipamentosApi.salvarComponentesUARLote(ucId, componentesApi);

      return {
        message: response.message,
        componentes: (response.componentes || []).map(transformApiToFrontend)
      };

    } catch (err) {
      handleError(err, 'salvarComponentesUARLote');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getEstatisticasPlanta = useCallback(async (plantaId: string): Promise<EstatisticasPlantaResponse> => {
    try {
      setLoading(true);
      setError(null);
      
      return await equipamentosApi.getEstatisticasPlanta(plantaId);
      
    } catch (err) {
      handleError(err, 'getEstatisticasPlanta');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  return {
    // Estados
    loading,
    error,
    
    // Dados
    equipamentos,
    equipamentosUC,
    componentesUAR,
    totalPages,
    currentPage,
    total,
    
    // Operações CRUD
    createEquipamento,
    updateEquipamento,
    deleteEquipamento,
    getEquipamento,
    
    // Operações de listagem
    fetchEquipamentos,
    fetchEquipamentosByPlanta,
    
    // Operações específicas para componentes
    fetchComponentesByEquipamento,
    fetchEquipamentosUCDisponiveis,
    
    // Gerenciamento em lote
    fetchComponentesParaGerenciar,
    salvarComponentesUARLote,
    
    // Estatísticas
    getEstatisticasPlanta,
    
    // Utilitários
    clearError,
    refreshData
  };
}