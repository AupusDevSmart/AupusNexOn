import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface FluxoLiquidoCardProps {
  fluxoLiquidoKw: number;
  consumoKw: number;
  injecaoKw: number;
}

// Mesma paleta dos gauges (DemandaGauge) e do grafico (TendenciaPotencia).
const COR_CONSUMO = "#64748b"; // slate-500
const COR_GERACAO = "#a16207"; // yellow-700

export function FluxoLiquidoCard({
  fluxoLiquidoKw,
  consumoKw,
  injecaoKw,
}: FluxoLiquidoCardProps) {
  const exportando = fluxoLiquidoKw >= 0;
  const sinal = exportando ? "+" : "−";
  const valorAbs = Math.abs(fluxoLiquidoKw);

  // Barra horizontal de proporcao entre import e export. Se ambos forem 0,
  // mostra barra vazia neutra.
  const total = consumoKw + injecaoKw;
  const pctConsumo = total > 0 ? (consumoKw / total) * 100 : 0;
  const pctInjecao = total > 0 ? (injecaoKw / total) * 100 : 0;

  return (
    <Card className="rounded-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Fluxo Líquido
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-[calc(100%-3.5rem)]">
        {/* Valor central grande, centralizado vertical e horizontalmente. */}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
          <div
            className="text-5xl font-semibold tabular-nums leading-none"
            style={{ color: exportando ? COR_GERACAO : COR_CONSUMO }}
          >
            {sinal}
            {valorAbs.toFixed(1)}
          </div>
          <div className="text-base text-muted-foreground">kW</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2">
            {exportando ? "Exportando" : "Importando"}
          </div>
        </div>

        {/* Barra de proporcao Importacao vs Exportacao. */}
        <div className="space-y-2 pt-4">
          <div className="flex h-2 overflow-hidden bg-muted/40 rounded-sm">
            {total > 0 && (
              <>
                <div style={{ width: `${pctConsumo}%`, background: COR_CONSUMO }} />
                <div style={{ width: `${pctInjecao}%`, background: COR_GERACAO }} />
              </>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Importação {pctConsumo.toFixed(0)}%</span>
            <span>Exportação {pctInjecao.toFixed(0)}%</span>
          </div>
        </div>

        {/* Detalhes numericos. */}
        <div className="space-y-1.5 pt-3 mt-3 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowDownToLine className="h-3.5 w-3.5" style={{ color: COR_CONSUMO }} />
              Importação da rede
            </span>
            <span className="font-medium tabular-nums">{consumoKw.toFixed(1)} kW</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpFromLine className="h-3.5 w-3.5" style={{ color: COR_GERACAO }} />
              Exportação para rede
            </span>
            <span className="font-medium tabular-nums">{injecaoKw.toFixed(1)} kW</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
