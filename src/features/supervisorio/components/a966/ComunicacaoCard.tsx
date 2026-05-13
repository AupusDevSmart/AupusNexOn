import { Card, CardContent } from "@/components/ui/card";
import { Signal } from "lucide-react";
import type { GatewayComunicacao } from "@/hooks/useGatewayDashboard";

interface ComunicacaoCardProps {
  comunicacao: GatewayComunicacao;
}

const TZ = "America/Sao_Paulo";

function formatHoraBRT(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ComunicacaoCard({ comunicacao }: ComunicacaoCardProps) {
  const pct = comunicacao.percentual;
  const tone =
    pct >= 95
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 80
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";

  return (
    <Card className="rounded-sm h-full">
      <CardContent className="grid grid-cols-3 gap-4 pt-6">
        <div>
          <div className="text-xs text-muted-foreground">Comunicação</div>
          <div className={`text-base font-semibold tabular-nums flex items-center gap-1.5 ${tone}`}>
            <Signal className="h-3.5 w-3.5" />
            {pct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Pacotes perdidos</div>
          <div className="text-base font-semibold tabular-nums">
            {comunicacao.pacotes_perdidos}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Último pulso</div>
          <div className="text-base font-semibold tabular-nums">
            {formatHoraBRT(comunicacao.ultimo_pulso)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
