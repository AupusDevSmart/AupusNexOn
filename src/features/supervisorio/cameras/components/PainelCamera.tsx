import {
  Camera as CameraIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  ListVideo,
  Loader2,
  Maximize,
  Mic,
  Radio,
  RefreshCw,
  Search,
  Video,
  VideoOff,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEventosCameras } from '../hooks/useEventosCameras';
import type { Camera, CameraEvento, FiltroEventos } from '../types';
import { chaveHoje, deslocarDia, diaCurto } from '../utils/agrupar-por-dia';
import { FILTROS_EVENTOS, carimboDataHora, horaCurta, tituloEvento } from '../utils/eventos';
import { EventosSkeleton } from './CamerasSkeleton';
import { ItemEvento } from './ItemEvento';
import { PlayerHls } from './PlayerHls';

interface PainelCameraProps {
  unidadeId: string;
  camera: Camera | null;
  /** Dia (AAAA-MM-DD, Brasília) da lista de eventos. */
  dia: string;
  onDia: (chave: string) => void;
  eventoSel: CameraEvento | null;
  onSelecionarEvento: (ev: CameraEvento | null) => void;
  urlMidia: (caminho: string | null | undefined) => string | null;
  podeComandar: boolean;
  onFoto: () => void;
  fotoPendente: boolean;
}

/**
 * Aba "Câmera" do painel lateral: nome + status, player 16:9 com carimbo, barra de
 * controles, navegação por dia e lista de eventos do dia. Clicar num evento mostra o
 * snapshot/clipe no lugar do vídeo (status "Gravação").
 */
