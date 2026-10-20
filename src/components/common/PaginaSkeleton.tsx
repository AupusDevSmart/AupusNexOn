import { Skeleton } from "@/components/ui/skeleton";

type Variante = "tabela" | "diagrama";

/**
 * Silhueta de página enquanto o código da rota (lazy) chega. Mesmo padding do
 * Layout.Main e do TitleCard, para a tela não pular quando a página real entra.
 * Substitui o antigo `<div>Carregando...</div>` que aparecia solto no canto.
 */
export function PaginaSkeleton({ variante = "tabela" }: { variante?: Variante }) {
  return (
    <div
      className="flex h-full w-full flex-col gap-4 p-3 pt-2 sm:gap-6 sm:p-6 lg:pt-2"
      role="status"
      aria-label="Carregando página"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48 rounded-sm" />
        <Skeleton className="h-4 w-72 max-w-full rounded-sm" />
      </div>

      {variante === "tabela" && <TabelaSkeleton />}
      {variante === "diagrama" && (
        <div className="min-h-[60vh] flex-1 rounded-sm border border-border bg-card p-6">
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-1 w-3/4 rounded-full" />
            <div className="flex w-3/4 justify-between">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-16" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabelaSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row">
        <Skeleton className="h-9 flex-1 rounded-sm" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-sm" />
          <Skeleton className="h-9 w-28 rounded-sm" />
        </div>
      </div>
      <div className="w-full overflow-hidden rounded-sm border border-border bg-card">
        <div className="flex gap-4 border-b border-border p-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 flex-1 rounded-sm" />
          ))}
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex gap-4 border-b border-border p-3 last:border-b-0">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-4 flex-1 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
