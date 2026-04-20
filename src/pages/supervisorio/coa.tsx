"use client";

import React, { useMemo } from "react";
import { Layout } from "@/components/common/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Zap,
  Battery,
  TrendingUp,
  AlertTriangle,
  Activity,
  RefreshCw,
  Clock,
  Map
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { useCoaDashboard } from "@/features/coa/hooks/use-coa-dashboard";
import { MapaCoa } from "@/features/coa/components/mapa-coa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatEnergy, formatPower } from "@/utils/formatEnergy";

// Dados mockados para gráfico de performance 24h
const dadosPerformance24h = Array.from({ length: 24 }, (_, i) => ({
  hora: `${i.toString().padStart(2, "0")}:00`,
  geracao: 80 + Math.sin((i / 24) * Math.PI * 4) * 30 + Math.random() * 10,
  consumo: 70 + Math.sin((i / 24) * Math.PI * 2) * 20 + Math.random() * 8,
  meta: 85,
}));

// Dados mockados para cargas monitoradas
const cargasMonitoradas = [
  { nome: "Fábrica ABC", tipo: "Industrial", consumo: "12.3 MW", status: "Normal" },
  { nome: "Shopping XYZ", tipo: "Comercial", consumo: "8.7 MW", status: "Normal" },
  { nome: "Hospital Central", tipo: "Hospitalar", consumo: "5.2 MW", status: "Alerta" },
  { nome: "Data Center Alpha", tipo: "Tecnologia", consumo: "9.5 MW", status: "Normal" },
];

// Dados mockados para eventos recentes
const eventosRecentes = [
  { mensagem: "UFV Bahia - Sistema em TRIP - Técnico despachado", hora: "11:15", tipo: "critico" },
  { mensagem: "UFV São Paulo - Manutenção preventiva iniciada", hora: "10:30", tipo: "info" },
  { mensagem: "UFV Ceará - Performance acima da meta por 48h consecutivas", hora: "09:45", tipo: "sucesso" },
  { mensagem: "Subestação RJ Norte - Temperatura elevada detectada", hora: "08:22", tipo: "alerta" },
];

/**
 * Página COA (Centro de Operações Avançadas)
 *
 * Mostra dados em tempo real de todas as plantas e unidades
 * com atualização automática a cada 30 segundos
 */
