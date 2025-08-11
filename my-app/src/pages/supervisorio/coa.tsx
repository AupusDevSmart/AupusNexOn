// src/pages/supervisorio/coa.tsx
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  Battery,
  Eye,
  FileText,
  MapPin,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
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

// Dados dos ativos no Brasil
const ativosNoBrasil = [
  {
    id: "sp-001",
    nome: "UFV São Paulo",
    estado: "São Paulo",
    cidade: "São Paulo",
    potencia: 25.5,
    status: "NORMAL",
    coordenadas: { x: 60, y: 65 }, // Posição relativa no SVG do Brasil
    eficiencia: 95.2,
    disponibilidade: 99.1,
    geracao: 23.8,
  },
  {
    id: "rj-001",
    nome: "UFV Rio de Janeiro",
    estado: "Rio de Janeiro",
    cidade: "Rio de Janeiro",
    potencia: 18.2,
    status: "ALERTA",
    coordenadas: { x: 65, y: 70 },
    eficiencia: 88.5,
    disponibilidade: 97.3,
    geracao: 16.1,
  },
  {
    id: "mg-001",
    nome: "UFV Minas Gerais",
    estado: "Minas Gerais",
    cidade: "Belo Horizonte",
    potencia: 32.1,
    status: "NORMAL",
    coordenadas: { x: 62, y: 62 },
    eficiencia: 96.8,
    disponibilidade: 99.7,
    geracao: 31.1,
  },
  {
    id: "ba-001",
    nome: "UFV Bahia",
    estado: "Bahia",
    cidade: "Salvador",
    potencia: 15.8,
    status: "CRITICO",
    coordenadas: { x: 58, y: 55 },
    eficiencia: 72.1,
    disponibilidade: 85.2,
    geracao: 11.4,
  },
  {
    id: "ce-001",
    nome: "UFV Ceará",
    estado: "Ceará",
    cidade: "Fortaleza",
    potencia: 22.3,
    status: "NORMAL",
    coordenadas: { x: 56, y: 45 },
    eficiencia: 94.7,
    disponibilidade: 98.9,
    geracao: 21.1,
  },
  {
    id: "go-001",
    nome: "UFV Goiás",
    estado: "Goiás",
    cidade: "Goiânia",
    potencia: 19.4,
    status: "NORMAL",
    coordenadas: { x: 55, y: 58 },
    eficiencia: 93.2,
    disponibilidade: 99.2,
    geracao: 18.1,
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
  const [ativoSelecionado, setAtivoSelecionado] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "#22c55e";
      case "ALERTA":
        return "#eab308";
      case "CRITICO":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "bg-green-100 text-green-800";
      case "ALERTA":
        return "bg-yellow-100 text-yellow-800";
      case "CRITICO":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleAtivoClick = (ativoId: string) => {
    setAtivoSelecionado(ativoSelecionado === ativoId ? null : ativoId);
  };

  const ativoInfo = ativosNoBrasil.find((a) => a.id === ativoSelecionado);

  return (
    <Layout>
      <div className="min-h-screen">
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="flex flex-col gap-6 p-6">
            <TitleCard title="Centro de Operação de Ativos (COA)" />

            {/* Cards de Indicadores */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Potência Total
                    </p>
                    <p className="text-2xl font-bold">133.3 MW</p>
                    <p className="text-xs text-green-600">+6.3% hoje</p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Geração Atual
                    </p>
                    <p className="text-2xl font-bold">121.6 MW</p>
                    <p className="text-xs text-blue-600">91.2% da capacidade</p>
                  </div>
                  <Battery className="h-8 w-8 text-green-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Alarmes Ativos
                    </p>
                    <p className="text-2xl font-bold text-yellow-600">3</p>
                    <p className="text-xs text-muted-foreground">
                      2 médios, 1 baixo
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Ativos Online
                    </p>
                    <p className="text-2xl font-bold text-blue-600">6/6</p>
                    <p className="text-xs text-green-600">100% disponível</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </Card>
            </div>

            {/* Mapa do Brasil Interativo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  Mapa de Ativos no Brasil
                  {ativoSelecionado && (
                    <Badge variant="outline" className="ml-2">
                      {ativoInfo?.nome} selecionado
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Mapa */}
                  <div className="lg:col-span-2">
                    <div className="relative bg-blue-50 rounded-lg p-4 h-96">
                      {/* SVG Simplificado do Brasil */}
                      <svg
                        viewBox="0 0 100 100"
                        className="w-full h-full"
                        style={{
                          filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.1))",
                        }}
                      >
                        {/* Contorno simplificado do Brasil */}
                        <path
                          d="M20,20 L80,20 L85,30 L88,50 L85,70 L80,85 L70,88 L50,85 L30,80 L20,70 L15,50 L18,30 Z"
                          fill="#e0f2fe"
                          stroke="#0284c7"
                          strokeWidth="1"
                        />

                        {/* Marcadores dos ativos */}
                        {ativosNoBrasil.map((ativo) => (
                          <g key={ativo.id}>
                            {/* Círculo de seleção se ativo */}
                            {ativoSelecionado === ativo.id && (
                              <circle
                                cx={ativo.coordenadas.x}
                                cy={ativo.coordenadas.y}
                                r="8"
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="2"
                                className="animate-pulse"
                              />
                            )}

                            {/* Marcador do ativo */}
                            <circle
                              cx={ativo.coordenadas.x}
                              cy={ativo.coordenadas.y}
                              r="5"
                              fill={getStatusColor(ativo.status)}
                              stroke="white"
                              strokeWidth="2"
                              className="cursor-pointer hover:r-6 transition-all duration-200"
                              onClick={() => handleAtivoClick(ativo.id)}
                            />

                            {/* Label do ativo */}
                            <text
                              x={ativo.coordenadas.x}
                              y={ativo.coordenadas.y - 8}
                              textAnchor="middle"
                              fontSize="3"
                              fill="#1f2937"
                              className="font-medium pointer-events-none"
                            >
                              {ativo.nome.split(" ")[1]}
                            </text>
                          </g>
                        ))}
                      </svg>

                      {/* Legenda */}
                      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-3 rounded-lg border shadow-sm">
                        <div className="text-xs font-medium mb-2">Status:</div>
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>
                              Normal (
                              {
                                ativosNoBrasil.filter(
                                  (a) => a.status === "NORMAL"
                                ).length
                              }
                              )
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span>
                              Alerta (
                              {
                                ativosNoBrasil.filter(
                                  (a) => a.status === "ALERTA"
                                ).length
                              }
                              )
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span>
                              Crítico (
                              {
                                ativosNoBrasil.filter(
                                  (a) => a.status === "CRITICO"
                                ).length
                              }
                              )
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Painel de informações do ativo selecionado */}
                  <div className="lg:col-span-1">
                    {ativoInfo ? (
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold">{ativoInfo.nome}</h4>
                            <Badge className={getStatusBadge(ativoInfo.status)}>
                              {ativoInfo.status}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Localização:
                              </span>
                              <span>
                                {ativoInfo.cidade}, {ativoInfo.estado}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Potência:
                              </span>
                              <span className="font-medium">
                                {ativoInfo.potencia} MW
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Geração:
                              </span>
                              <span className="font-medium text-green-600">
                                {ativoInfo.geracao} MW
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Eficiência:
                              </span>
                              <span className="font-medium">
                                {ativoInfo.eficiencia}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Disponibilidade:
                              </span>
                              <span className="font-medium">
                                {ativoInfo.disponibilidade}%
                              </span>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3"
                            onClick={() =>
                              alert(`Abrindo detalhes de ${ativoInfo.nome}`)
                            }
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-center p-4 border rounded-lg border-dashed">
                        <div>
                          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Clique em um ativo no mapa para ver suas informações
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráficos de Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Performance 24h */}
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

              {/* Gráfico de Performance por Região */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    Performance por Região
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={performancePorRegiao}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="opacity-30"
                      />
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
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="geracao"
                        fill="#3b82f6"
                        name="Geração Atual"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="meta"
                        fill="#e5e7eb"
                        name="Meta"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Tabelas de Monitoramento */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Usinas Fotovoltaicas
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Nome</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-right py-2">Geração</th>
                        <th className="text-right py-2">Eficiência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ativosNoBrasil.map((ativo) => (
                        <tr
                          key={ativo.id}
                          className="border-b hover:bg-muted/50 cursor-pointer"
                        >
                          <td className="py-2">{ativo.nome}</td>
                          <td className="py-2">
                            <Badge
                              variant="outline"
                              className={getStatusBadge(ativo.status)}
                            >
                              {ativo.status}
                            </Badge>
                          </td>
                          <td className="text-right py-2">
                            {ativo.geracao} MW
                          </td>
                          <td className="text-right py-2">
                            {ativo.eficiencia}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Cargas Monitoradas
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Nome</th>
                        <th className="text-left py-2">Tipo</th>
                        <th className="text-right py-2">Consumo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">Fábrica ABC</td>
                        <td className="py-2">Industrial</td>
                        <td className="text-right py-2">12.3 MW</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Shopping XYZ</td>
                        <td className="py-2">Comercial</td>
                        <td className="text-right py-2">8.7 MW</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Hospital Central</td>
                        <td className="py-2">Hospitalar</td>
                        <td className="text-right py-2">5.2 MW</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Data Center Alpha</td>
                        <td className="py-2">Tecnologia</td>
                        <td className="text-right py-2">9.5 MW</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Eventos Recentes */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Eventos Recentes</h3>
              <div className="space-y-2">
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
                      UFV Rio de Janeiro - Alerta de temperatura elevada
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">08:22</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm">
                      UFV Bahia - Falha no inversor principal - Técnico a
                      caminho
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">06:48</span>
                </div>
              </div>
            </Card>

            {/* Estatísticas Adicionais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Eficiência Média
                </h4>
                <p className="text-2xl font-bold text-green-600">
                  {(
                    ativosNoBrasil.reduce((acc, a) => acc + a.eficiencia, 0) /
                    ativosNoBrasil.length
                  ).toFixed(1)}
                  %
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  +2.3% em relação ao mês anterior
                </p>
              </Card>

              <Card className="p-6">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Disponibilidade Média
                </h4>
                <p className="text-2xl font-bold text-blue-600">
                  {(
                    ativosNoBrasil.reduce(
                      (acc, a) => acc + a.disponibilidade,
                      0
                    ) / ativosNoBrasil.length
                  ).toFixed(1)}
                  %
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Dentro da meta estabelecida
                </p>
              </Card>

              <Card className="p-6">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Total Geração Hoje
                </h4>
                <p className="text-2xl font-bold text-purple-600">
                  {ativosNoBrasil
                    .reduce((acc, a) => acc + a.geracao, 0)
                    .toFixed(1)}{" "}
                  MW
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(
                    (ativosNoBrasil.reduce((acc, a) => acc + a.geracao, 0) /
                      ativosNoBrasil.reduce((acc, a) => acc + a.potencia, 0)) *
                    100
                  ).toFixed(1)}
                  % da capacidade total
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
