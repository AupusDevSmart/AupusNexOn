import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Silhueta de gráfico de linha/área enquanto a primeira carga não chega:
 * marcas do eixo Y, uma área ondulada e marcas do eixo X. Ocupa a altura
 * que receber em `className` (mesma do gráfico), então a tela não pula.
 */
export function GraficoSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full gap-2", className)} role="status" aria-label="Carregando gráfico">
      <div className="flex flex-col justify-between py-1">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-2 w-6 rounded-sm" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm">
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full animate-pulse text-slate-900/10 dark:text-white/10"
            aria-hidden
          >
            <path
              d="M0 32 C10 30 15 22 25 20 S40 8 50 10 S65 22 75 18 S90 6 100 9 L100 40 L0 40 Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="flex justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-2 w-8 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
