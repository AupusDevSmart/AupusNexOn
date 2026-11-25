import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Inbox, Plus, SearchX, X, ZapOff } from 'lucide-react';
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
import { Segmentado } from './components/Segmentado';
import { diaBR, duracaoDoChamado, formatarDuracao, inicioDoPeriodo, PERIODOS, plural, type Periodo } from './utils/datas';
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
  periodo: '',
  de: '',
  ate: '',
  prioridade: 'all',
  page: 1,
  limit: 20,
};

// Opções dizem o que filtram ("Todos os tipos"): o filtro não mostra rótulo em cima.
const filtroTipo: FilterConfig = {
  key: 'tipo',
  type: 'select',
  label: 'Tipo',
  options: [
    { value: 'all', label: 'Todos os tipos' },
    { value: 'EXTERNO', label: 'Externos' },
    { value: 'INTERNO', label: 'Reparos' },
  ],
};

const filtroMotivo: FilterConfig = {
  key: 'motivo',
  type: 'select',
  label: 'Motivo',
  options: [
    { value: 'all', label: 'Todos os motivos' },
    ...Object.entries(MOTIVO_ROTULO).map(([value, label]) => ({ value, label })),
  ],
};

const filtrosLista: FilterConfig[] = [
  { key: 'busca', type: 'search', placeholder: 'Buscar número, protocolo, equipamento' },
  filtroTipo,
  {
    key: 'status',
    type: 'select',
    label: 'Status',
    options: [
      { value: 'ABERTOS', label: 'Em aberto' },
      { value: 'ABERTO', label: 'Aberto' },
      { value: 'EM_ANDAMENTO', label: 'Em andamento' },
      { value: 'ENCAMINHADO', label: 'Encaminhados' },
      { value: 'ENCERRADOS', label: 'Encerrados' },
      { value: 'RESOLVIDO', label: 'Resolvidos' },
      { value: 'FECHADO', label: 'Fechados' },
      { value: 'CANCELADO', label: 'Cancelados' },
      { value: 'all', label: 'Todos os status' },
    ],
  },
  filtroMotivo,
];

// Indicadores olham o recorte inteiro: busca e status não entram.
const filtrosIndicadores: FilterConfig[] = [filtroTipo, filtroMotivo];

const subtitulo = (c: Chamado) =>
  c.tipo === 'EXTERNO'
    ? [c.orgao, c.protocolo ? `prot. ${c.protocolo}` : null].filter(Boolean).join(' · ')
    : `${MOTIVO_ROTULO[c.motivo] ?? c.motivo} · ${PRIORIDADE_ROTULO[c.prioridade]}`;

