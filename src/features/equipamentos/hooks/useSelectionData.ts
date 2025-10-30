// src/features/equipamentos/hooks/useSelectionData.ts - COM CARREGAMENTO OTIMIZADO
import { useState, useEffect, useCallback } from 'react';
import { 
  selectionDataService,
  ProprietarioSelection,
  PlantaSelection,
  TipoEquipamento,
  SelectionOption
} from '@/services/selection-data.services';

interface UseSelectionDataReturn {
  // Estados de loading
  loadingProprietarios: boolean;
  loadingPlantas: boolean;
  loadingHierarquia: boolean;
  loadingTipos: boolean;
  loadingUCs: boolean;
  
  // Dados
  proprietarios: ProprietarioSelection[];
  plantas: PlantaSelection[];
  tiposEquipamentos: TipoEquipamento[];
  equipamentosUC: SelectionOption[];
  
  // Funções para carregar dados
  fetchProprietarios: () => Promise<ProprietarioSelection[]>;
  fetchPlantas: (proprietarioId?: string) => Promise<PlantaSelection[]>;
  fetchHierarquiaNivel: (nivel: string, parentId?: string) => Promise<any[]>;
  fetchTiposEquipamentos: () => Promise<TipoEquipamento[]>;
  fetchEquipamentosUC: (plantaId?: string) => Promise<SelectionOption[]>;
  
  // Utilitários
  getProprietarioById: (id: string) => ProprietarioSelection | null;
  getPlantaById: (id: string) => PlantaSelection | null;
  getTipoEquipamentoById: (id: string) => TipoEquipamento | null;
  getCamposTecnicosPorTipo: (tipo: string) => any[];
  
  // Estados para o modal
  error: string | null;
  clearError: () => void;
}

