import { cn } from '@/lib/utils';

/**
 * Escolha única entre poucas opções (período, status, destino). No celular ocupa a
 * largura toda e divide igual; no desktop encolhe para o conteúdo.
 */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
  className,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onChange: (v: T) => void;
  /** Nome do grupo para leitor de tela. */
  rotulo: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={cn('flex w-full rounded-md border border-border bg-muted/40 p-0.5 sm:inline-flex sm:w-auto', className)}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor || 'vazio'}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.valor)}
            className={cn(
              'h-8 flex-1 whitespace-nowrap rounded px-2 text-sm sm:px-3 font-medium transition-colors touch:h-10 sm:flex-none',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              ativo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
