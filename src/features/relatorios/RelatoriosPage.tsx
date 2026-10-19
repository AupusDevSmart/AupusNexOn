import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BoletimSemanalFvPage } from '@/features/monitoramento-fv/BoletimSemanalFvPage';
import { ConsumoReportPreview } from './consumo/ConsumoReportPreview';
import { ConsumoEnvioConfig } from './consumo/ConsumoEnvioConfig';
import { AbastecimentoReport } from './AbastecimentoReport';
import { useFiltrosNaUrl } from '@/hooks/useEstadoLembrado';

/**
 * Área de Relatórios (top-level): Geração (usinas) e Consumo (unidades medidas).
 * Geração reusa a página de boletim semanal; Consumo renderiza o componente React
 * de gestão de energia.
 */
export function RelatoriosPage() {
  // Aba aberta na URL (?aba=) e lembrada para a próxima visita.
  const [tela, setTela] = useFiltrosNaUrl('relatorios', { aba: 'geracao' });
  return (
    <Layout>
      <Layout.Main>
        <Tabs className="w-full" value={tela.aba} onValueChange={(aba) => setTela({ aba })}>
          <TitleCard
            title="Relatórios"
            actions={
              <TabsList>
                <TabsTrigger value="geracao">Geração</TabsTrigger>
                <TabsTrigger value="consumo">Consumo</TabsTrigger>
                <TabsTrigger value="abastecimento">Abastecimento</TabsTrigger>
              </TabsList>
            }
          />
          <TabsContent value="geracao"><BoletimSemanalFvPage /></TabsContent>
          <TabsContent value="consumo">
            <div className="space-y-4">
              <ConsumoReportPreview />
              <ConsumoEnvioConfig />
            </div>
          </TabsContent>
          <TabsContent value="abastecimento"><AbastecimentoReport /></TabsContent>
        </Tabs>
      </Layout.Main>
    </Layout>
  );
}

export default RelatoriosPage;
