// src/features/plantas/components/PlantasPage.tsx - VERSÃO ATUALIZADA
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/core/components/common/Layout';
import { TitleCard } from '@/core/components/common/title-card';
import { BaseTable } from '@/core/components/common/base-table/BaseTable';
import { BaseFilters } from '@/core/components/common/base-filters/BaseFilters';
import { PlantaModal } from './planta-modal';
import { InstalacoesExpandedRow } from './InstalacoesExpandedRow';
import { UnidadeModal } from '@/core/features/unidades/components/unidade-modal';
import { useUnidades } from '@/core/context/hooks';
import type { Unidade } from '@/core/features/unidades/types';
import { Button } from '@/core/components/ui/button';
import { Plus, Factory, RefreshCw, Filter } from 'lucide-react';
import { useGenericModal } from '@/core/hooks/useGenericModal';
import { toast } from '@/core/hooks/use-toast';
import { PlantasFilters } from '../types';
import { plantasTableColumns } from '../config/table-config';
import { useProprietarios } from '../config/filter-config';
import { useUserStore, usePlantasFeature, useHttpClient } from '@/core/context/hooks';
import { unwrapApiResponse } from '@/core/lib/utils';

const initialFilters: PlantasFilters = {
  search: '',
  proprietarioId: 'all',
  page: 1,
  limit: 15
};

interface PlantasPageProps {
  /**
   * Mostra subgrupo tarifario, demandas e os checkboxes de perfil no sheet da
   * instalacao. Sao detalhe de faturamento: o supervisorio precisa deles, o
   * Service nao.
   */
  mostrarTarifacao?: boolean;
}

