import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEventosCameras } from '../hooks/useEventosCameras';
import type { CameraEvento, FiltroEventos } from '../types';
import { agruparPorDia } from '../utils/agrupar-por-dia';
import { FILTROS_EVENTOS } from '../utils/eventos';
import { EventosSkeleton } from './CamerasSkeleton';
import { ItemEvento } from './ItemEvento';

const PAGINA = 50;

interface PainelNotificacoesProps {
  unidadeId: string;
  naoLidos: number;
  onAbrirEvento: (ev: CameraEvento) => void;
  onMarcarTodas: () => void;
  marcandoTodas: boolean;
}

/**
 * Aba "Todas as notificações": chips Todas/Pessoas/Veículos/Sistema, contador de
 * não lidas, "Marcar todas como lidas" e grupos por dia (Hoje · 07/11, Ontem · 06/11…).
 */
export function PainelNotificacoes({ unidadeId, naoLidos, onAbrirEvento, onMarcarTodas, marcandoTodas }: PainelNotificacoesProps) {
  const [filtro, setFiltro] = useState<FiltroEventos>('todas');
  const [limite, setLimite] = useState(PAGINA);
  const eventos = useEventosCameras({ unidadeId, filtro, limit: limite });

  const grupos = useMemo(() => agruparPorDia(eventos.data?.data ?? [], (e) => e.inicio_em), [eventos.data]);
  const total = eventos.data?.pagination.total ?? 0;
  const carregados = eventos.data?.data.length ?? 0;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-1.5 px-3.5 pt-3">
        {FILTROS_EVENTOS.map((f) => {
          const ativo = filtro === f.valor;
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFiltro(f.valor)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-semibold transition-colors touch:h-9',
                ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground/80 mouse:hover:bg-muted',
              )}
            >
              {f.rotulo}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 pt-1.5">
        <span className="text-xs text-muted-foreground">
          {naoLidos > 0 ? `${naoLidos} não ${naoLidos === 1 ? 'lida' : 'lidas'}` : 'Tudo lido'}
        </span>
        <button
          type="button"
          disabled={naoLidos === 0 || marcandoTodas}
          onClick={onMarcarTodas}
          className="h-9 text-xs font-semibold text-foreground/80 transition-colors disabled:opacity-40 mouse:hover:text-foreground"
        >
          Marcar todas como lidas
        </button>
      </div>

      {eventos.isPending ? (
        <div className="px-3.5 pb-3.5 pt-2">
          <EventosSkeleton linhas={5} />
        </div>
      ) : eventos.isError ? (
        <div className="flex items-center justify-between gap-2 px-3.5 py-4 text-[13px] text-muted-foreground">
          Não foi possível carregar as notificações.
          <button type="button" onClick={() => void eventos.refetch()} className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Tentar de novo
          </button>
        </div>
      ) : grupos.length === 0 ? (
        <p className="px-3.5 py-6 text-center text-[13px] text-muted-foreground">
          Nenhuma notificação{filtro !== 'todas' ? ' neste filtro' : ''}.
        </p>
      ) : (
        grupos.map((g) => (
          <section key={g.chave || 'sem-data'} aria-label={g.rotulo} className="px-3.5 pt-2">
            <h3 className="mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.rotulo}</h3>
            <ol className="flex flex-col gap-1.5">
              {g.itens.map((ev) => (
                <ItemEvento key={ev.id} evento={ev} mostrarLocal onClick={() => onAbrirEvento(ev)} />
              ))}
            </ol>
          </section>
        ))
      )}

      {carregados < total && (
        <div className="px-3.5 pt-3">
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setLimite((l) => l + PAGINA)}>
            Mostrar mais ({total - carregados})
          </Button>
        </div>
      )}
      <div className="h-3.5" />
    </div>
  );
}
