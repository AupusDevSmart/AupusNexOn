// src/features/dashboard/components/overview-cards.tsx
import { AlertCircle, Battery, TrendingUp, Zap } from "lucide-react";
import React from "react";

interface COAOverviewData {
  potenciaTotalMonitorada: number; // em MW
  cargaTotalMonitorada: number; // em MW
  energiaAcumulada: number; // em MWh
  contadores: {
    trips: number;
    alarmes: number;
    urgencias: number;
    osAbertas: number;
  };
}

interface COAOverviewCardsProps {
  data: COAOverviewData;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  variant = "default",
  className = "",
}: MetricCardProps) {
  const variantClasses = {
    default:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    success:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    warning:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    danger:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  };

  return (
    <div
      className={`p-6 rounded-lg border ${variantClasses[variant]} ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-2xl opacity-75">{icon}</div>
        <div className="text-right">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">
              {typeof value === "number"
                ? value.toLocaleString("pt-BR")
                : value}
            </span>
            {unit && (
              <span className="text-sm opacity-75 font-medium">{unit}</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold opacity-90">{title}</h3>
        {subtitle && <p className="text-xs opacity-70">{subtitle}</p>}
      </div>
    </div>
  );
}

export function COAOverviewCards({ data }: COAOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* Energia Consumida */}
      <MetricCard
        title="Energia Consumida"
        value={data.potenciaTotalMonitorada}
        unit="MW"
        subtitle="Capacidade instalada total"
        icon={<Zap />}
        variant="success"
      />

      {/* Consumo Total */}
      <MetricCard
        title="Consumo Total"
        value={data.cargaTotalMonitorada}
        unit="MW"
        subtitle="Demanda atual total"
        icon={<Battery />}
        variant="default"
      />

      {/* Energia Acumulada */}
      <MetricCard
        title="Energia Acumulada"
        value={data.energiaAcumulada}
        unit="MWh"
        subtitle="Energia gerada/consumida"
        icon={<TrendingUp />}
        variant="success"
      />

      {/* Contadores (Trips, Alarmes, Urgências, OS abertas) */}
      <div className="p-6 rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl text-gray-600 dark:text-gray-400">
            <AlertCircle />
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {data.contadores.trips +
                data.contadores.alarmes +
                data.contadores.urgencias +
                data.contadores.osAbertas}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Status Operacionais
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-red-600 dark:text-red-400 font-medium">
                Trips:
              </span>
              <span className="font-bold">{data.contadores.trips}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Alarmes:
              </span>
              <span className="font-bold">{data.contadores.alarmes}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-orange-600 dark:text-orange-400 font-medium">
                Urgências:
              </span>
              <span className="font-bold">{data.contadores.urgencias}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                OS Abertas:
              </span>
              <span className="font-bold">{data.contadores.osAbertas}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
