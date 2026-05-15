import { useMemo, useState } from "react";

interface DemandaGaugeProps {
  /** Valor atual (kW), modo "Atual" */
  valor: number;
  /** Pico do mes corrente (kW + timestamp), modo "Mes". null = sem dado */
  picoMes: { kw: number; timestamp: string } | null;
  /** Demanda contratada (kW). Se null/0, gauge fica vazio. */
  contratada: number | null;
  /** Cor do arco preenchido em hex. */
  cor: string;
  /** Label da contratada (ex: "Demanda Carga", "Demanda Geração") */
  labelContratada: string;
  /** Label do valor atual no modo "Atual" (ex: "Demanda atual", "Geração atual") */
  labelAtual: string;
}

const SIZE = 160;
const STROKE = 14;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = (SIZE - STROKE) / 2;
const ANG_START = 225; // 7h30 em math convention (0 = direita, anti-horario)
const ANG_END = 315; // 4h30
const ARC_LEN = (270 / 360) * 2 * Math.PI * R;

const TZ = "America/Sao_Paulo";

function pointAt(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + R * Math.cos(rad),
    // Y do SVG cresce pra baixo — inverter sinal pra usar convencao math standard.
    y: CY - R * Math.sin(rad),
  };
}

const START_POINT = pointAt(ANG_START);
const END_POINT = pointAt(ANG_END);
// largeArc=1 (270 > 180), sweep=1 (clockwise visualmente em SVG, passa pelo topo).
const ARC_PATH = `M ${START_POINT.x} ${START_POINT.y} A ${R} ${R} 0 1 1 ${END_POINT.x} ${END_POINT.y}`;

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

  // No modo "mes" usa o kW do pico (ou 0 se sem dado).
  const valorMostrado = modo === "mes" ? picoMes?.kw ?? 0 : valor;

  const ratio = useMemo(
    () => (contratada && contratada > 0 ? valorMostrado / contratada : 0),
    [valorMostrado, contratada],
  );
  const ratioClamp = Math.max(0, Math.min(ratio, 1.2));
  const percentLabel = contratada && contratada > 0 ? Math.round(ratio * 100) : null;
  const filledLen = (ratioClamp / 1.2) * ARC_LEN;
  // Evita renderizar a "bolinha" do stroke-linecap=round quando ratio=0.
  const showFilled = filledLen > 0.5;

  const labelInferior =
    modo === "mes"
      ? picoMes
        ? `Pico do Mês — ${formatDataHoraBRT(picoMes.timestamp)}`
        : "Pico do Mês — sem dado"
      : labelAtual;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-full flex items-center justify-end gap-1 mb-1">
        <ToggleButton ativo={modo === "atual"} onClick={() => setModo("atual")}>
          Atual
        </ToggleButton>
        <ToggleButton
          ativo={modo === "mes"}
          onClick={() => setModo("mes")}
          disabled={!picoMes}
        >
          Mês
        </ToggleButton>
      </div>

      <div className="relative" style={{ width: SIZE, height: SIZE * 0.85 }}>
        <svg
          width={SIZE}
          height={SIZE * 0.85}
          viewBox={`0 0 ${SIZE} ${SIZE * 0.85}`}
        >
          <path
            d={ARC_PATH}
            fill="none"
            stroke="#e5e7eb"
            strokeOpacity="0.25"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {showFilled && (
            <path
              d={ARC_PATH}
              fill="none"
              stroke={cor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${filledLen} ${ARC_LEN}`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pb-2">
          <div className="text-2xl font-semibold tabular-nums" style={{ color: cor }}>
            {percentLabel !== null ? `${percentLabel}%` : "—"}
          </div>
          <div className="text-sm font-medium tabular-nums text-foreground">
            {valorMostrado.toFixed(1)} kW
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide text-center px-2 leading-tight">
            {labelInferior}
          </div>
        </div>
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
  disabled,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-sm border transition-colors
        ${
          ativo
            ? "bg-foreground/10 border-border text-foreground"
            : "bg-transparent border-border/50 text-muted-foreground hover:bg-foreground/5"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {children}
    </button>
  );
}
