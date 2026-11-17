import { CalendarX2, Cctv, CheckCheck, ListChecks, ListFilter, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CameraEvento, FiltroEventos, Paginado } from '../types';
import { agruparPorDia } from '../utils/agrupar-por-dia';
import { FILTROS_EVENTOS } from '../utils/eventos';
import { PERIODO_VAZIO, resumoPeriodo, temPeriodo, type PeriodoEventos } from '../utils/periodo';
import { AreaRolagem } from './AreaRolagem';
import { EventosSkeleton } from './CamerasSkeleton';
import { ChipFiltro } from './ChipFiltro';
import { BOTAO_SECUNDARIO } from './estilo-filtro';
import { FiltroPeriodo } from './FiltroPeriodo';
import { ItemEvento } from './ItemEvento';
import { SeletorFiltro, type OpcaoSeletor } from './SeletorFiltro';

/** Câmera no seletor da lista (nome, situação e não vistos). */
export interface CameraFiltro {
  id: string;
  nome: string;
  status: 'online' | 'offline';
  naoVistos: number;
}

/** Valor do seletor de câmera para "todas" (não colide com id de câmera, que é UUID). */
const TODAS = '';

interface PainelEventosProps {
  /** Resultado de `useEventosCameras` (a aba guarda a consulta para o anterior/próximo do player). */
  eventos: {
    data?: Paginado<CameraEvento>;
    isPending: boolean;
    isError: boolean;
    /** Lista anterior na tela enquanto o filtro novo carrega (não vale como contagem). */
    isPlaceholderData?: boolean;
    refetch: () => unknown;
  };
  filtro: FiltroEventos;
  onFiltro: (f: FiltroEventos) => void;
  somenteNaoVistos: boolean;
  onSomenteNaoVistos: (v: boolean) => void;
  /** Câmeras da usina no seletor; com uma só, o seletor não aparece. */
  cameras?: CameraFiltro[];
  /** Câmera filtrada na lista; `null` = todas. */
  cameraFiltro: string | null;
  onCameraFiltro: (id: string | null) => void;
  /** Câmera do player: ganha a nota "no player" no seletor. */
  cameraPlayerId?: string | null;
  naoVistos: number;
  eventoSelId: string | null;
  onAbrirEvento: (ev: CameraEvento) => void;
  onMarcarTodos: () => void;
  marcandoTodos: boolean;
  onMostrarMais: () => void;
  urlMidia: (caminho: string | null | undefined) => string | null;
  /** Só admin: apaga os eventos marcados (a aba confirma antes). Sem ele, não há modo seleção. */
  onApagar?: (eventos: CameraEvento[]) => void;
  /** Muda depois de apagar: limpa a seleção. */
  apagadosEm?: number;
  /** Filtro de período (dia/intervalo e faixa de hora); sem `onPeriodo` o botão não aparece. */
  periodo?: PeriodoEventos;
  onPeriodo?: (p: PeriodoEventos) => void;
  className?: string;
}

/**
 * Lista de eventos ao lado do player (NEXON-108): filtros compactos fixos no topo
 * (câmera, período, tipo e "Não vistos", em duas linhas) e a lista, agrupada por dia,
 * com rolagem própria no desktop.
 */
