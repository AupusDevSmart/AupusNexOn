import { CalendarX2, CheckCheck, ListChecks, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { forwardRef, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CameraEvento, FiltroEventos, Paginado } from '../types';
import { agruparPorDia } from '../utils/agrupar-por-dia';
import { FILTROS_EVENTOS } from '../utils/eventos';
import { PERIODO_VAZIO, resumoPeriodo, temPeriodo, type PeriodoEventos } from '../utils/periodo';
import { AreaRolagem } from './AreaRolagem';
import { EventosSkeleton } from './CamerasSkeleton';
import { ChipFiltro } from './ChipFiltro';
import { BOTAO_SECUNDARIO, DESABILITADO, FOCO, ITEM_ATIVO } from './estilo-filtro';
import { FiltroPeriodo } from './FiltroPeriodo';
import { ItemEvento } from './ItemEvento';

export type EscopoEventos = 'todas' | 'camera';

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
  escopo: EscopoEventos;
  onEscopo: (e: EscopoEventos) => void;
  /** Nome da câmera do player (rótulo do escopo "Esta câmera"). */
  cameraNome: string | null;
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
 * Lista de eventos ao lado do player: escopo (todas / esta câmera), chips de tipo e
 * "Não vistos", grupos por dia com cabeçalho fixo e rolagem própria no desktop.
 */
export const PainelEventos = forwardRef<HTMLElement, PainelEventosProps>(function PainelEventos(
  {
    eventos,
    filtro,
    onFiltro,
    somenteNaoVistos,
    onSomenteNaoVistos,
    escopo,
    onEscopo,
    cameraNome,
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
  const comFiltro = filtro !== 'todas' || somenteNaoVistos || comPeriodo;
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
  };

  return (
    <section ref={ref} aria-label="Eventos" className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', className)}>
      <div className="flex shrink-0 flex-col gap-3 border-b border-border p-4">
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
            <h2 className="text-lg font-semibold leading-tight">Eventos</h2>
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

        <div role="radiogroup" aria-label="Câmeras da lista" className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1">
          <Segmento ativo={escopo === 'todas'} onClick={() => onEscopo('todas')}>
            Todas as câmeras
          </Segmento>
          <Segmento ativo={escopo === 'camera'} onClick={() => onEscopo('camera')} disabled={!cameraNome}>
            <span className="truncate">{cameraNome ?? 'Esta câmera'}</span>
          </Segmento>
        </div>

        {onPeriodo && <FiltroPeriodo periodo={periodo} onPeriodo={onPeriodo} resultado={resultado} />}

        <div role="group" aria-label="Filtrar eventos" className="flex flex-wrap gap-2">
          <ChipFiltro ativo={somenteNaoVistos} onClick={() => onSomenteNaoVistos(!somenteNaoVistos)} className="pr-2 touch:pr-2.5">
            Não vistos
            {naoVistos > 0 && (
              <span
                className={cn(
                  'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                  somenteNaoVistos ? 'bg-nexon-verde text-nexon-azul' : 'bg-muted text-foreground',
                )}
              >
                {naoVistos > 99 ? '99+' : naoVistos}
              </span>
            )}
          </ChipFiltro>
          <span aria-hidden className="my-1.5 w-px self-stretch bg-border" />
          {FILTROS_EVENTOS.map((f) => (
            <ChipFiltro key={f.valor} ativo={filtro === f.valor} onClick={() => onFiltro(f.valor)}>
              {f.rotulo}
            </ChipFiltro>
          ))}
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
            somenteNaoVistos={somenteNaoVistos && filtro === 'todas'}
            cameraNome={escopo === 'camera' ? cameraNome : null}
            onLimpar={limparFiltros}
          />
        ) : (
          <div className="pb-3">
            {grupos.map((g) => (
              <section key={g.chave || 'sem-data'} aria-label={g.rotulo}>
                <h3 className="sticky top-0 z-10 bg-card px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
  somenteNaoVistos,
  cameraNome,
  onLimpar,
}: {
  /** Resumo do período filtrado (vazio próprio do período); `null` = sem período. */
  periodo: string | null;
  onVerTodoPeriodo: () => void;
  outrosFiltros: boolean;
  comFiltro: boolean;
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
  } else if (comFiltro) {
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
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

function Segmento({
  ativo,
  onClick,
  disabled,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-10 min-w-0 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors touch:h-11',
        ativo ? ITEM_ATIVO : 'border-transparent text-muted-foreground mouse:hover:bg-muted mouse:hover:text-foreground',
        DESABILITADO,
        FOCO,
      )}
    >
      {children}
    </button>
  );
}
