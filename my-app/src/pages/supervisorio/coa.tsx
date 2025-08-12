// src/pages/supervisorio/coa.tsx
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapaBrasil } from "@/features/supervisorio/components/mapa-brasil";
import {
  Activity,
  AlertTriangle,
  Battery,
  FileText,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Dados dos ativos no Brasil - formato profissional
const ativosNoBrasil = [
  {
    id: "sp-001",
    nome: "UFV São Paulo",
    tipo: "UFV" as const,
    estado: "São Paulo",
    cidade: "São Paulo",
    coordenadas: {
      latitude: -23.5505,
      longitude: -46.6333,
      x: 60,
      y: 65,
    },
    status: "NORMAL" as const,
    potenciaNominal: 25.5,
    potenciaAtual: 23.8,
    eficiencia: 95.2,
    disponibilidade: 99.1,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "rj-001",
    nome: "UFV Rio de Janeiro",
    tipo: "UFV" as const,
    estado: "Rio de Janeiro",
    cidade: "Rio de Janeiro",
    coordenadas: {
      latitude: -22.9068,
      longitude: -43.1729,
      x: 65,
      y: 70,
    },
    status: "ALARME" as const,
    potenciaNominal: 18.2,
    potenciaAtual: 16.1,
    eficiencia: 88.5,
    disponibilidade: 97.3,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "mg-001",
    nome: "UFV Minas Gerais",
    tipo: "UFV" as const,
    estado: "Minas Gerais",
    cidade: "Belo Horizonte",
    coordenadas: {
      latitude: -19.9167,
      longitude: -43.9345,
      x: 62,
      y: 62,
    },
    status: "NORMAL" as const,
    potenciaNominal: 32.1,
    potenciaAtual: 31.1,
    eficiencia: 96.8,
    disponibilidade: 99.7,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "ba-001",
    nome: "UFV Bahia",
    tipo: "UFV" as const,
    estado: "Bahia",
    cidade: "Salvador",
    coordenadas: {
      latitude: -12.9714,
      longitude: -38.5014,
      x: 58,
      y: 55,
    },
    status: "TRIP" as const,
    potenciaNominal: 15.8,
    potenciaAtual: 0,
    eficiencia: 0,
    disponibilidade: 85.2,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "ce-001",
    nome: "UFV Ceará",
    tipo: "UFV" as const,
    estado: "Ceará",
    cidade: "Fortaleza",
    coordenadas: {
      latitude: -3.7319,
      longitude: -38.5267,
      x: 56,
      y: 45,
    },
    status: "NORMAL" as const,
    potenciaNominal: 22.3,
    potenciaAtual: 21.1,
    eficiencia: 94.7,
    disponibilidade: 98.9,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "go-001",
    nome: "UFV Goiás",
    tipo: "UFV" as const,
    estado: "Goiás",
    cidade: "Goiânia",
    coordenadas: {
      latitude: -16.6864,
      longitude: -49.2643,
      x: 55,
      y: 58,
    },
    status: "NORMAL" as const,
    potenciaNominal: 19.4,
    potenciaAtual: 18.1,
    eficiencia: 93.2,
    disponibilidade: 99.2,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "carga-001",
    nome: "Carga Industrial SP",
    tipo: "CARGA" as const,
    estado: "São Paulo",
    cidade: "São Bernardo do Campo",
    coordenadas: {
      latitude: -23.6914,
      longitude: -46.5646,
      x: 61,
      y: 66,
    },
    status: "NORMAL" as const,
    potenciaNominal: 12.5,
    potenciaAtual: 11.8,
    disponibilidade: 99.5,
    ultimaAtualizacao: new Date().toISOString(),
  },
  {
    id: "trafo-001",
    nome: "Subestação RJ Norte",
    tipo: "TRANSFORMADOR" as const,
    estado: "Rio de Janeiro",
    cidade: "Nova Iguaçu",
    coordenadas: {
      latitude: -22.759,
      longitude: -43.4509,
      x: 64,
      y: 71,
    },
    status: "ALARME" as const,
    potenciaNominal: 50.0,
    potenciaAtual: 45.2,
    eficiencia: 97.8,
    disponibilidade: 98.1,
    ultimaAtualizacao: new Date().toISOString(),
  },
];

// Dados de performance das últimas 24 horas
const dadosPerformance = Array.from({ length: 24 }, (_, i) => ({
  hora: `${i.toString().padStart(2, "0")}:00`,
  geracao: 80 + Math.sin((i / 24) * Math.PI * 4) * 30 + Math.random() * 10,
  consumo: 70 + Math.sin((i / 24) * Math.PI * 2) * 20 + Math.random() * 8,
  meta: 85,
}));

// Dados de performance por região
const performancePorRegiao = [
  { regiao: "Sudeste", geracao: 75.8, meta: 80, eficiencia: 94.2 },
  { regiao: "Nordeste", geracao: 68.4, meta: 70, eficiencia: 92.1 },
  { regiao: "Centro-Oeste", geracao: 18.1, meta: 20, eficiencia: 93.2 },
  { regiao: "Sul", geracao: 12.3, meta: 15, eficiencia: 89.7 },
  { regiao: "Norte", geracao: 8.9, meta: 10, eficiencia: 91.4 },
];

export function COAPage() {
  const navigate = useNavigate();

  const handleAtivoClick = (ativoId: string) => {
    console.log(`Navegando para sinóptico do ativo: ${ativoId}`);
    // A navegação será tratada pelo componente MapaBrasil
  };

  return (
    <Layout>
      <div className="min-h-screen">
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="flex flex-col gap-6 p-6">
            <TitleCard title="Centro de Operação de Ativos (COA)" />

            {/* Cards de Indicadores Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Potência Total
                    </p>
                    <p className="text-xl font-bold">133.3 MW</p>
                    <p className="text-xs text-green-600">+6.3% hoje</p>
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
                      {ativosNoBrasil
                        .filter((a) => a.potenciaAtual)
                        .reduce((acc, a) => acc + (a.potenciaAtual || 0), 0)
                        .toFixed(1)}{" "}
                      MW
                    </p>
                    <p className="text-xs text-blue-600">
                      {(
                        (ativosNoBrasil
                          .filter((a) => a.potenciaAtual)
                          .reduce((acc, a) => acc + (a.potenciaAtual || 0), 0) /
                          ativosNoBrasil.reduce(
                            (acc, a) => acc + a.potenciaNominal,
                            0
                          )) *
                        100
                      ).toFixed(1)}
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
                      {(
                        ativosNoBrasil
                          .filter((a) => a.eficiencia)
                          .reduce((acc, a) => acc + (a.eficiencia || 0), 0) /
                        ativosNoBrasil.filter((a) => a.eficiencia).length
                      ).toFixed(1)}
                      %
                    </p>
                    <p className="text-xs text-green-600">
                      +2.3% vs mês anterior
                    </p>
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
                      {(
                        ativosNoBrasil
                          .filter((a) => a.disponibilidade)
                          .reduce(
                            (acc, a) => acc + (a.disponibilidade || 0),
                            0
                          ) /
                        ativosNoBrasil.filter((a) => a.disponibilidade).length
                      ).toFixed(1)}
                      %
                    </p>
                    <p className="text-xs text-blue-600">Dentro da meta</p>
                  </div>
                  <Activity className="h-6 w-6 text-blue-500" />
                </div>
              </Card>
            </div>

            {/* Cards de Status e Alertas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Alarmes Ativos
                    </p>
                    <p className="text-xl font-bold text-yellow-600">
                      {
                        ativosNoBrasil.filter((a) => a.status === "ALARME")
                          .length
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Média prioridade
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
                      {ativosNoBrasil.filter((a) => a.status !== "TRIP").length}
                      /{ativosNoBrasil.length}
                    </p>
                    <p className="text-xs text-green-600">
                      {(
                        (ativosNoBrasil.filter((a) => a.status !== "TRIP")
                          .length /
                          ativosNoBrasil.length) *
                        100
                      ).toFixed(0)}
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
                        ativosNoBrasil.filter((a) =>
                          ["URGENCIA", "TRIP"].includes(a.status)
                        ).length
                      }
                    </p>
                    <p className="text-xs text-red-600">
                      {ativosNoBrasil.filter((a) => a.status === "TRIP").length}{" "}
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

            {/* Layout Principal: Mapa + Gráfico de Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mapa do Brasil */}
              <div>
                <MapaBrasil
                  ativos={ativosNoBrasil}
                  onAtivoClick={handleAtivoClick}
                  atualizacaoTempo={5}
                />
              </div>

              {/* Gráfico de Performance por Região - VERSÃO MELHORADA */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-purple-500" />
                      Performance por Região
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart
                        data={performancePorRegiao}
                        margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="opacity-30"
                        />
                        <XAxis
                          dataKey="regiao"
                          fontSize={12}
                          angle={0}
                          textAnchor="middle"
                          height={60}
                          interval={0}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          fontSize={12}
                          label={{
                            value: "MW",
                            angle: -90,
                            position: "insideLeft",
                            style: { textAnchor: "middle" },
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--background)",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                          }}
                          formatter={(value, name) => [
                            `${value} MW`,
                            name === "geracao"
                              ? "Geração Atual"
                              : name === "meta"
                              ? "Meta"
                              : name,
                          ]}
                        />
                        <Legend
                          verticalAlign="bottom"
                          align="left"
                          wrapperStyle={{
                            paddingTop: "35px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar
                          dataKey="geracao"
                          fill="#3b82f6"
                          name="Geração Atual"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={80}
                        />
                        <Bar
                          dataKey="meta"
                          fill="#e5e7eb"
                          name="Meta"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={80}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Gráfico de Performance das Últimas 24h */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Performance Últimas 24h
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

            {/* Tabela de Cargas - Layout Simplificado */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Cargas Monitoradas</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Nome</th>
                      <th className="text-left py-2">Tipo</th>
                      <th className="text-right py-2">Consumo</th>
                      <th className="text-right py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-2">Fábrica ABC</td>
                      <td className="py-2">Industrial</td>
                      <td className="text-right py-2">12.3 MW</td>
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
                      <td className="py-2">Shopping XYZ</td>
                      <td className="py-2">Comercial</td>
                      <td className="text-right py-2">8.7 MW</td>
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
                      <td className="py-2">Hospital Central</td>
                      <td className="py-2">Hospitalar</td>
                      <td className="text-right py-2">5.2 MW</td>
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
                      <td className="py-2">Data Center Alpha</td>
                      <td className="py-2">Tecnologia</td>
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

            {/* Eventos Recentes */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Eventos Recentes</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm">
                      UFV Bahia - Sistema em TRIP - Técnico despachado
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">11:15</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">
                      UFV São Paulo - Manutenção preventiva iniciada
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">10:30</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">
                      UFV Ceará - Performance acima da meta por 48h consecutivas
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">09:45</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">
                      Subestação RJ Norte - Temperatura elevada detectada
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">08:22</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
