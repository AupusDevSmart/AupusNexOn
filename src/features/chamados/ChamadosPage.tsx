import { useCallback, useEffect, useState } from 'react';
import { Plus, Wrench, X, ZapOff } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { BaseTable } from '@/components/common/base-table/BaseTable';
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FilterConfig, TableColumn } from '@/types/base';
import { useFiltrosNaUrl } from '@/hooks/useEstadoLembrado';
import { formatarDataHoraBR } from '@/lib/utils/date-formatters';
import { cn } from '@/lib/utils';
import { formatApiError } from '@/utils/api-error';
import { ChamadosService, type ListarChamadosParams } from './services';
import { useAtualizarContagem, useChamadosContagem } from './hooks/useChamadosContagem';
import { ChamadoFormModal } from './components/ChamadoFormModal';
import { ChamadoDetalheModal } from './components/ChamadoDetalheModal';
import { AvisarFaltaEnergiaModal } from './falta-energia/AvisarFaltaEnergiaModal';
import { useUserStore } from '@/store/useUserStore';
import { isGlobal } from '@/store/papeis';
import { ChamadosIndicadores } from './components/ChamadosIndicadores';
import { SeloStatus } from './components/SeloStatus';
import { duracaoDoChamado, formatarDuracao } from './utils/datas';
import {
  DESTINO_ROTULO,
  estaEncerrado,
  MOTIVO_ROTULO,
  PRIORIDADE_ROTULO,
  TIPO_ROTULO,
  type Chamado,
  type ChamadosFilters,
  type EstatisticasChamados,
  type TipoChamado,
} from './types';

const filtrosIniciais: ChamadosFilters = {
  busca: '',
  status: 'ABERTOS',
  tipo: 'all',
  motivo: 'all',
  orgao: '',
  de: '',
  ate: '',
  prioridade: 'all',
  page: 1,
  limit: 20,
};

const filterConfig: FilterConfig[] = [
  { key: 'busca', type: 'search', placeholder: 'Buscar por número, protocolo, equipamento, título...', className: 'lg:col-span-2' },
  {
    key: 'tipo',
    type: 'combobox',
    label: 'Tipo',
    placeholder: 'Todos',
    options: [
      { value: 'all', label: 'Todos' },
      { value: 'EXTERNO', label: 'Externos (Equatorial...)' },
      { value: 'INTERNO', label: 'Reparo de equipamento' },
    ],
  },
  {
    key: 'status',
    type: 'combobox',
    label: 'Status',
    placeholder: 'Abertos',
    options: [
      { value: 'ABERTOS', label: 'Abertos (não encerrados)' },
      { value: 'ABERTO', label: 'Aberto' },
      { value: 'EM_ANDAMENTO', label: 'Em andamento' },
      { value: 'ENCAMINHADO', label: 'Encaminhado (reparo)' },
      { value: 'ENCERRADOS', label: 'Encerrados' },
      { value: 'RESOLVIDO', label: 'Resolvido' },
      { value: 'FECHADO', label: 'Fechado (reparo)' },
      { value: 'CANCELADO', label: 'Cancelado' },
      { value: 'all', label: 'Todos' },
    ],
  },
  {
    key: 'motivo',
    type: 'combobox',
    label: 'Motivo',
    placeholder: 'Todos',
    options: [{ value: 'all', label: 'Todos' }, ...Object.entries(MOTIVO_ROTULO).map(([value, label]) => ({ value, label }))],
  },
  { key: 'de', type: 'date', label: 'De' },
  { key: 'ate', type: 'date', label: 'Até' },
];

