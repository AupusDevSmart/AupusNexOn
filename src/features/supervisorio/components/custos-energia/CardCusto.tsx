import { Card } from '@/components/ui/card';
import type { TipoHorario } from '@/types/dtos/custos-energia-dto';
import {
  formatarMoeda,
  formatarEnergia,
  getLabelTipoHorario,
  getDescricaoTipoHorario,
} from '@/utils/custos-energia';

interface CardCustoProps {
  tipo: TipoHorario;
  energia_kwh: number;
  custo: number;
  tarifa?: number;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  observacao?: string;
  className?: string;
}

export function CardCusto({
  tipo,
  energia_kwh,
  custo,
  tarifa,
  horario_inicio,
  horario_fim,
  observacao,
  className = '',
}: CardCustoProps) {
  const label = getLabelTipoHorario(tipo);
  const descricao = getDescricaoTipoHorario(tipo);

  const horarioTexto =
    horario_inicio && horario_fim ? `${horario_inicio} - ${horario_fim}` : null;

  return (
    <Card className={`p-3 border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-medium text-sm">{label}</h3>
          {horarioTexto && (
            <p className="text-xs text-muted-foreground">{horarioTexto}</p>
          )}
          {!horarioTexto && descricao && (
            <p className="text-xs text-muted-foreground">{descricao}</p>
          )}
        </div>
      </div>

      {/* Valores */}
      <div className="space-y-1">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-foreground">Energia:</span>
          <span className="text-sm font-medium">{formatarEnergia(energia_kwh)} kWh</span>
        </div>

        {tarifa !== undefined && tarifa !== null && (
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Tarifa:</span>
            <span className="text-xs">R$ {tarifa.toFixed(6)}/kWh</span>
          </div>
        )}

        {/* Custo */}
        <div className="pt-1 border-t border-border/30 mt-1">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-medium">Custo:</span>
            <span className="text-base font-semibold">{formatarMoeda(custo)}</span>
          </div>
        </div>
      </div>

      {observacao && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground text-center">
            {observacao}
          </p>
        </div>
      )}
    </Card>
  );
}
