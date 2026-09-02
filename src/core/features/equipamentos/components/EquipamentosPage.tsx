// src/features/equipamentos/components/EquipamentosPage.tsx - CORRIGIDO
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '@/core/components/common/Layout';
import { TitleCard } from '@/core/components/common/TitleCard';
import { BaseTable } from '@/core/components/common/base-table/BaseTable';
import { BaseFilters } from '@/core/components/common/base-filters/BaseFilters';
import { Button } from '@/core/components/ui/button';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';
import { Wrench, ArrowLeft, AlertCircle, Copy } from 'lucide-react';
import { Equipamento, EquipamentosFilters } from '../types';
import { getEquipamentosTableColumns } from '../config/table-config';
import { createEquipamentosFilterConfig } from '../config/filter-config';
import { useEquipamentos, useEquipamentoFilters, useUserStore } from '@/core/context/hooks';

// Modais separados
import { EquipamentoUCModal, type ContextoSlot } from './modals/EquipamentoUCModal';
import { ComponenteUARModal } from './modals/ComponenteUARModal';

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

/**
 * Filtros iniciais ja com o que veio na URL.
 *
 * Aplicar a URL depois do mount, por efeito, disparava DUAS buscas: a primeira
 * sem filtro (initialFilters) e a segunda com ele. Sem cancelamento, vencia a
 * que respondesse por ultimo — e a sem filtro traz mais dados, entao costumava
 * chegar depois. Dai o sintoma de "o filtro aparece preenchido mas a lista
 * mostra tudo", intermitente.
 */
const filtrosDaUrl = (search: string): EquipamentosFilters => {
  const params = new URLSearchParams(search);
  const proprietarioId = params.get('proprietarioId');
  const plantaId = params.get('plantaId');
  const unidadeId = params.get('unidadeId');

  return {
    ...initialFilters,
    ...(proprietarioId ? { proprietarioId } : {}),
    ...(plantaId ? { plantaId } : {}),
    ...(unidadeId ? { unidadeId } : {}),
  };
};

interface EquipamentosPageProps {
  /**
   * Secao extra no sheet do equipamento UC, injetada pelo consumidor.
   * O AupusService usa para a secao de plano de manutencao, que so existe
   * naquele produto. Ver EquipamentoUCModal.
   */
  renderSecaoExtraUC?: (
    equipamento: Equipamento | null,
    mode: 'create' | 'edit' | 'view',
    contexto: ContextoSlot,
  ) => React.ReactNode;
  /**
   * Campo extra dentro da grade de Dados Basicos do sheet UC. O AupusService
   * usa para a escolha do plano de manutencao, que e dado basico do
   * equipamento; as tarefas do plano vao em renderSecaoExtraUC.
   */
  renderCampoDadosBasicosUC?: (
    equipamento: Equipamento | null,
    mode: 'create' | 'edit' | 'view',
    contexto: ContextoSlot,
  ) => React.ReactNode;
  /** MQTT e Automacao no sheet: so o supervisorio (NexOn) precisa deles. */
  mostrarSupervisorio?: boolean;
  /** Conteudo da aba Historico do sheet UC. Sem este slot a aba nao aparece. */
  renderHistoricoUC?: (equipamento: Equipamento, mode: 'create' | 'edit' | 'view') => React.ReactNode;
}

