import { Bell, Clock } from "lucide-react";
import { useUnidadeStatus } from "../hooks/useUnidadeStatus";
import { formatarHoraLocal, tempoRelativo } from "../utils/tempo";

interface SinopticoStatusBarProps {
  unidadeId: string;
}

const NIVEL = {
  NORMAL: { dot: "bg-emerald-500", label: "Operando normalmente" },
  ALARME: { dot: "bg-amber-500", label: "Atenção" },
  CRITICA: { dot: "bg-red-500", label: "Falha" },
} as const;

/**
 * Barra de status da unidade (R1): estado de operacao + motivo discreto,
 * ultima atualizacao (formatada em horario local) e contador de alarmes.
 */
export function SinopticoStatusBar({ unidadeId }: SinopticoStatusBarProps) {
  const { data: status } = useUnidadeStatus(unidadeId);
  const nivel = status?.nivel ?? "NORMAL";
  const info = NIVEL[nivel];
  const hora = formatarHoraLocal(status?.ultimaAtualizacao);
  const rel = tempoRelativo(status?.ultimaAtualizacao);
  const alarmes = status?.alarmesAtivos ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-border bg-card px-3 py-2 text-xs sm:text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${info.dot}`} />
        <span className="shrink-0 font-medium leading-tight text-foreground">{info.label}</span>
        {status?.motivo && (
          <span className="truncate text-muted-foreground">— {status.motivo}</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-4 text-muted-foreground">
        <span className="flex items-center gap-1.5" title={rel ?? undefined}>
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Atualizado</span>
          <span className="tabular-nums">{hora}</span>
        </span>
        <span
          className={`flex items-center gap-1.5 ${alarmes > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="tabular-nums">{alarmes}</span>
          <span className="hidden sm:inline">{alarmes === 1 ? "alarme" : "alarmes"}</span>
        </span>
      </div>
    </div>
  );
}
