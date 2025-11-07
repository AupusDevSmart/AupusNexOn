import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, TrendingDown, Clock } from 'lucide-react';
import { formatarMoeda, formatarEnergia, formatarPercentual } from '@/utils/custos-energia';
import type { IrriganteInfoDto } from '@/types/dtos/custos-energia-dto';

interface IndicadorIrriganteProps {
  irrigante: IrriganteInfoDto;
  className?: string;
}

export function IndicadorIrrigante({ irrigante, className = '' }: IndicadorIrriganteProps) {
  const temEconomia = irrigante.economia_total > 0;

  return (
    <Card
      className={`p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 ${className}`}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-green-500/20">
            <Droplets className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Tarifa Irrigante</h3>
            <p className="text-xs text-muted-foreground">Desconto especial de irrigação</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
          {formatarPercentual(irrigante.percentual_desconto)} TE
        </Badge>
      </div>

      {/* Informações */}
      <div className="space-y-3">
        {/* Horário */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Período:</span>
          <span className="font-medium">
            {irrigante.horario_inicio} - {irrigante.horario_fim}
          </span>
        </div>

        {/* Energia no Período */}
        <div className="bg-background/50 rounded-lg p-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Energia no período:</span>
            <span className="font-semibold">{formatarEnergia(irrigante.energia_periodo_kwh)} kWh</span>
          </div>
        </div>

        {/* Economia */}
        {temEconomia && (
          <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-500">Economia:</span>
              </div>
              <span className="text-lg font-bold text-green-500">
                {formatarMoeda(irrigante.economia_total)}
              </span>
            </div>
          </div>
        )}

        {/* Aviso se não houver economia */}
        {!temEconomia && (
          <div className="text-xs text-muted-foreground text-center pt-2">
            Nenhum consumo no horário irrigante neste período
          </div>
        )}
      </div>

      {/* Rodapé com explicação */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          O desconto de {formatarPercentual(irrigante.percentual_desconto)} é aplicado apenas na TE
          (Tarifa de Energia), mantendo o TUSD integral
        </p>
      </div>
    </Card>
  );
}
