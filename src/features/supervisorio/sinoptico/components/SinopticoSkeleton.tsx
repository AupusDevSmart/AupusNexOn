import { Skeleton } from "@/components/ui/skeleton";
import { GraficoSkeleton } from "@/components/graficos/grafico-skeleton";

/** Card de painel lateral em carregamento: título curto + linhas de valor. */
export function PainelSkeleton({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 rounded-sm border border-border bg-card p-3 ${className ?? ""}`}>
      <Skeleton className="h-3 w-24 rounded-sm" />
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-16 rounded-sm" />
          <Skeleton className="h-3 w-12 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

/**
 * Silhueta do sinóptico ativo (mesmo grid do SinopticoOverview): diagrama à
 * esquerda; KPIs, grandezas/demanda, gráfico e alarmes à direita. Usada
 * enquanto o código da página ou os dados da unidade chegam.
 */
export function SinopticoSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden px-2 pb-2 pt-1 sm:px-3" role="status" aria-label="Carregando sinóptico">
      <div className="grid grid-cols-1 gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.1fr_1fr]">
        <div className="relative min-h-[60vh] overflow-hidden rounded-sm border border-border bg-card xl:min-h-0">
          <DiagramaSkeleton />
        </div>
        <div className="flex flex-col gap-1.5 xl:min-h-0">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-sm border border-border bg-card p-3">
                <Skeleton className="h-2.5 w-14 rounded-sm" />
                <Skeleton className="h-5 w-16 rounded-sm" />
              </div>
            ))}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <PainelSkeleton linhas={4} />
            <PainelSkeleton linhas={4} />
          </div>
          <div className="flex min-h-[230px] flex-1 flex-col gap-2 rounded-sm border border-border bg-card p-3 xl:min-h-[320px]">
            <Skeleton className="h-3 w-28 rounded-sm" />
            <GraficoSkeleton className="min-h-0 flex-1" />
          </div>
          <PainelSkeleton linhas={1} />
        </div>
      </div>
    </div>
  );
}

/** Diagrama unifilar em carregamento: barramento com alguns equipamentos pendurados. */
export function DiagramaSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6" role="status" aria-label="Carregando diagrama">
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-1 w-3/4 rounded-full" />
      <div className="flex w-3/4 justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <Skeleton className="h-8 w-1 rounded-full" />
            <Skeleton className="h-12 w-16" />
            <Skeleton className="h-2.5 w-12 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Aba genérica (IoT, comissionamento, visão geral) em carregamento. */
export function AbaSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-3" role="status" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <PainelSkeleton key={i} linhas={1} />
        ))}
      </div>
      <div className="flex min-h-[260px] flex-1 flex-col gap-2 rounded-sm border border-border bg-card p-3">
        <Skeleton className="h-3 w-32 rounded-sm" />
        <GraficoSkeleton className="min-h-0 flex-1" />
      </div>
    </div>
  );
}
