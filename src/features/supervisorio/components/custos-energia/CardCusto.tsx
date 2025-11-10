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
  const icone = getIconeTipoHorario(tipo);
  const label = getLabelTipoHorario(tipo);
  const descricao = getDescricaoTipoHorario(tipo);
  const bgColor = getBgCorTipoHorario(tipo);

  // Formatar horário
  const horarioTexto =
    horario_inicio && horario_fim ? `${horario_inicio} - ${horario_fim}` : null;

  return (
    <Card className={`p-4 border ${bgColor} ${className}`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icone}</span>
          <div>
            <h3 className="font-semibold text-sm">{label}</h3>
            {horarioTexto && (
              <p className="text-xs text-muted-foreground">{horarioTexto}</p>
            )}
            {!horarioTexto && descricao && (
              <p className="text-xs text-muted-foreground">{descricao}</p>
            )}
          </div>
        </div>
      </div>

      {/* Valores */}
      <div className="space-y-2">
        {/* Energia */}
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-foreground">Energia:</span>
          <span className="font-medium">{formatarEnergia(energia_kwh)} kWh</span>
        </div>

        {/* Tarifa (se fornecida) */}
        {tarifa !== undefined && tarifa !== null && (
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">Tarifa:</span>
            <span className="text-xs">R$ {tarifa.toFixed(4)}/kWh</span>
          </div>
        )}

        {/* Custo Total */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-medium">Custo:</span>
            <span className="text-lg font-bold">{formatarMoeda(custo)}</span>
          </div>
        </div>
      </div>

      {/* Observação (se houver) */}
      {observacao && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <Badge variant="outline" className="text-xs w-full justify-center">
            {observacao}
          </Badge>
        </div>
      )}
    </Card>
  );
}
