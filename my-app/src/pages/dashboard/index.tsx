// src/pages/dashboard/index.tsx - NOVO COA
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapaBrasil } from "@/features/supervisorio/components/mapa-brasil";
import {
  Activity,
  AlertTriangle,
  Battery,
  FileText,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Dados dos clientes e suas unidades
const clientesUnidades = [
  {
    id: "cliente-001",
    nome: "Energia Verde Goiás Ltda",
    unidades: [
      { id: "go-001", nome: "UFV Goiânia Central", cidade: "Goiânia" },
      { id: "go-002", nome: "UFV Senador Canedo", cidade: "Senador Canedo" },
      { id: "go-007", nome: "Carga Industrial Goiânia", cidade: "Goiânia" },
    ],
  },
  {
    id: "cliente-002",
    nome: "Sol do Cerrado Energia S.A.",
    unidades: [
      {
        id: "go-003",
        nome: "UFV Aparecida de Goiânia",
        cidade: "Aparecida de Goiânia",
      },
      {
        id: "go-010",
        nome: "Carga Comercial Aparecida",
        cidade: "Aparecida de Goiânia",
      },
    ],
  },
  {
    id: "cliente-003",
    nome: "Anápolis Power Systems",
    unidades: [
      { id: "go-004", nome: "UFV Anápolis Industrial", cidade: "Anápolis" },
      { id: "go-008", nome: "Subestação Anápolis Norte", cidade: "Anápolis" },
    ],
  },
  {
    id: "cliente-004",
    nome: "Catalão Energias Renováveis",
    unidades: [{ id: "go-005", nome: "UFV Catalão", cidade: "Catalão" }],
  },
  {
    id: "cliente-005",
    nome: "Rio Verde Sustentável",
    unidades: [{ id: "go-006", nome: "UFV Rio Verde", cidade: "Rio Verde" }],
  },
  {
    id: "cliente-006",
    nome: "Caldas Solar Park",
    unidades: [
      { id: "go-009", nome: "UFV Caldas Novas", cidade: "Caldas Novas" },
    ],
  },
];

// Dados dos ativos em Goiás - formato profissional
const ativosNoBrasil = [
  {
    id: "go-001",
    nome: "UFV Goiânia Central",
    tipo: "UFV" as const,
    estado: "Goiás",
    cidade: "Goiânia",
    clienteId: "cliente-001",
    coordenadas: {
      latitude: -16.6864,
      longitude: -49.2643,
      x: 55,
      y: 58,
    },
    status: "NORMAL" as const,
    potenciaNominal: 25.5,
    potenciaAtual: 23.8,
    eficiencia: 95.2,
    disponibilidade: 99.1,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-002",
    nome: "UFV Senador Canedo",
    tipo: "UFV" as const,
    estado: "Goiás",
    cidade: "Senador Canedo",
    clienteId: "cliente-001",
    coordenadas: {
      latitude: -16.705,
      longitude: -49.0928,
      x: 56,
      y: 59,
    },
    status: "NORMAL" as const,
    potenciaNominal: 18.2,
    potenciaAtual: 16.8,
    eficiencia: 92.3,
    disponibilidade: 98.7,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-003",
    nome: "UFV Aparecida de Goiânia",
    tipo: "UFV" as const,
    estado: "Goiás",
    cidade: "Aparecida de Goiânia",
    clienteId: "cliente-002",
    coordenadas: {
      latitude: -16.8233,
      longitude: -49.2442,
      x: 55,
      y: 60,
    },
    status: "ALARME" as const,
    potenciaNominal: 32.1,
    potenciaAtual: 28.9,
    eficiencia: 90.1,
    disponibilidade: 97.3,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-004",
    nome: "UFV Anápolis Industrial",
    tipo: "UFV" as const,
    estado: "Goiás",
    cidade: "Anápolis",
    clienteId: "cliente-003",
    coordenadas: {
      latitude: -16.3281,
      longitude: -48.9531,
      x: 57,
      y: 56,
    },
    status: "NORMAL" as const,
    potenciaNominal: 22.3,
    potenciaAtual: 21.1,
    eficiencia: 94.7,
    disponibilidade: 99.2,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-005",
    nome: "UFV Catalão",
    tipo: "UFV" as const,
    estado: "Goiás",
    cidade: "Catalão",
    clienteId: "cliente-004",
    coordenadas: {
      latitude: -18.1658,
      longitude: -47.9467,
      x: 58,
      y: 63,
    },
    status: "TRIP" as const,
    potenciaNominal: 15.8,
    potenciaAtual: 0,
    eficiencia: 0,
    disponibilidade: 85.2,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-006",
    nome: "UFV Rio Verde",
    tipo: "UFV" as const,
    estado: "Goiás",
    cidade: "Rio Verde",
    clienteId: "cliente-005",
    coordenadas: {
      latitude: -17.7944,
      longitude: -50.9256,
      x: 53,
      y: 62,
    },
    status: "NORMAL" as const,
    potenciaNominal: 28.7,
    potenciaAtual: 26.3,
    eficiencia: 91.6,
    disponibilidade: 98.4,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-007",
    nome: "Carga Industrial Goiânia",
    tipo: "CARGA" as const,
    estado: "Goiás",
    cidade: "Goiânia",
    clienteId: "cliente-001",
    coordenadas: {
      latitude: -16.72,
      longitude: -49.3,
      x: 54,
      y: 59,
    },
    status: "NORMAL" as const,
    potenciaNominal: 12.5,
    potenciaAtual: 11.8,
    disponibilidade: 99.5,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-008",
    nome: "Subestação Anápolis Norte",
    tipo: "TRANSFORMADOR" as const,
    estado: "Goiás",
    cidade: "Anápolis",
    clienteId: "cliente-003",
    coordenadas: {
      latitude: -16.29,
      longitude: -48.92,
      x: 57,
      y: 55,
    },
    status: "NORMAL" as const,
    potenciaNominal: 50.0,
    potenciaAtual: 45.2,
    eficiencia: 97.8,
    disponibilidade: 99.1,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-009",
    nome: "UFV Caldas Novas",
    tipo: "UFV" as const,
    estado: "Goiás",
    cidade: "Caldas Novas",
    clienteId: "cliente-006",
    coordenadas: {
      latitude: -17.7406,
      longitude: -48.6253,
      x: 56,
      y: 62,
    },
    status: "NORMAL" as const,
    potenciaNominal: 19.4,
    potenciaAtual: 18.1,
    eficiencia: 93.2,
    disponibilidade: 98.9,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-010",
    nome: "Carga Comercial Aparecida",
    tipo: "CARGA" as const,
    estado: "Goiás",
    cidade: "Aparecida de Goiânia",
    clienteId: "cliente-002",
    coordenadas: {
      latitude: -16.85,
      longitude: -49.27,
      x: 55,
      y: 60,
    },
    status: "ALARME" as const,
    potenciaNominal: 8.3,
    potenciaAtual: 7.1,
    disponibilidade: 96.8,
    ultimaAtualizacao: new Date().toISOString(),
  },
];

// Função para gerar dados de performance das últimas 24h baseado no filtro
const gerarDadosPerformance = (ativosFiltrados: typeof ativosNoBrasil) => {
  if (ativosFiltrados.length === 0) {
    return Array.from({ length: 24 }, (_, i) => ({
      hora: `${i.toString().padStart(2, "0")}:00`,
      geracao: 0,
      consumo: 0,
      meta: 0,
    }));
  }

  const potenciaTotal = ativosFiltrados.reduce(
    (acc, ativo) => acc + ativo.potenciaNominal,
    0
  );
  const metaBase = potenciaTotal * 0.85;

  return Array.from({ length: 24 }, (_, i) => ({
    hora: `${i.toString().padStart(2, "0")}:00`,
    geracao: Math.max(
      0,
      potenciaTotal * 0.6 +
        Math.sin((i / 24) * Math.PI * 4) * (potenciaTotal * 0.3) +
        Math.random() * (potenciaTotal * 0.1)
    ),
    consumo: Math.max(
      0,
      potenciaTotal * 0.5 +
        Math.sin((i / 24) * Math.PI * 2) * (potenciaTotal * 0.2) +
        Math.random() * (potenciaTotal * 0.08)
    ),
    meta: metaBase,
  }));
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("todos");
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string>("todas");

  const handleAtivoClick = (ativoId: string) => {
    console.log(`Navegando para sinóptico do ativo: ${ativoId}`);
    // TODO: Implementar navegação para tela de sinóptico
  };

  // Filtrar ativos com base na seleção
  const ativosFiltrados = useMemo(() => {
    if (clienteSelecionado === "todos") {
      return ativosNoBrasil;
    }

    if (unidadeSelecionada === "todas" || unidadeSelecionada === "") {
      return ativosNoBrasil.filter(
        (ativo) => ativo.clienteId === clienteSelecionado
      );
    }

    return ativosNoBrasil.filter((ativo) => ativo.id === unidadeSelecionada);
  }, [clienteSelecionado, unidadeSelecionada]);

  // Obter unidades do cliente selecionado
  const unidadesDoCliente = useMemo(() => {
    if (clienteSelecionado === "todos") return [];
    const cliente = clientesUnidades.find((c) => c.id === clienteSelecionado);
    return cliente ? cliente.unidades : [];
  }, [clienteSelecionado]);

  // Gerar dados de performance baseados no filtro
  const dadosPerformance = useMemo(() => {
    return gerarDadosPerformance(ativosFiltrados);
  }, [ativosFiltrados]);

  // Gerar dados de performance por unidade/cidade
  const performancePorUnidade = useMemo(() => {
    if (ativosFiltrados.length === 0) return [];

    if (clienteSelecionado === "todos") {
      // Performance por cidade quando todos estão selecionados
      const cidadesAgrupadas = ativosFiltrados.reduce((acc, ativo) => {
        const cidade = ativo.cidade;
        if (!acc[cidade]) {
          acc[cidade] = { geracao: 0, meta: 0, count: 0 };
        }
        acc[cidade].geracao += ativo.potenciaAtual || 0;
        acc[cidade].meta += ativo.potenciaNominal * 0.85;
        acc[cidade].count += 1;
        return acc;
      }, {} as Record<string, { geracao: number; meta: number; count: number }>);

      return Object.entries(cidadesAgrupadas)
        .map(([cidade, data]) => ({
          regiao: cidade.length > 10 ? cidade.substring(0, 10) + "..." : cidade,
          geracao: Number(data.geracao.toFixed(1)),
          meta: Number(data.meta.toFixed(1)),
        }))
        .slice(0, 5);
    } else {
      // Performance por unidade quando cliente específico está selecionado
      return ativosFiltrados
        .map((ativo) => ({
          regiao: ativo.nome
            .replace(/^UFV\s|^Carga\s|^Subestação\s/, "")
            .substring(0, 12),
          geracao: Number((ativo.potenciaAtual || 0).toFixed(1)),
          meta: Number((ativo.potenciaNominal * 0.85).toFixed(1)),
        }))
        .slice(0, 5);
    }
  }, [ativosFiltrados, clienteSelecionado]);

  // Reset unidade quando cliente muda
  const handleClienteChange = (clienteId: string) => {
    setClienteSelecionado(clienteId);
    setUnidadeSelecionada("todas");
  };

  // Limpar filtros
  const limparFiltros = () => {
    setClienteSelecionado("todos");
    setUnidadeSelecionada("todas");
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="min-h-screen">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex flex-col gap-6 p-6">
              <TitleCard title="Centro de Operação de Ativos (COA)" />

              {/* Cards de Indicadores Principais - DADOS FILTRADOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Potência Total
                      </p>
                      <p className="text-xl font-bold">
                        {ativosFiltrados
                          .reduce((acc, a) => acc + a.potenciaNominal, 0)
                          .toFixed(1)}{" "}
                        MW
                      </p>
                      <p className="text-xs text-green-600">
                        {ativosFiltrados.length} ativo
                        {ativosFiltrados.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Zap className="h-6 w-6 text-yellow-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Geração Atual
                      </p>
                      <p className="text-xl font-bold">
                        {ativosFiltrados
                          .reduce((acc, a) => acc + (a.potenciaAtual || 0), 0)
                          .toFixed(1)}{" "}
                        MW
                      </p>
                      <p className="text-xs text-blue-600">
                        {ativosFiltrados.length > 0
                          ? (
                              (ativosFiltrados.reduce(
                                (acc, a) => acc + (a.potenciaAtual || 0),
                                0
                              ) /
                                ativosFiltrados.reduce(
                                  (acc, a) => acc + a.potenciaNominal,
                                  0
                                )) *
                              100
                            ).toFixed(1)
                          : 0}
                        % da capacidade
                      </p>
                    </div>
                    <Battery className="h-6 w-6 text-green-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Eficiência Média
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        {ativosFiltrados.length > 0
                          ? (
                              ativosFiltrados
                                .filter((a) => a.eficiencia)
                                .reduce(
                                  (acc, a) => acc + (a.eficiencia || 0),
                                  0
                                ) /
                              ativosFiltrados.filter((a) => a.eficiencia).length
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                      <p className="text-xs text-green-600">Filtro aplicado</p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Disponibilidade
                      </p>
                      <p className="text-xl font-bold text-blue-600">
                        {ativosFiltrados.length > 0
                          ? (
                              ativosFiltrados
                                .filter((a) => a.disponibilidade)
                                .reduce(
                                  (acc, a) => acc + (a.disponibilidade || 0),
                                  0
                                ) /
                              ativosFiltrados.filter((a) => a.disponibilidade)
                                .length
                            ).toFixed(1)
                          : 0}
                        %
                      </p>
                      <p className="text-xs text-blue-600">Média do filtro</p>
                    </div>
                    <Activity className="h-6 w-6 text-blue-500" />
                  </div>
                </Card>
              </div>

              {/* Cards de Status e Alertas - DADOS FILTRADOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Alarmes Ativos
                      </p>
                      <p className="text-xl font-bold text-yellow-600">
                        {
                          ativosFiltrados.filter((a) => a.status === "ALARME")
                            .length
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        No filtro atual
                      </p>
                    </div>
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Ativos Online
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        {
                          ativosFiltrados.filter((a) => a.status !== "TRIP")
                            .length
                        }
                        /{ativosFiltrados.length}
                      </p>
                      <p className="text-xs text-green-600">
                        {ativosFiltrados.length > 0
                          ? (
                              (ativosFiltrados.filter(
                                (a) => a.status !== "TRIP"
                              ).length /
                                ativosFiltrados.length) *
                              100
                            ).toFixed(0)
                          : 0}
                        % disponível
                      </p>
                    </div>
                    <FileText className="h-6 w-6 text-green-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Status Crítico
                      </p>
                      <p className="text-xl font-bold text-red-600">
                        {
                          ativosFiltrados.filter((a) =>
                            ["URGENCIA", "TRIP"].includes(a.status)
                          ).length
                        }
                      </p>
                      <p className="text-xs text-red-600">
                        {
                          ativosFiltrados.filter((a) => a.status === "TRIP")
                            .length
                        }{" "}
                        em TRIP
                      </p>
                    </div>
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Última Atualização
                      </p>
                      <p className="text-xl font-bold text-blue-600">
                        {new Date().toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-blue-600">Tempo real</p>
                    </div>
                    <Activity className="h-6 w-6 text-blue-500" />
                  </div>
                </Card>
              </div>

              {/* Layout Principal: Mapa com Filtros Integrados */}
              <div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-purple-500" />
                        Mapa dos Ativos
                      </CardTitle>

                      {/* Filtros integrados no header do mapa */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="cliente-mapa"
                            className="text-sm text-muted-foreground"
                          >
                            Cliente:
                          </Label>
                          <Select
                            value={clienteSelecionado}
                            onValueChange={handleClienteChange}
                          >
                            <SelectTrigger className="w-48 h-8">
                              <SelectValue placeholder="Todos os clientes" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">
                                🌍 Todos os Clientes
                              </SelectItem>
                              {clientesUnidades.map((cliente) => (
                                <SelectItem key={cliente.id} value={cliente.id}>
                                  🏢 {cliente.nome.split(" ")[0]}...
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="unidade-mapa"
                            className="text-sm text-muted-foreground"
                          >
                            Unidade:
                          </Label>
                          <Select
                            value={unidadeSelecionada}
                            onValueChange={setUnidadeSelecionada}
                            disabled={clienteSelecionado === "todos"}
                          >
                            <SelectTrigger className="w-48 h-8">
                              <SelectValue
                                placeholder={
                                  clienteSelecionado === "todos"
                                    ? "Selecione cliente"
                                    : "Todas as unidades"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todas">
                                ⚡ Todas as Unidades
                              </SelectItem>
                              {unidadesDoCliente.map((unidade) => (
                                <SelectItem key={unidade.id} value={unidade.id}>
                                  🏭{" "}
                                  {unidade.nome
                                    .split(" ")
                                    .slice(0, 2)
                                    .join(" ")}
                                  ...
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {(clienteSelecionado !== "todos" ||
                          unidadeSelecionada !== "todas") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={limparFiltros}
                            className="h-8"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Indicador do filtro ativo - mais discreto */}
                    <p className="text-xs text-muted-foreground">
                      {clienteSelecionado === "todos"
                        ? `Mostrando todos os ativos (${ativosNoBrasil.length} total)`
                        : unidadeSelecionada === "todas"
                        ? `Filtro: ${
                            clientesUnidades.find(
                              (c) => c.id === clienteSelecionado
                            )?.nome
                          } (${ativosFiltrados.length} ativos)`
                        : `Filtro: ${ativosFiltrados[0]?.nome}`}
                    </p>
                  </CardHeader>

                  <CardContent>
                    <MapaBrasil
                      ativos={ativosNoBrasil} // Sempre todos os ativos no mapa
                      onAtivoClick={handleAtivoClick}
                      atualizacaoTempo={5}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Gráfico de Performance das Últimas 24h - DADOS FILTRADOS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Performance Últimas 24h -{" "}
                    {clienteSelecionado === "todos"
                      ? "Geral"
                      : clientesUnidades.find(
                          (c) => c.id === clienteSelecionado
                        )?.nome || "Seleção"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={dadosPerformance}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="opacity-30"
                      />
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
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                        }}
                        formatter={(value, name) => [
                          `${Number(value).toFixed(1)} MW`,
                          name === "geracao"
                            ? "Geração"
                            : name === "consumo"
                            ? "Consumo"
                            : "Meta",
                        ]}
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

              {/* Tabela de Cargas - DADOS GLOBAIS */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Cargas Monitoradas em Goiás
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Nome</th>
                        <th className="text-left py-2">Cidade</th>
                        <th className="text-right py-2">Consumo</th>
                        <th className="text-right py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="py-2">Indústria Metalúrgica GO</td>
                        <td className="py-2">Goiânia</td>
                        <td className="text-right py-2">11.8 MW</td>
                        <td className="text-right py-2">
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 text-xs"
                          >
                            Normal
                          </Badge>
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="py-2">Shopping Aparecida Center</td>
                        <td className="py-2">Aparecida de Goiânia</td>
                        <td className="text-right py-2">7.1 MW</td>
                        <td className="text-right py-2">
                          <Badge
                            variant="outline"
                            className="bg-yellow-100 text-yellow-800 text-xs"
                          >
                            Alerta
                          </Badge>
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="py-2">Hospital Regional Anápolis</td>
                        <td className="py-2">Anápolis</td>
                        <td className="text-right py-2">5.2 MW</td>
                        <td className="text-right py-2">
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 text-xs"
                          >
                            Normal
                          </Badge>
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/50">
                        <td className="py-2">
                          Distrito Industrial Senador Canedo
                        </td>
                        <td className="py-2">Senador Canedo</td>
                        <td className="text-right py-2">9.5 MW</td>
                        <td className="text-right py-2">
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 text-xs"
                          >
                            Normal
                          </Badge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Eventos Recentes - DADOS GLOBAIS */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Eventos Recentes - Goiás
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm">
                        UFV Catalão - Sistema em TRIP - Técnico despachado
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">11:15</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">
                        UFV Goiânia Central - Manutenção preventiva iniciada
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">10:30</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">
                        UFV Rio Verde - Performance acima da meta por 48h
                        consecutivas
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">09:45</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">
                        Subestação Anápolis Norte - Temperatura elevada
                        detectada
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">08:22</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">
                        Carga Comercial Aparecida - Consumo acima do normal
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">07:58</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Layout.Main>
    </Layout>
  );
}
