import { CheckCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { forwardRef, useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CameraEvento, FiltroEventos, Paginado } from '../types';
import { agruparPorDia } from '../utils/agrupar-por-dia';
import { FILTROS_EVENTOS } from '../utils/eventos';
import { AreaRolagem } from './AreaRolagem';
import { EventosSkeleton } from './CamerasSkeleton';
import { ItemEvento } from './ItemEvento';

export type EscopoEventos = 'todas' | 'camera';

interface PainelEventosProps {
  /** Resultado de `useEventosCameras` (a aba guarda a consulta para o anterior/próximo do player). */
  eventos: {
    data?: Paginado<CameraEvento>;
    isPending: boolean;
    isError: boolean;
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
    className,
  },
  ref,
) {
  const grupos = useMemo(() => agruparPorDia(eventos.data?.data ?? [], (e) => e.inicio_em), [eventos.data]);
  const total = eventos.data?.pagination.total ?? 0;
  const carregados = eventos.data?.data.length ?? 0;
  const comFiltro = filtro !== 'todas' || somenteNaoVistos;

  const limparFiltros = () => {
    onFiltro('todas');
    onSomenteNaoVistos(false);
  };

  return (
    <section ref={ref} aria-label="Eventos" className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', className)}>
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Eventos</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs text-muted-foreground touch:h-10"
            disabled={naoVistos === 0 || marcandoTodos}
            onClick={onMarcarTodos}
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Marcar todos como vistos
          </Button>
        </div>

        <div role="radiogroup" aria-label="Câmeras da lista" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Segmento ativo={escopo === 'todas'} onClick={() => onEscopo('todas')}>
            Todas as câmeras
          </Segmento>
          <Segmento ativo={escopo === 'camera'} onClick={() => onEscopo('camera')} disabled={!cameraNome}>
            <span className="truncate">{cameraNome ?? 'Esta câmera'}</span>
          </Segmento>
        </div>

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
                      onClick={() => onAbrirEvento(ev)}
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

function Vazio({
  comFiltro,
  somenteNaoVistos,
  cameraNome,
  onLimpar,
}: {
  comFiltro: boolean;
  somenteNaoVistos: boolean;
  cameraNome: string | null;
  onLimpar: () => void;
}) {
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
      <ShieldCheck className="h-8 w-8 text-muted-foreground/60" aria-hidden />
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
        ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground/80 mouse:hover:bg-muted',
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