export const PainelEventos = forwardRef<HTMLElement, PainelEventosProps>(function PainelEventos(
  {
    eventos,
    filtro,
    onFiltro,
    somenteNaoVistos,
    onSomenteNaoVistos,
    cameras = [],
    cameraFiltro,
    onCameraFiltro,
    cameraPlayerId = null,
    naoVistos,
    eventoSelId,
    onAbrirEvento,
    onMarcarTodos,
    marcandoTodos,
    onMostrarMais,
    urlMidia,
    onApagar,
    apagadosEm,
    periodo = PERIODO_VAZIO,
    onPeriodo,
    className,
  },
  ref,
) {
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setMarcados(new Set());
    setSelecionando(false);
  }, [apagadosEm]);
  const grupos = useMemo(() => agruparPorDia(eventos.data?.data ?? [], (e) => e.inicio_em), [eventos.data]);
  const total = eventos.data?.pagination.total ?? 0;
  const carregados = eventos.data?.data.length ?? 0;
  const comPeriodo = temPeriodo(periodo);
  const cameraSel = cameraFiltro ? cameras.find((c) => c.id === cameraFiltro) ?? null : null;
  const comCamera = !!cameraSel;
  const comFiltro = filtro !== 'todas' || somenteNaoVistos || comPeriodo || comCamera;
  const seletorCamera = cameras.length > 1;
  const opcoesCamera = useMemo<OpcaoSeletor<string>[]>(
    () => [
      { valor: TODAS, rotulo: 'Todas as câmeras' },
      ...cameras.map((c) => ({
        valor: c.id,
        rotulo: c.nome,
        status: c.status,
        contador: c.naoVistos,
        nota: c.id === cameraPlayerId ? 'no player' : undefined,
      })),
    ],
    [cameras, cameraPlayerId],
  );
  const contando = eventos.isPending || !!eventos.isPlaceholderData;
  const resultado = contando || eventos.isError ? null : total;

  const lista = eventos.data?.data ?? [];
  const sairDaSelecao = () => {
    setSelecionando(false);
    setMarcados(new Set());
  };
  const alternarMarcado = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  const todosMarcados = lista.length > 0 && lista.every((e) => marcados.has(e.id));

  const limparFiltros = () => {
    onFiltro('todas');
    onSomenteNaoVistos(false);
    onPeriodo?.(PERIODO_VAZIO);
    if (comCamera) onCameraFiltro(null);
  };

  return (
    <section ref={ref} aria-label="Eventos" className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', className)}>
      <div className="flex shrink-0 flex-col gap-3 border-b border-border p-3 sm:p-4">
        {selecionando ? (
          <div className="flex items-center gap-1.5">
            <button type="button" className={cn(BOTAO_SECUNDARIO, '-ml-2 h-10 w-10 touch:h-11 touch:w-11')} aria-label="Cancelar seleção" onClick={sairDaSelecao}>
              <X className="h-5 w-5" aria-hidden />
            </button>
            <span className="text-base font-semibold tabular-nums" aria-live="polite">
              {marcados.size === 0 ? 'Marque os eventos' : `${marcados.size} marcado${marcados.size > 1 ? 's' : ''}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-10 px-3 text-sm touch:h-11"
              disabled={lista.length === 0}
              onClick={() => setMarcados(todosMarcados ? new Set() : new Set(lista.map((e) => e.id)))}
            >
              {todosMarcados ? 'Desmarcar todos' : `Marcar todos (${lista.length})`}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-10 gap-2 px-3.5 text-sm touch:h-11"
              disabled={marcados.size === 0}
              onClick={() => onApagar?.(lista.filter((e) => marcados.has(e.id)))}
            >
              <Trash2 className="h-[18px] w-[18px]" aria-hidden />
              Apagar
            </Button>
          </div>
        ) : (
          <div className="flex min-h-10 items-center justify-between gap-2">
            <h2 className="pl-1 text-lg font-semibold leading-tight">Eventos</h2>
            {/* no painel estreito (lg, 340 px) as ações ficam só com ícone; nome continua no leitor de tela e no title */}
            <div className="-mr-2 flex items-center gap-1">
              <button
                type="button"
                title={onApagar ? 'Marcar vistos' : 'Marcar todos como vistos'}
                className={cn(BOTAO_SECUNDARIO, 'h-10 min-w-10 px-2.5 text-sm touch:h-11')}
                disabled={naoVistos === 0 || marcandoTodos}
                onClick={onMarcarTodos}
              >
                <CheckCheck className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className={cn(onApagar && 'lg:max-xl:sr-only')}>{onApagar ? 'Marcar vistos' : 'Marcar todos como vistos'}</span>
              </button>
              {onApagar && (
                <button
                  type="button"
                  title="Selecionar"
                  className={cn(BOTAO_SECUNDARIO, 'h-10 min-w-10 px-2.5 text-sm touch:h-11')}
                  disabled={lista.length === 0}
                  onClick={() => setSelecionando(true)}
                >
                  <ListChecks className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="lg:max-xl:sr-only">Selecionar</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div role="group" aria-label="Filtrar eventos" className="grid grid-cols-2 gap-2">
          {seletorCamera && (
            <SeletorFiltro
              rotulo="Câmera"
              icone={Cctv}
              valor={cameraSel?.id ?? TODAS}
              padrao={TODAS}
              opcoes={opcoesCamera}
              onValor={(v) => onCameraFiltro(v || null)}
            />
          )}
          {onPeriodo && (
            <FiltroPeriodo
              compacto
              periodo={periodo}
              onPeriodo={onPeriodo}
              resultado={resultado}
              className={cn(!seletorCamera && 'col-span-2')}
            />
          )}
          <SeletorFiltro
            rotulo="Tipo"
            icone={ListFilter}
            valor={filtro}
            padrao="todas"
            opcoes={OPCOES_TIPO}
            onValor={onFiltro}
            textoGatilho={filtro === 'todas' ? 'Todos os tipos' : undefined}
          />
          <ChipFiltro
            ativo={somenteNaoVistos}
            onClick={() => onSomenteNaoVistos(!somenteNaoVistos)}
            className="min-w-0 justify-center px-3 touch:px-3"
          >
            <span className="truncate">Não vistos</span>
            {naoVistos > 0 && (
              <span
                className={cn(
                  'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                  somenteNaoVistos ? 'bg-nexon-verde text-nexon-azul' : 'bg-red-500 text-white',
                )}
              >
                {naoVistos > 99 ? '99+' : naoVistos}
              </span>
            )}
          </ChipFiltro>
        </div>

        {comFiltro && (
          <div className="-mb-1 flex min-h-10 items-center justify-between gap-2 text-sm">
            <p aria-live="polite" className="tabular-nums text-muted-foreground">
              {resultado === null ? (eventos.isError ? '' : 'Procurando…') : textoResultado(resultado, comPeriodo)}
            </p>
            {/* lista vazia já traz o botão de limpar no meio da tela */}
            {!!resultado && (
              <button
                type="button"
                onClick={limparFiltros}
                className={cn(BOTAO_SECUNDARIO, '-mr-2 h-10 shrink-0 px-2.5 text-sm text-foreground touch:h-11')}
              >
                <X className="h-[18px] w-[18px]" aria-hidden />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <AreaRolagem className="min-h-0 flex-1">
        {eventos.isPending ? (
          <div className="p-4">
            <EventosSkeleton linhas={6} />
          </div>
        ) : eventos.isError ? (
          <div role="alert" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">Não foi possível carregar os eventos.</p>
            <Button type="button" variant="outline" className="h-10 text-sm touch:h-11" onClick={() => void eventos.refetch()}>
              <RefreshCw aria-hidden />
              Tentar de novo
            </Button>
          </div>
        ) : grupos.length === 0 ? (
          <Vazio
            periodo={comPeriodo ? resumoPeriodo(periodo) : null}
            onVerTodoPeriodo={() => onPeriodo?.(PERIODO_VAZIO)}
            outrosFiltros={filtro !== 'todas' || somenteNaoVistos}
            comFiltro={comFiltro}
            filtroTipo={filtro !== 'todas'}
            somenteNaoVistos={somenteNaoVistos && filtro === 'todas'}
            cameraNome={cameraSel?.nome ?? null}
            onLimpar={limparFiltros}
          />
        ) : (
          <div className="pb-3">
            {grupos.map((g) => (
              <section key={g.chave || 'sem-data'} aria-label={g.rotulo}>
                <h3 className="sticky top-0 z-10 bg-card px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.rotulo}
                </h3>
                <ol className="flex flex-col gap-0.5 px-1.5">
                  {g.itens.map((ev) => (
                    <ItemEvento
                      key={ev.id}
                      evento={ev}
                      selecionado={eventoSelId === ev.id}
                      miniatura={urlMidia(ev.snapshot_url)}
                      marcado={selecionando ? marcados.has(ev.id) : undefined}
                      onClick={() => (selecionando ? alternarMarcado(ev.id) : onAbrirEvento(ev))}
                    />
                  ))}
                </ol>
              </section>
            ))}
            {carregados < total && (
              <div className="px-4 pt-3">
                <Button type="button" variant="outline" className="h-10 w-full text-sm touch:h-11" onClick={onMostrarMais}>
                  Mostrar mais ({total - carregados})
                </Button>
              </div>
            )}
          </div>
        )}
      </AreaRolagem>
    </section>
  );
});

const OPCOES_TIPO: OpcaoSeletor<FiltroEventos>[] = FILTROS_EVENTOS.map((f) => ({ valor: f.valor, rotulo: f.rotulo }));

/** "12 eventos neste período" · "1 evento com esse filtro" · "Nenhum evento neste período". */
function textoResultado(n: number, comPeriodo: boolean): string {
  const onde = comPeriodo ? 'neste período' : 'com esse filtro';
  if (n === 0) return `Nenhum evento ${onde}`;
  return `${n} evento${n > 1 ? 's' : ''} ${onde}`;
}

function Vazio({
  periodo,
  onVerTodoPeriodo,
  outrosFiltros,
  comFiltro,
  filtroTipo,
  somenteNaoVistos,
  cameraNome,
  onLimpar,
}: {
  /** Resumo do período filtrado (vazio próprio do período); `null` = sem período. */
  periodo: string | null;
  onVerTodoPeriodo: () => void;
  outrosFiltros: boolean;
  comFiltro: boolean;
  /** Filtro de tipo ligado (Pessoas, Veículos…). */
  filtroTipo: boolean;
  somenteNaoVistos: boolean;
  cameraNome: string | null;
  onLimpar: () => void;
}) {
  if (periodo) {
    return (
      <div role="status" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <CalendarX2 className="mb-1 h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="text-base font-semibold">Nada neste período</p>
        <p className="max-w-[300px] text-sm font-medium text-foreground">
          {periodo}
          {cameraNome && <span className="text-muted-foreground"> · {cameraNome}</span>}
        </p>
        <p className="max-w-[280px] text-sm text-muted-foreground">
          {outrosFiltros ? 'Nenhum evento com esses filtros. Tente um período maior.' : 'Tente um período maior.'}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" className="h-10 text-sm touch:h-11" onClick={onVerTodoPeriodo}>
            Ver todo o período
          </Button>
          {outrosFiltros && (
            <Button type="button" variant="ghost" className="h-10 text-sm touch:h-11" onClick={onLimpar}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>
    );
  }
  let titulo = 'Nenhum evento ainda';
  let texto = 'Quando alguém ou algo aparecer nas câmeras, o evento chega aqui com foto e hora.';
  if (somenteNaoVistos) {
    titulo = 'Tudo visto';
    texto = 'Nenhum evento esperando você.';
  } else if (filtroTipo) {
    titulo = 'Nada com esse filtro';
    texto = cameraNome ? `Nenhum evento desse tipo em ${cameraNome}.` : 'Nenhum evento desse tipo nas câmeras.';
  } else if (cameraNome) {
    texto = `Nada registrado em ${cameraNome} até agora.`;
  }
  return (
    <div role="status" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <ShieldCheck className="mb-1 h-10 w-10 text-[color-mix(in_srgb,var(--muted-foreground)_60%,transparent)]" aria-hidden />
      <p className="text-base font-semibold">{titulo}</p>
      <p className="max-w-[280px] text-sm text-muted-foreground">{texto}</p>
      {comFiltro && (
        <Button type="button" variant="outline" className="mt-2 h-10 text-sm touch:h-11" onClick={onLimpar}>
          {filtroTipo || somenteNaoVistos ? 'Limpar filtros' : 'Ver todas as câmeras'}
        </Button>
      )}
    </div>
  );
}
