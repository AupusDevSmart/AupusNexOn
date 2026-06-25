import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon?: LucideIcon;
  /** Nome completo — exibido no tooltip (title). */
  titulo: string;
  /** Rotulo curto exibido no card (cabe na coluna estreita). Default: titulo. */
  abrev?: string;
  valor?: string | number | null;
  unidade?: string;
  /** Regra de agregacao — entra no tooltip junto do nome completo. */
  legenda?: string;
  loading?: boolean;
}

/** Card de KPI compacto (uma linha): icone + rotulo curto a esquerda, valor a direita.
 *  O nome completo (+ regra) aparece como tooltip ao passar o mouse. */
export function KpiCard({ icon: Icon, titulo, abrev, valor, unidade, legenda, loading }: KpiCardProps) {
  return (
    <Card
      title={legenda ? `${titulo} · ${legenda}` : titulo}
      className="flex items-center justify-between gap-1.5 rounded-sm px-2.5 py-2 min-w-0"
    >
      <div className="flex min-w-0 items-center gap-1">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className="truncate text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
          {abrev ?? titulo}
        </span>
      </div>

      {loading ? (
        <div className="h-5 w-12 shrink-0 animate-pulse rounded bg-muted" />
      ) : (
        <div className="flex shrink-0 items-baseline gap-0.5">
          <span className="text-base font-semibold tabular-nums text-foreground sm:text-lg">
            {valor ?? "--"}
          </span>
          {unidade && <span className="text-[10px] text-muted-foreground">{unidade}</span>}
        </div>
      )}
    </Card>
  );
}
