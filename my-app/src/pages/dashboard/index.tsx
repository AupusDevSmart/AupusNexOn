// src/pages/dashboard/index.tsx
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { OverviewCards } from "@/features/dashboard/components/overview-cards";
import { PlannedVsCompletedChart } from "@/features/dashboard/components/planned-vs-completed-chart";
import { ServiceSeverityCharts } from "@/features/dashboard/components/service-severity-charts";
import { SystemStatusCards } from "@/features/dashboard/components/system-status-cards";
import { TaskPriorities } from "@/features/dashboard/components/task-priorities";
import { WorkOrdersPanel } from "@/features/dashboard/components/work-orders-panel";

// Dados simulados - normalmente viriam de uma API
const dashboardData = {
  overview: {
    totalAssets: 30,
    assetsFaults: 5,
    assetsDown: 2,
    openWorker: 8,
    workInProgress: 4,
    completed: 12,
  },
  taskPriorities: [
    {
      id: 1,
      title: "Inspecionar conexões do inversor",
      priority: "high",
      status: "pending",
    },
    {
      id: 2,
      title: "Substituir módulo danificado",
      priority: "urgent",
      status: "pending",
    },
    {
      id: 3,
      title: "Verificar sistema de aterramento",
      priority: "medium",
      status: "pending",
    },
  ],
  serviceSeverity: {
    minor: 25,
    major: 45,
    critical: 30,
  },
  riskLevels: {
    low: 20,
    medium: 30,
    high: 50,
  },
  plannedVsCompleted: [
    { month: "Fev", planejadas: 8, concluidas: 6 },
    { month: "Mar", planejadas: 12, concluidas: 10 },
    { month: "Abr", planejadas: 15, concluidas: 12 },
    { month: "Mai", planejadas: 18, concluidas: 16 },
    { month: "Jun", planejadas: 22, concluidas: 20 },
    { month: "Jul", planejadas: 25, concluidas: 23 },
  ],
  systemStatus: {
    scheduledDowntime: 2,
    assetStatus: 2,
    assetClass: 3,
    unscheduledDowntime: 5,
    faultsCausingDamage: 3,
    sensorsDamaged: 5,
  },
  workOrders: {
    openWorkOrders: 8,
    workGrade: 75,
    overdueWorkOrders: 1,
    completedWorkOrders: 12,
    workloadIndicator: 75,
  },
};

export function DashboardPage() {
  return (
    <Layout>
      <Layout.Main>
        <TitleCard
          title="Dashboard"
          description="Visão geral completa do sistema e operações"
        />

        <div className="space-y-6">
          {/* Primeira linha - Overview, Service Severity e Opevode */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Visão Geral */}
            <div className="lg:col-span-4">
              <OverviewCards data={dashboardData.overview} />
            </div>

            {/* Severidade dos Serviços */}
            <div className="lg:col-span-4">
              <ServiceSeverityCharts
                serviceSeverity={dashboardData.serviceSeverity}
                riskLevels={dashboardData.riskLevels}
              />
            </div>

            {/* Ordens de Trabalho */}
            <div className="lg:col-span-4">
              <WorkOrdersPanel data={dashboardData.workOrders} />
            </div>
          </div>

          {/* Segunda linha - Prioridades de Tarefas e Planejadas vs Concluídas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Prioridades de Tarefas */}
            <div className="lg:col-span-4">
              <TaskPriorities tasks={dashboardData.taskPriorities} />
            </div>

            {/* Gráfico Planejadas vs Concluídas */}
            <div className="lg:col-span-8">
              <PlannedVsCompletedChart
                data={dashboardData.plannedVsCompleted}
              />
            </div>
          </div>

          {/* Terceira linha - Cards de Status do Sistema */}
          <div className="grid grid-cols-1">
            <SystemStatusCards data={dashboardData.systemStatus} />
          </div>
        </div>
      </Layout.Main>
    </Layout>
  );
}
