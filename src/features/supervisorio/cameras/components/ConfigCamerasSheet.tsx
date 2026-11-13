import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MSG_SOMENTE_LEITURA } from '@/store/papeis';
import { useUserStore } from '@/store/useUserStore';
import { SecaoAgentes } from './config/SecaoAgentes';
import { SecaoCameras } from './config/SecaoCameras';
import { SecaoUnidade } from './config/SecaoUnidade';

export type AbaConfigCameras = 'cameras' | 'agentes' | 'unidade';

interface ConfigCamerasSheetProps {
  unidadeId: string;
  unidadeNome?: string;
  aberto: boolean;
  onFechar: () => void;
  abaInicial?: AbaConfigCameras;
}

/**
 * Painel lateral de configuração das câmeras da unidade: câmeras e aparelhos (agentes)
 * (`cadastroTecnico`), armamento/comandos/avisos (`configOperacional`).
 */
export function ConfigCamerasSheet({ unidadeId, unidadeNome, aberto, onFechar, abaInicial }: ConfigCamerasSheetProps) {
  const capacidades = useUserStore((s) => s.capacidades);
  const podeCadastrar = capacidades.cadastroTecnico;
  const podeConfigurar = capacidades.configOperacional;

  const abas: { valor: AbaConfigCameras; rotulo: string }[] = [
    ...(podeCadastrar ? [{ valor: 'cameras' as const, rotulo: 'Câmeras' }, { valor: 'agentes' as const, rotulo: 'Aparelhos' }] : []),
    ...(podeConfigurar ? [{ valor: 'unidade' as const, rotulo: 'Armamento e avisos' }] : []),
  ];
  const primeira = abas[0]?.valor ?? 'unidade';
  const [aba, setAba] = useState<AbaConfigCameras>(abaInicial ?? primeira);

  // Ao abrir, começa na aba pedida (ou na primeira permitida).
  useEffect(() => {
    if (aberto) setAba(abaInicial && abas.some((a) => a.valor === abaInicial) ? abaInicial : primeira);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, abaInicial]);

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base">Configurar câmeras</SheetTitle>
          <SheetDescription className="text-xs">
            {abas.length === 0 ? MSG_SOMENTE_LEITURA : 'Câmeras e aparelhos da usina, armamento, refletor, sirene e avisos.'}
          </SheetDescription>
        </SheetHeader>
        {abas.length > 0 && (
          <Tabs value={aba} onValueChange={(v) => setAba(v as AbaConfigCameras)} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 grid h-9 w-auto touch:h-10" style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }}>
              {abas.map((a) => (
                <TabsTrigger key={a.valor} value={a.valor} className="truncate text-xs sm:text-sm">
                  {a.rotulo}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
              {podeCadastrar && (
                <TabsContent value="cameras" className="mt-0">
                  <SecaoCameras unidadeId={unidadeId} />
                </TabsContent>
              )}
              {podeCadastrar && (
                <TabsContent value="agentes" className="mt-0">
                  <SecaoAgentes unidadeId={unidadeId} unidadeNome={unidadeNome} />
                </TabsContent>
              )}
              {podeConfigurar && (
                <TabsContent value="unidade" className="mt-0">
                  <SecaoUnidade unidadeId={unidadeId} />
                </TabsContent>
              )}
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
