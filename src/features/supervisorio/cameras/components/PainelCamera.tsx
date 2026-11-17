import { Camera as CameraIcon, ChevronDown, ChevronUp, Download, Image as ImageIcon, Loader2, Maximize, Radio, Trash2, Video, VideoOff, type LucideIcon } from 'lucide-react';
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Camera, CameraEvento } from '../types';
import { miniaturaComVersao, paraBaixar } from '../utils/midia';
import { carimboDataHora, diaHoraCurta, horaCurta, textoChamado, tituloEvento } from '../utils/eventos';
import { BOTAO_PRIMARIO, FOCO, ITEM_ATIVO } from './estilo-filtro';
import { EtiquetaTipo } from './ItemEvento';
import { PlayerHls } from './PlayerHls';
import { PlayerVideo } from './PlayerVideo';
import { QuadroVideo } from './QuadroVideo';

interface PainelCameraProps {
  camera: Camera | null;
  /** Evento aberto na lista: mostra a foto/clipe no lugar do ao vivo. */
  evento: CameraEvento | null;
  onVoltarAoVivo: () => void;
  /** Evento mais novo / mais antigo da lista; `undefined` quando não há. */
  onEventoAnterior?: () => void;
  onEventoProximo?: () => void;
  urlMidia: (caminho: string | null | undefined) => string | null;
  podeComandar: boolean;
  onFoto: () => void;
  fotoPendente: boolean;
  /** NEXON-108: "Ao vivo | Histórico". Sem `onModo` o seletor não aparece. */
  modo?: ModoPlayer;
  onModo?: (modo: ModoPlayer) => void;
  /** Vídeo + linha do tempo do histórico (no lugar do ao vivo quando `modo = historico`). */
  historico?: ReactNode;
  /** Só admin: apaga o evento aberto (a aba confirma antes). */
  onApagarEvento?: (evento: CameraEvento) => void;
}

export type ModoPlayer = 'aovivo' | 'historico';

/**
 * Player principal: ao vivo da câmera escolhida ou a gravação do evento aberto.
 * No desktop ocupa a altura que sobra na coluna e o vídeo 16:9 é o maior que cabe
 * (`QuadroVideo`); no celular é 16:9 na largura toda.
 */
export const PainelCamera = forwardRef<HTMLElement, PainelCameraProps>(function PainelCamera(
  {
    camera,
    evento,
    onVoltarAoVivo,
    onEventoAnterior,
    onEventoProximo,
    urlMidia,
    podeComandar,
    onFoto,
    fotoPendente,
    modo = 'aovivo',
    onModo,
    historico,
    onApagarEvento,
  },
  ref,
) {
  const [agora, setAgora] = useState(() => new Date());
  const quadroRef = useRef<HTMLDivElement>(null);

  const offline = camera?.status === 'offline';
  const emHistorico = modo === 'historico' && !evento && !!historico;
  const aoVivo = !!camera && !offline && !evento && !emHistorico;

  // Relógio do carimbo só enquanto o vídeo ao vivo está na tela.
  useEffect(() => {
    if (!aoVivo) return undefined;
    setAgora(new Date());
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [aoVivo]);

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
    return (
      <section ref={ref} aria-label="Câmera" className="flex aspect-video items-center justify-center rounded-xl border border-border bg-card lg:aspect-auto lg:min-h-0 lg:flex-1">
        <p className="text-sm text-muted-foreground">Escolha uma câmera para ver ao vivo.</p>
      </section>
    );
  }

  const chamado = evento ? textoChamado(evento) : null;

  return (
    <section ref={ref} aria-label="Câmera" className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:min-h-0 lg:flex-1">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="truncate text-base font-semibold">{camera.nome}</h2>
          {evento ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <EtiquetaTipo tipo={evento.tipo} />
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{diaHoraCurta(evento.inicio_em)}</span>
              {chamado && <span className="hidden truncate text-sm text-muted-foreground sm:inline">· {chamado}</span>}
            </span>
          ) : emHistorico ? null : offline ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              <span aria-hidden className="h-2 w-2 rounded-full bg-zinc-500" />
              Sem sinal
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-nexon-verde">
              <span aria-hidden className="h-2 w-2 rounded-full bg-nexon-verde" />
              Ao vivo
            </span>
          )}
        </div>

        <div role="group" aria-label="Controles da câmera" className="flex shrink-0 items-center gap-1">
          {!evento && onModo && <SeletorModo modo={emHistorico ? 'historico' : 'aovivo'} onModo={onModo} />}
          {evento ? (
            <>
              <BotaoIcone rotulo="Evento mais novo" icone={ChevronUp} onClick={onEventoAnterior} desabilitado={!onEventoAnterior} />
              <BotaoIcone rotulo="Evento mais antigo" icone={ChevronDown} onClick={onEventoProximo} desabilitado={!onEventoProximo} />
              <MenuBaixar evento={evento} urlMidia={urlMidia} />
              {onApagarEvento && <BotaoIcone rotulo="Apagar evento" icone={Trash2} onClick={() => onApagarEvento(evento)} perigo />}
              <button type="button" className={cn(BOTAO_PRIMARIO, 'ml-1 h-9 px-3.5 text-sm touch:h-11')} onClick={onVoltarAoVivo}>
                <Radio className="h-4 w-4" aria-hidden />
                Voltar ao vivo
              </button>
            </>
          ) : (
            podeComandar &&
            !emHistorico && (
              <BotaoIcone rotulo="Tirar foto agora" icone={CameraIcon} onClick={onFoto} ocupado={fotoPendente} desabilitado={offline} />
            )
          )}
          {!emHistorico && !evento && <BotaoIcone rotulo="Tela cheia" icone={Maximize} onClick={telaCheia} />}
        </div>
      </div>

      {emHistorico ? (
        historico
      ) : (
      <QuadroVideo ref={quadroRef}>
        {evento ? (
          <MidiaEvento evento={evento} urlMidia={urlMidia} />
        ) : offline ? (
          <div role="status" className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
            <VideoOff className="h-6 w-6" aria-hidden />
            <span className="text-sm">Sem sinal{camera.status_em ? ` desde ${horaCurta(camera.status_em)}` : ''}</span>
          </div>
        ) : (
          <PlayerHls cameraId={camera.id} cameraNome={camera.nome} capa={miniaturaComVersao(urlMidia(camera.miniatura_url), camera.miniatura_em)} />
        )}
        {aoVivo && (
          <span className="pointer-events-none absolute bottom-2 left-3 text-xs tabular-nums text-white/70">{carimboDataHora(agora)}</span>
        )}
      </QuadroVideo>
      )}
    </section>
  );
});

