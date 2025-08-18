// src/features/dashboard/components/system-status-cards.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Wrench, Zap } from 'lucide-react';

interface SystemStatusData {
  scheduledDowntime: number;
  assetStatus: number;
  assetClass: number;
  unscheduledDowntime: number;
  faultsCausingDamage: number;
  sensorsDamaged: number;
}

interface SystemStatusCardsProps {
  data: SystemStatusData;
}

interface StatusCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

function StatusCard({ title, value, icon, variant = 'default' }: StatusCardProps) {
  const variantClasses = {
    default: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
  };

  return (
    <Card className={`p-4 border ${variantClasses[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-90 mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold">
            {value}
          </p>
        </div>
        <div className="text-2xl opacity-75">
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function SystemStatusCards({ data }: SystemStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatusCard
        title="Paradas Programadas"
        value={data.scheduledDowntime}
        icon={<Activity />}
        variant="default"
      />
      
      <StatusCard
        title="Status de Ativos"
        value={data.assetStatus}
        icon={<TrendingUp />}
        variant="warning"
      />
      
      <StatusCard
        title="Classe de Ativos"
        value={data.assetClass}
        icon={<Wrench />}
        variant="default"
      />
      
      <StatusCard
        title="Paradas Não Programadas"
        value={data.unscheduledDowntime}
        icon={<TrendingDown />}
        variant="danger"
      />
      
      <StatusCard
        title="Falhas Causando Danos"
        value={data.faultsCausingDamage}
        icon={<AlertTriangle />}
        variant="danger"
      />
      
      <StatusCard
        title="Sensores Danificados"
        value={data.sensorsDamaged}
        icon={<Zap />}
        variant="warning"
      />
    </div>
  );
}