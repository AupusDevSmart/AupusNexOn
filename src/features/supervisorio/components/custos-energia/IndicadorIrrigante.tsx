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
    <Card className={`p-3 border ${className}`}>
      {/* Cabeçalho Compacto */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-foreground" />
          <div>
            <h3 className="font-medium text-xs">Tarifa Irrigante</h3>
            <p className="text-[9px] text-muted-foreground">Desconto irrigação</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
          {formatarPercentual(irrigante.percentual_desconto)} TE
        </Badge>
      </div>

      {/* Informações Compactas */}
      <div className="space-y-1">
        {/* Horário */}
        <div className="flex items-center gap-1 text-[10px]">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Período:</span>
          <span className="font-medium">
            {irrigante.horario_inicio} - {irrigante.horario_fim}
          </span>
        </div>

        {/* Energia no Período */}
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-muted-foreground">Energia período:</span>
          <span className="text-xs font-medium">{formatarEnergia(irrigante.energia_periodo_kwh)} kWh</span>
        </div>

        {/* Economia */}
        {temEconomia && (
          <div className="bg-muted/50 rounded p-2 mt-1">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                <span className="text-[10px] font-medium">Economia:</span>
              </div>
              <span className="text-sm font-semibold">
                {formatarMoeda(irrigante.economia_total)}
              </span>
            </div>
          </div>
        )}

        {/* Aviso se não houver economia */}
        {!temEconomia && (
          <div className="text-[9px] text-muted-foreground text-center pt-1">
            Sem consumo no horário irrigante
          </div>
        )}
      </div>

      {/* Rodapé com explicação */}
      <div className="mt-2 pt-2 border-t border-border/30">
        <p className="text-[9px] text-muted-foreground text-center">
          Desconto de {formatarPercentual(irrigante.percentual_desconto)} aplicado apenas na TE, TUSD integral
        </p>
      </div>
    </Card>
  );
}