export function PainelCamera({
  unidadeId,
  camera,
  dia,
  onDia,
  eventoSel,
  onSelecionarEvento,
  urlMidia,
  podeComandar,
  onFoto,
  fotoPendente,
}: PainelCameraProps) {
  const hoje = chaveHoje();
  const [filtro, setFiltro] = useState<FiltroEventos>('todas');
  const [busca, setBusca] = useState('');
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const quadroRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLOListElement>(null);

  const offline = camera?.status === 'offline';
  const aoVivo = !!camera && !offline && !eventoSel;

  // Relógio do carimbo só enquanto o vídeo ao vivo está na tela.
  useEffect(() => {
    if (!aoVivo) return undefined;
    setAgora(new Date());
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [aoVivo]);

  const eventos = useEventosCameras({ unidadeId, cameraId: camera?.id, dia, filtro, limit: 100 }, !!camera);
  const lista = useMemo(() => {
    const todos = eventos.data?.data ?? [];
    const q = busca.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((e) => tituloEvento(e).toLowerCase().includes(q));
  }, [eventos.data, busca]);

  const telaCheia = () => {
    const el = quadroRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (el.requestFullscreen) {
      void el.requestFullscreen();
      return;
    }
    // iPhone: só o <video> entra em tela cheia.
    const video = el.querySelector('video') as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    video?.webkitEnterFullscreen?.();
  };

  if (!camera) {
    return <p className="p-4 text-[13px] text-muted-foreground">Selecione uma câmera na grade.</p>;
  }

  const status = offline ? 'Offline' : eventoSel ? 'Gravação' : 'Ao vivo';
  const carimbo = eventoSel ? carimboDataHora(eventoSel.inicio_em) : offline ? '' : carimboDataHora(agora);

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2 px-3.5 pb-2 pt-3">
        <h2 className="truncate text-[15px] font-semibold">{camera.nome}</h2>
        <span className={cn('shrink-0 text-xs', aoVivo ? 'text-nexon-verde' : 'text-muted-foreground')}>{status}</span>
      </div>

      <div ref={quadroRef} className="relative aspect-video w-full overflow-hidden bg-black">
        {eventoSel ? (
          <MidiaEvento evento={eventoSel} urlMidia={urlMidia} />
        ) : offline ? (
          <div role="status" className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
            <VideoOff className="h-6 w-6" aria-hidden />
            <span className="text-[13px]">
              Sem sinal{camera.status_em ? ` desde ${horaCurta(camera.status_em)}` : ''}
            </span>
          </div>
        ) : (
          <PlayerHls cameraId={camera.id} />
        )}
        {carimbo && (
          <span className="pointer-events-none absolute bottom-2 left-2.5 text-[11px] tabular-nums text-white/70">{carimbo}</span>
        )}
        {eventoSel && !offline && (
          <button
            type="button"
            onClick={() => onSelecionarEvento(null)}
            className="absolute right-2 top-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-black/60 px-2.5 text-xs font-medium text-white transition-colors hover:bg-black/80 touch:h-10"
          >
            <Radio className="h-3.5 w-3.5" aria-hidden />
            Ao vivo
          </button>
        )}
      </div>

      <div role="group" aria-label="Controles da câmera" className="grid auto-cols-fr grid-flow-col border-b border-border px-2 py-1">
        <Controle rotulo="Áudio" icone={Volume2} indisponivel />
        <Controle rotulo="Gravar clipe" icone={Video} indisponivel />
        <Controle rotulo="Falar" icone={Mic} indisponivel />
        {podeComandar && <Controle rotulo="Foto" icone={CameraIcon} onClick={onFoto} ocupado={fotoPendente} desabilitado={offline} />}
        <Controle rotulo="Tela cheia" icone={Maximize} onClick={telaCheia} />
        <Controle
          rotulo="Gravações"
          icone={ListVideo}
          ativo={!!eventoSel}
          onClick={() => listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 pt-2.5">
        <div role="group" aria-label="Dia" className="flex items-center rounded-lg bg-muted">
          <button
            type="button"
            aria-label="Dia anterior"
            onClick={() => onDia(deslocarDia(dia, -1))}
            className="flex h-9 w-10 items-center justify-center rounded-l-lg text-foreground/80 transition-colors mouse:hover:bg-accent touch:h-10"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDia(hoje)}
            title={dia === hoje ? 'Hoje' : 'Voltar para hoje'}
            className="min-w-[60px] text-center text-sm font-semibold tabular-nums"
          >
            {diaCurto(dia)}
          </button>
          <button
            type="button"
            aria-label="Próximo dia"
            disabled={dia >= hoje}
            onClick={() => onDia(deslocarDia(dia, 1))}
            className="flex h-9 w-10 items-center justify-center rounded-r-lg text-foreground/80 transition-colors disabled:text-muted-foreground/40 mouse:hover:bg-accent touch:h-10"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex">
          <button
            type="button"
            aria-label="Buscar"
            aria-pressed={buscaAberta}
            onClick={() => {
              if (buscaAberta) setBusca('');
              setBuscaAberta((v) => !v);
            }}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-md text-foreground/80 transition-colors mouse:hover:bg-muted',
              buscaAberta && 'bg-muted text-foreground',
            )}
          >
            <Search className="h-4 w-4" aria-hidden />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Filtrar"
                className="relative flex h-10 w-10 items-center justify-center rounded-md text-foreground/80 transition-colors mouse:hover:bg-muted"
              >
                <Filter className="h-4 w-4" aria-hidden />
                {filtro !== 'todas' && <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-nexon-verde" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={filtro} onValueChange={(v) => setFiltro(v as FiltroEventos)}>
                {FILTROS_EVENTOS.map((f) => (
                  <DropdownMenuRadioItem key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {buscaAberta && (
        <div className="px-3.5 pt-2">
          <Input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar evento"
            aria-label="Buscar evento"
            className="h-9"
          />
        </div>
      )}

      <ol ref={listaRef} className="flex flex-col gap-1.5 px-3.5 pb-3.5 pt-2.5">
        {eventos.isPending ? (
          <li>
            <EventosSkeleton />
          </li>
        ) : eventos.isError ? (
          <li className="flex items-center justify-between gap-2 px-1 py-3 text-[13px] text-muted-foreground">
            Não foi possível carregar os eventos.
            <button type="button" onClick={() => void eventos.refetch()} className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Tentar de novo
            </button>
          </li>
        ) : lista.length === 0 ? (
          <li className="px-1 py-4 text-[13px] text-muted-foreground">
            {busca.trim()
              ? 'Nenhum evento com esse texto.'
              : dia === hoje
                ? 'Nenhum evento nesta câmera hoje.'
                : `Nenhum evento nesta câmera em ${diaCurto(dia)}.`}
          </li>
        ) : (
          lista.map((ev) => (
            <ItemEvento key={ev.id} evento={ev} selecionado={eventoSel?.id === ev.id} onClick={() => onSelecionarEvento(ev)} />
          ))
        )}
      </ol>
    </div>
  );
}

/** Snapshot ou clipe do evento no lugar do vídeo ao vivo. */
function MidiaEvento({ evento, urlMidia }: { evento: CameraEvento; urlMidia: PainelCameraProps['urlMidia'] }) {
  const clipe = urlMidia(evento.clipe_url);
  const foto = urlMidia(evento.snapshot_url);
  if (clipe) {
    return <video key={clipe} className="h-full w-full object-contain" src={clipe} poster={foto ?? undefined} controls autoPlay playsInline />;
  }
  if (foto) {
    return <img src={foto} alt={`${tituloEvento(evento)} em ${evento.camera_nome}`} className="h-full w-full object-contain" />;
  }
  return <div className="flex h-full items-center justify-center text-[13px] text-white/60">Sem imagem deste evento</div>;
}

function Controle({
  rotulo,
  icone: Icone,
  onClick,
  indisponivel,
  desabilitado,
  ocupado,
  ativo,
}: {
  rotulo: string;
  icone: LucideIcon;
  onClick?: () => void;
  /** Recurso que a câmera não oferece: fica apagado com tooltip. */
  indisponivel?: boolean;
  desabilitado?: boolean;
  ocupado?: boolean;
  ativo?: boolean;
}) {
  const botao = (
    <button
      type="button"
      aria-label={rotulo}
      title={indisponivel ? undefined : rotulo}
      aria-disabled={indisponivel || desabilitado || undefined}
      aria-pressed={ativo}
      disabled={desabilitado || ocupado}
      onClick={indisponivel ? undefined : onClick}
      className={cn(
        'flex h-11 items-center justify-center rounded-md text-foreground/80 transition-colors',
        indisponivel ? 'cursor-not-allowed text-muted-foreground/40' : 'mouse:hover:bg-muted',
        ativo && 'bg-muted text-foreground',
        desabilitado && 'opacity-40',
      )}
    >
      {ocupado ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : <Icone className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
  if (!indisponivel) return botao;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{botao}</TooltipTrigger>
      <TooltipContent side="bottom">Indisponível nesta câmera</TooltipContent>
    </Tooltip>
  );
}
