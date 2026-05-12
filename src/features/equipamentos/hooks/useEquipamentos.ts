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
  EquipamentosFilters,
  Unidade
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
    createdAt: apiEquipamento.created_at?.toString() || new Date().toISOString(),
    updatedAt: apiEquipamento.updated_at?.toString() || new Date().toISOString(),

    // Dados básicos
    nome: apiEquipamento.nome || '',
    classificacao: apiEquipamento.classificacao || 'UC',
    unidadeId: apiEquipamento.unidade_id, // Agora usando unidade_id corretamente
    plantaId: apiEquipamento.planta_id,
    proprietarioId: apiEquipamento.proprietario_id,
    equipamentoPaiId: apiEquipamento.equipamento_pai_id,
    
    // Dados técnicos
    fabricante: apiEquipamento.fabricante,
    modelo: apiEquipamento.modelo,
    numeroSerie: apiEquipamento.numero_serie,
    criticidade: apiEquipamento.criticidade || '3',
    tipo: ((apiEquipamento as any).tipo_equipamento_rel?.id || apiEquipamento.tipo_equipamento_id || apiEquipamento.tipo_equipamento)?.trim(),
    tipoEquipamento: ((apiEquipamento as any).tipo_equipamento_rel?.id || apiEquipamento.tipo_equipamento_id || apiEquipamento.tipo_equipamento)?.trim(), // Alias para compatibilidade com modal

    // Status
    status: (apiEquipamento as any).status || 'Ativo',

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

    // TAG e MQTT
    tag: apiEquipamento.tag,
    mqttHabilitado: apiEquipamento.mqtt_habilitado,
    topicoMqtt: apiEquipamento.topico_mqtt,

    // Automacao (PR3)
    automacao: apiEquipamento.automacao ?? false,

    // Campos MCPSE
    mcpse: apiEquipamento.mcpse,
    tuc: apiEquipamento.tuc,
    a1: apiEquipamento.a1,
    a2: apiEquipamento.a2,
    a3: apiEquipamento.a3,
    a4: apiEquipamento.a4,
    a5: apiEquipamento.a5,
    a6: apiEquipamento.a6,

    // Foto
    fotoUrl: apiEquipamento.foto_url,

    // Relacionamentos
    unidade: apiEquipamento.unidade ? ({
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
    } as unknown as Unidade) : undefined,

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
      criadoEm: apiEquipamento.created_at?.toString() || new Date().toISOString(),
      createdAt: apiEquipamento.created_at?.toString() || new Date().toISOString(),
      updatedAt: apiEquipamento.updated_at?.toString() || new Date().toISOString()
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
    
    componentesUAR: (apiEquipamento.componentes_uar?.map(comp => ({
      id: comp.id,
      nome: comp.nome || 'Componente sem nome',
      classificacao: 'UAR' as const,
      criticidade: '3' as const,
      criadoEm: apiEquipamento.created_at?.toString() || new Date().toISOString(),
      createdAt: apiEquipamento.created_at?.toString() || new Date().toISOString(),
      updatedAt: apiEquipamento.updated_at?.toString() || new Date().toISOString(),
      totalComponentes: 0
    })) || []) as unknown as Equipamento[],
    
    dadosTecnicos: apiEquipamento.dados_tecnicos?.map(dt => ({
      id: dt.id,
      campo: dt.campo,
      valor: dt.valor || '',
      tipo: dt.tipo,
      unidade: dt.unidade
    })) || [],

    // Pontos de automacao (PR3) — preservado em snake_case pra match com modal
    // (que le `dadosCompletos.equipamento_pontos`). Tambem expondo em camel pra consumo
    // futuro mais limpo.
    equipamento_pontos: (apiEquipamento as any).equipamento_pontos?.map((p: any) => ({
      id: p.id?.trim?.() ?? p.id,
      equipamento_id: p.equipamento_id?.trim?.() ?? p.equipamento_id,
      tipo: p.tipo,
      nome: p.nome,
      unidade: p.unidade,
      ordem: p.ordem ?? 0,
      ativo: p.ativo !== false,
    })) || [],

    // Tipo de equipamento completo (relação com tipos_equipamentos)
    tipoEquipamentoObj: (apiEquipamento as any).tipo_equipamento_rel ? {
      id: (apiEquipamento as any).tipo_equipamento_rel.id?.trim(),
      codigo: (apiEquipamento as any).tipo_equipamento_rel.codigo?.trim(),
      nome: (apiEquipamento as any).tipo_equipamento_rel.nome?.trim(),
      // ✅ CORRIGIDO: categoria é objeto, não string
      categoria: (apiEquipamento as any).tipo_equipamento_rel.categoria?.nome ||
                 (apiEquipamento as any).tipo_equipamento_rel.categoria || '',
      larguraPadrao: (apiEquipamento as any).tipo_equipamento_rel.largura_padrao,
      alturaPadrao: (apiEquipamento as any).tipo_equipamento_rel.altura_padrao,
      iconeSvg: (apiEquipamento as any).tipo_equipamento_rel.icone_svg
    } : undefined,

    // Prioridade: usar equipamentos_filhos (nome correto no backend) > totalComponentes > _count > componentes_uar
    totalComponentes: (apiEquipamento as any).equipamentos_filhos?.length
      || apiEquipamento.totalComponentes
      || (apiEquipamento as any)._count?.componentes_uar
      || apiEquipamento.componentes_uar?.length
      || 0
  };
};

