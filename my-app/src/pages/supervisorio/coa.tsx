// src/pages/supervisorio/coa.tsx
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Card } from "@/components/ui/card";
import { useSidebar } from "@/components/ui/sidebar";
import {
  AlertTriangle,
  Battery,
  Clock,
  FileText,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";

export function COAPage() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Layout>
      <div
        className={`min-h-screen transition-all duration-300 ${
          isCollapsed ? "w-full" : ""
        }`}
      >
        <div className="h-[calc(100vh-4rem)] overflow-y-auto">
          <div
            className={`flex flex-col gap-6 transition-all duration-300 ${
              isCollapsed ? "px-4 md:px-6 lg:px-8" : "px-6"
            }`}
          >
            <TitleCard title="Centro de Operação de Ativos (COA)" />

            {/* Cards de Indicadores - Todos no topo, menores */}
            <div
              className={`grid gap-3 transition-all duration-300 ${
                isCollapsed
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7"
              }`}
            >
              {/* Potência Total */}
              <Card className="p-3 sm:p-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Potência Total
                  </p>
                  <p className="text-base sm:text-lg font-bold">125.4 MW</p>
                </div>
              </Card>

              {/* Carga Total */}
              <Card className="p-3 sm:p-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <Battery className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Carga Total
                  </p>
                  <p className="text-base sm:text-lg font-bold">98.7 MW</p>
                </div>
              </Card>

              {/* Alarmes Ativos */}
              <Card className="p-3 sm:p-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Alarmes
                  </p>
                  <p className="text-base sm:text-lg font-bold text-yellow-600">
                    7
                  </p>
                </div>
              </Card>

              {/* OS Abertas */}
              <Card className="p-3 sm:p-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    OS Abertas
                  </p>
                  <p className="text-base sm:text-lg font-bold text-blue-600">
                    12
                  </p>
                </div>
              </Card>

              {/* Eficiência Média */}
              <Card className="p-3 sm:p-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Eficiência
                  </p>
                  <p className="text-base sm:text-lg font-bold text-green-600">
                    94.2%
                  </p>
                  <p className="text-xs text-gray-500">+2.3%</p>
                </div>
              </Card>

              {/* Disponibilidade */}
              <Card className="p-3 sm:p-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Disponibilidade
                  </p>
                  <p className="text-base sm:text-lg font-bold text-blue-600">
                    99.5%
                  </p>
                  <p className="text-xs text-gray-500">Meta OK</p>
                </div>
              </Card>

              {/* MTBF */}
              <Card className="p-3 sm:p-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <Timer className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    MTBF
                  </p>
                  <p className="text-base sm:text-lg font-bold text-purple-600">
                    720h
                  </p>
                  <p className="text-xs text-gray-500">Média</p>
                </div>
              </Card>
            </div>

            {/* Mapa e Tabelas lado a lado */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Mapa - Tamanho fixo */}
              <div className="w-full lg:w-80 flex-shrink-0">
                <Card className="p-4 sm:p-6 h-full">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">
                    Mapa de Ativos
                  </h3>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg aspect-square flex items-center justify-center">
                    <p className="text-gray-500 dark:text-gray-400 text-center text-sm px-4">
                      Mapa do Brasil com localização dos ativos
                    </p>
                  </div>
                </Card>
              </div>

              {/* Tabelas - Ocupam o espaço restante */}
              <div className="flex-1 space-y-6">
                {/* Usinas Fotovoltaicas */}
                <Card className="p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">
                    Usinas Fotovoltaicas
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Nome</th>
                          <th className="text-left py-2 px-2">Status</th>
                          <th className="text-right py-2 px-2">Potência</th>
                          {isCollapsed && (
                            <>
                              <th className="text-center py-2 px-2 hidden lg:table-cell">
                                Eficiência
                              </th>
                              <th className="text-center py-2 px-2 hidden xl:table-cell">
                                Última Manutenção
                              </th>
                              <th className="text-center py-2 px-2 hidden 2xl:table-cell">
                                Disponibilidade
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2">UFV São Paulo</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              Normal
                            </span>
                          </td>
                          <td className="text-right py-2 px-2">25.5 MW</td>
                          {isCollapsed && (
                            <>
                              <td className="text-center py-2 px-2 hidden lg:table-cell">
                                95.2%
                              </td>
                              <td className="text-center py-2 px-2 hidden xl:table-cell">
                                15/12/2024
                              </td>
                              <td className="text-center py-2 px-2 hidden 2xl:table-cell">
                                99.8%
                              </td>
                            </>
                          )}
                        </tr>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2">UFV Rio de Janeiro</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                              Alerta
                            </span>
                          </td>
                          <td className="text-right py-2 px-2">18.2 MW</td>
                          {isCollapsed && (
                            <>
                              <td className="text-center py-2 px-2 hidden lg:table-cell">
                                92.8%
                              </td>
                              <td className="text-center py-2 px-2 hidden xl:table-cell">
                                10/12/2024
                              </td>
                              <td className="text-center py-2 px-2 hidden 2xl:table-cell">
                                98.5%
                              </td>
                            </>
                          )}
                        </tr>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2">UFV Minas Gerais</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              Normal
                            </span>
                          </td>
                          <td className="text-right py-2 px-2">32.1 MW</td>
                          {isCollapsed && (
                            <>
                              <td className="text-center py-2 px-2 hidden lg:table-cell">
                                96.1%
                              </td>
                              <td className="text-center py-2 px-2 hidden xl:table-cell">
                                20/12/2024
                              </td>
                              <td className="text-center py-2 px-2 hidden 2xl:table-cell">
                                99.9%
                              </td>
                            </>
                          )}
                        </tr>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2">UFV Bahia</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                              Crítico
                            </span>
                          </td>
                          <td className="text-right py-2 px-2">15.8 MW</td>
                          {isCollapsed && (
                            <>
                              <td className="text-center py-2 px-2 hidden lg:table-cell">
                                87.3%
                              </td>
                              <td className="text-center py-2 px-2 hidden xl:table-cell">
                                05/12/2024
                              </td>
                              <td className="text-center py-2 px-2 hidden 2xl:table-cell">
                                95.2%
                              </td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Cargas Monitoradas */}
                <Card className="p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">
                    Cargas Monitoradas
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Nome</th>
                          <th className="text-left py-2 px-2">Tipo</th>
                          <th className="text-right py-2 px-2">Consumo</th>
                          {isCollapsed && (
                            <>
                              <th className="text-center py-2 px-2 hidden lg:table-cell">
                                Fator Potência
                              </th>
                              <th className="text-center py-2 px-2 hidden xl:table-cell">
                                Demanda Contratada
                              </th>
                              <th className="text-center py-2 px-2 hidden 2xl:table-cell">
                                % Utilização
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2">Fábrica ABC</td>
                          <td className="py-2 px-2">Industrial</td>
                          <td className="text-right py-2 px-2">12.3 MW</td>
                          {isCollapsed && (
                            <>
                              <td className="text-center py-2 px-2 hidden lg:table-cell">
                                0.92
                              </td>
                              <td className="text-center py-2 px-2 hidden xl:table-cell">
                                15.0 MW
                              </td>
                              <td className="text-center py-2 px-2 hidden 2xl:table-cell">
                                82%
                              </td>
                            </>
                          )}
                        </tr>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2">Shopping XYZ</td>
                          <td className="py-2 px-2">Comercial</td>
                          <td className="text-right py-2 px-2">8.7 MW</td>
                          {isCollapsed && (
                            <>
                              <td className="text-center py-2 px-2 hidden lg:table-cell">
                                0.95
                              </td>
                              <td className="text-center py-2 px-2 hidden xl:table-cell">
                                10.0 MW
                              </td>
                              <td className="text-center py-2 px-2 hidden 2xl:table-cell">
                                87%
                              </td>
                            </>
                          )}
                        </tr>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2">Hospital Central</td>
                          <td className="py-2 px-2">Hospitalar</td>
                          <td className="text-right py-2 px-2">5.2 MW</td>
                          {isCollapsed && (
                            <>
                              <td className="text-center py-2 px-2 hidden lg:table-cell">
                                0.93
                              </td>
                              <td className="text-center py-2 px-2 hidden xl:table-cell">
                                6.0 MW
                              </td>
                              <td className="text-center py-2 px-2 hidden 2xl:table-cell">
                                87%
                              </td>
                            </>
                          )}
                        </tr>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2">Data Center Alpha</td>
                          <td className="py-2 px-2">Tecnologia</td>
                          <td className="text-right py-2 px-2">9.5 MW</td>
                          {isCollapsed && (
                            <>
                              <td className="text-center py-2 px-2 hidden lg:table-cell">
                                0.98
                              </td>
                              <td className="text-center py-2 px-2 hidden xl:table-cell">
                                10.0 MW
                              </td>
                              <td className="text-center py-2 px-2 hidden 2xl:table-cell">
                                95%
                              </td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>

            {/* Gráfico de Performance - Placeholder */}
            <Card className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-4">
                Performance nas Últimas 24 Horas
              </h3>
              <div
                className={`bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  isCollapsed ? "h-96" : "h-64"
                }`}
              >
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Gráfico de performance será implementado aqui
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
