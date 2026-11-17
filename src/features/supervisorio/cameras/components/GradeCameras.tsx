import { Camera as CameraIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { Camera } from '../types';
import { miniaturaComVersao } from '../utils/midia';
import { AreaRolagem } from './AreaRolagem';
import { FOCO } from './estilo-filtro';

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
 * Faixa de miniaturas para trocar a câmera do player (NEXON-108): uma linha só, com
 * rolagem lateral, em qualquer tela. Altura fixa para o player ficar com o resto no
 * desktop; com 10, 20, 30 câmeras a faixa rola e, no desktop, ganha setas nas pontas.
 * Setas do teclado andam entre as câmeras; Enter/espaço escolhe.
 */
export function GradeCameras({ cameras, selecionadaId, onSelecionar, urlMidia, className }: GradeCamerasProps) {
  const listaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pontas, setPontas] = useState({ inicio: false, fim: false });

  const medir = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const inicio = el.scrollLeft > 4;
    const fim = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setPontas((p) => (p.inicio === inicio && p.fim === fim ? p : { inicio, fim }));
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const obs = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    obs?.observe(el);
    if (listaRef.current) obs?.observe(listaRef.current);
    return () => {
      el.removeEventListener('scroll', medir);
      obs?.disconnect();
    };
  }, [medir, cameras.length]);

  // Câmera escolhida fora da tela (F5, link, clique num evento): traz para a faixa.
  useEffect(() => {
    const alvo = listaRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    alvo?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selecionadaId]);

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

  const rolar = (sentido: -1 | 1) => {
    const el = viewportRef.current;
    if (!el) return;
    const parado = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: parado ? 'auto' : 'smooth' });
  };

  return (
    <section aria-label="Câmeras da usina" className={cn('relative min-w-0 shrink-0', className)}>
      <AreaRolagem ref={viewportRef} orientacao="ambas">
        <div ref={listaRef} onKeyDown={mover} className="flex gap-2.5 p-1 pb-3.5">
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
      {/* setas só no desktop (no toque a faixa desliza com o dedo); somem na ponta */}
      {pontas.inicio && <SetaFaixa lado="esquerda" onClick={() => rolar(-1)} />}
      {pontas.fim && <SetaFaixa lado="direita" onClick={() => rolar(1)} />}
    </section>
  );
}

function SetaFaixa({ lado, onClick }: { lado: 'esquerda' | 'direita'; onClick: () => void }) {
  const Icone = lado === 'esquerda' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={lado === 'esquerda' ? 'Câmeras anteriores' : 'Mais câmeras'}
      onClick={onClick}
      className={cn(
        'absolute top-[calc(50%-5px)] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors mouse:hover:border-nexon-verde lg:flex',
        lado === 'esquerda' ? 'left-1' : 'right-1',
        FOCO,
      )}
    >
      <Icone className="h-5 w-5" aria-hidden />
    </button>
  );
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
        'relative block aspect-video w-44 shrink-0 overflow-hidden rounded-lg border-2 bg-zinc-900 text-left transition-[border-color,opacity] [@media(min-height:900px)]:lg:w-52',
        selecionada ? 'border-nexon-verde' : 'border-transparent opacity-90 mouse:hover:border-[color-mix(in_srgb,var(--nx-verde)_50%,transparent)] mouse:hover:opacity-100',
        FOCO,
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
        <span className="absolute inset-x-0 top-0 flex h-[calc(100%-2rem)] items-center justify-center text-xs font-medium text-white/75">Sem sinal</span>
      )}
      {alerta && (
        <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white tabular-nums">
          {camera.nao_lidos > 99 ? '99+' : camera.nao_lidos}
        </span>
      )}
      <span
        className={cn(
          'absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2.5 pb-1.5 pt-5 text-[13px] font-semibold text-white',
          selecionada
            ? 'bg-gradient-to-t from-[#161633] via-[color-mix(in_srgb,#161633_85%,transparent)] to-transparent'
            : 'bg-gradient-to-t from-black/85 to-transparent',
        )}
      >
        <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', offline ? 'bg-zinc-400' : 'bg-nexon-verde')} />
        <span className="truncate">{camera.nome}</span>
      </span>
    </button>
  );
}
