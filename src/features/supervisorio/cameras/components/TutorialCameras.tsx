import { Cable, Cctv, Check, Clock, Cpu, Plus, Settings, Video, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgentesCameras } from '../hooks/useConfigCameras';
import { agenteEmContato } from '../utils/agentes';
import type { AbaConfigCameras } from './ConfigCamerasSheet';

interface Props {
  unidadeId: string;
  unidadeNome?: string;
  podeCadastrar: boolean;
  podeConfigurar: boolean;
  onAbrirConfig: (aba: AbaConfigCameras) => void;
}

/**
 * Estado vazio da aba Câmeras (NEXON-88, simplificado no NEXON-108): o passo a passo para
 * ligar a primeira câmera — aparelho pareado por código, câmera achada na rede, só movimento.
 * Quem não cadastra (proprietário) vê só a explicação.
 */
export function TutorialCameras({ unidadeId, unidadeNome, podeCadastrar, podeConfigurar, onAbrirConfig }: Props) {
  const agentes = useAgentesCameras(unidadeId, podeCadastrar);
  const lista = agentes.data ?? [];
  const temAgente = lista.length > 0;
  const agenteVivo = lista.find(agenteEmContato);
  const nome = unidadeNome ? `de ${unidadeNome}` : 'da usina';

  if (!podeCadastrar && !podeConfigurar) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
        <Cctv className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Nenhuma câmera nesta usina</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          A instalação é feita pela equipe da Aupus: câmera e um pequeno aparelho do NexON na rede {nome}, e o cadastro
          aqui. Quando estiver pronta, o vídeo e os alertas aparecem nesta aba.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="tutorial-cameras-titulo" className="flex flex-1 flex-col rounded-xl border border-border bg-card">
      <header className="flex items-start gap-3 border-b border-border p-4 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Cctv className="h-5 w-5 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="tutorial-cameras-titulo" className="text-base font-semibold">
            Ligue as câmeras {nome}
          </h2>
          <p className="text-xs text-muted-foreground">
            Cinco passos, sem copiar token nem digitar IP. A câmera nunca fica exposta na internet.
          </p>
        </div>
      </header>

      <ol className="flex flex-col divide-y divide-border">
        <Passo numero={1} icone={Cable} titulo="Ligue a câmera e o aparelho no switch PoE">
          <p className="text-xs text-muted-foreground">
            Os dois no mesmo switch, por cabo de rede. O switch PoE já dá energia para a câmera.
          </p>
        </Passo>

        <Passo numero={2} icone={Cpu} titulo="Grave o cartão do aparelho e ligue na tomada">
          <p className="text-xs text-muted-foreground">
            Grave o cartão do Raspberry com a imagem do NexON, coloque no aparelho e ligue. Em uns 2 minutos ele mostra um
            código de 6 dígitos.
          </p>
        </Passo>

        <Passo numero={3} icone={Plus} titulo="Adicione o aparelho" feito={!!agenteVivo}>
          <p className="text-xs text-muted-foreground">
            Aparelhos › Adicionar aparelho. Na mesma rede, o código aparece sozinho; senão, digite o que está em
            http://ip-do-aparelho:8080.
          </p>
          {agenteVivo ? (
            <p className="text-xs">Aparelho online: {agenteVivo.nome}.</p>
          ) : temAgente ? (
            <p className="text-xs">
              {lista.length === 1 ? 'Aparelho vinculado' : `${lista.length} aparelhos vinculados`}, aguardando ficar online.
            </p>
          ) : (
            podeCadastrar && (
              <div>
                <Button type="button" size="sm" onClick={() => onAbrirConfig('agentes')}>
                  <Plus aria-hidden />
                  Adicionar aparelho
                </Button>
              </div>
            )
          )}
        </Passo>

        <Passo numero={4} icone={Video} titulo="Adicione as câmeras encontradas">
          <p className="text-xs text-muted-foreground">
            Câmeras › Câmeras encontradas › Adicionar, com a senha da câmera. Câmera nova de fábrica: crie a senha antes
            na página dela.
          </p>
          {podeCadastrar && (
            <div>
              <Button type="button" size="sm" variant={agenteVivo ? 'default' : 'outline'} onClick={() => onAbrirConfig('cameras')}>
                <Video aria-hidden />
                Ver câmeras encontradas
              </Button>
            </div>
          )}
        </Passo>

        <Passo numero={5} icone={Clock} titulo="Arme por horário">
          <p className="text-xs text-muted-foreground">
            Armamento e avisos: agenda (ex.: 18:00 → 06:30). Com a usina armada, movimento na câmera vira alerta.
          </p>
          {podeConfigurar && (
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => onAbrirConfig('unidade')}>
                <Settings aria-hidden />
                Configurar armamento
              </Button>
            </div>
          )}
        </Passo>
      </ol>
    </section>
  );
}

function Passo({
  numero,
  icone: Icone,
  titulo,
  feito = false,
  children,
}: {
  numero: number;
  icone: LucideIcon;
  titulo: string;
  feito?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 p-4 sm:gap-4 sm:p-5">
      <span
        aria-hidden
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          feito ? 'bg-nexon-verde text-white' : 'bg-muted text-foreground',
        )}
      >
        {feito ? <Check className="h-4 w-4" /> : numero}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {titulo}
            {feito && <span className="sr-only"> (feito)</span>}
          </span>
        </p>
        {children}
      </div>
    </li>
  );
}
