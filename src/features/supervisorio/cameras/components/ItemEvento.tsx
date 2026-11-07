import { cn } from '@/lib/utils';
import { formatarHoraLocal } from '@/features/supervisorio/sinoptico/utils/tempo';
import type { CameraEvento } from '../types';
import { ehNaoLido, iconeEvento, tituloEvento } from '../utils/eventos';

interface ItemEventoProps {
  evento: CameraEvento;
  selecionado?: boolean;
  /** Mostra "local · hora" (lista de todas as notificações) em vez de só a hora. */
  mostrarLocal?: boolean;
  onClick: () => void;
}

/** Ponto vermelho de "não lida" (alerta sem `lido_em`). */
export function PontoNaoLido() {
  return <span role="img" aria-label="Não lida" className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-red-500" />;
}

/** Linha de evento: ícone por tipo, título, hora (ou local · hora) e ponto de não lido. */
export function ItemEvento({ evento, selecionado, mostrarLocal, onClick }: ItemEventoProps) {
  const Icone = iconeEvento(evento.tipo);
  const hora = formatarHoraLocal(evento.inicio_em);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={selecionado ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg border bg-muted/40 px-2.5 py-2 text-left transition-colors mouse:hover:bg-muted',
          selecionado ? 'border-foreground/40' : 'border-transparent',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/80">
          <Icone className="h-4 w-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight">
            <span className="truncate">{tituloEvento(evento)}</span>
            {ehNaoLido(evento) && <PontoNaoLido />}
          </span>
          <span className="truncate text-xs tabular-nums text-muted-foreground">
            {mostrarLocal ? `${evento.camera_nome} · ${hora}` : hora}
          </span>
        </span>
      </button>
    </li>
  );
}
