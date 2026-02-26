// src/features/equipamentos/components/EquipamentosPage.tsx - CORRIGIDO
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Wrench, ArrowLeft, AlertCircle } from 'lucide-react';
import { Equipamento, EquipamentosFilters } from '../types';
import { getEquipamentosTableColumns } from '../config/table-config';
import { createEquipamentosFilterConfig } from '../config/filter-config';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useEquipamentoFilters } from '../hooks/useEquipamentoFilters';
import { useUserStore } from '@/store/useUserStore';

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
  const { isAdmin } = useUserStore();

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
    loadUnidadesByProprietario,
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
  const [unidadeInfo, setUnidadeInfo] = useState<{
    id: string;
    nome: string;
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

  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    equipamento: null as Equipamento | null
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
    const unidadeId = urlParams.get('unidadeId');
    const unidadeNome = urlParams.get('unidadeNome');

    const urlFilters: Partial<EquipamentosFilters> = {};

    if (plantaId) {
      urlFilters.plantaId = plantaId;
    }

    if (unidadeId) {
      urlFilters.unidadeId = unidadeId;
      // Atualizar unidadeInfo se tiver o nome na URL
      if (unidadeNome) {
        setUnidadeInfo({
          id: unidadeId,
          nome: decodeURIComponent(unidadeNome)
        });
      }
    }

    if (Object.keys(urlFilters).length > 0) {
      console.log(`🔗 [EQUIPAMENTOS PAGE] Filtros da URL:`, urlFilters);
      setFilters(prev => ({
        ...prev,
        ...urlFilters,
        page: 1
      }));
    }
  }, [location.search]);

  // ============================================================================
  // HANDLERS DOS FILTROS E PAGINAÇÃO
  // ============================================================================
  const handleFilterChange = useCallback(async (newFilters: Partial<EquipamentosFilters>) => {
    // Se o proprietário mudou, carregar plantas e unidades correspondentes
    if (newFilters.proprietarioId !== undefined && newFilters.proprietarioId !== filters.proprietarioId) {
      console.log('🔄 [EQUIPAMENTOS] Proprietário mudou, carregando plantas e unidades...');

      // Limpar erro anterior
      if (filtersError) clearFiltersError();

      // Carregar plantas e unidades do proprietário selecionado em paralelo
      try {
        await Promise.all([
          loadPlantasByProprietario(newFilters.proprietarioId),
          loadUnidadesByProprietario(newFilters.proprietarioId)
        ]);

        // Se mudou proprietário, resetar planta (mas não unidade, já que foram carregadas)
        setFilters(prev => ({
          ...prev,
          ...newFilters,
          plantaId: 'all', // Reset planta quando proprietário muda
          unidadeId: 'all', // Reset unidade quando proprietário muda
          page: 1 // Reset página quando filtros mudam
        }));
      } catch (error) {
        console.error('❌ [EQUIPAMENTOS] Erro ao carregar plantas/unidades:', error);

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
  }, [filters.proprietarioId, filters.plantaId, filtersError, clearFiltersError, loadPlantasByProprietario, loadUnidadesByPlanta, loadUnidadesByProprietario]);

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

  const handleDelete = (equipamento: Equipamento) => {
    setDeleteDialog({
      isOpen: true,
      equipamento
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.equipamento) return;

    try {
      await deleteEquipamento(deleteDialog.equipamento.id);

      toast.success('Equipamento removido!', {
        description: `${deleteDialog.equipamento.nome} foi removido com sucesso.`,
        duration: 4000,
      });

      // Recarregar dados
      await loadEquipamentos(filters);

    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Erro desconhecido ao remover equipamento';

      toast.error('Erro ao remover equipamento', {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setDeleteDialog({ isOpen: false, equipamento: null });
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
    onGerenciarComponentes: handleGerenciarComponentes,
    isAdmin: isAdmin()
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
            <Alert variant="destructive" className="mb-4 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Header com informações do filtro de planta ou unidade */}
          {(plantaInfo || unidadeInfo) ? (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(unidadeInfo ? '/cadastros/unidades' : '/cadastros/plantas')}
                  className="text-muted-foreground hover:text-foreground h-8"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  {unidadeInfo ? 'Voltar às Unidades' : 'Voltar às Plantas'}
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-950 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-blue-600" />
                    <div>
                      <h2 className="font-semibold text-blue-900 dark:text-blue-100">
                        {unidadeInfo ? `Equipamentos de ${unidadeInfo.nome}` : `Equipamentos de ${plantaInfo?.nome}`}
                      </h2>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Visualizando {equipamentos.length} {equipamentos.length === 1 ? 'equipamento' : 'equipamentos'}
                        {plantaInfo?.localizacao && !unidadeInfo && ` • ${plantaInfo.localizacao}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearPlantaFilter}
                    className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-800"
                  >
                    Ver Todos
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
              <Alert className="rounded-md border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                  {filtersError} - Os dados podem estar desatualizados.
                  <Button
                    variant="link"
                    className="p-0 h-auto text-amber-600 dark:text-amber-400 underline ml-2"
                    onClick={clearFiltersError}
                  >
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Filtros e Botões */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-start">
              {/* Filtros */}
              <div className="flex-1">
                <BaseFilters
                  filters={filters}
                  config={createEquipamentosFilterConfig(
                    proprietarios,
                    plantas,
                    loadingProprietarios,
                    loadingPlantas,
                    unidades,
                    loadingUnidades,
                    isAdmin() // Mostrar filtro de proprietário apenas para admins
                  )}
                  onFilterChange={handleFilterChange}
                />
              </div>

              {/* Botões de Ação */}
              {isAdmin() && (
                <button
                  onClick={() => openUCModal('create')}
                  className="btn-minimal-primary w-full lg:w-auto whitespace-nowrap"
                  disabled={loading}
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  <span>Novo Equipamento UC</span>
                </button>
              )}
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
              onEdit={isAdmin() ? handleEdit : undefined}
              onDelete={isAdmin() ? handleDelete : undefined}
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
          onDelete={handleDelete}
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

        {/* AlertDialog para confirmação de exclusão */}
        <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, equipamento: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o equipamento <strong>{deleteDialog.equipamento?.nome}</strong>?
                {deleteDialog.equipamento?.classificacao === 'UC' && deleteDialog.equipamento?.totalComponentes > 0 && (
                  <>
                    <br /><br />
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Este equipamento possui {deleteDialog.equipamento.totalComponentes} componente(s) UAR vinculado(s).
                      Eles também serão removidos.
                    </span>
                  </>
                )}
                <br /><br />
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout.Main>
    </Layout>
  );
}