/**
 * Potência "agora" (último minuto) + curva da última hora — vem da parcial de 1 em 1 min
 * que a TON-V2 publica entre os blocos do medidor (ssu_minutos). Só exibição: energia e
 * demanda continuam vindo dos blocos de fim de intervalo (sincronizados com o medidor da
 * concessionária). Gateway A-966 não tem parcial → o card não aparece.
 */
import { useMemo } from "react";
import { curveMonotoneX } from "@visx/curve";
import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { ChartTooltip } from "@/components/charts/tooltip";
import { formatHoraMinuto } from "@/components/charts/chart-formatters";
import { TooltipDestaque } from "@/components/graficos/tooltip-destaque";
import type { GatewayMinuto } from "@/hooks/useGatewayDashboard";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

interface PontoMinuto extends Record<string, unknown> {
  date: Date;
  consumo: number;
  injecao: number;
}

/** Sparkline da última hora: sem eixos nem grade, as duas séries na mesma escala. */
function Curva({ serie, corConsumo, corGeracao }: { serie: GatewayMinuto[]; corConsumo: string; corGeracao: string }) {
  const pontos = useMemo<PontoMinuto[]>(
    () =>
      serie
        .map((s) => ({ date: new Date(s.timestamp), consumo: s.kW_consumo, injecao: s.kW_injecao }))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [serie],
  );
  const temInjecao = serie.some((s) => s.kW_injecao > 0);
  if (pontos.length < 2) return null;
  return (
    <div className="h-16 w-full">
      <LineChart
        data={pontos}
        aspectRatio="auto"
        className="h-full"
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        animationDuration={0}
      >
        <Line
          dataKey="consumo"
          stroke={corConsumo}
          strokeWidth={2}
          curve={curveMonotoneX}
          fadeEdges={false}
          animate={false}
          showHighlight={false}
        />
        {temInjecao && (
          <Line
            dataKey="injecao"
            stroke={corGeracao}
            strokeWidth={2}
            curve={curveMonotoneX}
            fadeEdges={false}
            animate={false}
            showHighlight={false}
          />
        )}
        <ChartTooltip
          showDatePill={false}
          content={({ point }) => {
            const p = point as PontoMinuto;
            return (
              <TooltipDestaque
                titulo={formatHoraMinuto(p.date)}
                linhas={[
                  { label: "Consumo", value: `${fmt(p.consumo)} kW`, cor: corConsumo },
                  ...(temInjecao ? [{ label: "Injeção", value: `${fmt(p.injecao)} kW`, cor: corGeracao }] : []),
                ]}
              />
            );
          }}
        />
      </LineChart>
    </div>
  );
}

export function AgoraMinutoCard({
  agora, serie, corConsumo, corGeracao,
}: { agora: GatewayMinuto | null; serie: GatewayMinuto[]; corConsumo: string; corGeracao: string }) {
  if (!agora && serie.length === 0) return null;
  const kvar = agora ? agora.kvar_ind - agora.kvar_cap : null;
  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agora · último minuto</span>
        <span className="text-[11px] text-muted-foreground">
          {agora ? `atualizado ${hora(agora.timestamp)}` : "sem minuto recente"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3 tabular-nums">
        <div>
          <div className="text-[11px] text-muted-foreground">Consumo</div>
          <div className="text-lg font-semibold" style={{ color: corConsumo }}>{agora ? `${fmt(agora.kW_consumo)} kW` : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Injeção</div>
          <div className="text-lg font-semibold" style={{ color: corGeracao }}>{agora ? `${fmt(agora.kW_injecao)} kW` : "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Reativo</div>
          <div className="text-lg font-semibold">
            {kvar == null ? "—" : `${fmt(Math.abs(kvar))} kvar`}
            {kvar != null && kvar !== 0 && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{kvar > 0 ? "ind." : "cap."}</span>}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <Curva serie={serie} corConsumo={corConsumo} corGeracao={corGeracao} />
        {serie.length >= 2 && (
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{hora(serie[0].timestamp)}</span>
            <span>Última hora, minuto a minuto · demanda e energia continuam pelos blocos do medidor</span>
            <span>{hora(serie[serie.length - 1].timestamp)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgoraMinutoCard;
