import type { ReactNode } from 'react';

export interface LinhaTooltip {
  label: string;
  value: ReactNode;
  /** Cor da bolinha da série (token `var(--chart-N)`). */
  cor?: string;
}

interface TooltipDestaqueProps {
  /** Linha pequena acima do valor (data, dia, categoria). */
  titulo?: ReactNode;
  /** Valor principal, já formatado (sem unidade). */
  valor?: ReactNode;
  unidade?: ReactNode;
  /** Legenda do valor principal ("Potência", "Energia gerada"). */
  rotulo?: ReactNode;
  linhas?: LinhaTooltip[];
  className?: string;
}

/**
 * Conteúdo do `ChartTooltip content={...}` do bklit no padrão NexON:
 * valor grande + unidade, com linhas secundárias. O painel (fundo, borda,
 * sombra) é do próprio tooltip; aqui só o miolo.
 */
export function TooltipDestaque({ titulo, valor, unidade, rotulo, linhas, className }: TooltipDestaqueProps) {
  return (
    <div className={`min-w-[180px] px-3 py-2.5 text-chart-tooltip-foreground ${className ?? ''}`}>
      {titulo && <div className="mb-1 text-[11px] font-medium text-chart-tooltip-muted">{titulo}</div>}
      {valor !== undefined && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums leading-none">{valor}</span>
          {unidade && <span className="text-sm font-semibold text-chart-tooltip-muted">{unidade}</span>}
        </div>
      )}
      {rotulo && <div className="mt-0.5 text-xs text-chart-tooltip-muted">{rotulo}</div>}
      {linhas && linhas.length > 0 && (
        <div className={`space-y-1 ${valor !== undefined || titulo ? 'mt-2 border-t border-white/10 pt-2' : ''}`}>
          {linhas.map((linha) => (
            <div key={linha.label} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-chart-tooltip-muted">
                {linha.cor && (
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: linha.cor }} />
                )}
                {linha.label}
              </span>
              <span className="font-semibold tabular-nums">{linha.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
