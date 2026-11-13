import { Camera as CameraIcon } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { Camera } from '../types';
import { AreaRolagem } from './AreaRolagem';

interface GradeCamerasProps {
  cameras: Camera[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
  /** Aplica origem da API + token de mídia ao caminho da miniatura. */
  urlMidia: (caminho: string | null | undefined) => string | null;
  className?: string;
}

const TECLAS_ANTERIOR = new Set(['ArrowLeft', 'ArrowUp']);
const TECLAS_PROXIMA = new Set(['ArrowRight', 'ArrowDown']);

/**
 * Miniaturas para trocar de câmera. Celular: faixa que desliza na horizontal.
 * Desktop: grade que ocupa o espaço abaixo do player, com rolagem própria.
 * Setas do teclado andam entre as câmeras; Enter/espaço escolhe.
 */
export function GradeCameras({ cameras, selecionadaId, onSelecionar, urlMidia, className }: GradeCamerasProps) {
  const listaRef = useRef<HTMLDivElement>(null);

  const mover = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = TECLAS_ANTERIOR.has(e.key) ? -1 : TECLAS_PROXIMA.has(e.key) ? 1 : 0;
    if (!delta) return;
    const botoes = Array.from(listaRef.current?.querySelectorAll<HTMLButtonElement>('button[data-camera]') ?? []);
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    if (atual < 0) return;
    e.preventDefault();
    const alvo = botoes[(atual + delta + botoes.length) % botoes.length];
    alvo?.focus();
    alvo?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <section aria-label="Câmeras da usina" className={cn('flex min-w-0 flex-col', className)}>
      <AreaRolagem orientacao="ambas" className="min-h-0 flex-1">
        <div
          ref={listaRef}
          onKeyDown={mover}
          className="flex gap-2 p-1 pb-3.5 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] lg:pb-1 lg:pr-3.5"
        >
          {cameras.map((c) => (
            <TileCamera
              key={c.id}
              camera={c}
              selecionada={c.id === selecionadaId}
              onSelecionar={() => onSelecionar(c.id)}
              src={miniaturaComVersao(urlMidia(c.miniatura_url), c.miniatura_em)}
            />
          ))}
        </div>
      </AreaRolagem>
    </section>
  );
}

/** A miniatura muda de conteúdo na mesma URL; `v=` força o navegador a buscar a nova. */
function miniaturaComVersao(url: string | null, miniaturaEm: string | null): string | null {
  if (!url || !miniaturaEm) return url;
  const t = Date.parse(miniaturaEm);
  if (Number.isNaN(t)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${t}`;
}

function TileCamera({
  camera,
  selecionada,
  onSelecionar,
  src,
}: {
  camera: Camera;
  selecionada: boolean;
  onSelecionar: () => void;
  src: string | null;
}) {
  const [imagemFalhou, setImagemFalhou] = useState(false);
  useEffect(() => setImagemFalhou(false), [src]);

  const offline = camera.status === 'offline';
  const alerta = camera.nao_lidos > 0;
  const situacao = offline ? 'sem sinal' : 'online';
  const avisos = alerta ? `, ${camera.nao_lidos} ${camera.nao_lidos === 1 ? 'evento não visto' : 'eventos não vistos'}` : '';

  return (
    <button
      type="button"
      data-camera
      onClick={onSelecionar}
      aria-label={`${camera.nome} — ${situacao}${avisos}`}
      aria-pressed={selecionada}
      className={cn(
        'relative block aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-zinc-900 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:w-full',
        selecionada ? 'ring-2 ring-nexon-verde ring-offset-2 ring-offset-background' : 'opacity-90 mouse:hover:opacity-100',
      )}
    >
      {src && !imagemFalhou ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setImagemFalhou(true)}
          className={cn('absolute inset-0 h-full w-full object-cover', offline && 'opacity-40 grayscale')}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-zinc-600" aria-hidden>
          <CameraIcon className="h-6 w-6" />
        </span>
      )}
      {offline && (
        <span className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 text-[11px] font-medium text-white/70">Sem sinal</span>
      )}
      {alerta && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums">
          {camera.nao_lidos > 99 ? '99+' : camera.nao_lidos}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4 text-[11px] font-medium text-white/95">
        <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', offline ? 'bg-zinc-400' : 'bg-nexon-verde')} />
        <span className="truncate">{camera.nome}</span>
      </span>
    </button>
  );
}
