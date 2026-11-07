import { Skeleton } from '@/components/ui/skeleton';

/** Silhueta da aba Câmeras: cabeçalho, cartão do alerta, grade 16:9 e painel lateral. */
export function CamerasSkeleton() {
  return (
    <div role="status" aria-label="Carregando câmeras" className="flex flex-col gap-4 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-28 rounded-sm" />
          <Skeleton className="h-3 w-44 rounded-sm" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:w-[400px]">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="aspect-video w-full rounded-lg" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Linhas da lista de eventos em carregamento. */
export function EventosSkeleton({ linhas = 3 }: { linhas?: number }) {
  return (
    <div role="status" aria-label="Carregando eventos" className="flex flex-col gap-1.5">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