const colunas: TableColumn<Chamado>[] = [
  {
    key: 'numero',
    label: 'Nº',
    render: (c) => (
      <div>
        <span className="font-mono text-sm">#{c.numero}</span>
        <p className="text-xs text-muted-foreground">{TIPO_ROTULO[c.tipo ?? 'INTERNO']}</p>
      </div>
    ),
  },
  {
    key: 'titulo',
    label: 'Chamado',
    render: (c) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium max-w-72">{c.titulo}</p>
        <p className="truncate text-xs text-muted-foreground max-w-72">
          {c.tipo === 'EXTERNO'
            ? [c.orgao, c.protocolo ? `prot. ${c.protocolo}` : null].filter(Boolean).join(' · ')
            : `${MOTIVO_ROTULO[c.motivo] ?? c.motivo} · ${PRIORIDADE_ROTULO[c.prioridade]}`}
        </p>
      </div>
    ),
  },
  {
    key: 'local',
    label: 'Local',
    render: (c) => (
      <div className="min-w-0">
        <p className="truncate text-sm max-w-56">{c.equipamento_nome ?? c.unidade_nome ?? c.planta_nome ?? '—'}</p>
        <p className="truncate text-xs text-muted-foreground max-w-56">
          {(c.equipamento_nome ? [c.planta_nome, c.unidade_nome] : c.unidade_nome ? [c.planta_nome] : []).filter(Boolean).join(' · ')}
        </p>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (c) => {
      const previsaoVencida = !estaEncerrado(c.status) && !!c.previsao_em && new Date(c.previsao_em).getTime() < Date.now();
      return (
        <div className="space-y-0.5">
          <SeloStatus status={c.status} />
          {c.tipo !== 'EXTERNO' && c.encaminhamentos[0] && c.status !== 'FECHADO' && (
            <p className="text-xs text-muted-foreground">{DESTINO_ROTULO[c.encaminhamentos[0].destino]}</p>
          )}
          {c.tipo === 'EXTERNO' && (
            <p className={cn('text-xs text-muted-foreground', previsaoVencida && 'text-destructive')}>
              {estaEncerrado(c.status)
                ? `em ${formatarDuracao(duracaoDoChamado(c))}`
                : previsaoVencida
                  ? 'previsão vencida'
                  : `há ${formatarDuracao(duracaoDoChamado(c))}`}
            </p>
          )}
        </div>
      );
    },
  },
  {
    key: 'autor',
    label: 'Quando',
    hideOnMobile: true,
    render: (c) => (
      <div>
        <p className="text-sm">{formatarDataHoraBR(c.ocorrencia_em ?? c.aberto_em ?? c.created_at)}</p>
        <p className="text-xs text-muted-foreground">{c.autor_nome ?? '—'}</p>
      </div>
    ),
  },
];

const paraParams = (f: ChamadosFilters): ListarChamadosParams => ({
  busca: f.busca || undefined,
  status: f.status !== 'all' ? f.status : undefined,
  tipo: f.tipo !== 'all' ? f.tipo : undefined,
  motivo: f.motivo !== 'all' ? f.motivo : undefined,
  orgao: f.orgao || undefined,
  de: f.de || undefined,
  ate: f.ate || undefined,
  prioridade: f.prioridade !== 'all' ? f.prioridade : undefined,
});

