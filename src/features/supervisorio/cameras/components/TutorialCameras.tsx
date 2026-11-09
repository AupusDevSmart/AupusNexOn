import { Cctv, Check, Copy, Cpu, KeyRound, Plus, Settings, Video, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgentesCameras } from '../hooks/useConfigCameras';
import { COMANDOS_AGENTE, agenteEmContato, textoEnvAgente } from '../utils/agentes';
import type { AbaConfigCameras } from './ConfigCamerasSheet';

interface Props {
  unidadeId: string;
  unidadeNome?: string;
  podeCadastrar: boolean;
  podeConfigurar: boolean;
  onAbrirConfig: (aba: AbaConfigCameras) => void;
}

/**
 * Estado vazio da aba Câmeras (NEXON-88): em vez de "nenhuma câmera", o passo a passo
 * para ligar a primeira — com os atalhos de cadastro e o estado real do agente.
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
          A instalação é feita pela equipe da Aupus: câmera na rede {nome}, um pequeno computador com o agente NexON e o
          cadastro aqui. Quando estiver pronta, o vídeo e os alertas aparecem nesta aba.
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
            Ainda não há câmera cadastrada. São cinco passos: os cadastros você faz aqui; o agente roda num computador na
            rede da usina. A câmera nunca fica exposta na internet.
          </p>
        </div>
      </header>

      <ol className="flex flex-col divide-y divide-border">
        <Passo numero={1} icone={Video} titulo="Prepare a câmera">
          <p className="text-xs text-muted-foreground">
            IP fixo na rede da usina, senha do usuário <code className="font-mono">admin</code> trocada, RTSP ligado (porta
            554) e o stream extra em H.264. Modelo homologado: Intelbras VIPC 1230 B G2.
          </p>
        </Passo>

        <Passo numero={2} icone={KeyRound} titulo="Crie o agente e copie o token" feito={temAgente}>
          <p className="text-xs text-muted-foreground">
            Agentes › Novo, com um nome (ex.: "Mini-PC cabine"). O token aparece uma vez só: guarde para o passo 3.
          </p>
          {temAgente ? (
            <p className="text-xs">
              {lista.length === 1 ? '1 agente criado' : `${lista.length} agentes criados`}: {lista.map((a) => a.nome).join(', ')}
            </p>
          ) : (
            podeCadastrar && (
              <div>
                <Button type="button" size="sm" onClick={() => onAbrirConfig('agentes')}>
                  <Plus aria-hidden />
                  Criar agente
                </Button>
              </div>
            )
          )}
        </Passo>

        <Passo numero={3} icone={Cpu} titulo="Instale o agente num computador da usina" feito={!!agenteVivo}>
          <p className="text-xs text-muted-foreground">
            Mini-PC, Raspberry Pi 4/5 (4 GB) ou notebook com Docker, ligado na mesma rede da câmera e com saída para a
            internet (HTTPS e porta 8322). Copie a pasta <code className="font-mono">nexon-camera-agent</code> do repositório
            NexON para ele, crie o arquivo <code className="font-mono">.env</code> com o token e suba:
          </p>
          <BlocoCopiavel rotulo="Arquivo .env" texto={textoEnvAgente()} />
          <BlocoCopiavel rotulo="Comandos" texto={COMANDOS_AGENTE} />
          <p className="text-xs text-muted-foreground">
            <code className="font-mono">NEXON_ANALISE=yolo</code> reconhece pessoa, veículo e animal (imagem de ~2 GB);{' '}
            <code className="font-mono">movimento</code> é mais leve e só detecta movimento.
          </p>
          {agenteVivo ? (
            <p className="text-xs">Agente conectado: {agenteVivo.nome}.</p>
          ) : temAgente ? (
            <p className="text-xs">Aguardando o agente se conectar: ele aparece com a bolinha verde em Agentes assim que ligar.</p>
          ) : null}
        </Passo>

        <Passo numero={4} icone={Plus} titulo="Cadastre a câmera">
          <p className="text-xs text-muted-foreground">
            Câmeras › Nova: nome, IP, usuário e senha da câmera, portas 554/80, canal 1 e o agente do passo 2. Em até um
            minuto aparece a miniatura; Ao vivo abre o vídeo (3 a 6 s de atraso).
          </p>
          {podeCadastrar && (
            <div>
              <Button type="button" size="sm" variant={temAgente ? 'default' : 'outline'} onClick={() => onAbrirConfig('cameras')}>
                <Plus aria-hidden />
                Cadastrar câmera
              </Button>
            </div>
          )}
        </Passo>

        <Passo numero={5} icone={Settings} titulo="Ajuste a proteção">
          <p className="text-xs text-muted-foreground">
            Armamento (agenda 18:00 → 06:30 ou manual), refletor e sirene pelo ponto de comando do TON/relé, abertura
            automática de chamado e e-mails de aviso.
          </p>
          {podeConfigurar && (
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => onAbrirConfig('unidade')}>
                <Settings aria-hidden />
                Configurar unidade
              </Button>
            </div>
          )}
        </Passo>
      </ol>

      <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
        Guia completo, com os problemas comuns: <code className="font-mono">NexON/docs/cameras/INSTALACAO.md</code> no
        repositório.
      </footer>
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

function BlocoCopiavel({ rotulo, texto }: { rotulo: string; texto: string }) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${rotulo} copiado`);
    } catch {
      toast.error('Não foi possível copiar: selecione o texto e copie manualmente.');
    }
  };
  return (
    <div className="relative min-w-0">
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 pr-12 font-mono text-xs leading-relaxed">
        <code>{texto}</code>
      </pre>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-2 top-2 h-7 px-2"
        onClick={copiar}
        aria-label={`Copiar ${rotulo.toLowerCase()}`}
      >
        <Copy aria-hidden />
      </Button>
    </div>
  );
}
