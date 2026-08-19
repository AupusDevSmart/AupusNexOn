import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BoletimSemanalFvPage } from '@/features/monitoramento-fv/BoletimSemanalFvPage';
import { ConsumoReportPreview } from './consumo/ConsumoReportPreview';
import { ConsumoEnvioConfig } from './consumo/ConsumoEnvioConfig';
import { AbastecimentoReport } from './AbastecimentoReport';

/**
 * Área de Relatórios (top-level): Geração (usinas) e Consumo (unidades medidas).
 * Geração reusa a página de boletim semanal; Consumo renderiza o componente React
 * de gestão de energia.
 */
export function RelatoriosPage() {
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <Tabs defaultValue="geracao">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h1 className="text-base font-semibold">Relatórios</h1>
              <TabsList>
                <TabsTrigger value="geracao">Geração</TabsTrigger>
                <TabsTrigger value="consumo">Consumo</TabsTrigger>
                <TabsTrigger value="abastecimento">Abastecimento</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="geracao"><BoletimSemanalFvPage /></TabsContent>
            <TabsContent value="consumo">
              <div className="space-y-4">
                <ConsumoReportPreview />
                <ConsumoEnvioConfig />
              </div>
            </TabsContent>
            <TabsContent value="abastecimento"><AbastecimentoReport /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default RelatoriosPage;
