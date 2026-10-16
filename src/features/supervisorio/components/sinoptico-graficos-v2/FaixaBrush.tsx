import { useState } from 'react';
import { curveMonotoneX } from '@visx/curve';
import { AreaChart, Area } from '@/components/charts/area-chart';
import { BrushOverlay } from '@/components/graficos/brush-overlay';
import type { Dominio } from './dados';
import { useRodaZoom, type JanelaZoom } from './use-janela-zoom';

const MARGEM = { top: 4, right: 8, bottom: 4, left: 8 };

interface FaixaBrushProps {
  /** Mesmas linhas do gráfico principal. */
  pontos: Record<string, unknown>[];
  /** Série desenhada na miniatura. */
  dataKey: string;
  cor: string;
  /** Eixo da miniatura (dia inteiro); sem ele, a extensão dos dados. */
  dominio?: Dominio;
  janela: JanelaZoom;
}

/**
 * Miniatura da série com a janela de zoom por cima — o bklit não traz Brush,
 * então é o `BrushOverlay` do app. Arrastar escolhe a janela; a roda do mouse
 * aproxima/afasta pelo centro.
 */
export function FaixaBrush({ pontos, dataKey, cor, dominio, janela }: FaixaBrushProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useRodaZoom(el, janela.rolar, false);

  return (
    <div className="shrink-0 rounded-lg border bg-card p-2">
      <div className="mb-1 flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span>
          {janela.zoomAtivo ? (
            <>
              <span className="font-medium text-foreground">Zoom</span> · arraste ou use a roda do mouse para ajustar
            </>
          ) : (
            <>
              Visão geral · <span className="font-medium">arraste ou use a roda do mouse para dar zoom</span>
            </>
          )}
        </span>
        {janela.zoomAtivo && (
          <button
            type="button"
            onClick={janela.resetar}
            className="shrink-0 text-xs font-medium text-foreground transition-opacity hover:opacity-60"
          >
            Restaurar
          </button>
        )}
      </div>
      <div ref={setEl} className="relative h-[68px]" style={{ touchAction: 'none' }}>
        <AreaChart
          data={pontos}
          xDomain={dominio}
          aspectRatio="auto"
          className="h-full"
          margin={MARGEM}
          animationDuration={0}
        >
          <Area
            dataKey={dataKey}
            fill={cor}
            fillOpacity={0.3}
            gradientToOpacity={0.05}
            strokeWidth={1}
            curve={curveMonotoneX}
            showHighlight={false}
            animate={false}
          />
        </AreaChart>
        <BrushOverlay
          fracoes={janela.fracoes}
          start={janela.inicio}
          end={janela.fim}
          onChange={janela.definir}
          margemEsq={MARGEM.left}
          margemDir={MARGEM.right}
          cor={cor}
        />
      </div>
    </div>
  );
}
