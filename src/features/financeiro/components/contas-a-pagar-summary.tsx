// src/features/financeiro/components/contas-a-pagar-summary.tsx
import { Card } from '@/components/ui/card';
import { Conta, SummaryData } from '@/types/dtos/financeiro';

interface ContasAPagarSummaryProps {
  contas: Conta[];
}

interface SummaryCardProps {
  title: string;
  value: number;
  variant: 'danger' | 'warning' | 'info' | 'success' | 'default';
  hasTooltip?: boolean;
}

export function ContasAPagarSummary({ contas = [] }: ContasAPagarSummaryProps) {
  // Função para obter a data atual sem a parte de tempo
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Calcular os valores dos resumos com base nos dados da tabela
  const summaryData = contas.reduce((acc: SummaryData, conta: Conta) => {
    const dataVencimento = new Date(conta.vencimento);
    dataVencimento.setHours(0, 0, 0, 0);
    
    // Verificar se o valor deve ser contabilizado no período atual
    // Contas vencidas (anteriores a hoje)
    if (dataVencimento < hoje && conta.situacao !== 'pago') {
      acc.vencidos += conta.total;
    }
    // Contas que vencem hoje
    else if (dataVencimento.getTime() === hoje.getTime() && conta.situacao !== 'pago') {
      acc.vencemHoje += conta.total;
    }
    // Contas a vencer (posteriores a hoje)
    else if (dataVencimento > hoje && conta.situacao !== 'pago') {
      acc.aVencer += conta.total;
    }
    // Contas pagas
    if (conta.situacao === 'pago') {
      acc.pagos += conta.total;
    }
    
    // Total do período (todas as contas)
    acc.total += conta.total;
    
    return acc;
  }, {
    vencidos: 0,
    vencemHoje: 0,
    aVencer: 0,
    pagos: 0,
    total: 0
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
      <SummaryCard 
        title="Vencidos (R$)" 
        value={summaryData.vencidos} 
        variant="danger"
      />
      <SummaryCard 
        title="Vencem hoje (R$)" 
        value={summaryData.vencemHoje} 
        variant="warning"
      />
      <SummaryCard 
        title="A vencer (R$)" 
        value={summaryData.aVencer} 
        variant="info"
      />
      <SummaryCard 
        title="Pagos (R$)" 
        value={summaryData.pagos} 
        variant="success"
      />
      <SummaryCard 
        title="Total do período (R$)" 
        value={summaryData.total} 
        variant="default"
      />
    </div>
  );
}

function SummaryCard({ title, value, variant, hasTooltip = false }: SummaryCardProps) {
  // Mapear variantes para cores
  const variantClasses: Record<string, string> = {
    danger: "text-red-500",
    warning: "text-amber-500",
    info: "text-blue-500",
    success: "text-green-500",
    default: "text-blue-500"
  };
  
  const colorClass = variantClasses[variant] || variantClasses.default;
  
  return (
    <Card className="p-4 w-full">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        {hasTooltip && (
          <span className="rounded-full bg-muted h-5 w-5 flex items-center justify-center text-xs">?</span>
        )}
      </div>
      <p className={`text-xl font-bold ${colorClass}`}>
        {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </Card>
  );
}