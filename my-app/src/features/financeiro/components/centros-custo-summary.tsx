// src/features/financeiro/components/centros-custo-summary.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Building2, TrendingUp, DollarSign, Users } from 'lucide-react';
import { CentroCusto, SummaryData } from '@/types/dtos/financeiro';

interface CentrosCustoSummaryProps {
  centros: CentroCusto[];
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant: 'success' | 'warning' | 'info' | 'default';
  icon: React.ReactNode;
}

export function CentrosCustoSummary({ centros = [] }: CentrosCustoSummaryProps): JSX.Element {
  // Calcular métricas dos centros de custo
  const summaryData: SummaryData = centros.reduce((acc, centro) => {
    // Contadores por status
    if (centro.status === 'ativo') {
      acc.ativos += 1;
    } else {
      acc.inativos += 1;
    }
    
    // Somas financeiras
    acc.orcamentoTotal += centro.orcamentoMensal || 0;
    acc.gastoTotal += centro.gastoAcumulado || 0;
    
    // Contadores por tipo
    acc.tipos[centro.tipo] = (acc.tipos[centro.tipo] || 0) + 1;
    
    return acc;
  }, {
    ativos: 0,
    inativos: 0,
    orcamentoTotal: 0,
    gastoTotal: 0,
    tipos: {}
  });

  // Calcular utilização média
  const utilizacaoMedia = summaryData.orcamentoTotal > 0 
    ? (summaryData.gastoTotal / summaryData.orcamentoTotal) * 100 
    : 0;

  // Encontrar o tipo mais comum
  const tipoMaisComum = Object.keys(summaryData.tipos).length > 0
    ? Object.keys(summaryData.tipos).reduce((a, b) => summaryData.tipos[a] > summaryData.tipos[b] ? a : b)
    : 'N/A';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <SummaryCard 
        title="Centros Ativos" 
        value={summaryData.ativos}
        subtitle={`${summaryData.inativos} inativos`}
        variant="success"
        icon={<Building2 className="h-4 w-4" />}
      />
      <SummaryCard 
        title="Orçamento Total (R$)" 
        value={summaryData.orcamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        subtitle={`Gasto: R$ ${summaryData.gastoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
        variant="info"
        icon={<DollarSign className="h-4 w-4" />}
      />
      <SummaryCard 
        title="Utilização Média" 
        value={`${utilizacaoMedia.toFixed(1)}%`}
        subtitle={utilizacaoMedia > 80 ? 'Atenção ao limite' : 'Dentro do esperado'}
        variant={utilizacaoMedia > 80 ? 'warning' : 'success'}
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <SummaryCard 
        title="Tipo Predominante" 
        value={tipoMaisComum === 'N/A' ? 'N/A' : tipoMaisComum.charAt(0).toUpperCase() + tipoMaisComum.slice(1)}
        subtitle={`${Object.keys(summaryData.tipos).length} tipos diferentes`}
        variant="default"
        icon={<Users className="h-4 w-4" />}
      />
    </div>
  );
}

function SummaryCard({ title, value, subtitle, variant, icon }: SummaryCardProps): JSX.Element {
  // Mapear variantes para cores
  const variantClasses = {
    success: "text-green-500",
    warning: "text-amber-500",
    info: "text-blue-500",
    default: "text-slate-500"
  };
  
  const colorClass = variantClasses[variant];
  
  return (
    <Card className="p-4 w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={colorClass}>
          {icon}
        </div>
      </div>
      <p className={`text-xl font-bold ${colorClass}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">
          {subtitle}
        </p>
      )}
    </Card>
  );
}