import { Cctv, Check, Clock, Cpu, Link2, Loader2, Plus, Video, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgentesCameras } from '../hooks/useConfigCameras';
import { agenteEmContato } from '../utils/agentes';
import { etapaGuardada } from '../utils/assistente-raspberry';
import type { AbaConfigCameras } from './ConfigCamerasSheet';
import { AssistenteRaspberry } from './config/AssistenteRaspberry';
import { VERDE_TEXTO } from './estilo-filtro';

interface Props {
  unidadeId: string;
  unidadeNome?: string;
  podeCadastrar: boolean;
  podeConfigurar: boolean;
  onAbrirConfig: (aba: AbaConfigCameras) => void;
}

type Estado = 'feito' | 'atual' | 'depois';

/**
 * Estado vazio da aba Câmeras (NEXON-88; dinâmico no NEXON-108): três passos que acompanham o que já
 * aconteceu (Raspberry → câmeras → armar). Só o passo atual abre, com um botão; o Raspberry novo é
 * instalado pelo assistente (computador, pendrive ou cartão). Quem não cadastra vê só a explicação.
 */
export function TutorialCameras({ unidadeId, unidadeNome, podeCadastrar, podeConfigurar, onAbrirConfig }: Props) {
  const [instalando, setInstalando] = useState(false);
  const agentes = useAgentesCameras(unidadeId, podeCadastrar || podeConfigurar, 10_000);
  const lista = agentes.data ?? [];
  const vivo = lista.find((a) => agenteEmContato(a));
  const esperando = !vivo ? lista[0] : undefined;
  const nome = unidadeNome ? `de ${unidadeNome}` : 'da usina';

  if (!podeCadastrar && !podeConfigurar) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
        <Cctv className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Nenhuma câmera nesta usina</p>
        <p className="max-w-sm text-xs text-muted-foreground">A equipe da Aupus instala. Quando ficar pronto, o vídeo aparece aqui.</p>
      </div>
    );
  }

  const passo = vivo ? 2 : 1;
  const estado = (n: number): Estado => (n < passo ? 'feito' : n === passo ? 'atual' : 'depois');
  const continuar = !instalando && (etapaGuardada(unidadeId) ?? 1) > 1;

  return (
    <section aria-labelledby="tutorial-cameras-titulo" className="mx-auto flex w-full max-w-2xl flex-col rounded-xl border border-border bg-card">
      {instalando && (
        <AssistenteRaspberry
          key={unidadeId}
          unidadeId={unidadeId}
          unidadeNome={unidadeNome}
          onFechar={() => setInstalando(false)}
          onVincular={() => {
            setInstalando(false);
            onAbrirConfig('agentes');
          }}
        />
      )}

      <header className="flex flex-col gap-3 border-b border-border p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="tutorial-cameras-titulo" className="text-lg font-semibold">
            Ligue as câmeras {nome}
          </h2>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">Passo {passo} de 3</span>
        </div>
        <div aria-hidden className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((n) => (
            <span key={n} className={cn('h-1.5 rounded-full', n <= passo ? 'bg-nexon-verde' : 'bg-muted')} />
          ))}
        </div>
      </header>

      <ol className="flex flex-col divide-y divide-border">
        <Passo
          numero={1}
          icone={Cpu}
          titulo="Raspberry"
          estado={estado(1)}
          resumo={vivo ? `${vivo.nome} online` : undefined}
        >
          {esperando ? (
            <>
              <p className="flex items-center gap-2 text-base">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                Esperando <strong>{esperando.nome}</strong> ligar…
              </p>
              {podeCadastrar && (
                <Button type="button" variant="outline" className="h-11 self-start" onClick={() => setInstalando(true)}>
                  {continuar ? 'Continuar instalação' : 'Ver passo a passo'}
                </Button>
              )}
            </>
          ) : !podeCadastrar ? (
            <p className="text-sm text-muted-foreground">A equipe técnica instala o Raspberry.</p>
          ) : (
            <>
              <Button type="button" className="h-12 self-start px-6 text-base" onClick={() => setInstalando(true)}>
                <Plus aria-hidden />
                {continuar ? 'Continuar Raspberry novo' : 'Instalar Raspberry'}
              </Button>
              <p className="text-sm text-muted-foreground">Pelo computador, pendrive ou cartão SD.</p>
              <button
                type="button"
                className="flex min-h-11 items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 mouse:hover:underline"
                onClick={() => onAbrirConfig('agentes')}
              >
                <Link2 className="h-4 w-4" aria-hidden />
                Já está ligado? Vincular
              </button>
            </>
          )}
        </Passo>

        <Passo numero={2} icone={Video} titulo="Câmeras" estado={estado(2)}>
          <p className="flex items-center gap-2 text-base">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            Procurando câmeras na rede…
          </p>
          <p className="text-sm text-muted-foreground">Câmera de fábrica entra sozinha. Com senha, pede a senha.</p>
          {podeCadastrar && (
            <Button type="button" className="h-12 self-start px-6 text-base" onClick={() => onAbrirConfig('cameras')}>
              <Video aria-hidden />
              Ver câmeras encontradas
            </Button>
          )}
        </Passo>

        <Passo numero={3} icone={Clock} titulo="Armar por horário" estado={estado(3)}>
          {podeConfigurar && (
            <Button type="button" className="h-12 self-start px-6 text-base" onClick={() => onAbrirConfig('unidade')}>
              Configurar
            </Button>
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
  estado,
  resumo,
  children,
}: {
  numero: number;
  icone: LucideIcon;
  titulo: string;
  estado: Estado;
  resumo?: string;
  children: ReactNode;
}) {
  const atual = estado === 'atual';
  return (
    <li aria-current={atual ? 'step' : undefined} className={cn('flex gap-3 p-4 sm:gap-4 sm:p-5', estado === 'depois' && 'opacity-50')}>
      <span
        aria-hidden
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          estado === 'feito' ? 'bg-nexon-verde text-white' : atual ? 'border-2 border-nexon-verde text-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {estado === 'feito' ? <Check className="h-5 w-5" strokeWidth={3} /> : numero}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Icone className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {titulo}
            {estado === 'feito' && <span className="sr-only"> (feito)</span>}
          </span>
          {resumo && <span className={cn('truncate text-sm font-medium', VERDE_TEXTO)}>· {resumo}</span>}
        </p>
        {atual && children}
      </div>
    </li>
  );
}
