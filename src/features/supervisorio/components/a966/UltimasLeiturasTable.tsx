import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GatewayUltimaLeitura } from "@/hooks/useGatewayDashboard";

interface UltimasLeiturasTableProps {
  leituras: GatewayUltimaLeitura[];
}

const TZ = "America/Sao_Paulo";

function formatHoraBRT(ts: string): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
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
                  <th className="text-left font-normal py-2 pr-4">Horário</th>
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
                    <td className="py-2 pr-4 tabular-nums">{formatHoraBRT(l.timestamp)}</td>
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
