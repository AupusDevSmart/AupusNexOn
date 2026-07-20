import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PainelFv } from '@/features/coa/components/painel-fv';
import { ControleSyncFvPage } from './ControleSyncFvPage';
import { GeracaoFvPage } from './GeracaoFvPage';
import { EnvioFvPage } from './EnvioFvPage';

/**
 * Monitoramento FV — tela do BDO no NexON: Painel + Controle de sync + Curadoria, em abas
 * DENTRO do próprio quadro (título + abas na mesma linha, sem gastar uma linha só pras abas).
 * Acesso gateado pela ROTA (RequirePermission="Monitoramento") + BACKEND (assertEditor).
 */
export function MonitoramentoFvPage() {
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <Tabs defaultValue="painel">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h1 className="text-base font-semibold">Monitoramento FV</h1>
              <TabsList>
                <TabsTrigger value="painel">Painel</TabsTrigger>
                <TabsTrigger value="controle">Controle de sync</TabsTrigger>
                <TabsTrigger value="curadoria">Ajuste de dados</TabsTrigger>
                <TabsTrigger value="envio">Envio</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="painel"><PainelFv /></TabsContent>
            <TabsContent value="controle"><ControleSyncFvPage /></TabsContent>
            <TabsContent value="curadoria"><GeracaoFvPage /></TabsContent>
            <TabsContent value="envio"><EnvioFvPage /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default MonitoramentoFvPage;