export function EquipamentosPage({ renderSecaoExtraUC, renderCampoDadosBasicosUC, renderHistoricoUC, mostrarSupervisorio }: EquipamentosPageProps = {}) {
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
  const [filters, setFilters] = useState<EquipamentosFilters>(() =>
    filtrosDaUrl(window.location.search),
  );
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
    const proprietarioId = urlParams.get('proprietarioId');
    const plantaId = urlParams.get('plantaId');
    const unidadeId = urlParams.get('unidadeId');
    const unidadeNome = urlParams.get('unidadeNome');

    const urlFilters: Partial<EquipamentosFilters> = {};

    // O proprietario vem junto no link de dentro da instalacao. Sem aplicar
    // aqui, o filtro ficava com planta e instalacao preenchidas e o
    // proprietario em "Todos" — inconsistente com o que a lista mostra, e era
    // de la que o cadastro de equipamento tirava a pre-selecao.
    if (proprietarioId) {
      urlFilters.proprietarioId = proprietarioId;
    }

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
      setFilters(prev => {
        // Sem isto, o setState no mount recriava o objeto e disparava a busca
        // de novo — a segunda ja com o filtro certo, mas concorrendo com a
        // primeira.
        const igual = Object.entries(urlFilters).every(
          ([chave, valor]) => (prev as unknown as Record<string, unknown>)[chave] === valor,
        );
        if (igual) return prev;

        return { ...prev, ...urlFilters, page: 1 };
      });
    }
  }, [location.search]);

  // ============================================================================
  // HANDLERS DOS FILTROS E PAGINAÇÃO
  // ============================================================================
  const handleFilterChange = useCallback(async (newFilters: Partial<EquipamentosFilters>) => {
    // Se o proprietário mudou, carregar plantas e unidades correspondentes
    if (newFilters.proprietarioId !== undefined && newFilters.proprietarioId !== filters.proprietarioId) {

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
  /**
   * Equipamento de origem quando o cadastro é uma duplicação. Fica fora do
   * estado do modal porque em create a página já usa `entity` para carregar a
   * planta que veio na URL — os dois papéis não cabem no mesmo campo.
   */
  const [duplicarDe, setDuplicarDe] = useState<Equipamento | null>(null);

  const handleDuplicar = (equipamento: Equipamento) => {
    setDuplicarDe(equipamento);

    // Cada classificacao tem o seu sheet. O componente duplicado nasce sob o
    // mesmo pai do original — e ele que da a unidade e a planta.
    if (equipamento.classificacao === 'UAR') {
      setModalUAR({
        isOpen: true,
        mode: 'create',
        entity: null,
        equipamentoPai: (equipamento.equipamentoPai as Equipamento) ?? null,
      });
      return;
    }

    openUCModal('create');
  };

  const openUCModal = (mode: 'create' | 'edit' | 'view', entity: Equipamento | null = null) => {
    if (mode !== 'create') setDuplicarDe(null);
    if (mode === 'create') {
      // A localização sai dos filtros da própria tela, não da URL: o que está
      // selecionado no topo é o que o usuário está vendo na hora do clique —
      // venha do link "ver equipamentos" de dentro de uma instalação (que
      // escreve os filtros no mount) ou de ele ter escolhido na mão.
      //
      // A URL entra só como reforço, porque o proprietário não tem filtro
      // espelhado em todos os caminhos de entrada. O que faltar aqui o modal
      // resolve sozinho a partir da unidade — ver EquipamentoUCModal.
      const urlParams = new URLSearchParams(location.search);
      const doFiltro = (valor?: string) => (valor && valor !== 'all' ? valor.trim() : undefined);

      const proprietarioId =
        doFiltro(filters.proprietarioId) || urlParams.get('proprietarioId')?.trim();
      const plantaId = doFiltro(filters.plantaId) || urlParams.get('plantaId')?.trim();
      const unidadeId = doFiltro(filters.unidadeId) || urlParams.get('unidadeId')?.trim();

      const initialData: Record<string, string> = {};
      if (plantaId) initialData.plantaId = plantaId;
      if (proprietarioId) initialData.proprietarioId = proprietarioId;
      if (unidadeId) initialData.unidadeId = unidadeId;

      setModalUC({ isOpen: true, mode, entity: initialData as unknown as Equipamento });
    } else {
      setModalUC({ isOpen: true, mode, entity });
    }
  };

  const closeUCModal = () => {
    setModalUC({ isOpen: false, mode: 'create', entity: null });
    // Sem isso, o "Novo Equipamento" seguinte abriria preenchido com o que foi
    // duplicado antes.
    setDuplicarDe(null);
  };

  const handleSubmitUC = async (data: any) => {
    try {

      let criado: Equipamento | null = null;

      if (modalUC.mode === 'create') {
        criado = await createEquipamento(data);
      } else if (modalUC.mode === 'edit' && modalUC.entity) {
        await updateEquipamento(modalUC.entity.id, data);
      }

      // Recarregar dados após salvar
      await loadEquipamentos(filters);

      // Quem fecha o sheet é o próprio sheet: depois de criar, ele ainda tem
      // trabalho a fazer com o id novo (subir a foto, os anexos e vincular o
      // plano). Fechar aqui o desmontaria no meio disso.
      return criado;

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
    // Sem isto, o proximo "novo componente" abriria preenchido com o que foi
    // duplicado antes.
    setDuplicarDe(null);
  };

  const handleSubmitUAR = async (data: any) => {
    try {
      let criado: Equipamento | null = null;

      if (modalUAR.mode === 'create') {
        criado = await createEquipamento(data);
      } else if (modalUAR.mode === 'edit' && modalUAR.entity) {
        await updateEquipamento(modalUAR.entity.id, data);
      }

      closeUARModal();
      await loadEquipamentos(filters);

      // Devolvido para o sheet subir a foto que ficou pendente ate existir id.
      return criado;
    } catch (error) {
      console.error('Erro ao salvar componente UAR:', error);
    }
  };

  /** O lote nao passa pelo onSubmit: cria os N por endpoint proprio. */
  const handleUARsCriadosEmLote = async () => {
    closeUARModal();
    await loadEquipamentos(filters);
  };

  // ============================================================================
  // HANDLER PARA SALVAR UARs (usado pelo EquipamentoUCModal)
  // ============================================================================
  const handleSalvarUARs = async (ucId: string, uars: Equipamento[]) => {
    const result = await salvarComponentesUARLote(ucId, uars);
    await loadEquipamentos(filters);
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
  const tableColumns = getEquipamentosTableColumns();

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
                  onClick={() => navigate('/cadastros/plantas')}
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
                  <span>Novo Equipamento</span>
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
              customActions={
                isAdmin()
                  ? [
                      {
                        key: 'duplicar',
                        label: 'Duplicar',
                        icon: Copy,
                        handler: handleDuplicar,
                        // O UAR so pode ser duplicado quando se sabe o pai: sem
                        // ele o componente nao teria onde encaixar.
                        condition: (equipamento: Equipamento) =>
                          equipamento.classificacao === 'UC' ||
                          Boolean(equipamento.equipamentoPaiId || equipamento.equipamentoPai),
                      },
                    ]
                  : []
              }
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
          duplicarDe={duplicarDe}
          aoCriarEmLote={async (total) => {
            await loadEquipamentos(filters);
            toast.success(`${total} equipamentos cadastrados!`, {
              description: 'Vincule o plano de manutenção de cada um pela tela do equipamento.',
              duration: 5000,
            });
          }}
          onClose={closeUCModal}
          onSubmit={handleSubmitUC}
          onDelete={handleDelete}
          onSaveUARs={handleSalvarUARs}
          renderSecaoExtra={renderSecaoExtraUC}
          renderCampoDadosBasicos={renderCampoDadosBasicosUC}
          renderHistorico={renderHistoricoUC}
          mostrarSupervisorio={mostrarSupervisorio}
        />

        {/* Modal para Componentes UAR */}
        <ComponenteUARModal
          isOpen={modalUAR.isOpen}
          mode={modalUAR.mode}
          entity={modalUAR.entity}
          equipamentoPai={modalUAR.equipamentoPai}
          onClose={closeUARModal}
          onSubmit={handleSubmitUAR}
          aoCriarEmLote={handleUARsCriadosEmLote}
          duplicarDe={modalUAR.mode === 'create' ? duplicarDe : null}
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