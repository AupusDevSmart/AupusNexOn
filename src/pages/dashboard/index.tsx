// src/pages/dashboard/index.tsx - COA com espaçamento corrigido
import { Layout } from "@/components/common/Layout";
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
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// Dados dos clientes e suas unidades - ATUALIZADO COM 3 NOVAS CARGAS
const clientesUnidades = [
  {
    id: "cliente-001",
    nome: "Energia Verde Goiás Ltda",
    unidades: [
      { id: "go-001", nome: "UFV Goiânia Central", cidade: "Goiânia" },
      { id: "go-002", nome: "UFV Senador Canedo", cidade: "Senador Canedo" },
      { id: "go-007", nome: "Carga Industrial Goiânia", cidade: "Goiânia" },
      { id: "go-011", nome: "Carga Shopping Center", cidade: "Goiânia" },
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
      { id: "go-012", nome: "Carga Hospital Municipal", cidade: "Anápolis" },
    ],
  },
  {
    id: "cliente-004",
    nome: "Catalão Energias Renováveis",
    unidades: [
      { id: "go-005", nome: "UFV Catalão", cidade: "Catalão" },
      { id: "go-013", nome: "Carga Fábrica Têxtil", cidade: "Catalão" },
    ],
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

// Dados dos ativos em Goiás - ATUALIZADO COM 3 NOVAS CARGAS
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

  {
    id: "go-011",
    nome: "Carga Shopping Center",
    tipo: "CARGA" as const,
    estado: "Goiás",
    cidade: "Goiânia",
    clienteId: "cliente-001",
    coordenadas: {
      latitude: -16.6756,
      longitude: -49.2534,
      x: 55,
      y: 58,
    },
    status: "NORMAL" as const,
    potenciaNominal: 15.2,
    potenciaAtual: 14.3,
    disponibilidade: 98.7,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-012",
    nome: "Carga Hospital Municipal",
    tipo: "CARGA" as const,
    estado: "Goiás",
    cidade: "Anápolis",
    clienteId: "cliente-003",
    coordenadas: {
      latitude: -16.3102,
      longitude: -48.9445,
      x: 57,
      y: 56,
    },
    status: "TRIP" as const,
    potenciaNominal: 9.8,
    potenciaAtual: 0,
    disponibilidade: 87.4,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-013",
    nome: "Carga Fábrica Têxtil",
    tipo: "CARGA" as const,
    estado: "Goiás",
    cidade: "Catalão",
    clienteId: "cliente-004",
    coordenadas: {
      latitude: -18.1522,
      longitude: -47.9311,
      x: 58,
      y: 63,
    },
    status: "ALARME" as const,
    potenciaNominal: 18.7,
    potenciaAtual: 16.2,
    disponibilidade: 94.1,
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
  const [focoMapa, setFocoMapa] = useState<string | null>(null);

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

  // Determinar ativo focado no mapa
  const ativoFocado = useMemo(() => {
    // Se uma unidade específica está selecionada, focar nela
    if (unidadeSelecionada !== "todas" && unidadeSelecionada !== "") {
      return unidadeSelecionada;
    }
    return focoMapa;
  }, [focoMapa, unidadeSelecionada]);

  // Reset unidade quando cliente muda
  const handleClienteChange = (clienteId: string) => {
    setClienteSelecionado(clienteId);
    setUnidadeSelecionada("todas");

    // Se um cliente específico foi selecionado, focar no primeiro ativo
    if (clienteId !== "todos") {
      const ativosDoCliente = ativosNoBrasil.filter(
        (ativo) => ativo.clienteId === clienteId
      );
      if (ativosDoCliente.length > 0) {
        setFocoMapa(ativosDoCliente[0].id);
      }
    } else {
      setFocoMapa(null);
    }
  };

  // Handler para mudança de unidade com foco
  const handleUnidadeChange = (unidadeId: string) => {
    setUnidadeSelecionada(unidadeId);

    // Se uma unidade específica foi selecionada, focar nela
    if (unidadeId !== "todas" && unidadeId !== "") {
      setFocoMapa(unidadeId);
    } else {
      // Se voltou para "todas", manter foco no primeiro do cliente
      if (clienteSelecionado !== "todos") {
        const ativosDoCliente = ativosNoBrasil.filter(
          (ativo) => ativo.clienteId === clienteSelecionado
        );
        if (ativosDoCliente.length > 0) {
          setFocoMapa(ativosDoCliente[0].id);
        }
      } else {
        setFocoMapa(null);
      }
    }
  };

  // Limpar filtros
  const limparFiltros = () => {
    setClienteSelecionado("todos");
    setUnidadeSelecionada("todas");
    setFocoMapa(null);
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="min-h-screen w-full">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Alteração principal: mudei de gap-2 para gap-3 e ajustei o padding */}
            <div className="flex flex-col gap-3 p-3">
              {/* TitleCard sem margem extra - usando className para sobrescrever */}
              <div className="w-full 1">
                <h1 className="text-2xl font-bold text-foreground">
                  Centro de Operação de Ativos (COA)
                </h1>
              </div>

              {/* Cards de Indicadores Principais - 6 CARDS NA MESMA LINHA */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Energia Consumida */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Energia Consumida
                      </p>
                      <p className="text-xl font-bold">
                        {(
                          (ativosFiltrados.reduce(
                            (acc, a) => acc + (a.potenciaAtual || 0),
                            0
                          ) *
                            24 *
                            30) /
                          1000
                        ).toFixed(1)}{" "}
                        MWh
                      </p>
                      <p className="text-xs text-blue-600">Estimativa mensal</p>
                    </div>
                    <Zap className="h-6 w-6 text-blue-500" />
                  </div>
                </Card>

                {/* 2. Consumo Total */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Consumo Total
                      </p>
                      <p className="text-xl font-bold">
                        {ativosFiltrados
                          .filter((a) => a.tipo === "CARGA")
                          .reduce((acc, a) => acc + (a.potenciaAtual || 0), 0)
                          .toFixed(1)}{" "}
                        MW
                      </p>
                      <p className="text-xs text-green-600">
                        {
                          ativosFiltrados.filter((a) => a.tipo === "CARGA")
                            .length
                        }{" "}
                        cargas ativas
                      </p>
                    </div>
                    <Battery className="h-6 w-6 text-green-500" />
                  </div>
                </Card>

                {/* 3. Potência Instalada */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Potência Instalada
                      </p>
                      <p className="text-xl font-bold">
                        {(
                          ativosFiltrados.reduce(
                            (acc, a) => acc + (a.potenciaAtual || 0),
                            0
                          ) * 1000
                        ).toFixed(0)}{" "}
                        kW
                      </p>
                      <p className="text-xs text-orange-600">Tempo real</p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-orange-500" />
                  </div>
                </Card>

                {/* 4. Total de Eventos */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Total de Eventos
                      </p>
                      <p className="text-xl font-bold">
                        {ativosFiltrados.filter((a) => a.status === "TRIP")
                          .length +
                          ativosFiltrados.filter((a) => a.status === "ALARME")
                            .length +
                          ativosFiltrados.filter((a) => a.status === "URGENCIA")
                            .length +
                          3}{" "}
                        {/* 3 representa OS abertas mockadas */}
                      </p>
                      <p className="text-xs text-amber-600">
                        {
                          ativosFiltrados.filter((a) => a.status === "TRIP")
                            .length
                        }{" "}
                        trips,{" "}
                        {
                          ativosFiltrados.filter((a) => a.status === "ALARME")
                            .length
                        }{" "}
                        alarmes, 3 OS
                      </p>
                    </div>
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                  </div>
                </Card>

                {/* 5. Ativos Monitorados */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Ativos Monitorados
                      </p>
                      <p className="text-xl font-bold">10</p>
                      <p className="text-xs text-indigo-600">5 UGs, 5 Us</p>
                    </div>
                    <Activity className="h-6 w-6 text-indigo-500" />
                  </div>
                </Card>
              </div>

              {/* Layout Principal: Mapa com Filtros Integrados */}
              <div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-6">
                      {/* Título na esquerda */}
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-purple-500" />
                        <CardTitle>Mapa dos Ativos</CardTitle>
                      </div>

                      {/* Filtros também na esquerda, ao lado do título */}
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
                            <SelectTrigger className="min-w-48 w-auto h-8">
                              <SelectValue placeholder="Todos os clientes" />
                            </SelectTrigger>
                            <SelectContent className="max-w-80">
                              <SelectItem value="todos">
                                Todos os Clientes
                              </SelectItem>
                              {clientesUnidades.map((cliente) => (
                                <SelectItem key={cliente.id} value={cliente.id}>
                                  🏢 {cliente.nome}
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
                            onValueChange={handleUnidadeChange}
                            disabled={clienteSelecionado === "todos"}
                          >
                            <SelectTrigger className="min-w-48 w-auto h-8">
                              <SelectValue
                                placeholder={
                                  clienteSelecionado === "todos"
                                    ? "Selecione cliente"
                                    : "Todas as unidades"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="max-w-80">
                              <SelectItem value="todas">
                                Todas as Unidades
                              </SelectItem>
                              {unidadesDoCliente.map((unidade) => (
                                <SelectItem key={unidade.id} value={unidade.id}>
                                  🏭 {unidade.nome}
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
                  </CardHeader>

                  <CardContent>
                    <MapaBrasil
                      ativos={ativosNoBrasil}
                      onAtivoClick={handleAtivoClick}
                      atualizacaoTempo={5}
                      focoAtivo={ativoFocado}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </Layout.Main>
    </Layout>
  );
}
