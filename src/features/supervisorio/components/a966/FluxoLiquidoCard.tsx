import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";

interface FluxoLiquidoCardProps {
  fluxoLiquidoKw: number;
  consumoKw: number;
  injecaoKw: number;
}

export function FluxoLiquidoCard({
  fluxoLiquidoKw,
  consumoKw,
  injecaoKw,
}: FluxoLiquidoCardProps) {
  const importando = fluxoLiquidoKw >= 0;
  const sinal = importando ? "+" : "−";
  const valorAbs = Math.abs(fluxoLiquidoKw);

  return (
    <Card className="rounded-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          Fluxo Líquido
          <Info className="h-3 w-3" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-3xl font-semibold tabular-nums">
            {sinal}
            {valorAbs.toFixed(1)} <span className="text-base font-normal">kW</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {importando ? "Importando" : "Exportando"}
          </div>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Importação da rede
            </span>
            <span className="font-medium tabular-nums">{consumoKw.toFixed(1)} kW</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              Exportação para rede
            </span>
            <span className="font-medium tabular-nums">{injecaoKw.toFixed(1)} kW</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
