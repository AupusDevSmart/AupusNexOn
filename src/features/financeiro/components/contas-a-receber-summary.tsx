// src/features/financeiro/components/contas-a-receber-summary.jsx
import { Card } from '@/components/ui/card';

interface SummaryCardProps {
  title: string;
  value: number;
  variant: 'danger' | 'warning' | 'info' | 'success' | 'default';
  hasTooltip?: boolean;
}

export function ContasAReceberSummary({ contas = [] }) {
  // Função para obter a data atual sem a parte de tempo
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  // Calcular os valores dos resumos com base nos dados da tabela
  const summaryData = contas.reduce((acc, conta) => {
    const dataVencimento = new Date(conta.vencimento);
    dataVencimento.setHours(0, 0, 0, 0);
    
    // Verificar se o valor deve ser contabilizado no período atual
    // Contas vencidas (anteriores a hoje)
    if (dataVencimento < hoje && conta.situacao !== 'recebido') {
      acc.vencidos += conta.total;
    }
    // Contas que vencem hoje
    else if (dataVencimento.getTime() === hoje.getTime() && conta.situacao !== 'recebido') {
      acc.vencemHoje += conta.total;
    }
    // Contas a vencer (posteriores a hoje)
    else if (dataVencimento > hoje && conta.situacao !== 'recebido') {
      acc.aVencer += conta.total;
    }
    // Contas recebidas
    if (conta.situacao === 'recebido') {
      acc.recebidos += conta.total;
    }
    
    // Total do período (todas as contas)
    acc.total += conta.total;
    
    return acc;
  }, {
    vencidos: 0,
    vencemHoje: 0,
    aVencer: 0,
    recebidos: 0,
    total: 0
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
      <SummaryCard 
        title="Em atraso (R$)" 
        value={summaryData.vencidos} 
        variant="danger"
      />
      <SummaryCard 
        title="Vencem hoje (R$)" 
        value={summaryData.vencemHoje} 
        variant="warning"
      />
      <SummaryCard 
        title="A receber (R$)" 
        value={summaryData.aVencer} 
        variant="info"
      />
      <SummaryCard 
        title="Recebidos (R$)" 
        value={summaryData.recebidos} 
        variant="success"
      />
      <SummaryCard 
        title="Total do período (R$)" 
        value={summaryData.total} 
        variant="default"
        hasTooltip
      />
    </div>
  );
}

function SummaryCard({ title, value, variant, hasTooltip = false }) {
  // Mapear variantes para cores
  const variantClasses = {
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