/** "Ao vivo | Histórico" (segmentado, dois botões com aria-pressed). */
function SeletorModo({ modo, onModo }: { modo: ModoPlayer; onModo: (m: ModoPlayer) => void }) {
  const opcoes: { valor: ModoPlayer; rotulo: string }[] = [
    { valor: 'aovivo', rotulo: 'Ao vivo' },
    { valor: 'historico', rotulo: 'Histórico' },
  ];
  return (
    <div role="group" aria-label="Ver" className="mr-1 flex gap-0.5 rounded-lg border border-border p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={modo === o.valor}
          onClick={() => modo !== o.valor && onModo(o.valor)}
          className={cn(
            'h-8 rounded-md border px-3 text-sm font-medium transition-colors touch:h-10',
            modo === o.valor ? ITEM_ATIVO : 'border-transparent text-muted-foreground mouse:hover:text-foreground',
            FOCO,
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Foto ou clipe do evento no lugar do vídeo ao vivo. */
function MidiaEvento({ evento, urlMidia }: { evento: CameraEvento; urlMidia: PainelCameraProps['urlMidia'] }) {
  const clipe = urlMidia(evento.clipe_url);
  const foto = urlMidia(evento.snapshot_url);
  if (clipe) {
    return <PlayerVideo key={clipe} src={clipe} poster={foto} baixarUrl={paraBaixar(clipe)} rotulo={`Clipe: ${tituloEvento(evento)}`} />;
  }
  if (foto) {
    return <img src={foto} alt={`${tituloEvento(evento)} em ${evento.camera_nome}`} className="h-full w-full object-contain" />;
  }
  return <div className="flex h-full items-center justify-center text-sm text-white/60">Este evento não tem imagem</div>;
}

/** Baixar o clipe ou a foto do evento (anexo com nome legível; a API registra quem baixou). */
function MenuBaixar({ evento, urlMidia }: { evento: CameraEvento; urlMidia: PainelCameraProps['urlMidia'] }) {
  const clipe = paraBaixar(urlMidia(evento.clipe_url));
  const foto = paraBaixar(urlMidia(evento.snapshot_url));
  if (!clipe && !foto) return null;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Baixar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[color-mix(in_srgb,var(--foreground)_80%,transparent)] transition-colors mouse:hover:bg-muted touch:h-11 touch:w-11"
            >
              <Download className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Baixar</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {clipe && (
          <DropdownMenuItem asChild>
            <a href={clipe}>
              <Video className="h-4 w-4" aria-hidden />
              Vídeo (MP4)
            </a>
          </DropdownMenuItem>
        )}
        {foto && (
          <DropdownMenuItem asChild>
            <a href={foto}>
              <ImageIcon className="h-4 w-4" aria-hidden />
              Foto (JPG)
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BotaoIcone({
  rotulo,
  icone: Icone,
  onClick,
  desabilitado,
  ocupado,
  perigo,
}: {
  rotulo: string;
  icone: LucideIcon;
  onClick?: () => void;
  desabilitado?: boolean;
  ocupado?: boolean;
  perigo?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          aria-busy={ocupado || undefined}
          disabled={desabilitado || ocupado}
          onClick={onClick}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg text-[color-mix(in_srgb,var(--foreground)_80%,transparent)] transition-colors disabled:opacity-40 mouse:hover:bg-muted touch:h-11 touch:w-11',
            perigo && 'text-red-500 mouse:hover:bg-red-500/10 mouse:hover:text-red-500',
          )}
        >
          {ocupado ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : <Icone className="h-[18px] w-[18px]" aria-hidden />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{rotulo}</TooltipContent>
    </Tooltip>
  );
}
