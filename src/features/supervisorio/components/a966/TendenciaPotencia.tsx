import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import {
  useGatewayTendencia,
  type GatewayTendenciaData,
  type PeriodoTendencia,
} from "@/hooks/useGatewayTendencia";

interface TendenciaPotenciaProps {
  equipamentoId: string | null;
  /** Demanda contratada de carga em kW (linha tracejada positiva). null = sem linha. */
  demandaCarga: number | null;
  /** Demanda contratada de geracao em kW (linha tracejada negativa). null = sem linha. */
  demandaGeracao: number | null;
}

const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#94a3b833";
const CONSUMO_COLOR = "#64748b"; // slate-500
const INJECAO_COLOR = "#a16207"; // yellow-700
const REFERENCE_COLOR = "#ef4444"; // red-500 (tracejada)

const PERIODOS: Array<{ value: PeriodoTendencia; label: string }> = [
  { value: "1H", label: "1H" },
  { value: "6H", label: "6H" },
  { value: "24H", label: "24H" },
  { value: "7D", label: "7D" },
  { value: "custom", label: "Personalizado" },
];

function defaultCustomRange() {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - 7 * 24 * 3_600_000);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

function formatLabel(timestamp: string, periodo: PeriodoTendencia, intervaloMin: number) {
  const d = new Date(timestamp);
  if (periodo === "7D" || intervaloMin >= 60) {
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TendenciaPotencia({
  equipamentoId,
  demandaCarga,
  demandaGeracao,
}: TendenciaPotenciaProps) {
  const [periodo, setPeriodo] = useState<PeriodoTendencia>("24H");
  const [customRange, setCustomRange] = useState(defaultCustomRange);

  const { data, loading } = useGatewayTendencia(
    equipamentoId,
    periodo,
    periodo === "custom" ? customRange.inicio : undefined,
    periodo === "custom" ? customRange.fim : undefined,
  );

  const pontos = useMemo(() => mapPontos(data, periodo), [data, periodo]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Tendência de Potência (kW)
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {PERIODOS.map((p) => (
            <Button
              key={p.value}
              type="button"
              variant={periodo === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodo(p.value)}
              className="h-7 px-2.5 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {periodo === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <DateTimeInput
            value={customRange.inicio}
            onChange={(v) => setCustomRange((r) => ({ ...r, inicio: v }))}
          />
          <span className="text-muted-foreground text-sm">até</span>
          <DateTimeInput
            value={customRange.fim}
            onChange={(v) => setCustomRange((r) => ({ ...r, fim: v }))}
          />
        </div>
      )}

      <div className="flex-1 min-h-[280px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : !pontos.length ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Sem dados no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pontos} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis
                dataKey="label"
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                minTickGap={20}
              />
              <YAxis
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickFormatter={(v) => Number(v).toFixed(0)}
                padding={{ top: 12, bottom: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "hsl(var(--popover-foreground))",
                }}
                labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                formatter={(value: any, name: string) => [
                  `${Number(value).toFixed(2)} kW`,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ color: AXIS_COLOR, fontSize: 12 }} />
              {demandaCarga && demandaCarga > 0 && (
                <ReferenceLine
                  y={demandaCarga}
                  stroke={REFERENCE_COLOR}
                  strokeDasharray="4 2"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Demanda Carga (${demandaCarga.toFixed(0)} kW)`,
                    fill: REFERENCE_COLOR,
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
              )}
              {demandaGeracao && demandaGeracao > 0 && (
                <ReferenceLine
                  y={-demandaGeracao}
                  stroke={REFERENCE_COLOR}
                  strokeDasharray="4 2"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Demanda Geração (${demandaGeracao.toFixed(0)} kW)`,
                    fill: REFERENCE_COLOR,
                    fontSize: 10,
                    position: "insideBottomRight",
                  }}
                />
              )}
              <ReferenceLine y={0} stroke={AXIS_COLOR} strokeOpacity={0.5} />
              <Line
                type="monotone"
                dataKey="consumo"
                name="Consumo (kW)"
                stroke={CONSUMO_COLOR}
                dot={false}
                activeDot={{ r: 3, fill: CONSUMO_COLOR, stroke: CONSUMO_COLOR }}
                strokeWidth={1.5}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="injecao"
                name="Injeção (kW)"
                stroke={INJECAO_COLOR}
                dot={false}
                activeDot={{ r: 3, fill: INJECAO_COLOR, stroke: INJECAO_COLOR }}
                strokeWidth={1.5}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function mapPontos(data: GatewayTendenciaData | null, periodo: PeriodoTendencia) {
  if (!data) return [];
  return data.dados.map((p) => ({
    x: p.timestamp,
    label: formatLabel(p.timestamp, periodo, data.intervalo_min),
    consumo: p.kW_consumo,
    injecao: -p.kW_injecao, // negativo no plot (convencao do screenshot)
  }));
}
