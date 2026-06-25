import { useState } from "react";
import { Settings2 } from "lucide-react";
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

/**
 * Medidor circular (ring) minimalista: a demanda atual no centro e o anel
 * preenchido pela % em relacao a demanda contratada. Monocromatico (token do
 * tema); quando passa de 100% (acima da contratada) o anel fica ambar.
 */
function GaugeDemanda({
  rotulo,
  valor,
  unidade,
  pct,
  contratada,
}: {
  rotulo: string;
  valor?: string;
  unidade?: string;
  pct?: number;
  contratada?: string;
}) {
  const p = Math.min(100, Math.max(0, pct ?? 0));
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = (p / 100) * C;
  const acimaDaContratada = (pct ?? 0) > 100;

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>

      <div className="relative aspect-square w-full max-w-[116px]">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {/* trilho */}
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            strokeWidth="7"
            stroke="currentColor"
            className="text-muted"
          />
          {/* progresso */}
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={`${dash} ${C}`}
            className={`transition-all ${acimaDaContratada ? "text-amber-500" : "text-foreground"}`}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-sm font-semibold tabular-nums text-foreground">{valor ?? "--"}</span>
          <span className="text-[9px] text-muted-foreground">{unidade}</span>
          {pct != null && (
            <span className="mt-0.5 text-[11px] font-medium tabular-nums text-foreground/70">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </div>

      <span className="text-center text-[10px] leading-tight text-muted-foreground/70">
        {contratada ? `de ${contratada} kW contratada` : "contratada —"}
      </span>
    </div>
  );
}

/**
 * Painel Demanda / Fluxo (R4): demanda de Carga e de Geracao como medidores
 * circulares (% da contratada), lado a lado. Sem saldo.
 */
export function DemandaFluxoPanel({ unidadeId }: DemandaFluxoPanelProps) {
  const { cargaKw, geracaoKw, demandaCarga, demandaGeracao } = useDemandaFluxo(unidadeId);
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
        <div className="grid grid-cols-2 gap-3">
          <GaugeDemanda
            rotulo="Carga"
            valor={fmt(cargaKw)}
            unidade="kW"
            pct={pctDe(cargaKw, demandaCarga)}
            contratada={fmt(demandaCarga)}
          />
          <GaugeDemanda
            rotulo="Geração"
            valor={fmt(geracaoKw)}
            unidade="kW"
            pct={pctDe(geracaoKw, demandaGeracao)}
            contratada={fmt(demandaGeracao)}
          />
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
