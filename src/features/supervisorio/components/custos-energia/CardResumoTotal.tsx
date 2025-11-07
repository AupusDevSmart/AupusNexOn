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
    <Card className={`p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 ${className}`}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-full bg-blue-500/20">
          <Zap className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Resumo Total</h3>
          <p className="text-xs text-muted-foreground">Custo consolidado do período</p>
        </div>
      </div>

      {/* Valores Principais */}
      <div className="space-y-4">
        {/* Energia Total */}
        <div className="bg-background/50 rounded-lg p-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Energia Total:</span>
            <span className="text-xl font-bold">{formatarEnergia(energia_total_kwh)} kWh</span>
          </div>
        </div>

        {/* Custo Total - Destaque */}
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-4 border border-blue-500/30">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Custo Total</p>
              <p className="text-3xl font-bold text-blue-500">{formatarMoeda(custo_total)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500/50" />
          </div>
        </div>

        {/* Custo Médio */}
        <div className="flex justify-between items-baseline pt-2">
          <span className="text-sm text-muted-foreground">Custo Médio:</span>
          <span className="font-semibold">R$ {custo_medio_kwh.toFixed(4)}/kWh</span>
        </div>

        {/* Demanda (se disponível) */}
        {demanda_maxima_kw !== undefined && (
          <div className="pt-3 border-t border-border/50 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Demanda Máxima:</span>
              <span className="font-medium">{demanda_maxima_kw.toFixed(2)} kW</span>
            </div>
            {demanda_contratada_kw && (
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Demanda Contratada:</span>
                <span className="font-medium">{demanda_contratada_kw.toFixed(2)} kW</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
