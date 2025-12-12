import { Card } from '@/components/ui/card';
import { Zap, TrendingUp } from 'lucide-react';
import { formatarMoeda, formatarEnergia } from '@/utils/custos-energia';

interface CardResumoTotalProps {
  energia_total_kwh: number;
  custo_total: number;
  custo_medio_kwh: number;
  demanda_maxima_kw?: number;
  demanda_contratada_kw?: number;
  className?: string;
}

export function CardResumoTotal({
  energia_total_kwh,
  custo_total,
  custo_medio_kwh,
  demanda_maxima_kw,
  demanda_contratada_kw,
  className = '',
}: CardResumoTotalProps) {
  return (
    <Card className={`p-3 border ${className}`}>
      {/* Cabeçalho Compacto */}
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-foreground" />
        <div>
          <h3 className="font-semibold text-xs">Resumo Total</h3>
          <p className="text-[9px] text-muted-foreground">Consolidado do período</p>
        </div>
      </div>

      {/* Valores Compactos */}
      <div className="space-y-1">
        {/* Energia Total */}
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-muted-foreground">Energia Total:</span>
          <span className="text-xs font-semibold">{formatarEnergia(energia_total_kwh)} kWh</span>
        </div>

        {/* Custo Total - Destaque */}
        <div className="bg-muted/50 rounded p-2 my-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">Custo Total:</span>
            <span className="text-base font-bold">{formatarMoeda(custo_total)}</span>
          </div>
        </div>

        {/* Custo Médio */}
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-muted-foreground">Custo Médio:</span>
          <span className="text-[10px] font-medium">R$ {custo_medio_kwh.toFixed(4)}/kWh</span>
        </div>

        {/* Demanda (se disponível) */}
        {demanda_maxima_kw !== undefined && (
          <div className="pt-1 border-t border-border/30 mt-1 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-muted-foreground">Demanda Máx:</span>
              <span className="text-[10px] font-medium">{demanda_maxima_kw.toFixed(2)} kW</span>
            </div>
            {demanda_contratada_kw && (
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-muted-foreground">Dem. Contratada:</span>
                <span className="text-[10px] font-medium">{demanda_contratada_kw.toFixed(2)} kW</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
