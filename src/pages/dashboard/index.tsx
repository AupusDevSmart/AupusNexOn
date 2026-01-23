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
  Loader2
} from "lucide-react";
import {
  BarChart,
  Bar,
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

// Dados mockados para gráfico de performance por região
const performancePorRegiao = [
  { regiao: "Sudeste", geracao: 75.8, meta: 80, eficiencia: 94.2 },
  { regiao: "Nordeste", geracao: 68.4, meta: 70, eficiencia: 92.1 },
  { regiao: "Centro-Oeste", geracao: 18.1, meta: 20, eficiencia: 93.2 },
  { regiao: "Sul", geracao: 12.3, meta: 15, eficiencia: 89.7 },
  { regiao: "Norte", geracao: 8.9, meta: 10, eficiencia: 91.4 },
];

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
        potenciaGeracaoInstantanea: 0,
        energiaGeradaHoje: 0,
        potenciaCargaInstantanea: 0,
        energiaConsumidaHoje: 0,
        custoEnergiaHoje: 0,
        totalEventos: 0,
        instalacoesMonitoradas: 0,
        unidadesGeradoras: 0,
        unidadesConsumidoras: 0,
        eficienciaMedia: 0,
      };
    }

    // Soma totais de todas as plantas
    let potenciaGeracaoInstantanea = 0;
    let energiaGeradaHoje = 0;
    let potenciaCargaInstantanea = 0;
    let energiaConsumidaHoje = 0;
    let unidadesGeradoras = 0;
    let unidadesConsumidoras = 0;

    data.plantas.forEach(planta => {
      planta.unidades.forEach(unidade => {
        // Classificar tipo de unidade baseado no tipo
        if (unidade.tipo === 'UFV' ||
            unidade.tipo?.toLowerCase().includes('solar') ||
            unidade.tipo?.toLowerCase().includes('geracao')) {
          // GERAÇÃO
          potenciaGeracaoInstantanea += unidade.metricas.potenciaAtual;
          energiaGeradaHoje += unidade.metricas.energiaHoje;
          unidadesGeradoras++;

          // DEBUG: Log energia de cada unidade geradora
          console.log(`[Dashboard] Unidade Geradora: ${unidade.nome}`, {
            tipo: unidade.tipo,
            energiaHoje: unidade.metricas.energiaHoje,
            potenciaAtual: unidade.metricas.potenciaAtual
          });
        } else if (unidade.tipo === 'Carga') {
          // CARGA
          potenciaCargaInstantanea += unidade.metricas.potenciaAtual;
          energiaConsumidaHoje += unidade.metricas.energiaHoje;
          unidadesConsumidoras++;
        }
      });
    });

    // DEBUG: Log totais calculados
    console.log('[Dashboard] Totais calculados:', {
      energiaGeradaHoje,
      energiaConsumidaHoje,
      unidadesGeradoras,
      unidadesConsumidoras
    });

    // ✅ Custo de energia: usar valor calculado do backend (com tarifas reais)
    // Se não disponível, calcular estimativa com tarifa média
    const custoEnergiaHoje = data.resumoGeral.custoTotalHoje !== undefined
      ? data.resumoGeral.custoTotalHoje
      : energiaConsumidaHoje * 0.50; // Fallback: tarifa média R$ 0,50/kWh

    return {
      potenciaGeracaoInstantanea,
      energiaGeradaHoje,
      potenciaCargaInstantanea,
      energiaConsumidaHoje,
      custoEnergiaHoje,
      totalEventos: data.alertas.length,
      instalacoesMonitoradas: data.resumoGeral.totalUnidades,
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
        <div className="h-screen w-full overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="flex flex-col gap-3 p-2">
              {/* Header com Status */}
              <div className="w-full">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Centro de Operação de Ativos (COA)
                    </h1>
                    {/* COMENTADO: Status de conexão e última atualização */}
                    {/* <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isStale ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
                        <span className="text-sm text-muted-foreground">
                          {isStale ? 'Dados desatualizados' : 'Dados em tempo real'}
                        </span>
                      </div>

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
                    </div> */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* 1. Potência de Geração */}
                <MetricCard
                  title="Potência de Geração"
                  value={metricas.potenciaGeracaoInstantanea}
                  unit="kW"
                  subtitle={`${metricas.unidadesGeradoras} geradores ativos`}
                  icon={Zap}
                  color="text-blue-500"
                />

                {/* 2. Energia Gerada Hoje */}
                <MetricCard
                  title="Energia Gerada Hoje"
                  value={metricas.energiaGeradaHoje}
                  unit="kWh"
                  subtitle="Total acumulado"
                  icon={TrendingUp}
                  color="text-green-500"
                />

                {/* 3. Potência de Carga */}
                <MetricCard
                  title="Potência de Carga"
                  value={metricas.potenciaCargaInstantanea}
                  unit="kW"
                  subtitle={`${metricas.unidadesConsumidoras} cargas ativas`}
                  icon={Battery}
                  color="text-orange-500"
                />

                {/* 4. Energia Consumida Hoje */}
                <MetricCard
                  title="Energia Consumida Hoje"
                  value={metricas.energiaConsumidaHoje}
                  unit="kWh"
                  subtitle="Total de consumo"
                  icon={Activity}
                  color="text-red-500"
                />

                {/* 5. Custo da Energia */}
                <MetricCard
                  title="Custo da Energia"
                  value={metricas.custoEnergiaHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  subtitle={data?.resumoGeral.custoTotalHoje !== undefined ? 'Tarifas reais' : 'Estimativa'}
                  icon={TrendingUp}
                  color="text-yellow-500"
                />

                {/* 6. Instalações Monitoradas */}
                <MetricCard
                  title="Instalações Monitoradas"
                  value={data?.resumoGeral.unidadesOnline || 0}
                  subtitle={`de ${data?.resumoGeral.totalUnidades || 0} total`}
                  icon={Activity}
                  color="text-indigo-500"
                />
              </div>

              {/* Estatísticas Adicionais - Estilo COA Antigo */}
              {/* COMENTADO: Cards de estatísticas secundárias - podem ser reativados futuramente */}
              {/* {data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Eficiência Média
                    </h4>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {metricas.eficienciaMedia.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      +2.3% em relação ao mês anterior
                    </p>
                  </Card>

                  <Card className="p-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Disponibilidade Média
                    </h4>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {((data.resumoGeral.unidadesOnline / data.resumoGeral.totalUnidades) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dentro da meta estabelecida
                    </p>
                  </Card>

                  <Card className="p-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Total Geração Hoje
                    </h4>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {data.resumoGeral.totalGeracao.toFixed(1)} kW
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((data.resumoGeral.totalGeracao / (data.resumoGeral.totalGeracao * 1.17)) * 100).toFixed(1)}% da capacidade total
                    </p>
                  </Card>
                </div>
              )} */}

              {/* Layout: Mapa + Tabelas Laterais - Alinhado com os cards de cima */}
              {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  {/* Mapa - 4/6 da largura (alinha com os 4 primeiros cards) */}
                  <div className="lg:col-span-4 h-full">
                    <MapaCoa
                      unidades={data.plantas.flatMap(planta =>
                        planta.unidades.map(unidade => ({
                          ...unidade,
                          plantaNome: planta.nome
                        }))
                      )}
                      onUnidadeClick={(unidadeId) => {
                        console.log('🖱️ [DASHBOARD] Unidade clicada:', unidadeId);
                        // Buscar dados completos da unidade e planta para passar via state
                        const todasUnidades = data.plantas.flatMap(planta =>
                          planta.unidades.map(u => ({ unidade: u, planta }))
                        );
                        const unidadeComPlanta = todasUnidades.find(item => item.unidade.id === unidadeId);

                        if (unidadeComPlanta) {
                          console.log('✅ [DASHBOARD] Navegando com dados via state:', {
                            unidadeNome: unidadeComPlanta.unidade.nome,
                            plantaNome: unidadeComPlanta.planta.nome
                          });
                          // Navegar passando os dados da unidade e planta via state
                          navigate(`/supervisorio/sinoptico-ativo/${unidadeId}`, {
                            state: {
                              unidade: unidadeComPlanta.unidade,
                              planta: unidadeComPlanta.planta
                            }
                          });
                        } else {
                          console.warn('⚠️ [DASHBOARD] Unidade não encontrada, navegando sem state');
                          // Fallback: navegar sem state
                          navigate(`/supervisorio/sinoptico-ativo/${unidadeId}`);
                        }
                      }}
                    />
                  </div>

                  {/* COMENTADO: Painel Lateral - Resumo Rápido */}
                  {/* <div className="lg:col-span-1 h-full">
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle className="text-base">📊 Resumo Rápido</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded border">
                            <div className="font-bold text-green-600 text-lg">
                              {data.resumoGeral.unidadesOnline}
                            </div>
                            <div className="text-green-700 dark:text-green-400">Online</div>
                          </div>
                          <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border">
                            <div className="font-bold text-yellow-600 text-lg">
                              {data.alertas.filter(a => a.severidade === 'warning').length}
                            </div>
                            <div className="text-yellow-700 dark:text-yellow-400">Alertas</div>
                          </div>
                          <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded border">
                            <div className="font-bold text-red-600 text-lg">
                              {data.alertas.filter(a => a.severidade === 'critical').length}
                            </div>
                            <div className="text-red-700 dark:text-red-400">Críticos</div>
                          </div>
                          <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded border">
                            <div className="font-bold text-blue-600 text-lg">
                              {data.resumoGeral.totalGeracao.toFixed(0)}
                            </div>
                            <div className="text-blue-700 dark:text-blue-400">kW Ativo</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div> */}

                  {/* Painel Lateral - Tabelas de UFVs e Cargas - 2/6 da largura (alinha com os 2 últimos cards) */}
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    {/* Tabela: USINAS FOTOVOLTAICAS */}
                    <Card className="flex flex-col h-[calc(50vh-8rem)]">
                    <CardHeader className="flex-shrink-0">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <span>USINAS FOTOVOLTAICAS</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                      <div className="h-full overflow-y-auto overflow-x-auto">
                        <table className="w-full text-xs min-w-[600px]">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium">Nome</th>
                              <th className="text-center py-2 px-2 font-medium">Potência</th>
                              <th className="text-center py-2 px-2 font-medium">Potência Inst.</th>
                              <th className="text-center py-2 px-2 font-medium">FC</th>
                              <th className="text-center py-2 px-2 font-medium">Clima</th>
                              <th className="text-center py-2 px-2 font-medium">Status</th>
                              <th className="text-center py-2 px-2 font-medium">Trip</th>
                              <th className="text-center py-2 px-2 font-medium">Alarme</th>
                              <th className="text-center py-2 px-2 font-medium">Update</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const todasUnidades = data.plantas.flatMap(planta => planta.unidades);
                              // Filtrar UFVs: tipo === 'UFV'
                              const ufvs = todasUnidades.filter(unidade => unidade.tipo === 'UFV');
                              console.log('[Dashboard] UFVs filtradas:', ufvs.length, ufvs.map(u => ({ nome: u.nome, tipo: u.tipo })));

                              if (ufvs.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={9} className="text-center py-4 text-muted-foreground">
                                      Nenhuma unidade UFV encontrada
                                    </td>
                                  </tr>
                                );
                              }

                              return ufvs.map((unidade) => {
                                // ✅ CORRIGIDO: Calcular % baseado na potência instalada cadastrada
                                const potenciaPercent = unidade.potenciaInstalada > 0
                                  ? Math.round((unidade.metricas.potenciaAtual / unidade.potenciaInstalada) * 100)
                                  : 0;
                                const fatorCarga = unidade.metricas.fatorPotencia || 0;
                                const hasTrip = unidade.status === 'OFFLINE' || unidade.status === 'FALHA';
                                const hasAlarme = unidade.status === 'ALERTA';

                                return (
                                  <tr
                                    key={unidade.id}
                                    className="border-b hover:bg-muted/30 cursor-pointer"
                                    onClick={() => {
                                      // Buscar planta da unidade para passar via state
                                      const plantaDaUnidade = data.plantas.find(p =>
                                        p.unidades.some(u => u.id === unidade.id)
                                      );

                                      navigate(`/supervisorio/sinoptico-ativo/${unidade.id}`, {
                                        state: {
                                          unidade: unidade,
                                          planta: plantaDaUnidade
                                        }
                                      });
                                    }}
                                  >
                                    <td className="py-2 px-2 font-medium">{unidade.nome}</td>
                                    <td className="text-center py-2 px-2">
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-2 w-full">
                                          <span className="text-xs font-medium whitespace-nowrap">{potenciaPercent}%</span>
                                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all ${
                                                potenciaPercent >= 90 ? 'bg-green-500' :
                                                potenciaPercent >= 70 ? 'bg-yellow-500' :
                                                'bg-red-500'
                                              }`}
                                              style={{ width: `${Math.min(potenciaPercent, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{unidade.metricas.potenciaAtual.toFixed(1)} MW</span>
                                      </div>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant="outline">0%</Badge>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant="outline">{fatorCarga.toFixed(0)}</Badge>
                                    </td>
                                    <td className="text-center py-2 px-2">-</td>
                                    <td className="text-center py-2 px-2">
                                      <div className={`w-3 h-3 rounded-full mx-auto ${
                                        unidade.status === 'ONLINE' ? 'bg-green-500' :
                                        unidade.status === 'ALERTA' ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`} />
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant={hasTrip ? "destructive" : "outline"}>
                                        {hasTrip ? '1' : '0'}
                                      </Badge>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant={hasAlarme ? "warning" : "outline"}>
                                        {hasAlarme ? '1' : '0'}
                                      </Badge>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      {unidade.ultimaLeitura
                                        ? new Date(unidade.ultimaLeitura).toLocaleTimeString("pt-BR", {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })
                                        : '--:--'}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tabela: CARGAS MONITORADAS */}
                  <Card className="flex flex-col h-[calc(50vh-8rem)]">
                    <CardHeader className="flex-shrink-0">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <span>CARGAS MONITORADAS</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                      <div className="h-full overflow-y-auto overflow-x-auto">
                        <table className="w-full text-xs min-w-[600px]">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium">Nome</th>
                              <th className="text-center py-2 px-2 font-medium">Potência</th>
                              <th className="text-center py-2 px-2 font-medium">Potência Inst.</th>
                              <th className="text-center py-2 px-2 font-medium">FC</th>
                              <th className="text-center py-2 px-2 font-medium">Clima</th>
                              <th className="text-center py-2 px-2 font-medium">Status</th>
                              <th className="text-center py-2 px-2 font-medium">Trip</th>
                              <th className="text-center py-2 px-2 font-medium">Alarme</th>
                              <th className="text-center py-2 px-2 font-medium">Update</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const todasUnidades = data.plantas.flatMap(planta => planta.unidades);
                              // Filtrar CARGAS: tipo === 'Carga'
                              const cargas = todasUnidades.filter(unidade => unidade.tipo === 'Carga');
                              console.log('[Dashboard] Cargas filtradas:', cargas.length, cargas.map(u => ({ nome: u.nome, tipo: u.tipo })));

                              if (cargas.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={9} className="text-center py-4 text-muted-foreground">
                                      Nenhuma carga encontrada
                                    </td>
                                  </tr>
                                );
                              }

                              return cargas.map((unidade) => {
                                // ✅ CORRIGIDO: Calcular % baseado na potência instalada cadastrada
                                const consumoPercent = unidade.potenciaInstalada > 0
                                  ? Math.round((unidade.metricas.potenciaAtual / unidade.potenciaInstalada) * 100)
                                  : 0;
                                const fatorCarga = unidade.metricas.fatorPotencia || 0;
                                const hasTrip = unidade.status === 'OFFLINE' || unidade.status === 'FALHA';
                                const hasAlarme = unidade.status === 'ALERTA';

                                return (
                                  <tr
                                    key={unidade.id}
                                    className="border-b hover:bg-muted/30 cursor-pointer"
                                    onClick={() => {
                                      // Buscar planta da unidade para passar via state
                                      const plantaDaUnidade = data.plantas.find(p =>
                                        p.unidades.some(u => u.id === unidade.id)
                                      );

                                      navigate(`/supervisorio/sinoptico-ativo/${unidade.id}`, {
                                        state: {
                                          unidade: unidade,
                                          planta: plantaDaUnidade
                                        }
                                      });
                                    }}
                                  >
                                    <td className="py-2 px-2 font-medium">{unidade.nome}</td>
                                    <td className="text-center py-2 px-2">
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-2 w-full">
                                          <span className="text-xs font-medium whitespace-nowrap">{consumoPercent}%</span>
                                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all ${
                                                consumoPercent >= 90 ? 'bg-red-500' :
                                                consumoPercent >= 70 ? 'bg-yellow-500' :
                                                'bg-green-500'
                                              }`}
                                              style={{ width: `${Math.min(consumoPercent, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{unidade.metricas.potenciaAtual.toFixed(1)} MW</span>
                                      </div>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant="outline">0%</Badge>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant="outline">{fatorCarga.toFixed(0)}</Badge>
                                    </td>
                                    <td className="text-center py-2 px-2">-</td>
                                    <td className="text-center py-2 px-2">
                                      <div className={`w-3 h-3 rounded-full mx-auto ${
                                        unidade.status === 'ONLINE' ? 'bg-green-500' :
                                        unidade.status === 'ALERTA' ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`} />
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant={hasTrip ? "destructive" : "outline"}>
                                        {hasTrip ? '1' : '0'}
                                      </Badge>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant={hasAlarme ? "warning" : "outline"}>
                                        {hasAlarme ? '1' : '0'}
                                      </Badge>
                                    </td>
                                    <td className="text-center py-2 px-2">
                                      {unidade.ultimaLeitura
                                        ? new Date(unidade.ultimaLeitura).toLocaleTimeString("pt-BR", {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })
                                        : '--:--'}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                  </div>
                </div>
              )}

              {/* COMENTADO: Gráfico de Performance por Região - dados mockados */}
              {/* <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    Performance por Região
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={performancePorRegiao}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="regiao"
                        fontSize={12}
                        angle={-45}
                        textAnchor="end"
                        height={60}
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
                      <Bar
                        dataKey="geracao"
                        fill="#3b82f6"
                        name="Geração Atual"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="meta"
                        fill="#e5e7eb"
                        name="Meta"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card> */}

              {/* COMENTADO: Tabela de Cargas Monitoradas - dados mockados */}
              {/* <Card>
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
              </Card> */}

              {/* COMENTADO: Eventos Recentes - dados mockados */}
              {/* <Card>
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
              </Card> */}

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