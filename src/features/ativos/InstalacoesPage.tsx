import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Factory, MapPin, RefreshCw } from 'lucide-react';
import { Layout } from '@/core/components/common/Layout';
import { TitleCard } from '@/core/components/common/title-card';
import { BaseTable } from '@/core/components/common/base-table/BaseTable';
import { BaseFilters } from '@/core/components/common/base-filters/BaseFilters';
import { UnidadeModal } from '@/core/features/unidades/components/unidade-modal';
import type { Unidade } from '@/core/features/unidades/types';
import type { TableColumn } from '@/core/types/base';
import { useGenericModal } from '@/core/hooks/useGenericModal';
import { useUnidades, useUserStore } from '@/core/context/hooks';
import { useFiltrosNaUrl } from '@/hooks/useEstadoLembrado';

/**
 * Ativos › Instalações (NEXON-21): todas as instalações (unidades) de todas as
 * plantas numa lista só. Antes elas só apareciam abrindo a linha da planta.
 * O cadastro de uma instalação nova continua na planta, que é quem a dona.
 */

const inicial = { search: '', proprietarioId: 'all', page: 1, limit: 15 };

const colunas: TableColumn<Unidade>[] = [
  {
    key: 'nome',
    label: 'Instalação',
    render: (u) => (
      <div className="flex items-center gap-2 font-medium text-foreground">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate max-w-56" title={u.nome}>{u.nome}</span>
      </div>
    ),
  },
  {
    key: 'planta',
    label: 'Planta',
    render: (u) => (
      <div className="flex items-center gap-2">
        <Factory className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate max-w-48 text-sm" title={u.planta?.nome}>{u.planta?.nome || '-'}</span>
      </div>
    ),
  },
  {
    key: 'proprietario',
    label: 'Proprietário',
    hideOnTablet: true,
    render: (u) => (
      <span className="truncate block max-w-48 text-sm" title={u.planta?.proprietario?.nome}>
        {u.planta?.proprietario?.nome || '-'}
      </span>
    ),
  },
  {
    key: 'cidade',
    label: 'Cidade',
    hideOnTablet: true,
    render: (u) => <span className="text-sm">{u.cidade ? `${u.cidade}/${u.estado}` : u.estado || '-'}</span>,
  },
  {
    key: 'tipo',
    label: 'Tipo',
    render: (u) => <span className="text-sm">{u.tipo || '-'}</span>,
  },
  {
    key: 'potencia',
    label: 'Potência',
    align: 'right',
    render: (u) => (
      <span className="text-sm tabular-nums">
        {u.potencia != null ? `${Number(u.potencia).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kW` : '-'}
      </span>
    ),
  },
  {
    key: 'equipamentos',
    label: 'Equipamentos',
    align: 'right',
    hideOnMobile: true,
    render: (u) => <span className="text-sm tabular-nums">{u.totalEquipamentos ?? '-'}</span>,
  },
];

export default function InstalacoesPage() {
  const navigate = useNavigate();
  const { isAdmin } = useUserStore();
  const [filtros, setFiltros] = useFiltrosNaUrl('ativos:instalacoes', inicial);

  const {
    unidades,
    pagination: paginacaoApi,
    isLoading,
    refetch,
    createUnidade,
    updateUnidade,
    deleteUnidade,
  } = useUnidades({
    search: filtros.search || undefined,
    proprietarioId: filtros.proprietarioId !== 'all' ? filtros.proprietarioId : undefined,
    page: filtros.page,
    limit: filtros.limit,
    orderBy: 'nome',
    orderDirection: 'asc',
  });

  const { modalState, openModal, closeModal } = useGenericModal<Unidade>();

  const filterConfig = useMemo(
    () => [
      {
        key: 'search',
        type: 'search' as const,
        placeholder: 'Buscar por instalação, cidade ou planta...',
        className: 'lg:col-span-2',
      },
    ],
    [],
  );

  const total = paginacaoApi?.total ?? (unidades as Unidade[]).length;
  const pagination = {
    page: filtros.page,
    limit: filtros.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filtros.limit)),
  };

  const verEquipamentos = useCallback(
    (u: Unidade) => {
      const params = new URLSearchParams({ unidadeId: u.id.trim(), unidadeNome: u.nome });
      if (u.plantaId) params.set('plantaId', u.plantaId.trim());
      if (u.planta?.proprietario?.id) params.set('proprietarioId', u.planta.proprietario.id.trim());
      navigate(`/cadastros/equipamentos?${params.toString()}`);
    },
    [navigate],
  );

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard title="Instalações" description="Instalações de todas as plantas" />

          <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-start">
            <div className="flex-1">
              <BaseFilters
                filters={filtros}
                config={filterConfig}
                onFilterChange={(novos: Partial<typeof inicial>) => setFiltros((f) => ({ ...f, ...novos, page: 1 }))}
              />
            </div>
            <div className="flex flex-row gap-2 w-full lg:w-auto">
              <button
                onClick={() => void refetch()}
                disabled={isLoading}
                className="btn-minimal-outline flex-1 lg:flex-none whitespace-nowrap"
              >
                <RefreshCw className={`h-4 w-4 lg:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Atualizar</span>
              </button>
            </div>
          </div>

          {filtros.proprietarioId !== 'all' && (
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <span>Mostrando apenas instalações de um proprietário.</span>
              <button
                onClick={() => setFiltros((f) => ({ ...f, proprietarioId: 'all', page: 1 }))}
                className="text-foreground underline underline-offset-2 hover:no-underline"
              >
                Limpar
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0">
            <BaseTable
              data={unidades as Unidade[]}
              columns={colunas}
              pagination={pagination}
              loading={isLoading}
              onPageChange={(page) => setFiltros((f) => ({ ...f, page }))}
              onView={(u) => openModal('view', u)}
              onEdit={isAdmin() ? (u) => openModal('edit', u) : undefined}
              customActions={[
                {
                  key: 'ver_equipamentos',
                  label: 'Ver equipamentos',
                  icon: <Boxes className="h-4 w-4" />,
                  handler: verEquipamentos,
                },
              ]}
              emptyMessage={
                filtros.search
                  ? `Nenhuma instalação encontrada para "${filtros.search}".`
                  : 'Nenhuma instalação encontrada.'
              }
              emptyIcon={<MapPin className="h-8 w-8 text-muted-foreground/50" />}
            />
          </div>
        </div>

        <UnidadeModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          unidade={modalState.entity ?? null}
          onClose={closeModal}
          onSuccess={async () => {
            closeModal();
            await refetch?.();
          }}
          createUnidade={createUnidade}
          updateUnidade={updateUnidade}
          deleteUnidade={deleteUnidade}
          mostrarTarifacao
        />
      </Layout.Main>
    </Layout>
  );
}
