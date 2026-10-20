import { useCallback, useEffect, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import type { FilterConfig, TableColumn } from '@/types/base';
import { useFiltrosNaUrl } from '@/hooks/useEstadoLembrado';
import { formatarDataHoraBR } from '@/lib/utils/date-formatters';
import { formatApiError } from '@/utils/api-error';
import { ChamadosService } from './services';
import { useAtualizarContagem, useChamadosContagem } from './hooks/useChamadosContagem';
import { AbrirChamadoModal } from './components/AbrirChamadoModal';
import { ChamadoDetalheModal } from './components/ChamadoDetalheModal';
import { SeloStatus } from './components/SeloStatus';
import { DESTINO_ROTULO, MOTIVO_ROTULO, PRIORIDADE_ROTULO, type Chamado, type ChamadosFilters } from './types';

const filtrosIniciais: ChamadosFilters = { busca: '', status: 'ABERTOS', prioridade: 'all', page: 1, limit: 20 };

const filterConfig: FilterConfig[] = [
  { key: 'busca', type: 'search', placeholder: 'Buscar por número, equipamento, título ou autor...', className: 'lg:col-span-2' },
  {
    key: 'status',
    type: 'combobox',
    label: 'Status',
    placeholder: 'Abertos',
    options: [
      { value: 'ABERTOS', label: 'Abertos (não fechados)' },
      { value: 'ABERTO', label: 'Aguardando encaminhamento' },
      { value: 'ENCAMINHADO', label: 'Encaminhados' },
      { value: 'FECHADO', label: 'Fechados' },
      { value: 'all', label: 'Todos' },
    ],
  },
  {
    key: 'prioridade',
    type: 'combobox',
    label: 'Prioridade',
    placeholder: 'Todas',
    options: [{ value: 'all', label: 'Todas' }, ...Object.entries(PRIORIDADE_ROTULO).map(([value, label]) => ({ value, label }))],
  },
];

const colunas: TableColumn<Chamado>[] = [
  {
    key: 'numero',
    label: 'Nº',
    render: (c) => <span className="font-mono text-sm">#{c.numero}</span>,
  },
  {
    key: 'titulo',
    label: 'Chamado',
    render: (c) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium max-w-72">{c.titulo}</p>
        <p className="truncate text-xs text-muted-foreground max-w-72">
          {MOTIVO_ROTULO[c.motivo]} · {PRIORIDADE_ROTULO[c.prioridade]}
        </p>
      </div>
    ),
  },
  {
    key: 'equipamento',
    label: 'Equipamento',
    render: (c) => (
      <div className="min-w-0">
        <p className="truncate text-sm max-w-56">{c.equipamento_nome ?? '—'}</p>
        <p className="truncate text-xs text-muted-foreground max-w-56">
          {[c.planta_nome, c.unidade_nome].filter(Boolean).join(' · ')}
        </p>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (c) => (
      <div className="space-y-0.5">
        <SeloStatus status={c.status} />
        {c.encaminhamentos[0] && c.status !== 'FECHADO' && (
          <p className="text-xs text-muted-foreground">{DESTINO_ROTULO[c.encaminhamentos[0].destino]}</p>
        )}
      </div>
    ),
  },
  {
    key: 'autor',
    label: 'Aberto por',
    hideOnMobile: true,
    render: (c) => (
      <div>
        <p className="text-sm">{c.autor_nome ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{formatarDataHoraBR(c.created_at)}</p>
      </div>
    ),
  },
];

export default function ChamadosPage() {
  const [filters, setFilters] = useFiltrosNaUrl('chamados', filtrosIniciais);
  const [linhas, setLinhas] = useState<Chamado[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [abrindo, setAbrindo] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const { data: contagem } = useChamadosContagem();
  const atualizarContagem = useAtualizarContagem();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ChamadosService.listar({
        page: filters.page,
        limit: filters.limit,
        busca: filters.busca || undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        prioridade: filters.prioridade !== 'all' ? filters.prioridade : undefined,
      });
      setLinhas(r.data ?? []);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mudou = () => {
    carregar();
    atualizarContagem();
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard
            title="Chamados"
            description={
              contagem
                ? `${contagem.abertos} aberto(s) · ${contagem.aguardando_encaminhamento} aguardando encaminhamento`
                : 'Pedidos de reparo de equipamento'
            }
          />

          <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-start">
            <div className="flex-1">
              <BaseFilters
                filters={filters}
                config={filterConfig}
                onFilterChange={(f: Partial<ChamadosFilters>) => setFilters((atual) => ({ ...atual, page: 1, ...f }))}
              />
            </div>
            <button onClick={() => setAbrindo(true)} className="btn-minimal-primary w-full lg:w-auto whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              <span>Abrir chamado</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <BaseTable
              data={linhas as any}
              columns={colunas as any}
              loading={loading}
              pagination={{
                page: filters.page,
                limit: filters.limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / filters.limit)),
              }}
              onPageChange={(page: number) => setFilters((atual) => ({ ...atual, page }))}
              onView={(c: any) => setDetalheId(c.id)}
              emptyMessage={filters.status === 'ABERTOS' ? 'Nenhum chamado aberto' : 'Nenhum chamado encontrado'}
              emptyIcon={<Wrench className="h-8 w-8 text-muted-foreground" />}
            />
          </div>
        </div>

        <AbrirChamadoModal
          aberto={abrindo}
          onClose={() => setAbrindo(false)}
          onAberto={(c) => {
            setAbrindo(false);
            mudou();
            setDetalheId(c.id);
          }}
        />
        <ChamadoDetalheModal chamadoId={detalheId} onClose={() => setDetalheId(null)} onMudou={mudou} />
      </Layout.Main>
    </Layout>
  );
}
