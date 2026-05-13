interface DemandaGaugeProps {
  /** Valor atual (kW) */
  valor: number;
  /** Demanda contratada (kW). Se null/0, gauge fica vazio. */
  contratada: number | null;
  /** Cor do arco preenchido em hex. */
  cor: string;
  /** Label da contratada (ex: "Demanda Carga", "Demanda Geração") */
  labelContratada: string;
  /** Label do valor atual (ex: "Demanda atual", "Geração atual") */
  labelAtual: string;
}

// Gauge 270deg aberto embaixo:
// - inicio em 7h30 (math angle 225) — canto inferior esquerdo, 0%
// - passa pelo topo
// - fim em 4h30 (math angle 315) — canto inferior direito, 100%
// Preenchimento cresce do start em direcao ao end via stroke-dasharray.
// Permite overload visual ate 120% (a barra preenchida para no end mas
// o numero textual mostra a porcentagem real).

const SIZE = 160;
const STROKE = 14;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = (SIZE - STROKE) / 2;
const ANG_START = 225; // 7h30 em math convention (0 = direita, anti-horario)
const ANG_END = 315; // 4h30
const ARC_LEN = (270 / 360) * 2 * Math.PI * R;

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

export function DemandaGauge({
  valor,
  contratada,
  cor,
  labelContratada,
  labelAtual,
}: DemandaGaugeProps) {
  const ratio = contratada && contratada > 0 ? valor / contratada : 0;
  const ratioClamp = Math.max(0, Math.min(ratio, 1.2));
  const percentLabel = contratada && contratada > 0 ? Math.round(ratio * 100) : null;
  const filledLen = (ratioClamp / 1.2) * ARC_LEN;
  // Evita renderizar a "bolinha" do stroke-linecap=round quando ratio=0.
  const showFilled = filledLen > 0.5;

  return (
    <div className="flex flex-col items-center gap-1">
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
            {valor.toFixed(1)} kW
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {labelAtual}
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
