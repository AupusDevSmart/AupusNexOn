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

  const PASSOS: { n: number; icone: LucideIcon; titulo: string; resumo?: string; dica: string }[] = [
    { n: 1, icone: Cpu, titulo: 'Raspberry', resumo: vivo ? `${vivo.nome} online` : undefined, dica: 'O aparelho que liga as câmeras ao NexON.' },
    { n: 2, icone: Video, titulo: 'Câmeras', dica: 'Câmera de fábrica entra sozinha. Com senha, pede a senha.' },
    { n: 3, icone: Clock, titulo: 'Armar por horário', dica: 'Com a usina armada, movimento vira alerta.' },
  ];
  const atual = PASSOS[passo - 1];

  let conteudo: ReactNode = null;
  if (passo === 1) {
    conteudo = esperando ? (
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
      <p className="text-base text-muted-foreground">A equipe técnica instala o Raspberry.</p>
    ) : (
      <>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="button" className="h-12 px-6 text-base" onClick={() => setInstalando(true)}>
            <Plus aria-hidden />
            {continuar ? 'Continuar Raspberry novo' : 'Instalar Raspberry'}
          </Button>
          <button
            type="button"
            className="flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 mouse:hover:underline"
            onClick={() => onAbrirConfig('agentes')}
          >
            <Link2 className="h-4 w-4" aria-hidden />
            Já está ligado? Vincular
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Pelo computador (Mac, Windows ou Linux), pendrive ou cartão SD.</p>
      </>
    );
  } else {
    conteudo = (
      <>
        <p className="flex items-center gap-2 text-base">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          Procurando câmeras na rede…
        </p>
        {podeCadastrar && (
          <Button type="button" className="h-12 self-start px-6 text-base" onClick={() => onAbrirConfig('cameras')}>
            <Video aria-hidden />
            Ver câmeras encontradas
          </Button>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby="tutorial-cameras-titulo" className="mx-auto flex w-full max-w-5xl flex-col rounded-xl border border-border bg-card">
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

      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <h2 id="tutorial-cameras-titulo" className="text-lg font-semibold">
          Ligue as câmeras {nome}
        </h2>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">Passo {passo} de 3</span>
      </header>

      <ol aria-label="Passos" className="grid grid-cols-3 border-b border-border">
        {PASSOS.map((p) => (
          <Passo key={p.n} numero={p.n} icone={p.icone} titulo={p.titulo} estado={estado(p.n)} resumo={p.resumo} />
        ))}
      </ol>

      <div className="flex gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
        <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted sm:flex">
          <atual.icone className={cn('h-7 w-7', VERDE_TEXTO)} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">{atual.titulo}</h3>
            <p className="text-sm text-muted-foreground">{atual.dica}</p>
          </div>
          {conteudo}
        </div>
      </div>
    </section>
  );
}

function Passo({
  numero,
  icone: Icone,
  titulo,
  estado,
  resumo,
}: {
  numero: number;
  icone: LucideIcon;
  titulo: string;
  estado: Estado;
  resumo?: string;
}) {
  const atual = estado === 'atual';
  return (
    <li
      aria-current={atual ? 'step' : undefined}
      className={cn(
        'flex min-w-0 flex-col gap-2 border-b-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6 sm:py-4',
        estado === 'feito' || atual ? 'border-nexon-verde' : 'border-transparent',
        estado === 'depois' && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          estado === 'feito' ? 'bg-nexon-verde text-white' : atual ? 'border-2 border-nexon-verde text-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {estado === 'feito' ? <Check className="h-4 w-4" strokeWidth={3} /> : numero}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cn('flex items-center gap-1.5 truncate text-sm', atual ? 'font-semibold' : 'font-medium')}>
          <Icone className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block" aria-hidden />
          <span className="truncate">{titulo}</span>
          {estado === 'feito' && <span className="sr-only"> (feito)</span>}
        </span>
        {resumo && <span className={cn('truncate text-xs font-medium', VERDE_TEXTO)}>{resumo}</span>}
      </span>
    </li>
  );
}
