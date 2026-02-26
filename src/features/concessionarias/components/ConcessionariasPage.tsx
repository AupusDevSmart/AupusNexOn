// src/features/concessionarias/components/ConcessionariasPage.tsx
import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { BaseModal } from '@/components/common/base-modal/BaseModal';
import { Plus, Zap, RefreshCw, Filter } from 'lucide-react';
import { useGenericModal } from '@/hooks/useGenericModal';
import { toast } from '@/hooks/use-toast';
import { ConcessionariasFilters } from '../types';
import { concessionariasTableColumns } from '../config/table-config';
import { useConcessionariasFilters } from '../hooks/useConcessionariasFilters';
import { concessionariasFormFields } from '../config/form-config';
import {
  ConcessionariasService,
  CreateConcessionariaDto,
  UpdateConcessionariaDto,
  ConcessionariaResponse,
  FindAllConcessionariasParams
} from '@/services/concessionarias.services';
import { useUserStore } from '@/store/useUserStore';

const initialFilters: ConcessionariasFilters = {
  search: '',
  estado: 'all',
  page: 1,
  limit: 10
};

// ✅ HELPER: Transformar dados do formulário para API
const transformFormDataToAPI = (data: any): CreateConcessionariaDto | UpdateConcessionariaDto => {
  const transformedData: any = {
    nome: (data.nome || '').trim(),
    estado: (data.estado || '').toUpperCase(),
    data_inicio: data.data_inicio,
    data_validade: data.data_validade,
  };

  // Adicionar tarifas se existirem
  if (data.tarifas) {
    if (data.tarifas.a4_verde) {
      transformedData.a4_verde = data.tarifas.a4_verde;
    }
    if (data.tarifas.a3a_verde) {
      transformedData.a3a_verde = data.tarifas.a3a_verde;
    }
    if (data.tarifas.b) {
      transformedData.b = data.tarifas.b;
    }
  }

  return transformedData;
};

// ✅ HELPER: Transformar dados da API para o formulário
const transformAPIToFormData = (concessionaria: ConcessionariaResponse): any => {
  return {
    id: concessionaria.id,
    nome: concessionaria.nome,
    estado: concessionaria.estado || '',
    data_inicio: concessionaria.data_inicio.split('T')[0], // Converter para formato YYYY-MM-DD
    data_validade: concessionaria.data_validade.split('T')[0],
    tarifas: {
      a4_verde: concessionaria.a4_verde,
      a3a_verde: concessionaria.a3a_verde,
      b: concessionaria.b
    },
    anexos: concessionaria.anexos || []
  };
};

