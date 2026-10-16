import { useCallback, useRef } from 'react';

type Modo = 'novo' | 'esquerda' | 'direita' | 'mover';

interface Arraste {
  modo: Modo;
  indiceInicial: number;
  start0: number;
  end0: number;
}

export interface BrushOverlayProps {
  /** Posição horizontal (0 a 1) de cada ponto dentro da área útil do gráfico. */
  fracoes: number[];
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  /** Chamado ao soltar o ponteiro (hora de buscar o detalhe). */
  onCommit?: (start: number, end: number) => void;
  /** Margens do gráfico por baixo (px), para alinhar com a área útil. */
  margemEsq?: number;
  margemDir?: number;
  /** Cor da janela selecionada (token do tema). */
  cor?: string;
  className?: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Seleção de janela (brush) por cima de um gráfico bklit. O bklit não traz
 * brush no registry, então a janela é um overlay: arrastar no vazio cria uma
 * seleção nova, as alças redimensionam e arrastar dentro da janela move.
 * Posição em `calc()` a partir das frações, por isso não precisa medir nada
 * além do container no momento do arraste.
 */
export function BrushOverlay({
  fracoes,
  start,
  end,
  onChange,
  onCommit,
  margemEsq = 0,
  margemDir = 0,
  cor = 'var(--chart-1)',
  className,
}: BrushOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const arraste = useRef<Arraste | null>(null);
  const ultimo = useRef<{ start: number; end: number }>({ start, end });
  ultimo.current = { start, end };

  const total = fracoes.length;
  const posicao = (fracao: number) =>
    `calc(${margemEsq}px + ${(fracao * 100).toFixed(3)}% - ${(fracao * (margemEsq + margemDir)).toFixed(2)}px)`;

  const indiceNoX = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el || total === 0) return 0;
      const r = el.getBoundingClientRect();
      const util = Math.max(1, r.width - margemEsq - margemDir);
      const f = clamp((clientX - r.left - margemEsq) / util, 0, 1);
      let melhor = 0;
      let menor = Number.POSITIVE_INFINITY;
      for (let i = 0; i < total; i++) {
        const d = Math.abs(fracoes[i] - f);
        if (d < menor) {
          menor = d;
          melhor = i;
        }
      }
      return melhor;
    },
    [fracoes, margemDir, margemEsq, total],
  );

  const aoPressionar = (modo: Modo) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (total < 2) return;
    e.preventDefault();
    e.stopPropagation();
    const indice = indiceNoX(e.clientX);
    arraste.current = { modo, indiceInicial: indice, start0: start, end0: end };
    ref.current?.setPointerCapture(e.pointerId);
    if (modo === 'novo') onChange(indice, indice);
  };

  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arraste.current;
    if (!a) return;
    const indice = indiceNoX(e.clientX);
    const max = total - 1;
    let s = a.start0;
    let f = a.end0;
    if (a.modo === 'novo') {
      s = Math.min(a.indiceInicial, indice);
      f = Math.max(a.indiceInicial, indice);
    } else if (a.modo === 'esquerda') {
      s = clamp(indice, 0, a.end0 - 1);
    } else if (a.modo === 'direita') {
      f = clamp(indice, a.start0 + 1, max);
    } else {
      const largura = a.end0 - a.start0;
      s = clamp(a.start0 + (indice - a.indiceInicial), 0, max - largura);
      f = s + largura;
    }
    if (s !== ultimo.current.start || f !== ultimo.current.end) onChange(s, f);
  };

  const aoSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arraste.current;
    if (!a) return;
    arraste.current = null;
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* já liberado */
    }
    const { start: s, end: f } = ultimo.current;
    // Clique sem arrastar não vira janela de 1 ponto.
    if (a.modo === 'novo' && s === f) {
      onChange(a.start0, a.end0);
      return;
    }
    onCommit?.(s, f);
  };

  if (total < 2) return null;

  const fIni = fracoes[clamp(start, 0, total - 1)];
  const fFim = fracoes[clamp(end, 0, total - 1)];
  const sombra = 'color-mix(in srgb, var(--chart-background) 60%, transparent)';

  return (
    <div
      ref={ref}
      className={`absolute inset-0 select-none ${className ?? ''}`}
      style={{ touchAction: 'none', cursor: 'crosshair' }}
      onPointerDown={aoPressionar('novo')}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      role="slider"
      aria-label="Janela de zoom"
      aria-valuemin={0}
      aria-valuemax={total - 1}
      aria-valuenow={start}
    >
      {/* Sombra fora da janela */}
      <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: posicao(fIni), background: sombra }} />
      <div
        className="pointer-events-none absolute inset-y-0 right-0"
        style={{ left: posicao(fFim), background: sombra }}
      />
      {/* Janela */}
      <div
        className="absolute inset-y-0 rounded-sm"
        style={{
          left: posicao(fIni),
          width: `calc(${posicao(fFim)} - ${posicao(fIni)})`,
          background: `color-mix(in srgb, ${cor} 14%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 55%, transparent)`,
          cursor: 'grab',
        }}
        onPointerDown={aoPressionar('mover')}
      />
      {/* Alças */}
      {(
        [
          ['esquerda', fIni],
          ['direita', fFim],
        ] as const
      ).map(([modo, fracao]) => (
        <div
          key={modo}
          className="absolute inset-y-0 w-4 -translate-x-1/2"
          style={{ left: posicao(fracao), cursor: 'col-resize' }}
          onPointerDown={aoPressionar(modo)}
        >
          <div
            className="absolute left-1/2 top-1/2 h-[60%] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: cor }}
          />
        </div>
      ))}
    </div>
  );
}
