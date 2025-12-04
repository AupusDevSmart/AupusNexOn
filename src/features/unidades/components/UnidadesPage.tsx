// src/features/unidades/components/UnidadesPage.tsx

import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { UnidadeModal } from './unidade-modal';
import { Button } from '@/components/ui/button';
import { Plus, Factory, RefreshCw } from 'lucide-react';
import { useGenericModal } from '@/hooks/useGenericModal';
import { toast } from '@/hooks/use-toast';
import { unidadesTableColumns } from '../config/table-config';
import { createUnidadesFilterConfig } from '../config/filter-config';
import { usePlantas } from '../hooks/usePlantas';
import {
  getAllUnidades,
  getUnidadeById,
} from '@/services/unidades.services';
import type {
  Unidade,
  UnidadeFilters,
} from '../types';

const initialFilters: UnidadeFilters = {
  search: '',
  page: 1,
  limit: 10,
  orderBy: 'nome',
  orderDirection: 'asc',
};

export function UnidadesPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [totalUnidades, setTotalUnidades] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UnidadeFilters>(initialFilters);

  // Hook para plantas
  const { plantas, loading: loadingPlantas, error: plantasError } = usePlantas();

  // Modal state
  const {
    modalState,
    openModal,
    closeModal
  } = useGenericModal<Unidade>();

  // Configuração dinâmica de filtros
  const filterConfig = useMemo(() => {
    return createUnidadesFilterConfig(plantas, loadingPlantas);
  }, [plantas, loadingPlantas]);

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
        title: "Erro ao carregar unidades",
        description: error.message || "Não foi possível carregar a lista de unidades.",
        variant: "destructive",
      });
      setUnidades([]);
      setTotalUnidades(0);
    } finally {
      setLoading(false);
    }
  };

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
    try {
      console.log('📝 [UNIDADES PAGE] Abrindo edição da unidade:', unidade.id);
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
      openModal('edit', detailedUnidade);
    } catch (error: any) {
      console.error('❌ [UNIDADES PAGE] Erro ao carregar unidade:', error);
      toast({
        title: "Erro ao carregar unidade",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handler: Visualizar unidade
  const handleView = async (unidade: Unidade) => {
    try {
      console.log('👁️ [UNIDADES PAGE] Abrindo visualização da unidade:', unidade.id);
      const detailedUnidade = await getUnidadeById(unidade.id);
      console.log('📦 [UNIDADES PAGE - VIEW] Dados carregados:', detailedUnidade);
      console.log('📍 [UNIDADES PAGE - VIEW] Coordenadas:', {
        latitude: detailedUnidade.latitude,
        longitude: detailedUnidade.longitude
      });
      console.log('🔌 [UNIDADES PAGE - VIEW] Pontos de medição:', detailedUnidade.pontosMedicao);
      openModal('view', detailedUnidade);
    } catch (error: any) {
      console.error('❌ [UNIDADES PAGE] Erro ao carregar unidade:', error);
      toast({
        title: "Erro ao carregar unidade",
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
          {/* Header */}
          <TitleCard
            title="Unidades"
            description="Gerencie as unidades cadastradas no sistema"
          />

          {/* Filtros e Ações */}
          <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Filtros */}
            <div className="w-full">
              <BaseFilters
                filters={filters}
                config={filterConfig}
                onFilterChange={handleFilterChange}
              />
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:self-end">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={loading}
                className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
              >
                <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                <span className="sm:inline">Atualizar</span>
              </Button>

              <Button
                onClick={() => openModal('create')}
                disabled={loading}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="sm:inline">Nova Unidade</span>
              </Button>
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
                onEdit={handleEdit}
                onView={handleView}
                emptyMessage="Nenhuma unidade encontrada"
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
