import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PanelCard } from "./PanelCard";
import { useAlarmesUnidade } from "../hooks/useAlarmesUnidade";
import { formatarHoraLocal } from "../utils/tempo";
import { LogsMqttService } from "@/services/logs-mqtt.services";
import { useToast } from "@/hooks/use-toast";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: alarmes = [], isLoading } = useAlarmesUnidade(unidadeId);
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set());

  // Reconhecer (marcar como visto) — limpa o vermelho do trip no COA.
  const handleReconhecer = async (id: string) => {
    setAckedIds((prev) => new Set(prev).add(id));
    try {
      await LogsMqttService.reconhecer(id);
      toast({ title: "Reconhecido", description: "Alarme marcado como visto." });
      queryClient.invalidateQueries({ queryKey: ["sinoptico-alarmes"] });
    } catch {
      setAckedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast({ title: "Erro", description: "Não foi possível reconhecer.", variant: "destructive" });
    }
  };

  const verTodas = () => {
    navigate("/logs/logs-mqtt", {
      state: { filters: { unidadeId: unidadeId?.trim() }, unidadeNome },
    });
  };

  return (
    <PanelCard titulo="Alarmes ativos" className="xl:min-h-0">
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
              className="flex items-start gap-2 border-b border-border/50 py-1 last:border-0"
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
              {ackedIds.has(a.id) ? (
                <span className="flex shrink-0 items-center gap-0.5 self-center text-[10px] text-muted-foreground">
                  <Check className="h-3 w-3" /> visto
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReconhecer(a.id)}
                  className="shrink-0 self-center rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Marcar alarme como visto (reconhecer)"
                >
                  Reconhecer
                </button>
              )}
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
