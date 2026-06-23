import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PanelCard } from "./PanelCard";
import { useAlarmesUnidade } from "../hooks/useAlarmesUnidade";
import { formatarHoraLocal } from "../utils/tempo";

interface AlarmesAtivosPanelProps {
  unidadeId: string;
  unidadeNome?: string;
}

const SEV_DOT: Record<string, string> = {
  BAIXA: "bg-blue-500",
  MEDIA: "bg-yellow-500",
  ALTA: "bg-orange-500",
  CRITICA: "bg-red-500",
};

/**
 * Painel Alarmes Ativos (R5): 5 ultimos logs_mqtt da unidade.
 * "Ver todas" leva a /logs/logs-mqtt com o filtro da unidade ja aplicado
 * (via location.state).
 */
export function AlarmesAtivosPanel({ unidadeId, unidadeNome }: AlarmesAtivosPanelProps) {
  const navigate = useNavigate();
  const { data: alarmes = [], isLoading } = useAlarmesUnidade(unidadeId);

  const verTodas = () => {
    navigate("/logs/logs-mqtt", {
      state: { filters: { unidadeId: unidadeId?.trim() }, unidadeNome },
    });
  };

  return (
    <PanelCard titulo="Alarmes ativos" className="xl:flex-[1.8] xl:min-h-0">
      {isLoading ? (
        <div className="flex min-h-[3rem] items-center justify-center text-xs text-muted-foreground">
          Carregando...
        </div>
      ) : alarmes.length === 0 ? (
        <div className="flex min-h-[3rem] items-center justify-center text-xs text-muted-foreground">
          Nenhum alarme ativo
        </div>
      ) : (
        <ul className="flex flex-col">
          {alarmes.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-2 border-b border-border/50 py-1.5 last:border-0"
            >
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                  SEV_DOT[a.severidade?.toUpperCase()] ?? "bg-muted-foreground"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-foreground">
                    {a.equipamento?.nome ?? "Equipamento"}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {formatarHoraLocal(a.created_at)}
                  </span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">{a.mensagem}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={verTodas}
        className="mt-1 inline-flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
      >
        Ver todas as ocorrências
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </PanelCard>
  );
}
