import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGatewayDashboard } from "@/hooks/useGatewayDashboard";
import { Radio, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useMemo } from "react";
import { ComunicacaoCard } from "./a966/ComunicacaoCard";
import { DemandaGauge } from "./a966/DemandaGauge";
import { FluxoLiquidoCard } from "./a966/FluxoLiquidoCard";
import { ResumoDiaCard } from "./a966/ResumoDiaCard";
import { TendenciaPotencia } from "./a966/TendenciaPotencia";
import { UltimasLeiturasTable } from "./a966/UltimasLeiturasTable";

interface A966ModalProps {
  open: boolean;
  onClose: () => void;
  componenteData?: any;
  nomeComponente?: string;
}

// Cores das demandas (gauges). Slate-500 pra consumo e yellow-700 pra geracao
// — combina com as series do grafico (TendenciaPotencia).
const COR_CONSUMO = "#64748b";
const COR_GERACAO = "#a16207";

const STALE_THRESHOLD_MS = 30 * 60 * 1000;

function formatTempoRelativo(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  return `há ${dias}d`;
}

function statusFromFP(fp: number | undefined): { label: string; tone: string } {
  if (typeof fp !== "number" || !Number.isFinite(fp)) {
    return { label: "Sem dado", tone: "bg-muted text-muted-foreground border-border" };
  }
  if (fp >= 0.92) return { label: "Normal", tone: "bg-muted text-foreground border-border" };
  if (fp >= 0.8)
    return {
      label: "Atenção",
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40",
    };
  return {
    label: "Falha",
    tone: "bg-destructive/10 text-destructive border-destructive/40",
  };
}

export function A966Modal({
  open,
  onClose,
  componenteData,
  nomeComponente,
}: A966ModalProps) {
  const equipamentoId = (
    componenteData?.dados?.equipamento_id || componenteData?.id
  )?.trim();
  const nomeFallback = nomeComponente || componenteData?.nome || "Gateway IoT";

  const { data, loading, error, refetch } = useGatewayDashboard(
    open ? equipamentoId ?? null : null,
  );

  const nome = data?.equipamento?.nome ?? nomeFallback;
  const tag = data?.equipamento?.tag ?? null;
  const tipo = data?.equipamento?.tipo ?? "Gateway";

  const snapshot = data?.snapshot ?? null;
  const lastUpdate = snapshot?.timestamp_dados ? new Date(snapshot.timestamp_dados) : null;

  const isStale = useMemo(() => {
    if (!lastUpdate) return true;
    return Date.now() - lastUpdate.getTime() > STALE_THRESHOLD_MS;
  }, [lastUpdate]);

  const tempoRelativo = useMemo(
    () => (lastUpdate ? formatTempoRelativo(lastUpdate) : null),
    [lastUpdate],
  );

  const status = statusFromFP(snapshot?.FP);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-8">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{nome}</span>
                <span className="text-muted-foreground text-sm">{tipo}</span>
              </div>
              {tag && (
                <div className="text-xs text-muted-foreground font-mono pl-6">
                  TAG: {tag}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void refetch()}
                disabled={loading}
                title="Atualizar dados"
                className="h-7 px-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Badge variant="outline" className={status.tone}>
                {status.label}
              </Badge>
              {tempoRelativo ? (
                <Badge
                  variant="outline"
                  className={
                    isStale
                      ? "text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10"
                      : "text-muted-foreground border-border"
                  }
                >
                  {isStale ? (
                    <WifiOff className="h-3 w-3 mr-1" />
                  ) : (
                    <Wifi className="h-3 w-3 mr-1" />
                  )}
                  Atualizado {tempoRelativo}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground border-border">
                  <WifiOff className="h-3 w-3 mr-1" /> Sem dado
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Linha 1: 2 gauges de demanda + grafico tendencia + fluxo liquido */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-3 flex flex-col gap-3">
            <div className="rounded-sm border border-border bg-card p-3">
              <DemandaGauge
                valor={snapshot?.kW_consumo ?? 0}
                contratada={data?.unidade?.demanda_carga ?? null}
                cor={COR_CONSUMO}
                labelContratada="Demanda Carga"
                labelAtual="Demanda atual"
              />
            </div>
            <div className="rounded-sm border border-border bg-card p-3">
              <DemandaGauge
                valor={snapshot?.kW_injecao ?? 0}
                contratada={data?.unidade?.demanda_geracao ?? null}
                cor={COR_GERACAO}
                labelContratada="Demanda Geração"
                labelAtual="Geração atual"
              />
            </div>
          </div>

          <div className="xl:col-span-6 rounded-sm border border-border bg-card p-3">
            <TendenciaPotencia
              equipamentoId={equipamentoId ?? null}
              demandaCarga={data?.unidade?.demanda_carga ?? null}
              demandaGeracao={data?.unidade?.demanda_geracao ?? null}
            />
          </div>

          <div className="xl:col-span-3">
            <FluxoLiquidoCard
              fluxoLiquidoKw={snapshot?.fluxo_liquido_kw ?? 0}
              consumoKw={snapshot?.kW_consumo ?? 0}
              injecaoKw={snapshot?.kW_injecao ?? 0}
            />
          </div>
        </div>

        {/* Linha 2: resumo dia + ultimas leituras */}
        {data && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 mt-3">
            <div className="xl:col-span-5">
              <ResumoDiaCard resumo={data.resumo_dia} snapshot={snapshot} />
            </div>
            <div className="xl:col-span-7">
              <UltimasLeiturasTable leituras={data.ultimas_leituras} />
            </div>
          </div>
        )}

        {/* Linha 3: comunicacao (linha inteira) */}
        {data && (
          <div className="mt-3">
            <ComunicacaoCard comunicacao={data.comunicacao} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
