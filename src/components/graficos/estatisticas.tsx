import type { ReactNode } from 'react';

export interface Estatistica {
  rotulo: ReactNode;
  valor: ReactNode;
  /** Linha pequena abaixo do valor (unidade, contexto). */
  detalhe?: ReactNode;
  /** Cor da barrinha lateral (token `var(--chart-N)`); sem cor = neutra. */
  cor?: string;
}

interface EstatisticasProps {
  itens: Estatistica[];
  className?: string;
}

const COLUNAS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6',
};

/**
 * Faixa de números-resumo acima de um gráfico. O grid tem exatamente o número
 * de colunas dos itens, então nunca sobra coluna vazia; no celular cai para 2.
 */
export function Estatisticas({ itens, className }: EstatisticasProps) {
  if (itens.length === 0) return null;
  const colunas = COLUNAS[Math.min(itens.length, 6)] ?? COLUNAS[6];
  return (
    <div className={`grid ${colunas} gap-2 sm:gap-3 ${className ?? ''}`}>
      {itens.map((item, i) => (
        <div
          key={i}
          className="relative min-w-0 overflow-hidden rounded-xl border border-border bg-card/60 px-3 py-2.5"
        >
          {item.cor && (
            <span
              className="absolute inset-y-2 left-0 w-1 rounded-r-full"
              style={{ backgroundColor: item.cor }}
            />
          )}
          <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.rotulo}
          </div>
          <div className="mt-0.5 truncate text-lg font-semibold tabular-nums leading-tight">{item.valor}</div>
          {item.detalhe && <div className="truncate text-[11px] text-muted-foreground">{item.detalhe}</div>}
        </div>
      ))}
    </div>
  );
}