export default function ChamadosPage() {
  const [filters, setFilters] = useFiltrosNaUrl('chamados', filtrosIniciais);
  const [aba, setAba] = useState<'lista' | 'indicadores'>('lista');
  const [linhas, setLinhas] = useState<Chamado[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EstatisticasChamados | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [form, setForm] = useState<{ chamado: Chamado | null } | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [avisarFalta, setAvisarFalta] = useState(false);
  const podeAvisarFalta = isGlobal(useUserStore((u) => u.papel));
  const [versaoDetalhe, setVersaoDetalhe] = useState(0);
  const { data: contagem } = useChamadosContagem();
  const atualizarContagem = useAtualizarContagem();
  // Filtros salvos antes do NEXON-144 não têm os campos novos.
  const f = { ...filtrosIniciais, ...filters };

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ChamadosService.listar({ page: f.page, limit: f.limit, ...paraParams(f) });
      setLinhas(r.data ?? []);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const carregarStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      // Indicadores olham tudo do recorte (status do filtro só vale para a lista).
      setStats(await ChamadosService.estatisticas({ ...paraParams(f), status: undefined }));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoadingStats(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (aba === 'lista') carregar();
    else carregarStats();
  }, [aba, carregar, carregarStats]);

  const mudou = () => {
    if (aba === 'lista') carregar();
    else carregarStats();
    atualizarContagem();
  };

  const mudarFiltros = (p: Partial<ChamadosFilters>) => setFilters((atual) => ({ ...filtrosIniciais, ...atual, page: 1, ...p }));
  const tipoInicial: TipoChamado = f.tipo === 'INTERNO' ? 'INTERNO' : 'EXTERNO';

  const descricao = contagem
    ? `${contagem.abertos} aberto(s)${contagem.externos_abertos ? ` · ${contagem.externos_abertos} externo(s)` : ''} · ${contagem.aguardando_encaminhamento} reparo(s) aguardando encaminhamento`
    : 'Reparos de equipamento e chamados abertos com a concessionária e outros órgãos';

  return (
    <Layout>
      <Layout.Main>
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)} className="flex flex-col h-full w-full">
          <TitleCard
            title="Chamados"
            description={descricao}
            actions={
              <TabsList>
                <TabsTrigger value="lista">Lista</TabsTrigger>
                <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
              </TabsList>
            }
          />

          <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-start">
            <div className="flex-1">
              <BaseFilters filters={f} config={filterConfig} onFilterChange={(p: Partial<ChamadosFilters>) => mudarFiltros(p)} />
            </div>
            {podeAvisarFalta && (
              <button onClick={() => setAvisarFalta(true)} className="btn-minimal-outline w-full lg:w-auto whitespace-nowrap">
                <ZapOff className="mr-2 h-4 w-4" />
                <span>Avisar falta de energia</span>
              </button>
            )}
            <button onClick={() => setForm({ chamado: null })} className="btn-minimal-primary w-full lg:w-auto whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              <span>Abrir chamado</span>
            </button>
          </div>

          {f.orgao && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Órgão: <span className="font-medium text-foreground">{f.orgao}</span>
              </span>
              <button type="button" onClick={() => mudarFiltros({ orgao: '' })} className="rounded p-1 hover:bg-muted" aria-label="Tirar filtro de órgão">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <TabsContent value="lista" className="mt-0 flex-1 min-h-0 overflow-hidden">
            <BaseTable
              data={linhas as any}
              columns={colunas as any}
              loading={loading}
              pagination={{
                page: f.page,
                limit: f.limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / f.limit)),
              }}
              onPageChange={(page: number) => setFilters((atual) => ({ ...atual, page }))}
              onView={(c: any) => setDetalheId(c.id)}
              emptyMessage={f.status === 'ABERTOS' ? 'Nenhum chamado aberto' : 'Nenhum chamado encontrado'}
              emptyIcon={<Wrench className="h-8 w-8 text-muted-foreground" />}
            />
          </TabsContent>

          <TabsContent value="indicadores" className="mt-0">
            <ChamadosIndicadores
              dados={stats}
              loading={loadingStats}
              onFiltrar={(p) => {
                mudarFiltros({ ...(p.motivo ? { motivo: p.motivo } : {}), ...(p.orgao ? { orgao: p.orgao } : {}), status: 'all' });
                setAba('lista');
              }}
            />
          </TabsContent>
        </Tabs>

        <ChamadoFormModal
          aberto={!!form}
          chamado={form?.chamado}
          tipoInicial={tipoInicial}
          onClose={() => setForm(null)}
          onSalvo={(c) => {
            const editando = !!form?.chamado;
            setForm(null);
            mudou();
            if (editando) setVersaoDetalhe((v) => v + 1);
            setDetalheId(c.id);
          }}
        />
        <AvisarFaltaEnergiaModal
          aberto={avisarFalta}
          onClose={() => setAvisarFalta(false)}
          onAberto={(id) => {
            setAvisarFalta(false);
            mudou();
            if (id) setDetalheId(id);
          }}
        />
        <ChamadoDetalheModal
          chamadoId={detalheId}
          versao={versaoDetalhe}
          onClose={() => setDetalheId(null)}
          onMudou={mudou}
          onEditar={(c) => {
            setDetalheId(null);
            setForm({ chamado: c });
          }}
        />
      </Layout.Main>
    </Layout>
  );
}
