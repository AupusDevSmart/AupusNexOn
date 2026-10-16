import type { ReactNode } from 'react';

export interface ItemLegenda {
  rotulo: string;
  cor: string;
  tracejada?: boolean;
}

interface LegendaSeriesProps {
  itens: ItemLegenda[];
  /** Conteúdo à direita (ex.: botão de restaurar zoom). */
  acao?: ReactNode;
  className?: string;
}

/** Legenda simples (traço + nome) em HTML, fora do SVG do gráfico. */
export function LegendaSeries({ itens, acao, className }: LegendaSeriesProps) {
  if (itens.length === 0 && !acao) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground ${className ?? ''}`}>
      {itens.map((item) => (
        <span key={item.rotulo} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block w-4 border-t-2"
            style={{ borderColor: item.cor, borderTopStyle: item.tracejada ? 'dashed' : 'solid' }}
          />
          {item.rotulo}
        </span>
      ))}
      {acao && <span className="ml-auto">{acao}</span>}
    </div>
  );
}
