import { useMemo, useState } from "react";
import { Gauge } from "@/components/charts/gauge";
import type { ChartStatFlowFormat } from "@/components/charts/chart-stat-flow";

interface DemandaGaugeProps {
  /** Valor atual (kW), modo "Atual" */
  valor: number;
  /** Pico do mes corrente (kW + timestamp), modo "Mes". null = sem dado */
  picoMes: { kw: number; timestamp: string } | null;
  /** Demanda contratada (kW). Se null/0, gauge fica vazio. */
  contratada: number | null;
  /** Cor do arco preenchido (quem chama passa; de preferência token `var(--chart-N)`). */
  cor: string;
  /** Label da contratada (ex: "Demanda Carga", "Demanda Geração") */
  labelContratada: string;
  /** Label do valor atual no modo "Atual" (ex: "Demanda atual", "Geração atual") */
  labelAtual: string;
}

const SIZE = 160;
// O arco de 270° do Gauge deixa o pé vazio: corta como o SVG antigo (0,85 × 160).
const ALTURA_VISIVEL = 140;
const FORMATO_KW: ChartStatFlowFormat = { minimumFractionDigits: 1, maximumFractionDigits: 1 };

const TZ = "America/Sao_Paulo";

function formatDataHoraBRT(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Modo = "atual" | "mes";

export function DemandaGauge({
  valor,
  picoMes,
  contratada,
  cor,
  labelContratada,
  labelAtual,
}: DemandaGaugeProps) {
  const [modo, setModo] = useState<Modo>("atual");

  // No modo "mes" usa o kW do pico. Sem dado: mostra '—'.
  const semDadoMes = modo === "mes" && !picoMes;
  const valorMostrado = modo === "mes" ? picoMes?.kw ?? 0 : valor;

  const ratio = useMemo(
    () => (contratada && contratada > 0 ? valorMostrado / contratada : 0),
    [valorMostrado, contratada],
  );
  // Arco cheio = 120% da contratada, como no gauge antigo (sobra para mostrar estouro).
  const preenchimento = (Math.max(0, Math.min(ratio, 1.2)) / 1.2) * 100;
  const percentLabel = contratada && contratada > 0 ? Math.round(ratio * 100) : null;

  const labelInferior =
    modo === "mes"
      ? picoMes
        ? `Pico do Mês — ${formatDataHoraBRT(picoMes.timestamp)}`
        : "Pico do Mês — sem dado"
      : labelAtual;

  const rotuloCentro = percentLabel !== null ? `${percentLabel}% da contratada` : "sem contratada";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-full flex items-center justify-end gap-1 mb-1">
        <ToggleButton ativo={modo === "atual"} onClick={() => setModo("atual")}>
          Atual
        </ToggleButton>
        <ToggleButton ativo={modo === "mes"} onClick={() => setModo("mes")}>
          Mês
        </ToggleButton>
      </div>

      <div className="relative overflow-hidden" style={{ width: SIZE, height: ALTURA_VISIVEL }}>
        <Gauge
          value={semDadoMes ? 0 : preenchimento}
          width={SIZE}
          height={SIZE}
          activeFill={cor}
          centerValue={semDadoMes ? undefined : valorMostrado}
          suffix=" kW"
          formatOptions={FORMATO_KW}
          defaultLabel={rotuloCentro}
        />
        {semDadoMes && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-2 text-2xl font-semibold text-muted-foreground">
            —
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide text-center px-2 leading-tight">
        {labelInferior}
      </div>
      <div className="text-xs text-muted-foreground">
        {labelContratada}:{" "}
        <span className="font-medium text-foreground tabular-nums">
          {contratada && contratada > 0 ? `${contratada.toFixed(0)} kW` : "—"}
        </span>
      </div>
    </div>
  );
}

function ToggleButton({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 border transition-colors cursor-pointer ${
        ativo
          ? "bg-foreground/10 border-border text-foreground"
          : "bg-transparent border-border/50 text-muted-foreground hover:bg-foreground/5"
      }`}
    >
      {children}
    </button>
  );
}
