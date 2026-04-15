// src/features/unidades/components/UnidadesPage.tsx

import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { UnidadeModal } from './unidade-modal';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { useGenericModal } from '@/hooks/useGenericModal';
import { toast } from '@/hooks/use-toast';
import { unidadesTableColumns } from '../config/table-config';
import { createUnidadesFilterConfig } from '../config/filter-config';
import { usePlantas } from '../hooks/usePlantas';
import { useProprietarios } from '../hooks/useProprietarios';
import {
  getAllUnidades,
  getUnidadeById,
} from '@/services/unidades.services';
import type {
  Unidade,
  UnidadeFilters,
} from '../types';
import { useUserStore } from '@/store/useUserStore';

const initialFilters: UnidadeFilters = {
  search: '',
  page: 1,
  limit: 10,
  orderBy: 'nome',
  orderDirection: 'asc',
};

export function UnidadesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useUserStore();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [totalUnidades, setTotalUnidades] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UnidadeFilters>(initialFilters);

  // Hook para plantas
  const { plantas, loading: loadingPlantas, error: plantasError } = usePlantas();

  // Hook para proprietários (busca TODOS os usuários com roles permitidas)
  const { proprietarios, loading: loadingProprietarios } = useProprietarios();

  // Modal state
  const {
    modalState,
    openModal,
    closeModal
  } = useGenericModal<Unidade>();

  // Configuração dinâmica de filtros
  const filterConfig = useMemo(() => {
    return createUnidadesFilterConfig(
      plantas,
      loadingPlantas,
      proprietarios,
      loadingProprietarios,
      isAdmin() // Mostrar filtro de proprietário apenas para admin/super_admin
    );
  }, [plantas, loadingPlantas, proprietarios, loadingProprietarios, isAdmin]);

  // Buscar unidades da API
  const fetchUnidades = async (currentFilters: UnidadeFilters) => {
    try {
      setLoading(true);

      // Limpar filtros com valor 'all' ou vazios antes de enviar
      const cleanFilters = Object.entries(currentFilters).reduce((acc, [key, value]) => {
        // Sempre incluir page e limit
        if (key === 'page' || key === 'limit') {
          acc[key as keyof UnidadeFilters] = value;
        }
        // Para outros filtros, excluir se for 'all', vazio ou null
        else if (value !== 'all' && value !== '' && value !== null && value !== undefined) {
          acc[key as keyof UnidadeFilters] = value;
        }
        return acc;
      }, {} as UnidadeFilters);

      console.log('🔍 [UNIDADES PAGE] Buscando unidades com filtros:', cleanFilters);

      const response = await getAllUnidades(cleanFilters);

      setUnidades(response.data);
      setTotalUnidades(response.pagination.total);

      console.log('✅ [UNIDADES PAGE] Unidades carregadas:', {
        total: response.pagination.total,
        count: response.data.length,
        page: response.pagination.page
      });

    } catch (error: any) {
      console.error('❌ [UNIDADES PAGE] Erro ao carregar unidades:', error);
      toast({
        title: "Erro ao carregar instalações",
        description: error.message || "Não foi possível carregar a lista de instalações.",
        variant: "destructive",
      });
      setUnidades([]);
      setTotalUnidades(0);
    } finally {
      setLoading(false);
    }
  };

  // Aplicar filtros da URL quando a página carrega (aguarda plantas carregarem para o combobox funcionar)
  useEffect(() => {
    if (loadingPlantas) return;

    const urlParams = new URLSearchParams(location.search);
    const plantaId = urlParams.get('plantaId')?.trim();

    if (plantaId) {
      console.log(`🔗 [UNIDADES PAGE] Filtro da URL: planta ${plantaId}`);

      const newFilters = {
        ...initialFilters,
        plantaId: plantaId,
      };

      setFilters(newFilters);
    }
  }, [location.search, loadingPlantas]);

  // Carregar unidades quando filtros mudarem
  useEffect(() => {
    fetchUnidades(filters);
  }, [filters]);

  // Handler: Mudança de filtros
  const handleFilterChange = (newFilters: Partial<UnidadeFilters>) => {
    console.log('🔄 [UNIDADES PAGE] Filtros alterados:', newFilters);
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset página ao mudar filtros
    }));
  };

  // Handler: Mudança de página
  const handlePageChange = (newPage: number) => {
    console.log('📄 [UNIDADES PAGE] Mudando para página:', newPage);
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // Handler: Sucesso ao salvar unidade
  const handleModalSuccess = () => {
    fetchUnidades(filters);
    closeModal();
  };

  // Handler: Abrir modal de edição
  const handleEdit = async (unidade: Unidade) => {
    // Abre modal IMEDIATAMENTE com dados básicos
    openModal('edit', unidade);

    try {
      console.log('📝 [UNIDADES PAGE] Carregando dados detalhados da unidade:', unidade.id);
      const detailedUnidade = await getUnidadeById(unidade.id);
      console.log('📦 [UNIDADES PAGE] Dados detalhados carregados:', detailedUnidade);
      console.log('🔑 [UNIDADES PAGE] plantaId:', detailedUnidade.plantaId);
      console.log('📍 [UNIDADES PAGE] Endereço:', {
        cep: detailedUnidade.cep,
        logradouro: detailedUnidade.logradouro,
        numero: detailedUnidade.numero,
        cidade: detailedUnidade.cidade,
        estado: detailedUnidade.estado
      });
      // Atualiza modal com dados completos
      openModal('edit', detailedUnidade);
    } catch (error: any) {
      console.error('❌ [UNIDADES PAGE] Erro ao carregar unidade:', error);
      closeModal(); // Fecha o modal em caso de erro
      toast({
        title: "Erro ao carregar instalação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handler: Visualizar unidade
  const handleView = async (unidade: Unidade) => {
    // Abre modal IMEDIATAMENTE com dados básicos
    openModal('view', unidade);

    try {
      console.log('👁️ [UNIDADES PAGE] Carregando dados detalhados da unidade:', unidade.id);
      const detailedUnidade = await getUnidadeById(unidade.id);
      console.log('📦 [UNIDADES PAGE - VIEW] Dados carregados:', detailedUnidade);
      console.log('📍 [UNIDADES PAGE - VIEW] Coordenadas:', {
        latitude: detailedUnidade.latitude,
        longitude: detailedUnidade.longitude
      });
      console.log('🔌 [UNIDADES PAGE - VIEW] Pontos de medição:', detailedUnidade.pontosMedicao);
      // Atualiza modal com dados completos
      openModal('view', detailedUnidade);
    } catch (error: any) {
      console.error('❌ [UNIDADES PAGE] Erro ao carregar unidade:', error);
      closeModal(); // Fecha o modal em caso de erro
      toast({
        title: "Erro ao carregar instalação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handler: Refresh
  const handleRefresh = () => {
    console.log('🔄 [UNIDADES PAGE] Atualizando lista');
    fetchUnidades(filters);
  };

  // Função para obter informações da planta filtrada
  const getPlantaInfo = () => {
    if (!filters.plantaId) return null;

    // Tentar pegar o nome da URL primeiro
    const urlParams = new URLSearchParams(location.search);
    const plantaNome = urlParams.get('plantaNome');

    if (plantaNome) {
      return {
        id: filters.plantaId,
        nome: decodeURIComponent(plantaNome)
      };
    }

    // Se não tiver na URL, buscar nas plantas carregadas
    const planta = plantas.find(p => p.id === filters.plantaId);
    return planta ? { id: planta.id, nome: planta.nome } : null;
  };

  const plantaInfo = getPlantaInfo();
  const filteredByPlanta = !!plantaInfo;

  // Handler: Voltar para plantas
  const handleBackToPlantas = () => {
    navigate('/cadastros/plantas');
  };

  // Handler: Limpar filtro de planta
  const handleClearPlantaFilter = () => {
    navigate('/cadastros/unidades');
    setFilters(initialFilters);
  };

  // Calcular paginação
  const pagination = {
    page: filters.page || 1,
    limit: filters.limit || 10,
    total: totalUnidades,
    totalPages: Math.ceil(totalUnidades / (filters.limit || 10))
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard
            title="Instalações"
            description="Gerencie as instalações cadastradas no sistema"
          />

          {/* Filtros e Ações */}
          <div className="flex flex-col lg:flex-row gap-3 mb-4 lg:items-start">
            {/* Filtros */}
            <div className="flex-1">
              <BaseFilters
                filters={filters}
                config={filterConfig}
                onFilterChange={handleFilterChange}
              />
            </div>

            {/* Botões de Ação */}
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
                  disabled={loading}
                  className="btn-minimal-primary flex-1 lg:flex-none whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">Nova Instalação</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabela */}
          <div className="flex-1 overflow-auto -mx-4 sm:mx-0">
            <div className="min-w-full inline-block align-middle">
              <BaseTable
                columns={unidadesTableColumns}
                data={unidades}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                onEdit={isAdmin() ? handleEdit : undefined}
                onView={handleView}
                emptyMessage="Nenhuma instalação encontrada"
              />
            </div>
          </div>
        </div>

        {/* Modal com delete */}
        <UnidadeModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          unidade={modalState.entity}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      </Layout.Main>
    </Layout>
  );
}
