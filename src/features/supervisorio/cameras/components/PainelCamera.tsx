import { Camera as CameraIcon, ChevronDown, ChevronUp, Loader2, Maximize, Radio, VideoOff, type LucideIcon } from 'lucide-react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Camera, CameraEvento } from '../types';
import { carimboDataHora, diaHoraCurta, horaCurta, textoChamado, tituloEvento } from '../utils/eventos';
import { EtiquetaTipo } from './ItemEvento';
import { PlayerHls } from './PlayerHls';

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
}

/**
 * Player principal: ao vivo da câmera escolhida ou a gravação do evento aberto.
 * No desktop a altura acompanha a janela (a lista de eventos fica ao lado sem rolar
 * a página); no celular é 16:9 na largura toda.
 */
export const PainelCamera = forwardRef<HTMLElement, PainelCameraProps>(function PainelCamera(
  { camera, evento, onVoltarAoVivo, onEventoAnterior, onEventoProximo, urlMidia, podeComandar, onFoto, fotoPendente },
  ref,
) {
  const [agora, setAgora] = useState(() => new Date());
  const quadroRef = useRef<HTMLDivElement>(null);

  const offline = camera?.status === 'offline';
  const aoVivo = !!camera && !offline && !evento;

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
      <section ref={ref} aria-label="Câmera" className="flex aspect-video items-center justify-center rounded-xl border border-border bg-card">
        <p className="text-[13px] text-muted-foreground">Escolha uma câmera para ver ao vivo.</p>
      </section>
    );
  }

  const chamado = evento ? textoChamado(evento) : null;

  return (
    <section ref={ref} aria-label="Câmera" className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold">{camera.nome}</h2>
          {evento ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <EtiquetaTipo tipo={evento.tipo} />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{diaHoraCurta(evento.inicio_em)}</span>
              {chamado && <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {chamado}</span>}
            </span>
          ) : offline ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="h-2 w-2 rounded-full bg-zinc-500" />
              Sem sinal
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-nexon-verde">
              <span aria-hidden className="h-2 w-2 rounded-full bg-nexon-verde" />
              Ao vivo
            </span>
          )}
        </div>

        <div role="group" aria-label="Controles da câmera" className="flex shrink-0 items-center gap-1">
          {evento ? (
            <>
              <BotaoIcone rotulo="Evento mais novo" icone={ChevronUp} onClick={onEventoAnterior} desabilitado={!onEventoAnterior} />
              <BotaoIcone rotulo="Evento mais antigo" icone={ChevronDown} onClick={onEventoProximo} desabilitado={!onEventoProximo} />
              <Button type="button" size="sm" className="ml-1 h-8 gap-1.5 touch:h-10" onClick={onVoltarAoVivo}>
                <Radio className="h-3.5 w-3.5" aria-hidden />
                Voltar ao vivo
              </Button>
            </>
          ) : (
            podeComandar && (
              <BotaoIcone rotulo="Tirar foto agora" icone={CameraIcon} onClick={onFoto} ocupado={fotoPendente} desabilitado={offline} />
            )
          )}
          <BotaoIcone rotulo="Tela cheia" icone={Maximize} onClick={telaCheia} />
        </div>
      </div>

      <div
        ref={quadroRef}
        className="relative aspect-video w-full overflow-hidden bg-black lg:max-h-[calc(100dvh-25rem)] lg:min-h-[240px]"
      >
        {evento ? (
          <MidiaEvento evento={evento} urlMidia={urlMidia} />
        ) : offline ? (
          <div role="status" className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
            <VideoOff className="h-6 w-6" aria-hidden />
            <span className="text-[13px]">Sem sinal{camera.status_em ? ` desde ${horaCurta(camera.status_em)}` : ''}</span>
          </div>
        ) : (
          <PlayerHls cameraId={camera.id} />
        )}
        {aoVivo && (
          <span className="pointer-events-none absolute bottom-2 left-2.5 text-[11px] tabular-nums text-white/70">{carimboDataHora(agora)}</span>
        )}
      </div>
    </section>
  );
});

/** Foto ou clipe do evento no lugar do vídeo ao vivo. */
function MidiaEvento({ evento, urlMidia }: { evento: CameraEvento; urlMidia: PainelCameraProps['urlMidia'] }) {
  const clipe = urlMidia(evento.clipe_url);
  const foto = urlMidia(evento.snapshot_url);
  if (clipe) {
    return <video key={clipe} className="h-full w-full object-contain" src={clipe} poster={foto ?? undefined} controls autoPlay playsInline />;
  }
  if (foto) {
    return <img src={foto} alt={`${tituloEvento(evento)} em ${evento.camera_nome}`} className="h-full w-full object-contain" />;
  }
  return <div className="flex h-full items-center justify-center text-[13px] text-white/60">Este evento não tem imagem</div>;
}

function BotaoIcone({
  rotulo,
  icone: Icone,
  onClick,
  desabilitado,
  ocupado,
}: {
  rotulo: string;
  icone: LucideIcon;
  onClick?: () => void;
  desabilitado?: boolean;
  ocupado?: boolean;
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
            'flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 transition-colors disabled:opacity-40 mouse:hover:bg-muted touch:h-10 touch:w-10',
          )}
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icone className="h-4 w-4" aria-hidden />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{rotulo}</TooltipContent>
    </Tooltip>
  );
}
