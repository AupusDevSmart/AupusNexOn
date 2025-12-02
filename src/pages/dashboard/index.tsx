// src/pages/dashboard/index.tsx - COA com Dados Reais
"use client";

import React, { useMemo, useState } from "react";
import { Layout } from "@/components/common/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Zap,
  Battery,
  TrendingUp,
  AlertTriangle,
  Activity,
  RefreshCw,
  WifiOff,
  Clock,
  Map,
  Loader2
} from "lucide-react";
import { useCoaDashboard } from "@/features/coa/hooks/use-coa-dashboard";
import { MapaCoa } from "@/features/coa/components/mapa-coa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

/**
 * Página COA (Centro de Operações Avançadas) com Dados Reais
 *
 * AGORA USANDO 100% DADOS DO BACKEND - SEM MOCK!
 */
export function DashboardPage() {
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
        geracaoTotal: 0,
        totalEventos: 0,
        ativosMonitorados: 0,
        eficienciaMedia: 0,
      };
    }

    // Soma totais de todas as plantas
    let energiaTotal = 0;
    let unidadesGeradoras = 0;
    let unidadesConsumidoras = 0;

    data.plantas.forEach(planta => {
      planta.unidades.forEach(unidade => {
        energiaTotal += unidade.metricas.energiaHoje;

        // Classificar tipo de unidade baseado no tipo
        if (unidade.tipo?.toLowerCase().includes('solar') ||
            unidade.tipo?.toLowerCase().includes('ufv') ||
            unidade.tipo?.toLowerCase().includes('geracao')) {
          unidadesGeradoras++;
        } else {
          unidadesConsumidoras++;
        }
      });
    });

    return {
      energiaConsumida: energiaTotal,
      consumoTotal: data.resumoGeral.totalConsumo,
      geracaoTotal: data.resumoGeral.totalGeracao,
      totalEventos: data.alertas.length,
      ativosMonitorados: data.resumoGeral.totalUnidades,
      unidadesGeradoras,
      unidadesConsumidoras,
      eficienciaMedia: data.resumoGeral.totalUnidades > 0
        ? (data.resumoGeral.unidadesOnline / data.resumoGeral.totalUnidades * 100)
        : 0,
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
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-xl font-bold">
            {typeof value === "number" ? value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : value}
            {unit && ` ${unit}`}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
    </Card>
  );

  // Loading State
  if (isLoading && !data) {
    return (
      <Layout>
        <Layout.Main>
          <div className="min-h-screen w-full">
            <div className="flex flex-col gap-3 p-2">
              {/* Título */}
              <div className="w-full">
                <h1 className="text-2xl font-bold text-foreground">
                  Centro de Operação de Ativos (COA)
                </h1>
                <p className="text-muted-foreground mt-1">Carregando dados...</p>
              </div>

              {/* Skeletons para os cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </Card>
                ))}
              </div>

              {/* Skeleton para o mapa */}
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
          <div className="min-h-screen w-full">
            <div className="flex flex-col gap-3 p-2">
              <div className="w-full">
                <h1 className="text-2xl font-bold text-foreground">
                  Centro de Operação de Ativos (COA)
                </h1>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao carregar dados do COA: {error.message}
                </AlertDescription>
              </Alert>

              <Button onClick={() => refresh()} className="w-fit">
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
        <div className="min-h-screen w-full">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex flex-col gap-3 p-2">
              {/* Header com Status */}
              <div className="w-full">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Centro de Operação de Ativos (COA)
                    </h1>
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
                  </div>
                </div>
              </div>

              {/* Cards de Indicadores Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Energia Hoje */}
                <MetricCard
                  title="Energia Hoje"
                  value={metricas.energiaConsumida}
                  unit="kWh"
                  subtitle="Total acumulado"
                  icon={Zap}
                  color="text-blue-500"
                />

                {/* 2. Consumo Total */}
                <MetricCard
                  title="Consumo Total"
                  value={metricas.consumoTotal}
                  unit="kW"
                  subtitle={`${metricas.unidadesConsumidoras} cargas ativas`}
                  icon={Battery}
                  color="text-green-500"
                />

                {/* 3. Geração Solar */}
                <MetricCard
                  title="Geração Solar"
                  value={metricas.geracaoTotal}
                  unit="kW"
                  subtitle={`${metricas.unidadesGeradoras} geradores`}
                  icon={TrendingUp}
                  color="text-yellow-500"
                />

                {/* 4. Total de Eventos */}
                <MetricCard
                  title="Total de Eventos"
                  value={metricas.totalEventos}
                  subtitle={data?.alertas.length ? `${data.alertas.filter(a => a.severidade === 'critical').length} críticos` : 'Sem alertas'}
                  icon={AlertTriangle}
                  color={metricas.totalEventos > 0 ? "text-amber-500" : "text-gray-400"}
                />

                {/* 5. Ativos Monitorados */}
                <MetricCard
                  title="Ativos Monitorados"
                  value={data?.resumoGeral.unidadesOnline || 0}
                  subtitle={`de ${data?.resumoGeral.totalUnidades || 0} total`}
                  icon={Activity}
                  color="text-indigo-500"
                />
              </div>

              {/* Mapa de Unidades */}
              {data && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Map className="h-5 w-5 text-purple-500" />
                        <CardTitle>Mapa dos Ativos</CardTitle>
                      </div>

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
                        console.log('Unidade clicada:', unidadeId);
                        // Pode navegar para detalhes da unidade
                        // navigate(`/unidades/${unidadeId}`);
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Grid de Plantas */}
              {data && data.plantas.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.plantas.map(planta => (
                    <Card key={planta.id} className="hover:shadow-lg transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{planta.nome}</CardTitle>
                          <Badge variant={planta.totais.unidadesAtivas > 0 ? "success" : "secondary"}>
                            {planta.totais.unidadesAtivas} ativas
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{planta.cliente}</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Métricas da Planta */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Geração</p>
                            <p className="text-xl font-semibold text-green-600">
                              {planta.totais.geracao.toFixed(1)} kW
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Consumo</p>
                            <p className="text-xl font-semibold text-blue-600">
                              {planta.totais.consumo.toFixed(1)} kW
                            </p>
                          </div>
                        </div>

                        {/* Lista de Unidades */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Unidades ({planta.unidades.length})</p>
                          {planta.unidades.slice(0, 3).map(unidade => (
                            <div key={unidade.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${
                                  unidade.status === 'ONLINE' ? 'bg-green-500' :
                                  unidade.status === 'ALERTA' ? 'bg-yellow-500' :
                                  'bg-gray-400'
                                }`} />
                                <span className="text-sm">{unidade.nome}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {unidade.metricas.potenciaAtual.toFixed(1)} kW
                              </span>
                            </div>
                          ))}
                          {planta.unidades.length > 3 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{planta.unidades.length - 3} unidades
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Se não houver dados */}
              {data && data.plantas.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Nenhuma planta encontrada</p>
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      Verifique se há plantas cadastradas com equipamentos configurados
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Painel de Alertas */}
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
                      {data.alertas.slice(0, 5).map(alerta => (
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
                      {data.alertas.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center">
                          +{data.alertas.length - 5} alertas
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </Layout.Main>
    </Layout>
  );
}