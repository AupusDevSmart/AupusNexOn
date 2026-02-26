// src/features/plantas/components/PlantasPage.tsx - VERSÃO ATUALIZADA
import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { PlantaModal } from './planta-modal';
import { Button } from '@/components/ui/button';
import { Plus, Factory, ArrowLeft, RefreshCw, Filter } from 'lucide-react';
import { useGenericModal } from '@/hooks/useGenericModal';
import { toast } from '@/hooks/use-toast';
import { PlantasFilters } from '../types';
import { plantasTableColumns } from '../config/table-config';
import { useProprietarios, createPlantasFilterConfig } from '../config/filter-config';
import {
  PlantasService,
  PlantaResponse,
  FindAllPlantasParams
} from '@/services/plantas.services';
import { useUserStore } from '@/store/useUserStore';

const initialFilters: PlantasFilters = {
  search: '',
  proprietarioId: 'all',
  page: 1,
  limit: 10
};

export function PlantasPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useUserStore();

  // Estados locais
  const [plantas, setPlantas] = useState<PlantaResponse[]>([]);
  const [totalPlantas, setTotalPlantas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PlantasFilters>(initialFilters);

  // Hook para proprietários (só carrega se for admin)
  const { proprietarios, loading: loadingProprietarios, error: proprietariosError } = useProprietarios();

  // ✅ CONFIGURAÇÃO DINÂMICA: Filtros que se atualizam quando proprietários carregam
  const filterConfig = useMemo(() => {
    // Filtro de busca sempre disponível
    const searchFilter = {
      key: 'search',
      type: 'search' as const,
      placeholder: 'Buscar por nome, CNPJ ou localização...',
      className: 'lg:col-span-2'
    };

    // Se não for admin, mostrar apenas busca
    if (!isAdmin()) {
      return [searchFilter];
    }

    // Para admin, incluir filtro de proprietário
    if (loadingProprietarios || proprietariosError) {
      return [
        searchFilter,
        {
          key: 'proprietarioId',
          type: 'select' as const,
          label: 'Proprietário',
          options: [
            {
              value: 'all',
              label: loadingProprietarios ? 'Carregando proprietários...' : 'Erro ao carregar proprietários'
            }
          ]
        }
      ];
    }

    return createPlantasFilterConfig(proprietarios);
  }, [proprietarios, loadingProprietarios, proprietariosError, isAdmin]);

  // Modal state
  const {
    modalState,
    openModal,
    closeModal
  } = useGenericModal<PlantaResponse>();

  // ✅ FUNÇÃO: Buscar plantas da API
  const fetchPlantas = async (currentFilters: PlantasFilters) => {
    try {
      setLoading(true);
      
      const params: FindAllPlantasParams = {
        page: currentFilters.page,
        limit: currentFilters.limit,
        search: currentFilters.search || undefined,
        proprietarioId: currentFilters.proprietarioId !== 'all' ? currentFilters.proprietarioId : undefined,
        orderBy: 'nome',
        orderDirection: 'asc'
      };

      console.log('🔍 [PLANTAS PAGE] Buscando plantas com filtros:', params);

      const response = await PlantasService.getAllPlantas(params);
      
      setPlantas(response.data);
      setTotalPlantas(response.pagination.total);

      console.log('✅ [PLANTAS PAGE] Plantas carregadas:', {
        total: response.pagination.total,
        count: response.data.length,
        page: response.pagination.page
      });

    } catch (error: any) {
      console.error('❌ [PLANTAS PAGE] Erro ao carregar plantas:', error);
      toast({
        title: "Erro ao carregar plantas",
        description: error.message || "Não foi possível carregar a lista de plantas.",
        variant: "destructive",
      });
      setPlantas([]);
      setTotalPlantas(0);
    } finally {
      setLoading(false);
    }
  };

  // ✅ EFEITO: Aplicar filtros da URL quando a página carrega
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const proprietarioId = urlParams.get('proprietarioId');

    if (proprietarioId) {
      console.log(`🔗 [PLANTAS PAGE] Filtro da URL: proprietário ${proprietarioId}`);
      
      const newFilters = {
        ...initialFilters,
        proprietarioId: proprietarioId,
      };
      
      setFilters(newFilters);
      fetchPlantas(newFilters);
    } else {
      fetchPlantas(initialFilters);
    }
  }, [location.search]);

  // ✅ HANDLER: Mudança de filtros
  const handleFilterChange = (newFilters: Partial<PlantasFilters>) => {
    console.log('🔄 [PLANTAS PAGE] Filtros alterados:', newFilters);
    
    const updatedFilters = {
      ...filters,
      ...newFilters,
      page: newFilters.page || 1 // Reset página quando outros filtros mudarem
    };
    
    setFilters(updatedFilters);
    fetchPlantas(updatedFilters);
  };

  // ✅ HANDLER: Mudança de página
  const handlePageChange = (newPage: number) => {
    console.log('📄 [PLANTAS PAGE] Mudança de página:', newPage);
    handleFilterChange({ page: newPage });
  };

  // ✅ HANDLER: Refresh manual
  const handleRefresh = () => {
    console.log('🔄 [PLANTAS PAGE] Refresh manual');
    fetchPlantas(filters);
  };

  // ✅ FUNÇÃO: Informações do proprietário selecionado
  const getProprietarioInfo = () => {
    if (filters.proprietarioId === 'all' || !filters.proprietarioId) return null;
    
    // Tentar pegar o nome da URL primeiro
    const urlParams = new URLSearchParams(location.search);
    const proprietarioNome = urlParams.get('proprietarioNome');
    
    if (proprietarioNome) {
      return {
        id: filters.proprietarioId,
        nome: decodeURIComponent(proprietarioNome)
      };
    }
    
    // Se não tiver na URL, buscar nos proprietários carregados
    const proprietario = proprietarios.find(p => p.id === filters.proprietarioId);
    return proprietario ? { id: proprietario.id, nome: proprietario.nome } : null;
  };

  const proprietarioInfo = getProprietarioInfo();
  const filteredByProprietario = !!proprietarioInfo;

  // ✅ HANDLER: Buscar dados detalhados da planta para modal
  const fetchPlantaDetails = async (id: string): Promise<PlantaResponse | null> => {
    try {
      return await PlantasService.getPlanta(id);
    } catch (error: any) {
      console.error('❌ [PLANTAS PAGE] Erro ao buscar detalhes da planta:', error);
      toast({
        title: "Erro ao carregar planta",
        description: error.message || "Não foi possível carregar os detalhes da planta.",
        variant: "destructive",
      });
      return null;
    }
  };

  // ✅ HANDLER: Visualizar planta (otimista)
  const handleView = async (planta: PlantaResponse) => {
    console.log('👁️ [PLANTAS PAGE] Visualizando planta:', planta.id);
    // Abrir modal IMEDIATAMENTE com dados básicos
    openModal('view', planta);
    // Carregar detalhes em background
    try {
      const detailedPlanta = await fetchPlantaDetails(planta.id);
      if (detailedPlanta) {
        openModal('view', detailedPlanta);
      }
    } catch (error) {
      // Se falhar ao buscar detalhes, fechar modal
      closeModal();
    }
  };

  // ✅ HANDLER: Editar planta (otimista)
  const handleEdit = async (planta: PlantaResponse) => {
    console.log('✏️ [PLANTAS PAGE] Editando planta:', planta.id);
    // Abrir modal IMEDIATAMENTE com dados básicos
    openModal('edit', planta);
    // Carregar detalhes em background
    try {
      const detailedPlanta = await fetchPlantaDetails(planta.id);
      if (detailedPlanta) {
        openModal('edit', detailedPlanta);
      }
    } catch (error) {
      // Se falhar ao buscar detalhes, fechar modal
      closeModal();
    }
  };

  // ✅ HANDLER: Sucesso ao salvar planta
  const handleModalSuccess = () => {
    fetchPlantas(filters);
    closeModal();
  };

  // ✅ HANDLERS: Navegação
  const handleBackToUsuarios = () => {
    navigate('/usuarios');
  };

  const handleClearProprietarioFilter = () => {
    navigate('/plantas');
    handleFilterChange({
      proprietarioId: 'all',
      page: 1
    });
  };


  // ✅ CALCULAR PAGINAÇÃO
  const pagination = {
    page: filters.page || 1,
    limit: filters.limit || 10,
    total: totalPlantas,
    totalPages: Math.ceil(totalPlantas / (filters.limit || 10))
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          {/* ✅ Header com informações do filtro de proprietário */}
          {filteredByProprietario ? (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToUsuarios}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar aos Usuários
                </Button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-950 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Factory className="h-5 w-5 text-blue-600" />
                    <div>
                      <h2 className="font-semibold text-blue-900 dark:text-blue-100">
                        Plantas de {proprietarioInfo.nome}
                      </h2>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Visualizando {plantas.length} {plantas.length === 1 ? 'planta' : 'plantas'} deste proprietário
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearProprietarioFilter}
                    className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-800"
                  >
                    Ver Todas as Plantas
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <TitleCard
              title="Plantas"
              description="Gerencie as plantas cadastradas no sistema"
            />
          )}
          
          {/* ✅ Filtros e Ações */}
          <div className="flex flex-col lg:flex-row gap-3 mb-4 lg:items-start">
            {/* Filtros */}
            <div className="flex-1">
              <BaseFilters
                filters={filters}
                config={filterConfig}
                onFilterChange={handleFilterChange}
              />
            </div>

            {/* Botões */}
            <div className="flex flex-row gap-2 w-full lg:w-auto">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="btn-minimal-outline flex-1 lg:flex-none whitespace-nowrap"
              >
                <RefreshCw className={`h-4 w-4 lg:mr-2 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Atualizar</span>
              </button>

              {isAdmin() && (
                <button
                  onClick={() => openModal('create')}
                  className="btn-minimal-primary flex-1 lg:flex-none whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">Nova Planta</span>
                </button>
              )}
            </div>
          </div>

          {/* ✅ Indicador de filtros ativos */}
          {(filters.search || filters.proprietarioId !== 'all') && (
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>
                Filtros ativos: 
                {filters.search && ` busca por "${filters.search}"`}
                {filters.search && filters.proprietarioId !== 'all' && ', '}
                {filters.proprietarioId !== 'all' && proprietarioInfo && ` proprietário "${proprietarioInfo.nome}"`}
              </span>
            </div>
          )}

          {/* ✅ Status de carregamento dos proprietários */}
          {proprietariosError && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              ⚠️ Erro ao carregar proprietários para o filtro: {proprietariosError}
            </div>
          )}

          {/* ✅ Tabela */}
          <div className="flex-1 min-h-0">
            <BaseTable
              data={plantas}
              columns={plantasTableColumns}
              pagination={pagination}
              loading={loading}
              onPageChange={handlePageChange}
              onView={handleView}
              onEdit={isAdmin() ? handleEdit : undefined}
              emptyMessage={
                filteredByProprietario && proprietarioInfo
                  ? `Nenhuma planta encontrada para ${proprietarioInfo.nome}.`
                  : filters.search
                  ? `Nenhuma planta encontrada para "${filters.search}".`
                  : "Nenhuma planta encontrada."
              }
              emptyIcon={<Factory className="h-8 w-8 text-muted-foreground/50" />}
            />
          </div>
        </div>

        {/* ✅ Modal integrado com delete */}
        <PlantaModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          planta={modalState.entity}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
          proprietarioIdDefault={filters.proprietarioId !== 'all' ? filters.proprietarioId : undefined}
        />
      </Layout.Main>
    </Layout>
  );
}