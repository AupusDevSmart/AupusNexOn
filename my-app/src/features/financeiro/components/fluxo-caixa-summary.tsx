import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Calendar, LucideIcon } from 'lucide-react';
import type { FluxoCaixaData, SummaryVariant } from '@/types/dtos/financeiro';

interface FluxoCaixaSummaryProps {
  data: FluxoCaixaData[];
}

interface SummaryCardProps {
  title: string;
  value: number;
  variant: SummaryVariant;
  icon: LucideIcon;
  variation?: number;
  showPercentage?: boolean;
  showAsPercentage?: boolean;
  suffix?: string;
}

export function FluxoCaixaSummary({ data = [] }: FluxoCaixaSummaryProps): JSX.Element {
  // Calcular resumos dos dados
  const summaryData = data.reduce((acc, item) => {
    acc.totalEntradas += item.entradas || 0;
    acc.totalSaidas += item.saidas || 0;
    acc.resultado += item.resultado || 0;
    return acc;
  }, {
    totalEntradas: 0,
    totalSaidas: 0,
    resultado: 0
  });

  // Calcular variação (simulada)
  const entradaVariacao = 12.5; // Simulado
  const saidaVariacao = -8.2;   // Simulado
  const resultadoVariacao = 194; // Meta simulada

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <SummaryCard 
        title="Resultado do Período"
        value={summaryData.resultado}
        variant="default"
        icon={DollarSign}
        variation={resultadoVariacao}
        showPercentage={false}
        suffix="da meta"
      />
      <SummaryCard 
        title="Entradas (R$)"
        value={summaryData.totalEntradas}
        variant="success"
        icon={TrendingUp}
        variation={entradaVariacao}
      />
      <SummaryCard 
        title="Saídas (R$)"
        value={summaryData.totalSaidas}
        variant="danger"
        icon={TrendingDown}
        variation={saidaVariacao}
      />
      <SummaryCard 
        title="Meta do Período"
        value={194}
        variant="info"
        icon={Calendar}
        showAsPercentage={true}
        suffix="atingida"
      />
    </div>
  );
}

function SummaryCard({ 
  title, 
  value, 
  variant, 
  icon: Icon, 
  variation, 
  showPercentage = true,
  showAsPercentage = false,
  suffix = ""
}: SummaryCardProps): JSX.Element {
  const variantClasses: Record<SummaryVariant, string> = {
    danger: "text-red-600",
    success: "text-green-600", 
    info: "text-blue-600",
    default: "text-gray-900"
  };
  
  const iconClasses: Record<SummaryVariant, string> = {
    danger: "text-red-600",
    success: "text-green-600",
    info: "text-blue-600", 
    default: "text-gray-600"
  };
  
  const colorClass = variantClasses[variant] || variantClasses.default;
  const iconColorClass = iconClasses[variant] || iconClasses.default;
  
  const formatValue = (val: number): string => {
    if (showAsPercentage) {
      return `${val}%`;
    }
    return val.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  return (
    <Card className="p-6 w-full">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold ${colorClass}`}>
            {showAsPercentage ? formatValue(value) : `R$ ${formatValue(value)}`}
          </p>
          {variation !== undefined && (
            <div className="flex items-center mt-1">
              <span className={`text-xs ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {variation >= 0 ? '+' : ''}{variation}%{suffix && ` ${suffix}`}
              </span>
              {showPercentage && (
                <span className="text-xs text-muted-foreground ml-1">vs período anterior</span>
              )}
            </div>
          )}
        </div>
        <Icon className={`h-8 w-8 ${iconColorClass}`} />
      </div>
    </Card>
  );
}