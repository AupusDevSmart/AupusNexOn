// Build leve: sem legendas/áudio alternativo/DRM, ~230 kB a menos no chunk da aba (tipos em ../hls-light.d.ts).
import Hls from 'hls.js/light';
import { Loader2, RefreshCw, VideoOff, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useStreamCamera } from '../hooks/useStreamCamera';

const MAX_RECONEXOES = 6;
/** Sem avançar o vídeo por este tempo = travado. */
const TRAVADO_MS = 15_000;

interface PlayerHlsProps {
  cameraId: string;
  /** Última foto da câmera: aparece enquanto o vídeo conecta (a tela não fica preta). */
  capa?: string | null;
  className?: string;
}

/**
 * Vídeo ao vivo de uma câmera. Pede `GET /cameras/:id/stream` ao montar e repete
 * enquanto montado (hook); toca o HLS nativo no Safari e com hls.js nos demais.
 * Estados: "Conectando…" (aguardando o agente publicar), "Sem sinal" (offline) e
 * erro do hls com "Tentar de novo". Ao desmontar, destrói o hls e solta o <video>.
 */
export function PlayerHls({ cameraId, capa, className }: PlayerHlsProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useStreamCamera(cameraId, true);
  const [erroVideo, setErroVideo] = useState<string | null>(null);
  const [reproduzindo, setReproduzindo] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  /** Falhas seguidas sem tocar: até MAX_RECONEXOES o player tenta sozinho ("Reconectando…"). */
  const [falhas, setFalhas] = useState(0);

  const estado = stream.data?.estado;
  const url = estado === 'publicando' ? (stream.data?.hls_url ?? null) : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return undefined;
    setErroVideo(null);
    setReproduzindo(false);

    let hls: Hls | null = null;
    let ultimoAvanco = Date.now();
    const aoTocar = () => {
      setReproduzindo(true);
      setFalhas(0);
      ultimoAvanco = Date.now();
    };
    const aoAvancar = () => {
      ultimoAvanco = Date.now();
    };
    const aoErroNativo = () => setErroVideo('Falha ao carregar o vídeo.');
    video.addEventListener('playing', aoTocar);
    video.addEventListener('timeupdate', aoAvancar);
    // Vídeo congelado (rede caiu, câmera reiniciou) sem erro do hls: reabre sozinho.
    const vigia = window.setInterval(() => {
      if (!video.paused && Date.now() - ultimoAvanco > TRAVADO_MS) setErroVideo('Vídeo parado');
    }, 5_000);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS tocam HLS direto no <video>.
      video.addEventListener('error', aoErroNativo);
      video.src = url;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        // começa pelo trecho mais novo e alcança o ao vivo acelerando um pouco, em vez de esperar 3 segmentos
        liveSyncDurationCount: 2,
        maxLiveSyncPlaybackRate: 1.5,
        // playlist que ainda está nascendo no servidor: tenta de novo rápido antes de virar erro
        manifestLoadPolicy: {
          default: {
            maxTimeToFirstByteMs: 10_000,
            maxLoadTimeMs: 15_000,
            timeoutRetry: { maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0 },
            errorRetry: { maxNumRetry: 4, retryDelayMs: 500, maxRetryDelayMs: 2_000 },
          },
        },
      });
      hls.on(Hls.Events.ERROR, (_evento, dados) => {
        if (dados.fatal) setErroVideo(dados.details || 'Falha no vídeo.');
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      setErroVideo('Este navegador não reproduz vídeo HLS.');
      return () => {
        window.clearInterval(vigia);
        video.removeEventListener('timeupdate', aoAvancar);
        video.removeEventListener('playing', aoTocar);
      };
    }
    video.play().catch(() => undefined);

    return () => {
      window.clearInterval(vigia);
      video.removeEventListener('timeupdate', aoAvancar);
      video.removeEventListener('playing', aoTocar);
      video.removeEventListener('error', aoErroNativo);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, tentativa]);

  const tentarDeNovo = () => {
    setFalhas(0);
    setTentativa((t) => t + 1);
    void stream.refetch();
  };

  // Erro do vídeo (playlist ainda não existe, rede oscilou, câmera reiniciou): tenta de novo
  // sozinho com espera crescente; só mostra o botão depois de várias falhas seguidas.
  const reconectando = !!erroVideo && falhas < MAX_RECONEXOES;
  useEffect(() => {
    if (!erroVideo || falhas >= MAX_RECONEXOES) return undefined;
    const espera = Math.min(15_000, 1_000 * 2 ** falhas);
    const t = window.setTimeout(() => {
      setFalhas((f) => f + 1);
      setTentativa((n) => n + 1);
      void stream.refetch();
    }, espera);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erroVideo, falhas]);

  let aviso: ReactNode = null;
  if (stream.isError) {
    aviso = <Aviso texto="Não foi possível pedir o vídeo" acao={tentarDeNovo} />;
  } else if (reconectando) {
    aviso = <Aviso carregando texto="Reconectando…" />;
  } else if (erroVideo) {
    aviso = <Aviso texto="Sem vídeo no momento" detalhe="A câmera ou a internet do local pode ter caído." acao={tentarDeNovo} />;
  } else if (estado === 'offline') {
    aviso = <Aviso icone={VideoOff} texto="Sem sinal" />;
  } else if (!url || !reproduzindo) {
    aviso = <Aviso carregando texto="Conectando…" leve={!!capa} />;
  }

  return (
    <div className={cn('relative h-full w-full bg-black', className)}>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        poster={capa ?? undefined}
        muted
        autoPlay
        playsInline
        aria-label="Vídeo ao vivo"
      />
      {aviso}
    </div>
  );
}

function Aviso({
  texto,
  detalhe,
  acao,
  carregando,
  leve,
  icone: Icone,
}: {
  texto: string;
  detalhe?: string;
  acao?: () => void;
  carregando?: boolean;
  /** Fundo mais claro: deixa a foto da câmera aparecer por trás. */
  leve?: boolean;
  icone?: LucideIcon;
}) {
  return (
    <div
      role="status"
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-white/80',
        leve ? 'bg-black/30' : 'bg-black/70',
      )}
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
