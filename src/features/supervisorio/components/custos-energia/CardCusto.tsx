import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TipoHorario } from '@/types/dtos/custos-energia-dto';
import {
  formatarMoeda,
  formatarEnergia,
  getBgCorTipoHorario,
  getIconeTipoHorario,
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

  // Formatar horário
  const horarioTexto =
    horario_inicio && horario_fim ? `${horario_inicio} - ${horario_fim}` : null;

  return (
    <Card className={`p-3 border ${className}`}>
      {/* Cabeçalho Compacto */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-medium text-xs">{label}</h3>
          {horarioTexto && (
            <p className="text-[10px] text-muted-foreground">{horarioTexto}</p>
          )}
          {!horarioTexto && descricao && (
            <p className="text-[10px] text-muted-foreground">{descricao}</p>
          )}
        </div>
      </div>

      {/* Valores Compactos */}
      <div className="space-y-1">
        {/* Energia */}
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-muted-foreground">Energia:</span>
          <span className="text-xs font-medium">{formatarEnergia(energia_kwh)} kWh</span>
        </div>

        {/* Tarifa (se fornecida) */}
        {tarifa !== undefined && tarifa !== null && (
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] text-muted-foreground">Tarifa:</span>
            <span className="text-[10px]">R$ {tarifa.toFixed(4)}/kWh</span>
          </div>
        )}

        {/* Custo Total */}
        <div className="pt-1 border-t border-border/30 mt-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-medium">Custo:</span>
            <span className="text-sm font-semibold">{formatarMoeda(custo)}</span>
          </div>
        </div>
      </div>

      {/* Observação (se houver) */}
      {observacao && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <p className="text-[9px] text-muted-foreground text-center">
            {observacao}
          </p>
        </div>
      )}
    </Card>
  );
}
