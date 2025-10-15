// src/features/plantas/components/PlantasPage.tsx - VERSÃO ATUALIZADA
import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { BaseModal } from '@/components/common/base-modal/BaseModal';
import { Button } from '@/components/ui/button';
import { Plus, Factory, ArrowLeft, RefreshCw, Filter } from 'lucide-react';
import { useGenericModal } from '@/hooks/useGenericModal';
import { toast } from '@/hooks/use-toast';
import { PlantasFilters } from '../types';
import { plantasTableColumns } from '../config/table-config';
import { useProprietarios, createPlantasFilterConfig } from '../config/filter-config';
import { plantasFormFields } from '../config/form-config';
import {
  PlantasService,
  CreatePlantaRequest,
  UpdatePlantaRequest,
  PlantaResponse,
  FindAllPlantasParams
} from '@/services/plantas.services';
import { CNPJUtils } from '@/components/ui/cnpj-input';

const initialFilters: PlantasFilters = {
  search: '',
  proprietarioId: 'all',
  page: 1,
  limit: 10
};

// ✅ HELPER: Transformar dados do formulário para API
const transformFormDataToAPI = (data: any) => {
  console.log('🔄 [PLANTAS PAGE] Transformando dados do formulário:', data);

  // Validar CNPJ
  const cnpjFormatted = CNPJUtils.mask(data.cnpj || '');
  const cnpjClean = CNPJUtils.unmask(data.cnpj || '');

  // Validar endereço
  const endereco = data.endereco || {};

  const transformedData = {
    nome: (data.nome || '').trim(),
    cnpj: cnpjFormatted, // Enviar formatado como a API espera
    proprietarioId: data.proprietarioId,
    horarioFuncionamento: (data.horarioFuncionamento || '').trim(),
    localizacao: (data.localizacao || '').trim(),
    endereco: {
      logradouro: (endereco.logradouro || '').trim(),
      bairro: (endereco.bairro || '').trim(),
      cidade: (endereco.cidade || '').trim(),
      uf: (endereco.uf || '').trim(),
      cep: (endereco.cep || '').trim(),
    }
  };

  console.log('✅ [PLANTAS PAGE] Dados transformados:', transformedData);
  return transformedData;
};

export function PlantasPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estados locais
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plantas, setPlantas] = useState<PlantaResponse[]>([]);
  const [totalPlantas, setTotalPlantas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PlantasFilters>(initialFilters);

  // Hook para proprietários
  const { proprietarios, loading: loadingProprietarios, error: proprietariosError } = useProprietarios();

  // ✅ CONFIGURAÇÃO DINÂMICA: Filtros que se atualizam quando proprietários carregam
  const filterConfig = useMemo(() => {
    if (loadingProprietarios || proprietariosError) {
      return [
        {
          key: 'search',
          type: 'search' as const,
          placeholder: 'Buscar por nome, CNPJ ou localização...',
          className: 'lg:min-w-80'
        },
        {
          key: 'proprietarioId',
          type: 'select' as const,
          label: 'Proprietário',
          className: 'min-w-64',
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
  }, [proprietarios, loadingProprietarios, proprietariosError]);

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

  // ✅ HANDLER: Visualizar planta
  const handleView = async (planta: PlantaResponse) => {
    console.log('👁️ [PLANTAS PAGE] Visualizando planta:', planta.id);
    const detailedPlanta = await fetchPlantaDetails(planta.id);
    if (detailedPlanta) {
      openModal('view', detailedPlanta);
    }
  };

  // ✅ HANDLER: Editar planta
  const handleEdit = async (planta: PlantaResponse) => {
    console.log('✏️ [PLANTAS PAGE] Editando planta:', planta.id);
    const detailedPlanta = await fetchPlantaDetails(planta.id);
    if (detailedPlanta) {
      openModal('edit', detailedPlanta);
    }
  };

  // ✅ HANDLER: Submissão do formulário (Create e Update)
  const handleSubmit = async (data: any) => {
    console.log('💾 [PLANTAS PAGE] Dados recebidos do formulário:', data);
    setIsSubmitting(true);

    try {
      // ✅ Transformar dados antes de enviar
      const transformedData = transformFormDataToAPI(data);

      if (modalState.mode === 'create') {
        const requestData: CreatePlantaRequest = transformedData;
        const novaPlanta = await PlantasService.createPlanta(requestData);

        toast({
          title: "Planta cadastrada!",
          description: `A planta "${novaPlanta.nome}" foi cadastrada com sucesso.`,
          variant: "default",
        });

      } else if (modalState.mode === 'edit' && modalState.entity) {
        const updateData: UpdatePlantaRequest = transformedData;
        const plantaAtualizada = await PlantasService.updatePlanta(modalState.entity.id, updateData);

        toast({
          title: "Planta atualizada!",
          description: `A planta "${plantaAtualizada.nome}" foi atualizada com sucesso.`,
          variant: "default",
        });
      }

      await fetchPlantas(filters);
      closeModal();

    } catch (error: any) {
      console.error('❌ [PLANTAS PAGE] Erro ao salvar planta:', error);
      
      toast({
        title: modalState.mode === 'create' ? "Erro ao cadastrar planta" : "Erro ao atualizar planta",
        description: error.message || "Ocorreu um erro interno. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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

  // ✅ HANDLERS: Modal
  const getModalTitle = () => {
    const titles = {
      create: 'Nova Planta',
      edit: 'Editar Planta', 
      view: 'Visualizar Planta'
    };
    return titles[modalState.mode as keyof typeof titles] || 'Planta';
  };

  const getModalIcon = () => {
    return <Factory className="h-5 w-5 text-blue-600" />;
  };

  const getModalEntity = () => {
    const entity = modalState.entity;
    
    if (modalState.mode === 'create') {
      return {
        id: null,
        proprietarioId: filters.proprietarioId !== 'all' ? filters.proprietarioId : null
      };
    }
    
    return entity;
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
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <BaseFilters 
                filters={filters}
                config={filterConfig}
                onFilterChange={handleFilterChange}
              />
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Button 
                variant="outline"
                onClick={handleRefresh}
                disabled={loading}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              <Button 
                onClick={() => openModal('create')}
                className="bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Planta
              </Button>
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
              onEdit={handleEdit}
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

        {/* ✅ Modal integrado */}
        <BaseModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          entity={getModalEntity()}
          title={getModalTitle()}
          icon={getModalIcon()}
          formFields={plantasFormFields}
          onClose={closeModal}
          onSubmit={handleSubmit}
          width="w-[600px]"
          
          loading={isSubmitting}
          loadingText={modalState.mode === 'create' ? "Cadastrando planta..." : "Salvando alterações..."}
          
          closeOnBackdropClick={!isSubmitting}
          closeOnEscape={true}
          submitButtonText={modalState.mode === 'create' ? "Cadastrar Planta" : "Salvar Alterações"}
        />
      </Layout.Main>
    </Layout>
  );
}