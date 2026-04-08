import { Card } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { formatarMoeda, formatarEnergia } from '@/utils/custos-energia';

interface CardResumoTotalProps {
  energia_total_kwh: number;
  custo_total: number;
  custo_medio_kwh: number;
  custo_total_sem_tributos?: number;
  fator_tributos?: number;
  demanda_maxima_kw?: number;
  demanda_contratada_kw?: number;
  perdas_percentual?: number;
  fator_perdas?: number;
  className?: string;
}

export function CardResumoTotal({
  energia_total_kwh,
  custo_total,
  custo_medio_kwh,
  custo_total_sem_tributos,
  fator_tributos,
  demanda_maxima_kw,
  demanda_contratada_kw,
  perdas_percentual,
  fator_perdas,
  className = '',
}: CardResumoTotalProps) {
  const temTributos = fator_tributos !== undefined && fator_tributos > 1;

  return (
    <Card className={`p-3 border ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-foreground" />
        <div>
          <h3 className="font-semibold text-sm">Resumo Total</h3>
          <p className="text-[10px] text-muted-foreground">Consolidado do periodo</p>
        </div>
      </div>

      {/* Valores */}
      <div className="space-y-1">
        {/* Energia Total */}
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-foreground">Energia Total:</span>
          <span className="text-sm font-semibold">{formatarEnergia(energia_total_kwh)} kWh</span>
        </div>

        {/* Perdas */}
        {perdas_percentual !== undefined && perdas_percentual > 0 && (
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Perdas:</span>
            <span className="text-xs font-medium">{perdas_percentual.toFixed(2)}%</span>
          </div>
        )}

        {/* Custo sem tributos (quando tem tributos) */}
        {temTributos && custo_total_sem_tributos !== undefined && (
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Custo s/ tributos:</span>
            <span className="text-xs">{formatarMoeda(custo_total_sem_tributos)}</span>
          </div>
        )}

        {/* Custo Total - Destaque */}
        <div className="bg-muted/50 rounded p-2 my-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {temTributos ? 'Custo c/ tributos:' : 'Custo Total:'}
            </span>
            <span className="text-lg font-bold">{formatarMoeda(custo_total)}</span>
          </div>
        </div>

        {/* Custo Medio */}
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-foreground">Custo Medio:</span>
          <span className="text-xs font-medium">R$ {custo_medio_kwh.toFixed(4)}/kWh</span>
        </div>

        {/* Demanda */}
        {demanda_maxima_kw !== undefined && (
          <div className="pt-1 border-t border-border/30 mt-1 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Demanda Max:</span>
              <span className="text-xs font-medium">{demanda_maxima_kw.toFixed(2)} kW</span>
            </div>
            {demanda_contratada_kw && (
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Dem. Contratada:</span>
                <span className="text-xs font-medium">{demanda_contratada_kw.toFixed(2)} kW</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
