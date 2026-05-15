import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GatewayUltimaLeitura } from "@/hooks/useGatewayDashboard";

interface UltimasLeiturasTableProps {
  leituras: GatewayUltimaLeitura[];
}

const TZ = "America/Sao_Paulo";
const INTERVALO_MS = 15 * 60 * 1000;

function formatHoraBRT(d: Date): string {
  return d.toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Cada leitura A966 representa energia acumulada nos 15min anteriores ao
 * timestamp. Mostrar o intervalo (fim_intervalo_anterior - timestamp) deixa
 * claro de qual janela o dado e' — util quando ha pacote perdido.
 */
function formatIntervaloBRT(ts: string): string {
  const fim = new Date(ts);
  const inicio = new Date(fim.getTime() - INTERVALO_MS);
  return `${formatHoraBRT(inicio)} – ${formatHoraBRT(fim)}`;
}

export function UltimasLeiturasTable({ leituras }: UltimasLeiturasTableProps) {
  return (
    <Card className="rounded-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Últimas Leituras
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leituras.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Sem leituras
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left font-normal py-2 pr-4">Intervalo</th>
                  <th className="text-right font-normal py-2 px-2">Consumo (kW)</th>
                  <th className="text-right font-normal py-2 px-2">Injeção (kW)</th>
                  <th className="text-right font-normal py-2 px-2">Reativo (kvar)</th>
                  <th className="text-right font-normal py-2 px-2">kVA</th>
                  <th className="text-right font-normal py-2 pl-2">FP</th>
                </tr>
              </thead>
              <tbody>
                {leituras.map((l) => (
                  <tr key={l.timestamp} className="border-b border-border/40 last:border-b-0">
                    <td className="py-2 pr-4 tabular-nums whitespace-nowrap">
                      {formatIntervaloBRT(l.timestamp)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {l.kW_consumo.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {l.kW_injecao.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {l.kvar_resultante.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {l.kVA.toFixed(1)}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums">
                      {l.FP.toFixed(2)}{" "}
                      <span className="text-xs text-muted-foreground">{l.FP_natureza}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
