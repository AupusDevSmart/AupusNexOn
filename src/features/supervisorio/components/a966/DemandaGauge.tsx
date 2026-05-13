import { useId } from "react";

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

// Gauge semicircular 270deg aberto embaixo. SVG inline pra ter controle total
// das cores (Recharts RadialBarChart nao deixa custom facil) e nao adicionar
// dependencia. Tamanho do arco proporcional a min(valor/contratada, 1.2)
// — passa de 100% mostra ate 120% pra indicar overload.
export function DemandaGauge({
  valor,
  contratada,
  cor,
  labelContratada,
  labelAtual,
}: DemandaGaugeProps) {
  const uid = useId();
  const size = 160;
  const stroke = 14;
  const center = size / 2;
  const radius = (size - stroke) / 2;

  // Arco vai de 135deg ate 405deg (= 45deg), aberto embaixo (270deg total).
  const startAngle = 135;
  const endAngle = 45;

  const ratio = contratada && contratada > 0 ? valor / contratada : 0;
  const ratioClamp = Math.max(0, Math.min(ratio, 1.2));
  const percentLabel = contratada && contratada > 0 ? Math.round(ratio * 100) : null;

  const fullArcLen = (270 / 360) * (2 * Math.PI * radius);
  const filledLen = (ratioClamp / 1.2) * fullArcLen;

  // Pra desenhar o arco preenchido uso stroke-dasharray; o arco background
  // eh um path completo de 270deg.
  const arcPath = describeArc(center, center, radius, startAngle, endAngle);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size * 0.85 }}>
        <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size * 0.85}`}>
          <path
            d={arcPath}
            fill="none"
            stroke="#e5e7eb"
            strokeOpacity="0.3"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            id={uid}
            d={arcPath}
            fill="none"
            stroke={cor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filledLen} ${fullArcLen}`}
          />
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

// Helpers SVG: gerar path de arco a partir de angulos polares em graus.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  // Sweep 270deg = largeArc=1 quando endAngle vem antes de startAngle
  const largeArc = endAngle - startAngle <= 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
