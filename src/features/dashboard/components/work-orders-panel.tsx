// src/features/dashboard/components/work-orders-panel.tsx
import React from 'react';
import { Card } from '@/components/ui/card';

interface WorkOrdersData {
  openWorkOrders: number;
  workGrade: number;
  overdueWorkOrders: number;
  completedWorkOrders: number;
  workloadIndicator: number;
}

interface WorkOrdersPanelProps {
  data: WorkOrdersData;
}

interface MetricItemProps {
  label: string;
  value: number | string;
  isPercentage?: boolean;
  className?: string;
}

function MetricItem({ label, value, isPercentage = false, className = "" }: MetricItemProps) {
  return (
    <div className={`flex items-center justify-between py-3 ${className}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">
        {value}{isPercentage ? '%' : ''}
      </span>
    </div>
  );
}

function CircularProgress({ percentage, size = 100 }: { percentage: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="text-blue-500 transition-all duration-300"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{percentage}%</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground mt-2">Indicador de Carga</span>
    </div>
  );
}

export function WorkOrdersPanel({ data }: WorkOrdersPanelProps) {
  return (
    <Card className="p-6 h-full">
      <h3 className="text-lg font-semibold mb-6 text-foreground">
        Ordens de Trabalho
      </h3>
      
      <div className="space-y-1">
        <MetricItem 
          label="Ordens Abertas" 
          value={data.openWorkOrders}
        />
        
        <MetricItem 
          label="Qualidade do Trabalho" 
          value={data.workGrade}
          isPercentage
        />
        
        <MetricItem 
          label="Ordens Atrasadas" 
          value={data.overdueWorkOrders}
        />
        
        <MetricItem 
          label="Ordens Concluídas" 
          value={data.completedWorkOrders}
        />
        
        <MetricItem 
          label="Ordens Abertas" 
          value={data.openWorkOrders}
        />
      </div>
      
      {/* Indicador Circular de Progresso */}
      <div className="mt-6 flex justify-center">
        <CircularProgress percentage={data.workloadIndicator} />
      </div>
    </Card>
  );
}