const colunas: TableColumn<Chamado>[] = [
  {
    key: 'titulo',
    label: 'Chamado',
    render: (c) => (
      <div className="min-w-0 max-w-full lg:max-w-[22rem]">
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">#{c.numero}</span> · {TIPO_ROTULO[c.tipo ?? 'INTERNO']}
        </p>
        <p className="truncate text-sm font-medium">{c.titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitulo(c) || '—'}</p>
      </div>
    ),
  },
  {
    key: 'local',
    label: 'Local',
    render: (c) => (
      <div className="min-w-0 max-w-[12rem] lg:max-w-[16rem]">
        <p className="truncate text-sm">{c.equipamento_nome ?? c.unidade_nome ?? c.planta_nome ?? '—'}</p>
        <p className="truncate text-xs text-muted-foreground">
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
        <div className="flex flex-col items-end gap-0.5 sm:items-start">
          <SeloStatus status={c.status} />
          {c.tipo !== 'EXTERNO' && c.encaminhamentos[0] && c.status !== 'FECHADO' && (
            <p className="text-xs text-muted-foreground">{DESTINO_ROTULO[c.encaminhamentos[0].destino]}</p>
          )}
          {c.tipo === 'EXTERNO' && (
            <p className={cn('whitespace-nowrap text-xs text-muted-foreground', previsaoVencida && 'text-destructive')}>
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
    key: 'quando',
    label: 'Quando',
    hideOnMobile: true,
    render: (c) => (
      <div className="whitespace-nowrap">
        <p className="text-sm">{formatarDataHoraBR(c.ocorrencia_em ?? c.aberto_em ?? c.created_at)}</p>
        <p className="text-xs text-muted-foreground">{c.autor_nome ?? '—'}</p>
      </div>
    ),
  },
];

/** Período escolhido vence o intervalo livre (`de`/`ate`, só de links antigos). */
const intervalo = (f: ChamadosFilters) =>
  f.periodo ? { de: inicioDoPeriodo(f.periodo), ate: undefined } : { de: f.de || undefined, ate: f.ate || undefined };

const paraParams = (f: ChamadosFilters): ListarChamadosParams => ({
  busca: f.busca || undefined,
  status: f.status !== 'all' ? f.status : undefined,
  tipo: f.tipo !== 'all' ? f.tipo : undefined,
  motivo: f.motivo !== 'all' ? f.motivo : undefined,
  orgao: f.orgao || undefined,
  prioridade: f.prioridade !== 'all' ? f.prioridade : undefined,
  ...intervalo(f),
});

const temFiltro = (f: ChamadosFilters) =>
  !!f.busca || f.tipo !== 'all' || f.motivo !== 'all' || !!f.orgao || !!f.periodo || !!f.de || !!f.ate ||
  f.prioridade !== 'all' || f.status !== 'ABERTOS';

export default function ChamadosPage() {
  const [filters, setFilters] = useFiltrosNaUrl('chamados', filtrosIniciais);
  const [aba, setAba] = useState<'lista' | 'indicadores'>('lista');
  const [linhas, setLinhas] = useState<Chamado[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [stats, setStats] = useState<EstatisticasChamados | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [erroStats, setErroStats] = useState<string | null>(null);
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
    setErro(null);
    try {
      const r = await ChamadosService.listar({ page: f.page, limit: f.limit, ...paraParams(f) });
      setLinhas(r.data ?? []);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      setErro(formatApiError(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const carregarStats = useCallback(async () => {
    setLoadingStats(true);
    setErroStats(null);
    try {
      setStats(await ChamadosService.estatisticas({ ...paraParams(f), status: undefined, busca: undefined }));
    } catch (e) {
      setErroStats(formatApiError(e));
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
  const limparFiltros = () => setFilters(() => ({ ...filtrosIniciais, limit: f.limit }));
  const tipoInicial: TipoChamado = f.tipo === 'INTERNO' ? 'INTERNO' : 'EXTERNO';
  const filtrando = temFiltro(f);

  const descricao = contagem
    ? [
        plural(contagem.abertos, 'aberto', 'abertos'),
        contagem.externos_abertos ? plural(contagem.externos_abertos, 'externo', 'externos') : null,
        contagem.aguardando_encaminhamento
          ? `${plural(contagem.aguardando_encaminhamento, 'reparo', 'reparos')} sem encaminhar`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Reparos de equipamento e chamados com a concessionária e outros órgãos';

  const vazio = !loading && !erro && linhas.length === 0;

  return (
    <Layout>
      <Layout.Main>
        <Tabs
          value={aba}
          onValueChange={(v) => setAba(v as typeof aba)}
          className={cn('flex w-full flex-col', aba === 'lista' && 'lg:h-full')}
        >
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

          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className={cn('min-w-0 flex-1', aba === 'indicadores' && 'lg:max-w-xl')}>
              <BaseFilters
                filters={f}
                config={aba === 'lista' ? filtrosLista : filtrosIndicadores}
                onFilterChange={(p: Partial<ChamadosFilters>) => mudarFiltros(p)}
              />
            </div>
            <div className="flex w-full flex-row gap-2 lg:ml-auto lg:w-auto">
              {podeAvisarFalta && (
                <button
                  onClick={() => setAvisarFalta(true)}
                  className="btn-minimal-outline flex-1 whitespace-nowrap touch:h-11 lg:flex-none"
                >
                  <ZapOff className="mr-2 h-4 w-4" />
                  <span className="md:hidden">Falta de energia</span>
                  <span className="hidden md:inline">Avisar falta de energia</span>
                </button>
              )}
              <button
                onClick={() => setForm({ chamado: null })}
                className="btn-minimal-primary flex-1 whitespace-nowrap touch:h-11 lg:flex-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>Abrir chamado</span>
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Segmentado
              rotulo="Período"
              opcoes={PERIODOS}
              valor={(f.periodo as Periodo) || ''}
              onChange={(periodo) => mudarFiltros({ periodo, de: '', ate: '' })}
            />
            {(f.orgao || (!f.periodo && (f.de || f.ate))) && (
              <div className="flex flex-wrap items-center gap-2">
                {f.orgao && (
                  <Pilula rotulo={`Órgão: ${f.orgao}`} onTirar={() => mudarFiltros({ orgao: '' })} aria="Tirar filtro de órgão" />
                )}
                {!f.periodo && (f.de || f.ate) && (
                  <Pilula
                    rotulo={[f.de && `De ${diaBR(f.de)}`, f.ate && `até ${diaBR(f.ate)}`].filter(Boolean).join(' ')}
                    onTirar={() => mudarFiltros({ de: '', ate: '' })}
                    aria="Tirar intervalo de datas"
                  />
                )}
              </div>
            )}
            {filtrando && (
              <button
                type="button"
                onClick={limparFiltros}
                className="self-start rounded px-1 text-sm text-nexon-link-claro hover:underline dark:text-nexon-verde sm:ml-auto sm:self-center touch:py-2"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <TabsContent value="lista" className="mt-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
            {erro ? (
              <EstadoTela
                icone={<AlertTriangle className="h-6 w-6" />}
                titulo="Não deu para carregar os chamados"
                texto={erro}
                acao={<button className="btn-minimal-outline" onClick={carregar}>Tentar de novo</button>}
              />
            ) : vazio ? (
              filtrando ? (
                <EstadoTela
                  icone={<SearchX className="h-6 w-6" />}
                  titulo="Nenhum chamado com esses filtros"
                  texto="Tente outro período, status ou busca."
                  acao={<button className="btn-minimal-outline" onClick={limparFiltros}>Limpar filtros</button>}
                />
              ) : (
                <EstadoTela
                  icone={<Inbox className="h-6 w-6" />}
                  titulo="Nenhum chamado aberto"
                  texto="Quando faltar energia ou um equipamento der problema, registre aqui."
                  acao={
                    <button className="btn-minimal-primary" onClick={() => setForm({ chamado: null })}>
                      <Plus className="mr-2 h-4 w-4" />
                      Abrir chamado
                    </button>
                  }
                />
              )
            ) : (
              <BaseTable
                data={linhas}
                columns={colunas}
                loading={loading}
                pagination={{
                  page: f.page,
                  limit: f.limit,
                  total,
                  totalPages: Math.max(1, Math.ceil(total / f.limit)),
                }}
                onPageChange={(page: number) => setFilters((atual) => ({ ...atual, page }))}
                onView={(c) => setDetalheId(c.id)}
              />
            )}
          </TabsContent>

          <TabsContent value="indicadores" className="mt-0">
            {erroStats && !stats ? (
              <EstadoTela
                icone={<AlertTriangle className="h-6 w-6" />}
                titulo="Não deu para carregar os indicadores"
                texto={erroStats}
                acao={<button className="btn-minimal-outline" onClick={carregarStats}>Tentar de novo</button>}
              />
            ) : (
              <ChamadosIndicadores
                dados={stats}
                loading={loadingStats}
                onFiltrar={(p) => {
                  mudarFiltros({ ...(p.motivo ? { motivo: p.motivo } : {}), ...(p.orgao ? { orgao: p.orgao } : {}), status: 'all' });
                  setAba('lista');
                }}
              />
            )}
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

function Pilula({ rotulo, onTirar, aria }: { rotulo: string; onTirar: () => void; aria: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-card py-0.5 pl-2.5 pr-1 text-sm">
      <span className="truncate">{rotulo}</span>
      <button
        type="button"
        onClick={onTirar}
        aria-label={aria}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground touch:p-2"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** Vazio, sem resultado e erro: desenho simples, uma frase e o próximo passo. */
function EstadoTela({ icone, titulo, texto, acao }: { icone: React.ReactNode; titulo: string; texto: string; acao: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icone}</span>
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{texto}</p>
      </div>
      {acao}
    </div>
  );
}
