import { Skeleton } from '@/components/ui/skeleton';

/** Silhueta da aba Câmeras: faixa de status, player + miniaturas e a lista de eventos ao lado. */
export function CamerasSkeleton() {
  return (
    <div role="status" aria-label="Carregando câmeras" className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-28 rounded-sm" />
          <Skeleton className="h-4 w-72 max-w-full rounded-sm" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
      <div className="grid gap-3 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="aspect-video w-full rounded-xl lg:max-h-[calc(100dvh-22rem)]" />
          <div className="flex gap-2 overflow-hidden lg:grid lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-video w-40 shrink-0 rounded-lg lg:w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
          <Skeleton className="h-5 w-20 rounded-sm" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-full" />
          <EventosSkeleton linhas={5} />
        </div>
      </div>
    </div>
  );
}

/** Linhas da lista de eventos em carregamento (foto + duas linhas de texto). */
export function EventosSkeleton({ linhas = 3 }: { linhas?: number }) {
  return (
    <div role="status" aria-label="Carregando eventos" className="flex flex-col gap-1">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-1.5">
          <Skeleton className="aspect-video w-[72px] shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-36 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
