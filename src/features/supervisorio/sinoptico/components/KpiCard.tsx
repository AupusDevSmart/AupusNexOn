import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon?: LucideIcon;
  titulo: string;
  valor?: string | number | null;
  unidade?: string;
  /** Regra de agregacao — vira tooltip (title) para manter o card compacto. */
  legenda?: string;
  loading?: boolean;
}

/** Card de KPI compacto (uma linha): icone + titulo a esquerda, valor a direita. */
export function KpiCard({ icon: Icon, titulo, valor, unidade, legenda, loading }: KpiCardProps) {
  return (
    <Card
      title={legenda}
      className="flex items-center justify-between gap-2 rounded-sm px-3 py-2 min-w-0"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {titulo}
        </span>
      </div>

      {loading ? (
        <div className="h-6 w-16 shrink-0 animate-pulse rounded bg-muted" />
      ) : (
        <div className="flex shrink-0 items-baseline gap-1">
          <span className="text-lg font-semibold tabular-nums text-foreground sm:text-xl">
            {valor ?? "--"}
          </span>
          {unidade && <span className="text-xs text-muted-foreground">{unidade}</span>}
        </div>
      )}
    </Card>
  );
}
