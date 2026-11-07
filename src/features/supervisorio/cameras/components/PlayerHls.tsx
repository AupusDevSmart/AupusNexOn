// Build leve: sem legendas/áudio alternativo/DRM, ~230 kB a menos no chunk da aba (tipos em ../hls-light.d.ts).
import Hls from 'hls.js/light';
import { Loader2, RefreshCw, VideoOff, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useStreamCamera } from '../hooks/useStreamCamera';

interface PlayerHlsProps {
  cameraId: string;
  className?: string;
}

/**
 * Vídeo ao vivo de uma câmera. Pede `GET /cameras/:id/stream` ao montar e repete
 * enquanto montado (hook); toca o HLS nativo no Safari e com hls.js nos demais.
 * Estados: "Conectando…" (aguardando o agente publicar), "Sem sinal" (offline) e
 * erro do hls com "Tentar de novo". Ao desmontar, destrói o hls e solta o <video>.
 */
export function PlayerHls({ cameraId, className }: PlayerHlsProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useStreamCamera(cameraId, true);
  const [erroVideo, setErroVideo] = useState<string | null>(null);
  const [reproduzindo, setReproduzindo] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const estado = stream.data?.estado;
  const url = estado === 'publicando' ? (stream.data?.hls_url ?? null) : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return undefined;
    setErroVideo(null);
    setReproduzindo(false);

    let hls: Hls | null = null;
    const aoTocar = () => setReproduzindo(true);
    const aoErroNativo = () => setErroVideo('Falha ao carregar o vídeo.');
    video.addEventListener('playing', aoTocar);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS tocam HLS direto no <video>.
      video.addEventListener('error', aoErroNativo);
      video.src = url;
    } else if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3, enableWorker: true });
      hls.on(Hls.Events.ERROR, (_evento, dados) => {
        if (dados.fatal) setErroVideo(dados.details || 'Falha no vídeo.');
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      setErroVideo('Este navegador não reproduz vídeo HLS.');
      return () => video.removeEventListener('playing', aoTocar);
    }
    video.play().catch(() => undefined);

    return () => {
      video.removeEventListener('playing', aoTocar);
      video.removeEventListener('error', aoErroNativo);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, tentativa]);

  const tentarDeNovo = () => {
    setTentativa((t) => t + 1);
    void stream.refetch();
  };

  let aviso: ReactNode = null;
  if (stream.isError) {
    aviso = <Aviso texto="Não foi possível pedir o vídeo" acao={tentarDeNovo} />;
  } else if (erroVideo) {
    aviso = <Aviso texto="Falha no vídeo" detalhe={erroVideo} acao={tentarDeNovo} />;
  } else if (estado === 'offline') {
    aviso = <Aviso icone={VideoOff} texto="Sem sinal" />;
  } else if (!url || !reproduzindo) {
    aviso = <Aviso carregando texto="Conectando…" />;
  }

  return (
    <div className={cn('relative h-full w-full bg-black', className)}>
      <video ref={videoRef} className="h-full w-full object-contain" muted autoPlay playsInline aria-label="Vídeo ao vivo" />
      {aviso}
    </div>
  );
}

function Aviso({
  texto,
  detalhe,
  acao,
  carregando,
  icone: Icone,
}: {
  texto: string;
  detalhe?: string;
  acao?: () => void;
  carregando?: boolean;
  icone?: LucideIcon;
}) {
  return (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center text-white/80"
    >
      {carregando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : Icone ? <Icone className="h-6 w-6" aria-hidden /> : null}
      <span className="text-sm">{texto}</span>
      {detalhe && <span className="max-w-full truncate text-[11px] text-white/50">{detalhe}</span>}
      {acao && (
        <button
          type="button"
          onClick={acao}
          className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/30 px-3 text-xs font-medium text-white transition-colors hover:bg-white/10 touch:h-10"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Tentar de novo
        </button>
      )}
    </div>
  );
}
