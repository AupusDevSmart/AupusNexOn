// src/pages/supervisorio/coa.tsx
import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Battery, FileText, Zap } from "lucide-react";

export function COAPage() {
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
                    <p className="text-2xl font-bold">125.4 MW</p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Carga Total
                    </p>
                    <p className="text-2xl font-bold">98.7 MW</p>
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
                    <p className="text-2xl font-bold text-yellow-600">7</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      OS Abertas
                    </p>
                    <p className="text-2xl font-bold text-blue-600">12</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </Card>
            </div>

            {/* Área do Mapa - Placeholder */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Mapa de Ativos</h3>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg h-96 flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Mapa do Brasil com localização dos ativos será implementado
                  aqui
                </p>
              </div>
            </Card>

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
                        <th className="text-right py-2">Potência</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">UFV São Paulo</td>
                        <td className="py-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Normal
                          </span>
                        </td>
                        <td className="text-right py-2">25.5 MW</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">UFV Rio de Janeiro</td>
                        <td className="py-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                            Alerta
                          </span>
                        </td>
                        <td className="text-right py-2">18.2 MW</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">UFV Minas Gerais</td>
                        <td className="py-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Normal
                          </span>
                        </td>
                        <td className="text-right py-2">32.1 MW</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">UFV Bahia</td>
                        <td className="py-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                            Crítico
                          </span>
                        </td>
                        <td className="text-right py-2">15.8 MW</td>
                      </tr>
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
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">
                      Fábrica ABC - Pico de consumo detectado
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
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">
                      Hospital Central - Transferência para gerador concluída
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">07:15</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm">
                      UFV Bahia - Falha no inversor principal
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">06:48</span>
                </div>
              </div>
            </Card>

            {/* Gráfico de Performance - Placeholder */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Performance nas Últimas 24 Horas
              </h3>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg h-64 flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Gráfico de performance será implementado aqui
                </p>
              </div>
            </Card>

            {/* Estatísticas Adicionais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Eficiência Média
                </h4>
                <p className="text-2xl font-bold text-green-600">94.2%</p>
                <p className="text-xs text-gray-500 mt-1">
                  +2.3% em relação ao mês anterior
                </p>
              </Card>

              <Card className="p-6">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Disponibilidade
                </h4>
                <p className="text-2xl font-bold text-blue-600">99.5%</p>
                <p className="text-xs text-gray-500 mt-1">
                  Dentro da meta estabelecida
                </p>
              </Card>

              <Card className="p-6">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  MTBF
                </h4>
                <p className="text-2xl font-bold text-purple-600">720h</p>
                <p className="text-xs text-gray-500 mt-1">
                  Tempo médio entre falhas
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
