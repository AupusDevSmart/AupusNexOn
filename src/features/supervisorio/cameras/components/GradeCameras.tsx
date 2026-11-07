import { Camera as CameraIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Camera } from '../types';

interface GradeCamerasProps {
  cameras: Camera[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
  /** Aplica origem da API + token de mídia ao caminho da miniatura. */
  urlMidia: (caminho: string | null | undefined) => string | null;
}

/** Miniaturas 16:9 das câmeras; 1 coluna no celular, quantas caberem com 240px no desktop. */
export function GradeCameras({ cameras, selecionadaId, onSelecionar, urlMidia }: GradeCamerasProps) {
  return (
    <section aria-label="Grade de câmeras" className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
      {cameras.map((c) => (
        <TileCamera
          key={c.id}
          camera={c}
          selecionada={c.id === selecionadaId}
          onSelecionar={() => onSelecionar(c.id)}
          src={miniaturaComVersao(urlMidia(c.miniatura_url), c.miniatura_em)}
        />
      ))}
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
  const situacao = alerta
    ? `${camera.nao_lidos} ${camera.nao_lidos === 1 ? 'alerta não lido' : 'alertas não lidos'}`
    : offline
      ? 'sem sinal'
      : 'ao vivo';

  return (
    <button
      type="button"
      onClick={onSelecionar}
      aria-label={`${camera.nome} — ${situacao}`}
      aria-pressed={selecionada}
      className={cn(
        'relative block aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        alerta ? 'ring-2 ring-inset ring-red-500' : selecionada ? 'ring-2 ring-inset ring-foreground/80' : '',
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
          <CameraIcon className="h-7 w-7" />
        </span>
      )}
      {offline && (
        <span className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 text-xs text-white/60">Sem sinal</span>
      )}
      <span
        aria-hidden
        className={cn('absolute right-2.5 top-2.5 h-2 w-2 rounded-full', offline ? 'bg-zinc-500' : 'bg-nexon-verde')}
      />
      {alerta && (
        <span className="absolute left-2.5 top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums">
          {camera.nao_lidos > 99 ? '99+' : camera.nao_lidos}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-5 text-xs font-medium text-white/90">
        {camera.nome}
      </span>
    </button>
  );
}
