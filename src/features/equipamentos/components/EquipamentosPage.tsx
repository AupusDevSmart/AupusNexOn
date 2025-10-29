// src/features/equipamentos/components/EquipamentosPage.tsx - CORRIGIDO
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wrench, ArrowLeft, AlertCircle } from 'lucide-react';
import { Equipamento, EquipamentosFilters } from '../types';
import { getEquipamentosTableColumns } from '../config/table-config';
import { createEquipamentosFilterConfig } from '../config/filter-config';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useEquipamentoFilters } from '../hooks/useEquipamentoFilters';

// Modais separados
import { EquipamentoUCModal } from './modals/EquipamentoUCModal';
import { ComponenteUARModal } from './modals/ComponenteUARModal';
import { GerenciarUARsModal } from './modals/GerenciarUARsModal';

const initialFilters: EquipamentosFilters = {
  search: '',
  proprietarioId: 'all',
  plantaId: 'all',
  unidadeId: 'all',
  classificacao: 'all',
  criticidade: 'all',
  page: 1,
  limit: 10
};

export function EquipamentosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Hook da API
  const {
    loading,
    error,
    equipamentos,
    totalPages,
    currentPage,
    total,
    createEquipamento,
    updateEquipamento,
    deleteEquipamento,
    fetchEquipamentos,
    fetchEquipamentosByPlanta,
    salvarComponentesUARLote,
    getEquipamento
  } = useEquipamentos();

  // Hook dos filtros dinâmicos
  const {
    loadingProprietarios,
    loadingPlantas,
    loadingUnidades,
    proprietarios,
    plantas,
    unidades,
    loadPlantasByProprietario,
    loadUnidadesByPlanta,
    error: filtersError,
    clearError: clearFiltersError
  } = useEquipamentoFilters();

  // Estados locais
  const [filters, setFilters] = useState<EquipamentosFilters>(initialFilters);
  const [plantaInfo, setPlantaInfo] = useState<{
    id: string;
    nome: string;
    localizacao: string;
  } | null>(null);

  // ============================================================================
  // ESTADOS DOS MODAIS SEPARADOS
  // ============================================================================
  const [modalUC, setModalUC] = useState({
    isOpen: false,
    mode: 'create' as 'create' | 'edit' | 'view',
    entity: null as Equipamento | null
  });

  const [modalUAR, setModalUAR] = useState({
    isOpen: false,
    mode: 'create' as 'create' | 'edit' | 'view',
    entity: null as Equipamento | null,
    equipamentoPai: null as Equipamento | null
  });

  const [modalGerenciarUARs, setModalGerenciarUARs] = useState({
    isOpen: false,
    equipamentoUC: null as Equipamento | null
  });

  // ============================================================================
  // CARREGAR DADOS INICIAIS
  // ============================================================================
  const loadEquipamentos = useCallback(async (currentFilters: EquipamentosFilters) => {
    const urlParams = new URLSearchParams(location.search);
    const plantaId = urlParams.get('plantaId');
    const plantaNome = urlParams.get('plantaNome');

    if (plantaId && plantaNome) {
      // Carregar equipamentos de uma planta específica
      const result = await fetchEquipamentosByPlanta(plantaId, currentFilters); // PLANTAID JÁ É STRING
      setPlantaInfo(result.planta);
    } else {
      // Carregar todos os equipamentos
      await fetchEquipamentos(currentFilters);
      setPlantaInfo(null);
    }
  }, [location.search, fetchEquipamentos, fetchEquipamentosByPlanta]);

  // Carregar dados quando filtros mudam
  useEffect(() => {
    loadEquipamentos(filters);
  }, [filters, loadEquipamentos]);

  // Aplicar filtros da URL quando a página carrega
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const plantaId = urlParams.get('plantaId');

    if (plantaId) {
      setFilters(prev => ({
        ...prev,
        plantaId: plantaId, // MANTÉM COMO STRING
        page: 1
      }));
    }
  }, [location.search]);

  // ============================================================================
  // HANDLERS DOS FILTROS E PAGINAÇÃO
  // ============================================================================
  const handleFilterChange = useCallback(async (newFilters: Partial<EquipamentosFilters>) => {
    // Se o proprietário mudou, carregar plantas correspondentes
    if (newFilters.proprietarioId !== undefined && newFilters.proprietarioId !== filters.proprietarioId) {
      console.log('🔄 [EQUIPAMENTOS] Proprietário mudou, carregando plantas...');

      // Limpar erro anterior
      if (filtersError) clearFiltersError();

      // Carregar plantas do proprietário selecionado
      try {
        await loadPlantasByProprietario(newFilters.proprietarioId);

        // Se mudou proprietário, resetar planta e unidade selecionadas
        setFilters(prev => ({
          ...prev,
          ...newFilters,
          plantaId: 'all', // Reset planta quando proprietário muda
          unidadeId: 'all', // Reset unidade quando proprietário muda
          page: 1 // Reset página quando filtros mudam
        }));
      } catch (error) {
        console.error('❌ [EQUIPAMENTOS] Erro ao carregar plantas:', error);

        // Mesmo com erro, atualizar filtros
        setFilters(prev => ({
          ...prev,
          ...newFilters,
          plantaId: 'all',
          unidadeId: 'all',
          page: 1
        }));
      }
    }
    // Se a planta mudou, carregar unidades correspondentes
    else if (newFilters.plantaId !== undefined && newFilters.plantaId !== filters.plantaId) {
      console.log('🔄 [EQUIPAMENTOS] Planta mudou, carregando unidades...');

      // Limpar erro anterior
      if (filtersError) clearFiltersError();

      // Carregar unidades da planta selecionada
      try {
        await loadUnidadesByPlanta(newFilters.plantaId);

        // Se mudou planta, resetar unidade selecionada
        setFilters(prev => ({
          ...prev,
          ...newFilters,
          unidadeId: 'all', // Reset unidade quando planta muda
          page: 1 // Reset página quando filtros mudam
        }));
      } catch (error) {
        console.error('❌ [EQUIPAMENTOS] Erro ao carregar unidades:', error);

        // Mesmo com erro, atualizar filtros
        setFilters(prev => ({
          ...prev,
          ...newFilters,
          unidadeId: 'all',
          page: 1
        }));
      }
    } else {
      // Para outros filtros, apenas atualizar normalmente
      setFilters(prev => ({
        ...prev,
        ...newFilters,
        page: 1 // Reset página quando filtros mudam
      }));
    }
  }, [filters.proprietarioId, filters.plantaId, filtersError, clearFiltersError, loadPlantasByProprietario, loadUnidadesByPlanta]);

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // ============================================================================
  // HANDLERS DOS MODAIS UC
  // ============================================================================
  const openUCModal = (mode: 'create' | 'edit' | 'view', entity: Equipamento | null = null) => {
    if (mode === 'create') {
      const urlParams = new URLSearchParams(location.search);
      const plantaId = urlParams.get('plantaId');
      
      const initialData = plantaId ? { plantaId } : {}; // MANTÉM COMO STRING
      setModalUC({ isOpen: true, mode, entity: initialData as Equipamento });
    } else {
      setModalUC({ isOpen: true, mode, entity });
    }
  };

  const closeUCModal = () => {
    setModalUC({ isOpen: false, mode: 'create', entity: null });
  };

  const handleSubmitUC = async (data: any) => {
    try {
      console.log('💾 [EQUIPAMENTOS PAGE] handleSubmitUC chamado');
      console.log('💾 [EQUIPAMENTOS PAGE] Mode:', modalUC.mode);
      console.log('💾 [EQUIPAMENTOS PAGE] Entity:', modalUC.entity);
      console.log('💾 [EQUIPAMENTOS PAGE] Data a ser enviado:', data);

      if (modalUC.mode === 'create') {
        await createEquipamento(data);
        console.log('✅ [EQUIPAMENTOS PAGE] Equipamento UC criado com sucesso');
      } else if (modalUC.mode === 'edit' && modalUC.entity) {
        console.log('🔄 [EQUIPAMENTOS PAGE] Iniciando update com ID:', modalUC.entity.id);
        await updateEquipamento(modalUC.entity.id, data);
        console.log('✅ [EQUIPAMENTOS PAGE] Equipamento UC atualizado com sucesso');
      }

      // Recarregar dados após salvar
      await loadEquipamentos(filters);

      closeUCModal();

    } catch (error) {
      console.error('❌ [EQUIPAMENTOS PAGE] Erro ao salvar equipamento UC:', error);
      alert(`Erro ao salvar equipamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // ============================================================================
  // HANDLERS DOS MODAIS UAR
  // ============================================================================
  const openUARModal = (mode: 'create' | 'edit' | 'view', entity: Equipamento | null = null, equipamentoPai: Equipamento | null = null) => {
    setModalUAR({ isOpen: true, mode, entity, equipamentoPai });
  };

  const closeUARModal = () => {
    setModalUAR({ isOpen: false, mode: 'create', entity: null, equipamentoPai: null });
  };

  const handleSubmitUAR = async (data: any) => {
    try {
      if (modalUAR.mode === 'create') {
        await createEquipamento(data);
        console.log('Componente UAR criado com sucesso');
      } else if (modalUAR.mode === 'edit' && modalUAR.entity) {
        await updateEquipamento(modalUAR.entity.id, data); // USA ID STRING DIRETAMENTE
        console.log('Componente UAR atualizado com sucesso');
      }
      
      closeUARModal();
      
    } catch (error) {
      console.error('Erro ao salvar componente UAR:', error);
    }
  };

  // ============================================================================
  // HANDLERS PARA GESTÃO DE COMPONENTES
  // ============================================================================
  const handleGerenciarComponentes = async (equipamento: Equipamento) => {
    if (equipamento.classificacao !== 'UC') {
      alert('Apenas equipamentos UC podem ter componentes UAR!');
      return;
    }

    setModalGerenciarUARs({
      isOpen: true,
      equipamentoUC: equipamento
    });
  };

  const closeGerenciarUARsModal = () => {
    setModalGerenciarUARs({
      isOpen: false,
      equipamentoUC: null
    });
  };

  const handleSalvarUARs = async (uars: Equipamento[]) => {
    try {
      if (!modalGerenciarUARs.equipamentoUC) return;

      const ucId = modalGerenciarUARs.equipamentoUC.id; // USA ID STRING DIRETAMENTE
      const result = await salvarComponentesUARLote(ucId, uars);
      
      console.log(result.message);
      alert(`${result.componentes.length} componente(s) UAR salvos com sucesso!`);
      
      // Recarregar dados para mostrar os componentes atualizados
      await loadEquipamentos(filters);
      
    } catch (error) {
      console.error('Erro ao salvar UARs:', error);
      alert('Erro ao salvar componentes. Tente novamente.');
    }
  };

  // ============================================================================
  // HANDLERS GERAIS DA TABELA
  // ============================================================================
  const handleView = (equipamento: Equipamento) => {
    if (equipamento.classificacao === 'UC') {
      openUCModal('view', equipamento);
    } else {
      // CORRIGIDO: converter equipamentoPai para Equipamento completo
      const equipamentoPaiCompleto = equipamento.equipamentoPai ? {
        ...equipamento.equipamentoPai,
        // Preencher campos obrigatórios que podem estar faltando
        nome: equipamento.equipamentoPai.nome,
        classificacao: 'UC' as const,
        criticidade: equipamento.equipamentoPai.criticidade,
        criadoEm: equipamento.equipamentoPai.criadoEm,
        totalComponentes: 0
      } as Equipamento : null;
      
      openUARModal('view', equipamento, equipamentoPaiCompleto);
    }
  };

  const handleEdit = (equipamento: Equipamento) => {
    if (equipamento.classificacao === 'UC') {
      openUCModal('edit', equipamento);
    } else {
      // CORRIGIDO: converter equipamentoPai para Equipamento completo
      const equipamentoPaiCompleto = equipamento.equipamentoPai ? {
        ...equipamento.equipamentoPai,
        nome: equipamento.equipamentoPai.nome,
        classificacao: 'UC' as const,
        criticidade: equipamento.equipamentoPai.criticidade,
        criadoEm: equipamento.equipamentoPai.criadoEm,
        totalComponentes: 0
      } as Equipamento : null;
      
      openUARModal('edit', equipamento, equipamentoPaiCompleto);
    }
  };

  const handleDelete = async (equipamento: Equipamento) => {
    if (!confirm(`Tem certeza que deseja remover ${equipamento.nome}?`)) {
      return;
    }

    try {
      await deleteEquipamento(equipamento.id); // USA ID STRING DIRETAMENTE
      console.log('Equipamento removido com sucesso');
    } catch (error) {
      console.error('Erro ao remover equipamento:', error);
      alert('Erro ao remover equipamento. Verifique se não há componentes vinculados.');
    }
  };

  // ============================================================================
  // NAVEGAÇÃO
  // ============================================================================
  const handleBackToPlantas = () => {
    navigate('/plantas');
  };

  const handleClearPlantaFilter = () => {
    navigate('/equipamentos');
    setFilters(initialFilters);
  };

  // ============================================================================
  // PREPARAR COLUNAS DA TABELA
  // ============================================================================
  const tableColumns = getEquipamentosTableColumns({
    onGerenciarComponentes: handleGerenciarComponentes
  });

  // Preparar dados de paginação
  const pagination = {
    page: currentPage,
    limit: filters.limit || 10,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1
  };

  const testarErro = () => {
  console.log('Estado de erro atual:', error);
  // Para forçar um erro e testar se o Alert aparece, você pode:
  createEquipamento({ nome: '' }); // Isso vai gerar erro e deve mostrar o Alert
};

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-97 w-full mb-8">
          {/* Alerta de erro */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Header com informações do filtro de planta */}
          {plantaInfo ? (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToPlantas}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar às Plantas
                </Button>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-950 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-green-600" />
                    <div>
                      <h2 className="font-semibold text-green-900 dark:text-green-100">
                        Equipamentos de {plantaInfo.nome}
                      </h2>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Visualizando {equipamentos.length} {equipamentos.length === 1 ? 'equipamento' : 'equipamentos'} desta planta
                        {plantaInfo.localizacao && ` • ${plantaInfo.localizacao}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearPlantaFilter}
                    className="border-green-200 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-800"
                  >
                    Ver Todos os Equipamentos
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <TitleCard
              title="Equipamentos"
              description="Gerencie equipamentos (UC) e seus componentes (UAR)"
            />
          )}
          
          <div className="flex flex-col gap-4 mb-6">
            {/* Erro dos filtros */}
            {filtersError && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {filtersError} - Os dados podem estar desatualizados.
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-orange-600 underline ml-2"
                    onClick={clearFiltersError}
                  >
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Filtros - CORRIGIDO: removido prop loading */}
            <div className="w-full">
              <BaseFilters
                filters={filters}
                config={createEquipamentosFilterConfig(
                  proprietarios,
                  plantas,
                  loadingProprietarios,
                  loadingPlantas,
                  unidades,
                  loadingUnidades
                )}
                onFilterChange={handleFilterChange}
              />
            </div>
            
            {/* Botões de Ação - responsivos */}
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button 
                onClick={() => openUCModal('create')}
                className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
                disabled={loading}
              >
                <Wrench className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Novo Equipamento UC</span>
                <span className="sm:hidden">Novo UC</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <BaseTable
              data={equipamentos}
              columns={tableColumns}
              pagination={pagination}
              loading={loading}
              onPageChange={handlePageChange}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              emptyMessage={
                plantaInfo 
                  ? `Nenhum equipamento encontrado para ${plantaInfo.nome}.`
                  : "Nenhum equipamento encontrado."
              }
              emptyIcon={<Wrench className="h-8 w-8 text-muted-foreground/50" />}
            />
          </div>
        </div>

        {/* ============================================================================ */}
        {/* MODAIS SEPARADOS PARA UC E UAR */}
        {/* ============================================================================ */}
        
        {/* Modal para Equipamentos UC */}
        <EquipamentoUCModal
          isOpen={modalUC.isOpen}
          mode={modalUC.mode}
          entity={modalUC.entity}
          onClose={closeUCModal}
          onSubmit={handleSubmitUC}
        />

        {/* Modal para Componentes UAR */}
        <ComponenteUARModal
          isOpen={modalUAR.isOpen}
          mode={modalUAR.mode}
          entity={modalUAR.entity}
          equipamentoPai={modalUAR.equipamentoPai}
          onClose={closeUARModal}
          onSubmit={handleSubmitUAR}
        />

        {/* Modal para Gerenciar UARs de uma UC */}
        <GerenciarUARsModal
          isOpen={modalGerenciarUARs.isOpen}
          equipamentoUC={modalGerenciarUARs.equipamentoUC}
          onClose={closeGerenciarUARsModal}
          onSave={handleSalvarUARs}
        />
      </Layout.Main>
    </Layout>
  );
}