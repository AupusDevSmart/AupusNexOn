import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PainelFv } from '@/features/coa/components/painel-fv';
import { ControleSyncFvPage } from './ControleSyncFvPage';
import { GeracaoFvPage } from './GeracaoFvPage';
import { EnvioFvPage } from './EnvioFvPage';
import { useFiltrosNaUrl } from '@/hooks/useEstadoLembrado';

/**
 * Monitoramento FV — tela do BDO no NexON: Painel + Controle de sync + Curadoria, em abas
 * no cabeçalho padrão da tela (título à esquerda, abas à direita, sem gastar uma linha só pras abas).
 * Acesso gateado pela ROTA (RequirePermission="Monitoramento") + BACKEND (assertEditor).
 */
export function MonitoramentoFvPage() {
  // Aba aberta na URL (?aba=) e lembrada para a próxima visita.
  const [tela, setTela] = useFiltrosNaUrl('monitoramento-fv', { aba: 'painel' });
  return (
    <Layout>
      <Layout.Main>
        <Tabs className="w-full" value={tela.aba} onValueChange={(aba) => setTela({ aba })}>
          <TitleCard
            title="Monitoramento FV"
            actions={
              <TabsList>
                <TabsTrigger value="painel">Painel</TabsTrigger>
                <TabsTrigger value="controle">Controle de sync</TabsTrigger>
                <TabsTrigger value="curadoria">Ajuste de dados</TabsTrigger>
                <TabsTrigger value="envio">Envio</TabsTrigger>
              </TabsList>
            }
          />
          <TabsContent value="painel"><PainelFv /></TabsContent>
          <TabsContent value="controle"><ControleSyncFvPage /></TabsContent>
          <TabsContent value="curadoria"><GeracaoFvPage /></TabsContent>
          <TabsContent value="envio"><EnvioFvPage /></TabsContent>
        </Tabs>
      </Layout.Main>
    </Layout>
  );
}

export default MonitoramentoFvPage;