export function ConcessionariasPage() {
  const { isAdmin } = useUserStore();

  // Estados locais
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [concessionarias, setConcessionarias] = useState<ConcessionariaResponse[]>([]);
  const [totalConcessionarias, setTotalConcessionarias] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ConcessionariasFilters>(initialFilters);

  // Configuração de filtros dinâmicos com estados do IBGE
  const { filterConfig } = useConcessionariasFilters();

  // Modal state
  const {
    modalState,
    openModal,
    closeModal
  } = useGenericModal<ConcessionariaResponse>();

  // ✅ FUNÇÃO: Buscar concessionárias da API
  const fetchConcessionarias = async (currentFilters: ConcessionariasFilters) => {
    try {
      setLoading(true);

      const params: FindAllConcessionariasParams = {
        page: currentFilters.page,
        limit: currentFilters.limit,
        search: currentFilters.search || undefined,
        estado: currentFilters.estado !== 'all' ? currentFilters.estado : undefined,
        orderBy: 'nome',
        orderDirection: 'asc'
      };

      console.log('🔍 [CONCESSIONARIAS PAGE] Buscando concessionárias com filtros:', params);

      const response = await ConcessionariasService.getAllConcessionarias(params);

      setConcessionarias(response.data);
      setTotalConcessionarias(response.pagination.total);

      console.log('✅ [CONCESSIONARIAS PAGE] Concessionárias carregadas:', {
        total: response.pagination.total,
        count: response.data.length,
        page: response.pagination.page
      });

    } catch (error: any) {
      console.error('❌ [CONCESSIONARIAS PAGE] Erro ao carregar concessionárias:', error);
      toast({
        title: "Erro ao carregar concessionárias",
        description: error.message || "Não foi possível carregar a lista de concessionárias.",
        variant: "destructive",
      });
      setConcessionarias([]);
      setTotalConcessionarias(0);
    } finally {
      setLoading(false);
    }
  };

  // ✅ EFEITO: Carregar concessionárias quando a página carrega
  useEffect(() => {
    fetchConcessionarias(initialFilters);
  }, []);

  // ✅ HANDLER: Mudança de filtros
  const handleFilterChange = (newFilters: Partial<ConcessionariasFilters>) => {
    console.log('🔄 [CONCESSIONARIAS PAGE] Filtros alterados:', newFilters);

    const updatedFilters = {
      ...filters,
      ...newFilters,
      page: newFilters.page || 1
    };

    setFilters(updatedFilters);
    fetchConcessionarias(updatedFilters);
  };

  // ✅ HANDLER: Mudança de página
  const handlePageChange = (newPage: number) => {
    console.log('📄 [CONCESSIONARIAS PAGE] Mudança de página:', newPage);
    handleFilterChange({ page: newPage });
  };

  // ✅ HANDLER: Refresh manual
  const handleRefresh = () => {
    console.log('🔄 [CONCESSIONARIAS PAGE] Refresh manual');
    fetchConcessionarias(filters);
  };

  // ✅ HANDLER: Buscar dados detalhados da concessionária para modal
  const fetchConcessionariaDetails = async (id: string): Promise<ConcessionariaResponse | null> => {
    try {
      return await ConcessionariasService.getConcessionaria(id);
    } catch (error: any) {
      console.error('❌ [CONCESSIONARIAS PAGE] Erro ao buscar detalhes da concessionária:', error);
      toast({
        title: "Erro ao carregar concessionária",
        description: error.message || "Não foi possível carregar os detalhes da concessionária.",
        variant: "destructive",
      });
      return null;
    }
  };

  // ✅ HANDLER: Visualizar concessionária (abertura otimista)
  const handleView = async (concessionaria: ConcessionariaResponse) => {
    console.log('👁️ [CONCESSIONARIAS PAGE] Visualizando concessionária:', concessionaria.id);

    // Abrir modal IMEDIATAMENTE com dados básicos
    openModal('view', concessionaria);

    // Carregar detalhes em background
    try {
      const detailedConcessionaria = await fetchConcessionariaDetails(concessionaria.id);
      if (detailedConcessionaria) {
        openModal('view', detailedConcessionaria);
      }
    } catch (error) {
      closeModal();
    }
  };

  // ✅ HANDLER: Editar concessionária (abertura otimista)
  const handleEdit = async (concessionaria: ConcessionariaResponse) => {
    console.log('✏️ [CONCESSIONARIAS PAGE] Editando concessionária:', concessionaria.id);

    // Abrir modal IMEDIATAMENTE com dados básicos
    openModal('edit', concessionaria);

    // Carregar detalhes em background
    try {
      const detailedConcessionaria = await fetchConcessionariaDetails(concessionaria.id);
      if (detailedConcessionaria) {
        openModal('edit', detailedConcessionaria);
      }
    } catch (error) {
      closeModal();
    }
  };

  // ✅ HANDLER: Submissão do formulário (Create e Update)
  const handleSubmit = async (data: any) => {
    console.log('💾 [CONCESSIONARIAS PAGE] Dados recebidos do formulário:', data);
    console.log('💾 [CONCESSIONARIAS PAGE] Modal state:', modalState);
    setIsSubmitting(true);

    try {
      const transformedData = transformFormDataToAPI(data);
      console.log('💾 [CONCESSIONARIAS PAGE] Dados transformados:', transformedData);

      if (modalState.mode === 'create') {
        // 1. Criar a concessionária
        const novaConcessionaria = await ConcessionariasService.createConcessionaria(transformedData);
        console.log('✅ [CONCESSIONARIAS PAGE] Concessionária criada:', novaConcessionaria);

        // 2. Fazer upload dos anexos temporários se houver
        if (data.anexos && Array.isArray(data.anexos)) {
          const anexosTemporarios = data.anexos.filter((anexo: any) => anexo.isTemporary === true);

          if (anexosTemporarios.length > 0) {
            console.log(`📎 [CONCESSIONARIAS PAGE] Enviando ${anexosTemporarios.length} anexo(s) temporário(s)...`);

            for (const anexo of anexosTemporarios) {
              try {
                await ConcessionariasService.uploadAnexo(novaConcessionaria.id, anexo.file);
              } catch (error: any) {
                console.error(`❌ Erro ao enviar anexo "${anexo.nome_original}":`, error);
                // Continuar com outros anexos mesmo se um falhar
              }
            }
          }
        }

        toast({
          title: "Concessionária cadastrada!",
          description: `A concessionária "${novaConcessionaria.nome}" foi cadastrada com sucesso.`,
          variant: "default",
        });

      } else if (modalState.mode === 'edit') {
        // Usar o ID da entidade original ou do data se disponível
        const idToUpdate = modalState.entity?.id || data.id;

        console.log('✏️ [CONCESSIONARIAS PAGE] Atualizando concessionária ID:', idToUpdate);

        if (!idToUpdate) {
          throw new Error('ID da concessionária não encontrado para atualização');
        }

        const concessionariaAtualizada = await ConcessionariasService.updateConcessionaria(
          idToUpdate,
          transformedData
        );

        console.log('✅ [CONCESSIONARIAS PAGE] Concessionária atualizada:', concessionariaAtualizada);

        toast({
          title: "Concessionária atualizada!",
          description: `A concessionária "${concessionariaAtualizada.nome}" foi atualizada com sucesso.`,
          variant: "default",
        });
      }

      await fetchConcessionarias(filters);
      closeModal();

    } catch (error: any) {
      console.error('❌ [CONCESSIONARIAS PAGE] Erro ao salvar concessionária:', error);
      console.error('❌ [CONCESSIONARIAS PAGE] Error details:', error.response?.data || error);

      toast({
        title: modalState.mode === 'create' ? "Erro ao cadastrar concessionária" : "Erro ao atualizar concessionária",
        description: error.message || "Ocorreu um erro interno. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ HANDLERS: Modal
  const getModalTitle = () => {
    const titles = {
      create: 'Nova Concessionária',
      edit: 'Editar Concessionária',
      view: 'Visualizar Concessionária'
    };
    return titles[modalState.mode as keyof typeof titles] || 'Concessionária';
  };

  const getModalIcon = () => {
    return <Zap className="h-5 w-5 text-yellow-600" />;
  };

  const getModalEntity = () => {
    if (modalState.mode === 'create') {
      return null;
    }

    // Transformar dados da API para formato do formulário
    return modalState.entity ? transformAPIToFormData(modalState.entity) : null;
  };

  // ✅ CALCULAR PAGINAÇÃO
  const pagination = {
    page: filters.page || 1,
    limit: filters.limit || 10,
    total: totalConcessionarias,
    totalPages: Math.ceil(totalConcessionarias / (filters.limit || 10))
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard
            title="Concessionárias"
            description="Gerencie as concessionárias de energia e suas tarifas"
          />

          {/* Filtros e Ações */}
          <div className="flex flex-col gap-3 mb-4">
            {/* Linha 1: Busca por Nome */}
            <div className="flex-1">
              <BaseFilters
                filters={filters}
                config={[filterConfig[0]]} // Campo de busca
                onFilterChange={handleFilterChange}
              />
            </div>

            {/* Linha 2: Select de Estado + Botões */}
            <div className="flex flex-col sm:flex-row sm:gap-1.5 gap-2 w-full items-start sm:items-center">
              {/* Select de Estado */}
              <div className="w-full sm:w-[250px]">
                <BaseFilters
                  filters={filters}
                  config={[filterConfig[1]]} // Select de estados
                  onFilterChange={handleFilterChange}
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-row gap-2 w-full sm:w-auto sm:ml-auto">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="btn-minimal-outline flex-1 sm:flex-none"
                >
                  <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </button>

                {isAdmin() && (
                  <button
                    onClick={() => openModal('create')}
                    disabled={isSubmitting}
                    className="btn-minimal-primary flex-1 sm:flex-none"
                  >
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Nova Concessionária</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ✅ Indicador de filtros ativos */}
          {(filters.search || filters.estado !== 'all') && (
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>
                Filtros ativos:
                {filters.search && ` busca por "${filters.search}"`}
                {filters.search && filters.estado !== 'all' && ', '}
                {filters.estado !== 'all' && ` estado "${filters.estado}"`}
              </span>
            </div>
          )}

          {/* ✅ Tabela */}
          <div className="flex-1 min-h-0">
            <BaseTable
              data={concessionarias}
              columns={concessionariasTableColumns}
              pagination={pagination}
              loading={loading}
              onPageChange={handlePageChange}
              onView={handleView}
              onEdit={isAdmin() ? handleEdit : undefined}
              emptyMessage={
                filters.search
                  ? `Nenhuma concessionária encontrada para "${filters.search}".`
                  : "Nenhuma concessionária encontrada."
              }
              emptyIcon={<Zap className="h-8 w-8 text-muted-foreground/50" />}
            />
          </div>
        </div>

        {/* Modal integrado */}
        <BaseModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          entity={getModalEntity()}
          title={getModalTitle()}
          icon={getModalIcon()}
          formFields={concessionariasFormFields}
          onClose={closeModal}
          onSubmit={handleSubmit}

          loading={isSubmitting}
          loadingText={modalState.mode === 'create' ? "Cadastrando concessionária..." : "Salvando alterações..."}

          closeOnBackdropClick={!isSubmitting}
          closeOnEscape={true}
          submitButtonText={modalState.mode === 'create' ? "Cadastrar Concessionária" : "Salvar Alterações"}
        />
      </Layout.Main>
    </Layout>
  );
}