// NOVA TRANSFORMAÇÃO: Frontend -> API (SEM PERDER DADOS)
export const transformFrontendToApi = (equipamento: any): CreateEquipamentoApiData => {
  // console.log('TRANSFORM: Dados de entrada:', equipamento);

  // Se já vem no formato da API (do modal), usar direto
  // Verificar por unidade_id OU planta_id (nova estrutura ou antiga)
  if (equipamento.classificacao && (equipamento.unidade_id || equipamento.planta_id)) {
    // console.log('TRANSFORM: Dados já estão no formato da API');
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
    tipo_equipamento_id: (equipamento.tipo_equipamento_id || equipamento.tipoEquipamento || equipamento.tipo)?.trim(),
    
    // Status
    status: equipamento.status,

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

    // TAG e MQTT
    tag: equipamento.tag,
    mqtt_habilitado: equipamento.mqtt_habilitado || equipamento.mqttHabilitado,
    topico_mqtt: equipamento.topico_mqtt || equipamento.topicoMqtt,

    // Automacao (PR3)
    automacao: equipamento.automacao ?? false,

    // MCPSE
    mcpse: equipamento.mcpse,
    tuc: equipamento.tuc,
    a1: equipamento.a1,
    a2: equipamento.a2,
    a3: equipamento.a3,
    a4: equipamento.a4,
    a5: equipamento.a5,
    a6: equipamento.a6,

    // Foto (aceita ambos os nomes)
    foto_url: equipamento.foto_url || equipamento.fotoUrl,

    // Dados técnicos
    dados_tecnicos: equipamento.dados_tecnicos || equipamento.dadosTecnicos,

    // Pontos de automacao (PR3) — modal envia array no camelCase ou snake; aceitar ambos
    pontos: (equipamento as any).pontos,
  };

  // console.log('TRANSFORM: Dados de saída:', apiData);
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
  uploadFoto: (id: string, file: File) => Promise<{ fotoUrl: string }>;
  removeFoto: (id: string) => Promise<{ fotoUrl: null }>;
  
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

      // console.log('HOOK: Criando equipamento com dados:', data);

      const apiData = transformFrontendToApi(data);
      // console.log('HOOK: Dados transformados para API:', apiData);

      const response = await equipamentosApi.create(apiData);
      // console.log('HOOK: Resposta da API:', response);

      const equipamento = transformApiToFrontend(response);
      // console.log('HOOK: Equipamento transformado:', equipamento);
      
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

      // console.log('🔍 [HOOK] getEquipamento chamado com ID:', id);
      const response = await equipamentosApi.findOne(id);
      // console.log('📦 [HOOK] Resposta da API (response):', response);
      // console.log('📦 [HOOK] response.id:', response.id);
      // console.log('📦 [HOOK] response.nome:', response.nome);
      // console.log('📦 [HOOK] response.tipo_equipamento:', response.tipo_equipamento);
      // console.log('📦 [HOOK] response.dados_tecnicos:', response.dados_tecnicos);

      const transformed = transformApiToFrontend(response);
      // console.log('✨ [HOOK] Equipamento transformado:', transformed);

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
      
      // Filtros hierárquicos: proprietário > planta > unidade
      // Prioridade: unidade > planta > proprietário
      // Se unidade está selecionada, não enviamos planta_id nem proprietario_id
      const hasProprietario = filters?.proprietarioId && filters.proprietarioId !== 'all';
      const hasUnidade = filters?.unidadeId && filters.unidadeId !== 'all';
      const hasPlanta = filters?.plantaId && filters.plantaId !== 'all';

      const params: EquipamentosQueryParams = {
        page: filters?.page || 1,
        limit: filters?.limit || 10,
        search: filters?.search || undefined,
        classificacao: (filters?.classificacao !== 'all' ? filters?.classificacao : undefined) as 'UC' | 'UAR' | undefined,
        criticidade: (filters?.criticidade !== 'all' ? filters?.criticidade : undefined) as '1' | '2' | '3' | '4' | '5' | undefined,
        // Hierarquia: unidade > planta > proprietário (com trim para evitar espaços)
        unidade_id: hasUnidade ? filters.unidadeId?.trim() : undefined,
        planta_id: hasUnidade ? undefined : (hasPlanta ? filters.plantaId?.trim() : undefined),
        proprietario_id: (hasUnidade || hasPlanta) ? undefined : (hasProprietario ? filters.proprietarioId?.trim() : undefined),
        semPlano: filters?.semPlano || undefined
      };
      
      const response = await equipamentosApi.findAll(params);

      // A API retorna: { success: true, data: { data: [], pagination: {} }, meta: {} }
      // Após o interceptor desempacotar, response é { data: [], pagination: {} }
      const equipamentosArray = response.data;

      // DEBUG: Verificar primeiro equipamento UC para ver campos disponíveis
      // const primeiroUC = equipamentosArray.find((eq: any) => eq.classificacao === 'UC');
      // if (primeiroUC) {
      //   console.log('🔍 [DEBUG] Primeiro UC completo:', primeiroUC);
      //   console.log('✅ [DEBUG] equipamentos_filhos (CORRETO):', primeiroUC.equipamentos_filhos);
      //   console.log('✅ [DEBUG] equipamentos_filhos.length:', primeiroUC.equipamentos_filhos?.length);
      //   console.log('📊 [DEBUG] totalComponentes (backend):', primeiroUC.totalComponentes);
      //   console.log('📊 [DEBUG] Contagem FINAL que será usada:', primeiroUC.equipamentos_filhos?.length || primeiroUC.totalComponentes || 0);
      // }

      const equipamentosTransformados = equipamentosArray.map(transformApiToFrontend);

      // Filtrar para ocultar PONTOS e BARRAMENTOS
      const equipamentosFiltrados = equipamentosTransformados.filter(eq => {
        const tipoId = eq.tipo?.toUpperCase() || eq.tipoEquipamento?.toUpperCase() || '';
        return tipoId !== 'PONTO' && tipoId !== 'BARRAMENTO';
      });

      console.log('🔢 [DEBUG PAGINACAO] response.pagination:', response.pagination);
      console.log('🔢 [DEBUG PAGINACAO] array length:', equipamentosArray.length, 'filtrado:', equipamentosFiltrados.length);

      setEquipamentos(equipamentosFiltrados);
      setTotalPages(response.pagination?.pages || 0);
      setCurrentPage(response.pagination?.page || 1);
      setTotal(response.pagination?.total ?? equipamentosFiltrados.length); // Usa total do backend, fallback pra filtrado

      return equipamentosFiltrados;

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
      // Após o interceptor desempacotar, response é { data: [], pagination: {}, planta: {} }
      const equipamentosTransformados = response.data.map(transformApiToFrontend);

      // Filtrar para ocultar PONTOS e BARRAMENTOS
      const equipamentosFiltrados = equipamentosTransformados.filter(eq => {
        const tipoId = eq.tipo?.toUpperCase() || eq.tipoEquipamento?.toUpperCase() || '';
        return tipoId !== 'PONTO' && tipoId !== 'BARRAMENTO';
      });

      setEquipamentos(equipamentosFiltrados);
      setTotalPages(response.pagination.pages);
      setCurrentPage(response.pagination.page);
      setTotal(equipamentosFiltrados.length); // Atualizar total com a quantidade filtrada

      return {
        equipamentos: equipamentosFiltrados,
        planta: response.planta
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

      // console.log('🔍 [GERENCIAR] Buscando componentes para UC:', ucId);
      const response = await equipamentosApi.findComponentesParaGerenciar(ucId);
      // console.log('📦 [GERENCIAR] Resposta COMPLETA da API:', response);
      // console.log('📦 [GERENCIAR] response.data:', response.data);
      // console.log('📦 [GERENCIAR] response.data.componentes:', response.data?.componentes);
      // console.log('📦 [GERENCIAR] response.data.equipamentoUC:', response.data?.equipamentoUC);

      // A API retorna: { success: true, data: { equipamentoUC: {...}, componentes: [...] } }
      // Após o interceptor desempacotar, response é { equipamentoUC: {...}, componentes: [...] }
      const componentes = response?.componentes || [];
      const componentesTransformados = componentes.map(transformApiToFrontend);
      // console.log('✅ [GERENCIAR] Componentes transformados:', componentesTransformados);

      return {
        equipamentoUC: response?.equipamentoUC || null,
        componentes: componentesTransformados
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

  const uploadFoto = useCallback(async (id: string, file: File): Promise<{ fotoUrl: string }> => {
    try {
      setError(null);
      const result = await equipamentosApi.uploadFoto(id, file);
      // Atualiza equipamento em memoria sem refetch
      setEquipamentos((prev) =>
        prev.map((eq) => (eq.id?.trim() === id.trim() ? { ...eq, fotoUrl: result.fotoUrl } : eq))
      );
      return result;
    } catch (err) {
      handleError(err, 'uploadFoto');
      throw err;
    }
  }, [handleError]);

  const removeFoto = useCallback(async (id: string): Promise<{ fotoUrl: null }> => {
    try {
      setError(null);
      const result = await equipamentosApi.removeFoto(id);
      setEquipamentos((prev) =>
        prev.map((eq) => (eq.id?.trim() === id.trim() ? { ...eq, fotoUrl: undefined } : eq))
      );
      return result;
    } catch (err) {
      handleError(err, 'removeFoto');
      throw err;
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

    // Foto
    uploadFoto,
    removeFoto,

    // Utilitários
    clearError,
    refreshData
  };
}