export function PlantasPage({ mostrarTarifacao = false }: PlantasPageProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useUserStore();
  const httpClient = useHttpClient();
  const plantasFeature = usePlantasFeature();

  // Estados locais
  const [plantas, setPlantas] = useState<any[]>([]);
  const [totalPlantas, setTotalPlantas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PlantasFilters>(initialFilters);

  // Só para resolver o nome do proprietário quando a página é aberta com
  // ?proprietarioId= vindo da tela de usuários — não existe mais combobox.
  const { proprietarios } = useProprietarios();

  // Um campo de texto, e só. O backend procura o termo no nome da planta, no
  // CNPJ, na localização e também no nome do proprietário, então o combobox
  // separado virou um clique a mais para chegar no mesmo lugar.
  const filterConfig = useMemo(
    () => [
      {
        key: 'search',
        type: 'search' as const,
        placeholder: 'Buscar por nome, proprietário, CNPJ ou localização...',
        className: 'lg:col-span-2'
      }
    ],
    []
  );

  // Modal state
  const {
    modalState,
    openModal,
    closeModal
  } = useGenericModal<any>();

  // Linha expandida: as instalacoes da planta. Substitui a pagina
  // /cadastros/unidades, que deixou de existir.
  const [plantaExpandidaId, setPlantaExpandidaId] = useState<string | null>(null);
  /**
   * Instalacoes da planta expandida, e o sheet delas.
   *
   * Mora AQUI, e nao dentro da linha expandida, porque la o BaseModal acabava
   * dentro de um <TableCell> e o formulario abria vazio. E tambem como a
   * pagina de unidades fazia antes de ser removida.
   */
  // useGenericModal, e nao useState cru: e o mesmo caminho que a pagina de
  // unidades usava quando o sheet carregava. O closeModal dele zera a entity,
  // e o BaseModal depende desse ciclo para re-semear o formData.
  const {
    modalState: instalacaoModal,
    openModal: abrirInstalacao,
    closeModal: fecharInstalacao,
  } = useGenericModal<Unidade>();

  const {
    unidades: instalacoes,
    isLoading: carregandoInstalacoes,
    refetch: recarregarInstalacoes,
    createUnidade,
    updateUnidade,
    deleteUnidade,
  } = useUnidades(
    plantaExpandidaId ? { plantaId: plantaExpandidaId, page: 1, limit: 100 } : { limit: 1 },
  );

  const handleRowToggle = useCallback((planta: any) => {
    const id = planta?.id?.trim() || '';
    setPlantaExpandidaId((atual) => (atual === id ? null : id));
  }, []);

  const handleNovaInstalacao = useCallback((planta: any) => {
    const id = planta?.id?.trim() || null;
    setPlantaExpandidaId(id);
    // A planta ja vem da linha em que se clicou — nao faz sentido pedir de novo
    // algo que o clique ja disse.
    //
    // Estado e cidade vao junto porque o formulario NAO tem campo para eles:
    // quem os preenchia era o efeito colateral de escolher a planta no
    // combobox, e aqui a planta ja vem escolhida, entao esse efeito nunca
    // acontecia. O cadastro entao ia sem estado e o backend recusava com
    // "Estado deve conter 2 letras maiusculas" — sobre um campo que nao existe
    // na tela para se corrigir.
    //
    // Os dois caminhos de leitura sao de proposito: a planta desta LINHA vem
    // com o endereco aninhado (Planta.endereco.uf), enquanto a lista que
    // alimenta o combobox achata para planta.uf. Ler so uma das formas funciona
    // num caminho e devolve undefined no outro.
    const endereco = (planta as any)?.endereco || {};
    const uf = String(endereco.uf ?? planta?.uf ?? '').trim();
    const cidade = String(endereco.cidade ?? planta?.cidade ?? '').trim();

    abrirInstalacao('create', {
      plantaId: id,
      estado: uf,
      cidade,
    } as unknown as Unidade);
  }, []);

  // Descarta resposta de requisição atrasada. Clicar rápido entre páginas
  // podia fazer a resposta da página 1 chegar DEPOIS da página 2 e
  // sobrescrever a lista, com a paginação já marcando outra página.
  const requisicaoRef = useRef(0);

  // ✅ FUNÇÃO: Buscar plantas da API
  const fetchPlantas = async (currentFilters: PlantasFilters) => {
    const minhaVez = ++requisicaoRef.current;
    try {
      setLoading(true);

      const params: any = {
        page: currentFilters.page,
        limit: currentFilters.limit,
        search: currentFilters.search || undefined,
        proprietarioId: currentFilters.proprietarioId !== 'all' ? currentFilters.proprietarioId : undefined,
        orderBy: 'nome',
        orderDirection: 'asc'
      };


      const response = await httpClient.get('/plantas', { params });
      if (minhaVez !== requisicaoRef.current) return;

      const { data: plantasData, pagination: paginationData } = unwrapApiResponse(response.data);
      setPlantas(plantasData);
      setTotalPlantas(paginationData.total || plantasData.length);

    } catch (error: any) {
      if (minhaVez !== requisicaoRef.current) return;

      console.error('[PLANTAS PAGE] Erro ao carregar plantas:', error);
      toast({
        title: "Erro ao carregar plantas",
        description: error.message || "Não foi possível carregar a lista de plantas.",
        variant: "destructive",
      });
      setPlantas([]);
      setTotalPlantas(0);
    } finally {
      if (minhaVez === requisicaoRef.current) setLoading(false);
    }
  };

  // ✅ EFEITO: Aplicar filtros da URL quando a página carrega OU quando a URL muda
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const proprietarioId = urlParams.get('proprietarioId');


    if (proprietarioId) {

      const newFilters = {
        ...initialFilters,
        proprietarioId: proprietarioId,
      };

      setFilters(newFilters);
      fetchPlantas(newFilters);
    } else {
      setFilters(initialFilters);
      fetchPlantas(initialFilters);
    }
  }, [location.search]);

  // ✅ HANDLER: Mudança de filtros
  const handleFilterChange = (newFilters: Partial<PlantasFilters>) => {
    
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
    handleFilterChange({ page: newPage });
  };

  // ✅ HANDLER: Refresh manual
  const handleRefresh = () => {
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
  const fetchPlantaDetails = async (id: string): Promise<any | null> => {
    try {
      return await plantasFeature.obterPlanta(id);
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
  const handleView = async (planta: any) => {
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
  const handleEdit = async (planta: any) => {
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

  // Tirar o proprietarioId da URL basta: o efeito que observa location.search
  // recarrega a lista sem filtro. Navegar para um caminho fixo aqui era bug —
  // a rota é /cadastros/plantas, não /plantas.
  const handleClearProprietarioFilter = () => {
    navigate(location.pathname, { replace: true });
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
          <TitleCard
            title="Plantas"
            description="Gerencie as plantas cadastradas no sistema"
          />
          
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

          {/* Filtro de proprietário vindo da URL (tela de usuários). Sem
              combobox, este aviso é a única pista de que a lista está
              recortada — por isso vem com o botão de limpar junto. */}
          {filters.proprietarioId !== 'all' && proprietarioInfo && (
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Mostrando apenas plantas de "{proprietarioInfo.nome}"</span>
              <button
                onClick={handleClearProprietarioFilter}
                className="text-foreground underline underline-offset-2 hover:no-underline"
              >
                Limpar
              </button>
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
              customActions={
                isAdmin()
                  ? [
                      {
                        key: 'nova_instalacao',
                        label: 'Nova instalação',
                        icon: <Plus className="h-4 w-4" />,
                        handler: handleNovaInstalacao,
                      },
                    ]
                  : []
              }
              expandedRowId={plantaExpandidaId}
              onRowToggle={handleRowToggle}
              renderExpandedRow={(planta: any) => (
                <InstalacoesExpandedRow
                  unidades={(instalacoes ?? []) as Unidade[]}
                  carregando={carregandoInstalacoes}
                  somenteLeitura={!isAdmin()}
                  onVisualizar={(unidade) => abrirInstalacao('view', unidade)}
                  onEditar={(unidade) => abrirInstalacao('edit', unidade)}
                  plantaId={planta?.id?.trim()}
                  proprietarioId={planta?.proprietarioId?.trim()}
                />
              )}
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
        <UnidadeModal
          isOpen={instalacaoModal.isOpen}
          mode={instalacaoModal.mode}
          unidade={instalacaoModal.entity ?? null}
          onClose={fecharInstalacao}
          onSuccess={async () => {
            fecharInstalacao();
            await recarregarInstalacoes?.();
          }}
          createUnidade={createUnidade}
          updateUnidade={updateUnidade}
          deleteUnidade={deleteUnidade}
          mostrarTarifacao={mostrarTarifacao}
        />

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