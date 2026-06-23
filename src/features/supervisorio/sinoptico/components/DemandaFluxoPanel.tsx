import { useState } from "react";
import { ArrowRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfiguracaoDemandaModal } from "@/features/supervisorio/components/ConfiguracaoDemandaModal";
import { PanelCard } from "./PanelCard";
import { useDemandaFluxo } from "../hooks/useDemandaFluxo";
import { useConfiguracaoDemanda } from "../hooks/useConfiguracaoDemanda";

interface DemandaFluxoPanelProps {
  unidadeId: string;
}

function fmt(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function pctDe(v: number | null, ref: number | null): number | undefined {
  if (v == null || ref == null || ref <= 0) return undefined;
  return (v / ref) * 100;
}

/** Barra de progresso de demanda (carga/geração). */
function BarraDemanda({
  rotulo,
  valor,
  unidade,
  pct,
  referencia,
}: {
  rotulo: string;
  valor?: string;
  unidade?: string;
  pct?: number;
  referencia?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </span>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {valor ?? "--"}
          {unidade && <span className="ml-1 text-xs font-normal text-muted-foreground">{unidade}</span>}
          {pct != null && (
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">{Math.round(pct)}%</span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/60 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
        />
      </div>
      {referencia && <span className="text-[11px] text-muted-foreground/70">{referencia}</span>}
    </div>
  );
}

/**
 * Painel Demanda / Fluxo (R4). Carga (consumo) e Geração separados por fluxo,
 * reusando a config de demanda (useDemandaFluxo). Saldo = Geração − Carga.
 */
export function DemandaFluxoPanel({ unidadeId }: DemandaFluxoPanelProps) {
  const { cargaKw, geracaoKw, saldoKw, demandaCarga, demandaGeracao } = useDemandaFluxo(unidadeId);
  const { configuracao, equipamentosDisponiveis, salvar } = useConfiguracaoDemanda(unidadeId);
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <>
      <PanelCard
        titulo="Demanda / Fluxo"
        className="xl:flex-[1.1] xl:min-h-0"
        action={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Configurar demanda"
            onClick={() => setConfigOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        }
      >
      <div className="flex flex-col gap-2">
        <BarraDemanda
          rotulo="Carga"
          valor={fmt(cargaKw)}
          unidade="kW"
          pct={pctDe(cargaKw, demandaCarga)}
          referencia={demandaCarga != null ? `Demanda contratada ${fmt(demandaCarga)} kW` : "Demanda contratada"}
        />
        <BarraDemanda
          rotulo="Geração"
          valor={fmt(geracaoKw)}
          unidade="kW"
          pct={pctDe(geracaoKw, demandaGeracao)}
          referencia={demandaGeracao != null ? `Demanda de geração ${fmt(demandaGeracao)} kW` : "Demanda de geração"}
        />
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saldo
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-foreground tabular-nums">
            {fmt(saldoKw) ?? "--"} kW
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </div>
      </div>
      </PanelCard>
      <ConfiguracaoDemandaModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        configuracao={configuracao}
        equipamentosDisponiveis={equipamentosDisponiveis}
        onSalvar={salvar}
      />
    </>
  );
}
