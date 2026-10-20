import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Velocimetro } from "@/components/graficos/velocimetro";
import { COR } from "@/components/graficos/cores";
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
 * Medidor circular (Gauge do bklit): a demanda atual no centro e o arco
 * preenchido pela % em relacao a demanda contratada. Cor da grandeza (carga
 * azul, geracao verde); quando passa de 100% (acima da contratada) fica ambar.
 */
function GaugeDemanda({
  rotulo,
  valor,
  pct,
  cor,
  contratada,
}: {
  rotulo: string;
  valor?: number | null;
  pct?: number;
  cor: string;
  contratada?: string;
}) {
  const p = Math.min(100, Math.max(0, pct ?? 0));
  const acimaDaContratada = (pct ?? 0) > 100;

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>

      <Velocimetro
        size={100}
        value={p}
        totalNotches={32}
        activeFill={acimaDaContratada ? COR.consumo : cor}
        valor={valor}
        unidade="kW"
        rotulo={valor != null && pct != null ? `${Math.round(pct)}%` : undefined}
      />

      <span className="text-center text-[10px] leading-tight text-muted-foreground opacity-70">
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
  const { cargaKw, geracaoKw, demandaCarga, demandaGeracao, loading } = useDemandaFluxo(unidadeId);
  const { configuracao, equipamentosDisponiveis, salvar } = useConfiguracaoDemanda(unidadeId);
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <>
      <PanelCard
        titulo="Demanda"
        className="xl:min-h-0"
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
        {loading ? (
        <div className="grid grid-cols-2 gap-3" role="status" aria-label="Carregando demanda">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-2.5 w-12 rounded-sm" />
              <Skeleton className="h-[100px] w-[100px] rounded-full" />
              <Skeleton className="h-2 w-16 rounded-sm" />
            </div>
          ))}
        </div>
        ) : (
        <div className="grid grid-cols-2 gap-3">
          <GaugeDemanda
            rotulo="Carga"
            valor={cargaKw}
            pct={pctDe(cargaKw, demandaCarga)}
            cor={COR.potencia}
            contratada={fmt(demandaCarga)}
          />
          <GaugeDemanda
            rotulo="Geração"
            valor={geracaoKw}
            pct={pctDe(geracaoKw, demandaGeracao)}
            cor={COR.geracao}
            contratada={fmt(demandaGeracao)}
          />
        </div>
        )}
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
