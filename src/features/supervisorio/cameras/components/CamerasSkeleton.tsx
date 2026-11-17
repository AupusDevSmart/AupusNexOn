import { Skeleton } from '@/components/ui/skeleton';

/** Silhueta da aba Câmeras: status em uma linha, player + faixa de câmeras e eventos ao lado. */
export function CamerasSkeleton() {
  return (
    <div role="status" aria-label="Carregando câmeras" className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4 lg:py-2.5">
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-7 w-28 rounded-sm" />
          <Skeleton className="h-5 w-72 max-w-full rounded-sm" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
      <div className="grid gap-3 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
          <Skeleton className="aspect-video w-full rounded-xl lg:aspect-auto lg:min-h-0 lg:flex-1" />
          <div className="flex shrink-0 gap-2.5 overflow-hidden p-1">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="aspect-video w-44 shrink-0 rounded-lg [@media(min-height:900px)]:lg:w-52" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4">
          <Skeleton className="h-6 w-24 rounded-sm" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 rounded-full" />
            ))}
          </div>
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
