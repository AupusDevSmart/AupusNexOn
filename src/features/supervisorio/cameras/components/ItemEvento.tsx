import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CameraEvento, TipoEvento } from '../types';
import { corTipo, ehNaoLido, horaCurta, iconeEvento, rotuloTipo, textoChamado, tituloEvento } from '../utils/eventos';

interface ItemEventoProps {
  evento: CameraEvento;
  selecionado?: boolean;
  /** Foto do evento já com origem e token de mídia (ou null). */
  miniatura: string | null;
  onClick: () => void;
  /** Modo seleção (admin apagando em lote): `true/false` mostra a caixa; clique marca em vez de abrir. */
  marcado?: boolean;
}

/** Ponto vermelho de "não visto" (alerta sem `lido_em`). */
export function PontoNaoLido() {
  return <span role="img" aria-label="Não visto" className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-red-500" />;
}

/** Etiqueta colorida do tipo: ícone + "Pessoa", "Veículo", "Sem sinal"… */
export function EtiquetaTipo({ tipo, className }: { tipo: TipoEvento; className?: string }) {
  const Icone = iconeEvento(tipo);
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-semibold', corTipo(tipo), className)}>
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {rotuloTipo(tipo)}
    </span>
  );
}

/** Linha da lista de eventos: foto, tipo colorido, câmera e hora; ponto vermelho se não visto. */
export function ItemEvento({ evento, selecionado, miniatura, onClick, marcado }: ItemEventoProps) {
  const emSelecao = marcado !== undefined;
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [miniatura]);
  const Icone = iconeEvento(evento.tipo);
  const naoLido = ehNaoLido(evento);
  const chamado = textoChamado(evento);
  const hora = horaCurta(evento.inicio_em);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={!emSelecao && selecionado ? 'true' : undefined}
        aria-pressed={emSelecao ? marcado : undefined}
        aria-label={`${emSelecao ? (marcado ? 'Desmarcar ' : 'Marcar ') : ''}${tituloEvento(evento)} · ${evento.camera_nome} · ${hora}${naoLido ? ' · não visto' : ''}`}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg p-1.5 pr-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          emSelecao
            ? marcado
              ? 'bg-red-500/10 ring-1 ring-inset ring-red-500/40'
              : 'mouse:hover:bg-[color-mix(in_srgb,var(--muted)_60%,transparent)]'
            : selecionado
              ? 'bg-muted ring-1 ring-inset ring-[color-mix(in_srgb,var(--foreground)_25%,transparent)]'
              : 'mouse:hover:bg-[color-mix(in_srgb,var(--muted)_60%,transparent)]',
        )}
      >
        {emSelecao && (
          <span
            aria-hidden
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
              marcado ? 'border-red-500 bg-red-500 text-white' : 'border-[color-mix(in_srgb,var(--muted-foreground)_50%,transparent)]',
            )}
          >
            {marcado && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
        )}
        <span className="relative flex aspect-video w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-900 text-zinc-500">
          {miniatura && !falhou ? (
            <img src={miniatura} alt="" loading="lazy" onError={() => setFalhou(true)} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Icone className="h-4 w-4" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <EtiquetaTipo tipo={evento.tipo} />
            {naoLido && <PontoNaoLido />}
            <span className="ml-auto shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{hora}</span>
          </span>
          <span className="truncate text-[13px] text-[color-mix(in_srgb,var(--foreground)_90%,transparent)]">
            {evento.camera_nome}
            {chamado && <span className="text-muted-foreground"> · {chamado}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}
