import { useMemo, useState } from "react";
import { curveMonotoneX } from "@visx/curve";
import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Legend, LegendItem, LegendLabel, LegendMarker } from "@/components/charts/legend";
import { intFmt, weekdayDateFmt } from "@/components/charts/chart-formatters";
import { COR } from "@/components/graficos/cores";
import { TooltipDestaque } from "@/components/graficos/tooltip-destaque";
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

const COR_CONSUMO = COR.consumo;
const COR_INJECAO = COR.geracao;
/** Linha tracejada da demanda contratada (limite). */
const COR_LIMITE = "var(--destructive)";

const ALTURA_GRAFICO = 280;

const PERIODOS: Array<{ value: PeriodoTendencia; label: string }> = [
  { value: "1H", label: "1H" },
  { value: "6H", label: "6H" },
  { value: "24H", label: "24H" },
  { value: "7D", label: "7D" },
  { value: "custom", label: "Personalizado" },
];

const LEGENDA = [
  { label: "Consumo", value: 0, color: COR_CONSUMO },
  { label: "Injeção", value: 0, color: COR_INJECAO },
];

function defaultCustomRange() {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - 7 * 24 * 3_600_000);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

const fmtKw = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`;

interface PontoTendencia extends Record<string, unknown> {
  date: Date;
  consumo: number;
  injecao: number;
  /** Séries invisíveis só para o eixo Y abranger a demanda contratada. */
  limiteCarga?: number;
  limiteGeracao?: number;
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

  const carga = demandaCarga && demandaCarga > 0 ? demandaCarga : null;
  const geracao = demandaGeracao && demandaGeracao > 0 ? demandaGeracao : null;

  const pontos = useMemo(() => mapPontos(data, carga, geracao), [data, carga, geracao]);

  // O bklit calcula o eixo Y só pelos dados; os limites entram como série transparente
  // (acima) e a linha tracejada é desenhada pela Grid nesses valores.
  const limites = useMemo(() => {
    const v: number[] = [];
    if (carga != null) v.push(carga);
    if (geracao != null) v.push(-geracao);
    return v;
  }, [carga, geracao]);

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
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <Legend items={LEGENDA} className="flex-row flex-wrap gap-x-4 gap-y-1">
                <LegendItem>
                  <LegendMarker />
                  <LegendLabel className="text-[11px] font-medium" />
                </LegendItem>
              </Legend>
              {carga != null && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: COR_LIMITE }} />
                  Demanda carga {intFmt(Math.round(carga))} kW
                </span>
              )}
              {geracao != null && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: COR_LIMITE }} />
                  Demanda geração {intFmt(Math.round(geracao))} kW (negativa)
                </span>
              )}
            </div>
            <div style={{ height: ALTURA_GRAFICO }}>
              <LineChart
                data={pontos}
                aspectRatio="auto"
                className="h-full"
                margin={{ top: 12, right: 16, bottom: 28, left: 56 }}
                animationDuration={0}
              >
                <Grid
                  horizontal
                  numTicksRows={5}
                  highlightRowValues={[0]}
                  highlightRowStroke={COR.neutro}
                  highlightRowStrokeOpacity={0.6}
                />
                {limites.length > 0 && (
                  <Grid
                    horizontal
                    strokeOpacity={0}
                    highlightRowValues={limites}
                    highlightRowStroke={COR_LIMITE}
                    highlightRowStrokeDasharray="6,4"
                  />
                )}
                <Line
                  dataKey="consumo"
                  stroke={COR_CONSUMO}
                  strokeWidth={2}
                  curve={curveMonotoneX}
                  fadeEdges={false}
                  animate={false}
                />
                <Line
                  dataKey="injecao"
                  stroke={COR_INJECAO}
                  strokeWidth={2}
                  curve={curveMonotoneX}
                  fadeEdges={false}
                  animate={false}
                />
                {carga != null && (
                  <Line
                    dataKey="limiteCarga"
                    stroke="transparent"
                    strokeWidth={0}
                    showHighlight={false}
                    fadeEdges={false}
                    animate={false}
                    loading={false}
                  />
                )}
                {geracao != null && (
                  <Line
                    dataKey="limiteGeracao"
                    stroke="transparent"
                    strokeWidth={0}
                    showHighlight={false}
                    fadeEdges={false}
                    animate={false}
                    loading={false}
                  />
                )}
                <XAxis numTicks={6} />
                <YAxis numTicks={5} formatValue={(v) => intFmt(Math.round(v))} />
                <ChartTooltip
                  showDots
                  dotColor={(_ponto, linha) => (linha.dataKey.startsWith("limite") ? "transparent" : linha.stroke)}
                  content={({ point }) => {
                    const p = point as PontoTendencia;
                    return (
                      <TooltipDestaque
                        titulo={weekdayDateFmt.format(p.date)}
                        linhas={[
                          { label: "Consumo", value: fmtKw(p.consumo), cor: COR_CONSUMO },
                          { label: "Injeção", value: fmtKw(p.injecao), cor: COR_INJECAO },
                        ]}
                      />
                    );
                  }}
                />
              </LineChart>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function mapPontos(
  data: GatewayTendenciaData | null,
  carga: number | null,
  geracao: number | null,
): PontoTendencia[] {
  if (!data) return [];
  return data.dados
    .map((p) => {
      const ponto: PontoTendencia = {
        date: new Date(p.timestamp),
        consumo: p.kW_consumo,
        injecao: -p.kW_injecao, // negativo no plot (convencao do screenshot)
      };
      if (carga != null) ponto.limiteCarga = carga;
      if (geracao != null) ponto.limiteGeracao = -geracao;
      return ponto;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
