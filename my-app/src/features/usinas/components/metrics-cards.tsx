// src/features/usinas/components/metrics-cards.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Zap, TrendingUp, TrendingDown, Gauge, Settings, Battery } from 'lucide-react';

interface MetricsData {
  tensaoMedia: number;
  tensaoMaxima: number;
  tensaoMinima: number;
  consumo: number;
  geracao: number;
  energia: number;
}

interface MetricsCardsProps {
  data: MetricsData;
}

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

function MetricCard({ title, value, unit, icon, variant = 'default' }: MetricCardProps) {
  const variantClasses = {
    default: "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20",
    primary: "border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-900/20",
    success: "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20",
    warning: "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20"
  };

  const iconColors = {
    default: "text-blue-500",
    primary: "text-cyan-500", 
    success: "text-green-500",
    warning: "text-amber-500"
  };

  return (
    <Card className={`p-4 border-2 ${variantClasses[variant]}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={iconColors[variant]}>
              {icon}
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {title}
            </h3>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">
              {value.toLocaleString('pt-BR')}
            </span>
            <span className="text-sm text-muted-foreground font-medium">
              {unit}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function MetricsCards({ data }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard
        title="Tensão Média"
        value={data.tensaoMedia}
        unit="V"
        icon={<Zap className="h-5 w-5" />}
        variant="default"
      />
      
      <MetricCard
        title="Tensão Máxima"
        value={data.tensaoMaxima}
        unit="V"
        icon={<TrendingUp className="h-5 w-5" />}
        variant="success"
      />
      
      <MetricCard
        title="Tensão Mínima"
        value={data.tensaoMinima}
        unit="V"
        icon={<TrendingDown className="h-5 w-5" />}
        variant="warning"
      />
      
      <MetricCard
        title="Consumo"
        value={data.consumo}
        unit="kW"
        icon={<Gauge className="h-5 w-5" />}
        variant="primary"
      />
      
      <MetricCard
        title="Geração"
        value={data.geracao}
        unit="kW"
        icon={<Settings className="h-5 w-5" />}
        variant="default"
      />
      
      <MetricCard
        title="Energia"
        value={data.energia}
        unit="kWh"
        icon={<Battery className="h-5 w-5" />}
        variant="success"
      />
    </div>
  );
}