export function useSelectionData(): UseSelectionDataReturn {
  // Estados de loading
  const [loadingProprietarios, setLoadingProprietarios] = useState(false);
  const [loadingPlantas, setLoadingPlantas] = useState(false);
  const [loadingHierarquia, setLoadingHierarquia] = useState(false);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [loadingUCs, setLoadingUCs] = useState(false);

  // Estados de dados
  const [proprietarios, setProprietarios] = useState<ProprietarioSelection[]>([]);
  const [plantas, setPlantas] = useState<PlantaSelection[]>([]);
  const [tiposEquipamentos, setTiposEquipamentos] = useState<TipoEquipamento[]>([]);
  const [equipamentosUC, setEquipamentosUC] = useState<SelectionOption[]>([]);

  // Estado de erro
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // PROPRIETÁRIOS - APENAS AQUELES COM PLANTAS
  // ============================================================================
  const fetchProprietarios = useCallback(async (): Promise<ProprietarioSelection[]> => {
    console.log('🚀 [HOOK] Iniciando fetchProprietarios (apenas com plantas)...');
    try {
      setLoadingProprietarios(true);
      setError(null);
      
      const data = await selectionDataService.getProprietarios();
      console.log(`✅ [HOOK] ${data.length} proprietários com plantas carregados`);
      
      setProprietarios(data);
      return data;
    } catch (error: any) {
      console.error('❌ [HOOK] Erro ao carregar proprietários:', error);
      const errorMessage = error.message || 'Erro ao carregar proprietários';
      setError(`Erro ao carregar proprietários: ${errorMessage}`);
      setProprietarios([]); // Limpar dados em caso de erro
      return [];
    } finally {
      setLoadingProprietarios(false);
    }
  }, []);

  // ============================================================================
  // PLANTAS - DINÂMICO POR PROPRIETÁRIO
  // ============================================================================
  const fetchPlantas = useCallback(async (proprietarioId?: string): Promise<PlantaSelection[]> => {
    console.log('🚀 [HOOK] Iniciando fetchPlantas para proprietário:', proprietarioId);
    
    // Se não tem proprietário, limpar plantas
    if (!proprietarioId || proprietarioId === 'all') {
      console.log('📝 [HOOK] Limpando plantas (nenhum proprietário selecionado)');
      setPlantas([]);
      return [];
    }

    try {
      setLoadingPlantas(true);
      setError(null);
      
      const data = await selectionDataService.getPlantas(proprietarioId);
      console.log(`✅ [HOOK] ${data.length} plantas carregadas para proprietário ${proprietarioId}`);
      
      setPlantas(data);
      return data;
    } catch (error: any) {
      console.error('❌ [HOOK] Erro ao carregar plantas:', error);
      const errorMessage = error.message || 'Erro ao carregar plantas';
      setError(`Erro ao carregar plantas: ${errorMessage}`);
      setPlantas([]); // Limpar dados em caso de erro
      return [];
    } finally {
      setLoadingPlantas(false);
    }
  }, []);

  // ============================================================================
  // HIERARQUIA
  // ============================================================================
  const fetchHierarquiaNivel = useCallback(async (nivel: string, parentId?: string): Promise<any[]> => {
    try {
      setLoadingHierarquia(true);
      setError(null);
      return await selectionDataService.getHierarquiaNivel(nivel, parentId);
    } catch (error: any) {
      console.error(`❌ [HOOK] Erro ao carregar ${nivel}:`, error);
      const errorMessage = error.message || `Erro ao carregar ${nivel}`;
      setError(`Erro ao carregar ${nivel}: ${errorMessage}`);
      return [];
    } finally {
      setLoadingHierarquia(false);
    }
  }, []);

  // ============================================================================
  // TIPOS DE EQUIPAMENTOS
  // ============================================================================
  const fetchTiposEquipamentos = useCallback(async (): Promise<TipoEquipamento[]> => {
    console.log('🚀 [HOOK] Iniciando fetchTiposEquipamentos...');
    try {
      setLoadingTipos(true);
      setError(null);
      
      const data = await selectionDataService.getTiposEquipamentos();
      console.log(`✅ [HOOK] ${data.length} tipos de equipamentos carregados`);
      
      setTiposEquipamentos(data);
      return data;
    } catch (error: any) {
      console.error('❌ [HOOK] Erro ao carregar tipos de equipamentos:', error);
      const errorMessage = error.message || 'Erro ao carregar tipos de equipamentos';
      setError(`Erro ao carregar tipos: ${errorMessage}`);
      setTiposEquipamentos([]); // Limpar dados em caso de erro
      return [];
    } finally {
      setLoadingTipos(false);
    }
  }, []);

  // ============================================================================
  // EQUIPAMENTOS UC
  // ============================================================================
  const fetchEquipamentosUC = useCallback(async (plantaId?: string): Promise<SelectionOption[]> => {
    try {
      setLoadingUCs(true);
      setError(null);
      
      const data = await selectionDataService.getEquipamentosUCDisponiveis(plantaId);
      setEquipamentosUC(data);
      return data;
    } catch (error: any) {
      console.error('❌ [HOOK] Erro ao carregar equipamentos UC:', error);
      const errorMessage = error.message || 'Erro ao carregar equipamentos UC';
      setError(`Erro ao carregar equipamentos UC: ${errorMessage}`);
      setEquipamentosUC([]);
      return [];
    } finally {
      setLoadingUCs(false);
    }
  }, []);

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================
  const getProprietarioById = useCallback((id: string): ProprietarioSelection | null => {
    return proprietarios.find(p => p.id === id) || null;
  }, [proprietarios]);

  const getPlantaById = useCallback((id: string): PlantaSelection | null => {
    return plantas.find(p => p.id === id) || null;
  }, [plantas]);

  const getTipoEquipamentoById = useCallback((id: string): TipoEquipamento | null => {
    return tiposEquipamentos.find(t => t.value === id) || null;
  }, [tiposEquipamentos]);

  const getCamposTecnicosPorTipo = useCallback((tipo: string) => {
    const tipoEquipamento = getTipoEquipamentoById(tipo);
    const campos = tipoEquipamento?.campos_tecnicos || [];
    console.log(`📋 [HOOK] Campos técnicos para tipo "${tipo}":`, campos.length);
    return campos;
  }, [getTipoEquipamentoById]);

  // Função para limpar erro
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================================================
  // EFEITOS DE INICIALIZAÇÃO - CARREGAMENTO INTELIGENTE
  // ============================================================================
  useEffect(() => {
    console.log('🔄 [HOOK] useSelectionData - Efeito de inicialização');
    
    const loadInitialData = async () => {
      console.log('📊 [HOOK] Iniciando carregamento de dados básicos...');
      
      // Carregar dados básicos em paralelo (menos críticos)
      await Promise.all([
        fetchTiposEquipamentos(),
        // Proprietários são carregados por demanda quando o modal abre
      ]);
      
      console.log('✅ [HOOK] Carregamento inicial concluído');
    };
    
    loadInitialData();
  }, []); // Dependências vazias para executar apenas uma vez

  // Debug dos estados importantes
  useEffect(() => {
    console.log('📊 [HOOK] Estados atuais:');
    console.log('- Proprietários:', { loading: loadingProprietarios, count: proprietarios.length });
    console.log('- Plantas:', { loading: loadingPlantas, count: plantas.length });
    console.log('- Tipos:', { loading: loadingTipos, count: tiposEquipamentos.length });
    console.log('- Erro:', error);
  }, [loadingProprietarios, proprietarios.length, loadingPlantas, plantas.length, loadingTipos, tiposEquipamentos.length, error]);

  // ============================================================================
  // EFEITO PARA CARREGAR PROPRIETÁRIOS QUANDO NECESSÁRIO
  // ============================================================================
  useEffect(() => {
    // Carregar proprietários apenas se ainda não foram carregados
    if (proprietarios.length === 0 && !loadingProprietarios) {
      console.log('📝 [HOOK] Proprietários não carregados, iniciando carregamento...');
      fetchProprietarios();
    }
  }, [proprietarios.length, loadingProprietarios, fetchProprietarios]);

  return {
    // Estados de loading
    loadingProprietarios,
    loadingPlantas,
    loadingHierarquia,
    loadingTipos,
    loadingUCs,
    
    // Dados
    proprietarios,
    plantas,
    tiposEquipamentos,
    equipamentosUC,
    
    // Funções
    fetchProprietarios,
    fetchPlantas,
    fetchHierarquiaNivel,
    fetchTiposEquipamentos,
    fetchEquipamentosUC,
    
    // Utilitários
    getProprietarioById,
    getPlantaById,
    getTipoEquipamentoById,
    getCamposTecnicosPorTipo,
    
    // Estados para o modal
    error,
    clearError
  };
}