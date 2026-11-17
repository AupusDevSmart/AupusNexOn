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
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border p-3">
        {selecionando ? (
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 touch:h-10 touch:w-10" aria-label="Cancelar seleção" onClick={sairDaSelecao}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
            <span className="text-[15px] font-semibold tabular-nums" aria-live="polite">
              {marcados.size === 0 ? 'Marque os eventos' : `${marcados.size} marcado${marcados.size > 1 ? 's' : ''}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8 px-2 text-xs touch:h-10"
              disabled={lista.length === 0}
              onClick={() => setMarcados(todosMarcados ? new Set() : new Set(lista.map((e) => e.id)))}
            >
              {todosMarcados ? 'Desmarcar todos' : `Marcar todos (${lista.length})`}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs touch:h-10"
              disabled={marcados.size === 0}
              onClick={() => onApagar?.(lista.filter((e) => marcados.has(e.id)))}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Apagar
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Eventos</h2>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground touch:h-10"
                disabled={naoVistos === 0 || marcandoTodos}
                onClick={onMarcarTodos}
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                {onApagar ? 'Marcar vistos' : 'Marcar todos como vistos'}
              </Button>
              {onApagar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground touch:h-10"
                  disabled={lista.length === 0}
                  onClick={() => setSelecionando(true)}
                >
                  <ListChecks className="h-3.5 w-3.5" aria-hidden />
                  Selecionar
                </Button>
              )}
            </div>
          </div>
        )}

        <div role="radiogroup" aria-label="Câmeras da lista" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Segmento ativo={escopo === 'todas'} onClick={() => onEscopo('todas')}>
            Todas as câmeras
          </Segmento>
          <Segmento ativo={escopo === 'camera'} onClick={() => onEscopo('camera')} disabled={!cameraNome}>
            <span className="truncate">{cameraNome ?? 'Esta câmera'}</span>
          </Segmento>
        </div>

        {onPeriodo && <FiltroPeriodo periodo={periodo} onPeriodo={onPeriodo} resultado={resultado} />}

        <div role="group" aria-label="Filtrar eventos" className="flex flex-wrap gap-1.5">
          <Chip ativo={somenteNaoVistos} onClick={() => onSomenteNaoVistos(!somenteNaoVistos)}>
            Não vistos
            {naoVistos > 0 && <span className="tabular-nums opacity-80">{naoVistos > 99 ? '99+' : naoVistos}</span>}
          </Chip>
          <span aria-hidden className="mx-0.5 w-px self-stretch bg-border" />
          {FILTROS_EVENTOS.map((f) => (
            <Chip key={f.valor} ativo={filtro === f.valor} onClick={() => onFiltro(f.valor)}>
              {f.rotulo}
            </Chip>
          ))}
        </div>

        {comFiltro && (
          <div className="flex min-h-6 items-center justify-between gap-2 text-xs">
            <p aria-live="polite" className="tabular-nums text-muted-foreground">
              {resultado === null ? (eventos.isError ? '' : 'Procurando…') : textoResultado(resultado, comPeriodo)}
            </p>
            {/* lista vazia já traz o botão de limpar no meio da tela */}
            {!!resultado && (
              <button
                type="button"
                onClick={limparFiltros}
                className="-mr-1 h-6 rounded px-1 font-medium text-foreground underline-offset-2 mouse:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch:h-10"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <AreaRolagem className="min-h-0 flex-1">
        {eventos.isPending ? (
          <div className="p-3">
            <EventosSkeleton linhas={6} />
          </div>
        ) : eventos.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">Não foi possível carregar os eventos.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void eventos.refetch()}>
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
                <h3 className="sticky top-0 z-10 bg-card px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              <div className="px-3 pt-3">
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={onMostrarMais}>
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
      <div role="status" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <CalendarX2 className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold">Nada neste período</p>
        <p className="max-w-[280px] text-[13px] font-medium text-foreground">
          {periodo}
          {cameraNome && <span className="text-muted-foreground"> · {cameraNome}</span>}
        </p>
        <p className="max-w-[260px] text-[13px] text-muted-foreground">
          {outrosFiltros ? 'Nenhum evento com esses filtros. Tente um período maior.' : 'Tente um período maior.'}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" className="touch:h-10" onClick={onVerTodoPeriodo}>
            Ver todo o período
          </Button>
          {outrosFiltros && (
            <Button type="button" variant="ghost" size="sm" className="touch:h-10" onClick={onLimpar}>
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
    <div role="status" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <ShieldCheck className="h-8 w-8 text-[color-mix(in_srgb,var(--muted-foreground)_60%,transparent)]" aria-hidden />
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="max-w-[260px] text-[13px] text-muted-foreground">{texto}</p>
      {comFiltro && (
        <Button type="button" variant="outline" size="sm" className="mt-1" onClick={onLimpar}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors touch:h-9',
        ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-[color-mix(in_srgb,var(--foreground)_80%,transparent)] mouse:hover:bg-muted',
      )}
    >
      {children}
    </button>
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
        'flex h-8 min-w-0 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors disabled:opacity-40 touch:h-10',
        ativo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground mouse:hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