export function COAPage() {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    error,
    lastUpdate,
    isStale,
    refresh,
    forceRefresh
  } = useCoaDashboard({
    pollingInterval: 30, // Atualiza a cada 30 segundos
    enablePolling: true,
  });

  // Calcula métricas agregadas
  const metricas = useMemo(() => {
    if (!data) {
      return {
        energiaConsumida: 0,
        consumoTotal: 0,
        potenciaInstalada: 0,
        totalEventos: 0,
        ativosMonitorados: 0,
        eficienciaMedia: 0,
      };
    }

    // Soma totais de todas as plantas
    let potenciaInstalada = 0;
    let energiaTotal = 0;

    data.plantas.forEach(planta => {
      planta.unidades.forEach(unidade => {
        potenciaInstalada += unidade.metricas.potenciaAtual;
        energiaTotal += unidade.metricas.energiaHoje;
      });
    });

    return {
      energiaConsumida: energiaTotal,
      consumoTotal: data.resumoGeral.totalConsumo,
      potenciaInstalada: data.resumoGeral.totalGeracao,
      totalEventos: data.alertas.length,
      ativosMonitorados: data.resumoGeral.totalUnidades,
      eficienciaMedia: data.resumoGeral.unidadesOnline / data.resumoGeral.totalUnidades * 100,
    };
  }, [data]);

  // Componente de Card de Métrica
  const MetricCard = ({
    title,
    value,
    unit,
    subtitle,
    icon: Icon,
    color = "text-muted-foreground"
  }: {
    title: string;
    value: number | string;
    unit?: string;
    subtitle?: string;
    icon: React.ElementType;
    color?: string;
  }) => (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold">
                {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
              </p>
              {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );

  // Loading State
  if (isLoading && !data) {
    return (
      <Layout>
        <Layout.Main>
          <div className="min-h-screen w-full p-2 md:p-3">
            <div className="mx-auto w-full max-w-[1920px] space-y-3">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Centro de Operações Avançadas (COA)</h1>
                <p className="text-muted-foreground">Carregando dados...</p>
              </div>

              {/* Skeletons para os cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Skeleton para o conteúdo principal */}
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[400px] w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </Layout.Main>
      </Layout>
    );
  }

  // Error State
  if (error && !data) {
    return (
      <Layout>
        <Layout.Main>
          <div className="min-h-screen w-full p-2 md:p-3">
            <div className="mx-auto w-full max-w-[1920px] space-y-3">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao carregar dados do COA: {error.message}
                </AlertDescription>
              </Alert>
              <Button onClick={() => refresh()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        </Layout.Main>
      </Layout>
    );
  }

  return (
    <Layout>
      <Layout.Main>
        <div className="min-h-screen w-full p-2 md:p-3">
          <div className="mx-auto w-full max-w-[1920px] space-y-3">
            {/* Header com Status */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold">Centro de Operações Avançadas (COA)</h1>
                <div className="flex items-center gap-4 mt-2">
                  {/* Status de Conexão */}
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isStale ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
                    <span className="text-sm text-muted-foreground">
                      {isStale ? 'Dados desatualizados' : 'Dados em tempo real'}
                    </span>
                  </div>

                  {/* Última Atualização */}
                  {lastUpdate && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        Atualizado {formatDistanceToNow(lastUpdate, {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refresh()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => forceRefresh()}
                  disabled={isLoading}
                >
                  Forçar Refresh
                </Button>
              </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard
                title="Geração Solar"
                value={formatPower(metricas.potenciaInstalada)}
                subtitle={`${data?.resumoGeral.totalGeradores || 0} geradores`}
                icon={Zap}
                color="text-yellow-500"
              />
              <MetricCard
                title="Carga Total"
                value={formatPower(metricas.consumoTotal)}
                subtitle={`${data?.resumoGeral.totalCargas || 0} cargas ativas`}
                icon={Battery}
                color="text-blue-500"
              />
              <MetricCard
                title="Energia Hoje"
                value={formatEnergy(metricas.energiaConsumida)}
                icon={TrendingUp}
                color="text-green-500"
              />
              <MetricCard
                title="Alertas Ativos"
                value={metricas.totalEventos}
                icon={AlertTriangle}
                color={metricas.totalEventos > 0 ? "text-red-500" : "text-gray-400"}
              />
              <MetricCard
                title="Unidades Online"
                value={`${data?.resumoGeral.unidadesOnline || 0}/${data?.resumoGeral.totalUnidades || 0}`}
                icon={Activity}
                color="text-purple-500"
              />
            </div>

            {/* Mapa de Unidades */}
            {data && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Map className="h-5 w-5" />
                      Localização das Unidades
                    </CardTitle>
                    {data.plantas.reduce((acc, planta) =>
                      acc + planta.unidades.filter(u => u.coordenadas).length, 0
                    ) > 0 && (
                      <Badge variant="outline">
                        {data.plantas.reduce((acc, planta) =>
                          acc + planta.unidades.filter(u => u.coordenadas).length, 0
                        )} unidades mapeadas
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <MapaCoa
                    unidades={data.plantas.flatMap(planta => planta.unidades)}
                    onUnidadeClick={(unidadeId) => {
                      // Navegar para o sinótico da unidade
                      navigate(`/supervisorio/sinoptico-ativo/${unidadeId}`);
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* 1. Gráfico de Performance das Últimas 24h */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Performance Últimas 24h
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dadosPerformance24h}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="hora"
                      fontSize={12}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      fontSize={12}
                      label={{
                        value: "MW",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="geracao"
                      stroke="#22c55e"
                      strokeWidth={2}
                      name="Geração"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="consumo"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Consumo"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="meta"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Meta"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 2. Tabela de Cargas Monitoradas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Cargas Monitoradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 text-sm font-medium">Nome</th>
                        <th className="text-left py-2 px-2 text-sm font-medium">Tipo</th>
                        <th className="text-right py-2 px-2 text-sm font-medium">Consumo</th>
                        <th className="text-right py-2 px-2 text-sm font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargasMonitoradas.map((carga, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="py-2 px-2 text-sm">{carga.nome}</td>
                          <td className="py-2 px-2 text-sm text-muted-foreground">{carga.tipo}</td>
                          <td className="text-right py-2 px-2 text-sm font-medium">{carga.consumo}</td>
                          <td className="text-right py-2 px-2">
                            <Badge
                              variant="outline"
                              className={
                                carga.status === "Normal"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                              }
                            >
                              {carga.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 3. Eventos Recentes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-500" />
                  Eventos Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {eventosRecentes.map((evento, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-2 border-b hover:bg-muted/30 transition-colors rounded"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            evento.tipo === "critico"
                              ? "bg-red-500 animate-pulse"
                              : evento.tipo === "alerta"
                              ? "bg-yellow-500"
                              : evento.tipo === "sucesso"
                              ? "bg-green-500"
                              : "bg-blue-500"
                          }`}
                        />
                        <span className="text-sm">{evento.mensagem}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{evento.hora}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Painel de Alertas Reais (API) */}
            {data && data.alertas.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Alertas Ativos ({data.alertas.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.alertas.map(alerta => (
                      <Alert
                        key={alerta.id}
                        variant={alerta.severidade === 'critical' ? 'destructive' : 'default'}
                      >
                        <AlertDescription className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{alerta.unidadeNome}:</span> {alerta.mensagem}
                          </div>
                          <Badge variant={
                            alerta.severidade === 'critical' ? 'destructive' :
                            alerta.severidade === 'warning' ? 'warning' :
                            'secondary'
                          }>
                            {alerta.tipo}
                          </Badge>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Layout.Main>
    </Layout>
  );
}