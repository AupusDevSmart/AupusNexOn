// src/features/dashboard/components/overview-cards.tsx
import React from 'react';
import { Card } from '@/components/ui/card';

interface OverviewData {
  totalAssets: number;
  assetsFaults: number;
  assetsDown: number;
  openWorker: number;
  workInProgress: number;
  completed: number;
}

interface OverviewCardsProps {
  data: OverviewData;
}

interface MetricCardProps {
  title: string;
  value: number;
  className?: string;
}

function MetricCard({ title, value, className = "" }: MetricCardProps) {
  return (
    <div className={`text-center ${className}`}>
      <div className="text-3xl font-bold text-foreground mb-1">
        {value}
      </div>
      <div className="text-sm text-muted-foreground">
        {title}
      </div>
    </div>
  );
}

export function OverviewCards({ data }: OverviewCardsProps) {
  return (
    <Card className="p-6 h-full">
      <h3 className="text-lg font-semibold mb-6 text-foreground">
        Visão Geral
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        <MetricCard 
          title="Total de Ativos" 
          value={data.totalAssets}
        />
        <MetricCard 
          title="Ativos com Falhas" 
          value={data.assetsFaults}
        />
        <MetricCard 
          title="Ativos Parados" 
          value={data.assetsDown}
        />
        <MetricCard 
          title="Ordens Abertas" 
          value={data.openWorker}
        />
        <MetricCard 
          title="Em Execução" 
          value={data.workInProgress}
        />
        <MetricCard 
          title="Concluídas" 
          value={data.completed}
        />
      </div>
    </Card>
  );
}