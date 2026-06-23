import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";

interface PanelCardProps {
  titulo: string;
  /** Acao opcional no canto direito do cabecalho (ex.: botao configurar). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Card base dos paineis laterais do sinoptico (Grandezas, Demanda, Alarmes).
 * Cabecalho discreto + corpo. Segue os tokens muted/border do tema.
 */
export function PanelCard({ titulo, action, children, className }: PanelCardProps) {
  return (
    <Card className={`flex flex-col gap-2 rounded-sm p-3 min-w-0 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </h3>
        {action}
      </div>
      {/* Corpo: ocupa o espaco do card e rola internamente so se faltar altura */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">{children}</div>
    </Card>
  );
}
