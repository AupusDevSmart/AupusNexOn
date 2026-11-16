// Build leve: sem legendas/áudio alternativo/DRM, ~230 kB a menos no chunk da aba (tipos em ../hls-light.d.ts).
import Hls from 'hls.js/light';
import { ImageDown, Loader2, RefreshCw, SkipForward, VideoOff, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useStreamCamera } from '../hooks/useStreamCamera';

const MAX_RECONEXOES = 6;
/** Sem avançar o vídeo por este tempo = travado. */
const TRAVADO_MS = 15_000;
/** Mais que isto atrás do ao vivo (aba ficou em segundo plano, rede lenta): mostra "Ir para o ao vivo". */
const ATRASO_MAX_S = 6;

interface PlayerHlsProps {
  cameraId: string;
  /** Nome da câmera (arquivo da foto salva). */
  cameraNome?: string;
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
export function PlayerHls({ cameraId, cameraNome, capa, className }: PlayerHlsProps) {
  const hlsRef = useRef<Hls | null>(null);
  const [atrasado, setAtrasado] = useState(false);
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
      const h = hlsRef.current;
      const ao = h?.liveSyncPosition;
      setAtrasado(!!h && typeof ao === 'number' && ao - video.currentTime > ATRASO_MAX_S);
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
      hlsRef.current = hls;
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
      hlsRef.current = null;
      setAtrasado(false);
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

  const irAoVivo = () => {
    const video = videoRef.current;
    const ao = hlsRef.current?.liveSyncPosition;
    if (video && typeof ao === 'number') video.currentTime = ao;
    void video?.play().catch(() => undefined);
    setAtrasado(false);
  };

  /** Salva o quadro atual em JPG na máquina (o vídeo vem com CORS liberado: o canvas não fica bloqueado). */
  const salvarFoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nomeFoto(cameraNome ?? 'camera');
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 5_000);
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <div className={cn('group relative h-full w-full bg-black', className)}>
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
      {!aviso && reproduzindo && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {atrasado && (
            <button
              type="button"
              onClick={irAoVivo}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs font-medium text-white backdrop-blur transition-colors mouse:hover:bg-black/75 touch:h-10"
            >
              <SkipForward className="h-3.5 w-3.5" aria-hidden />
              Ir para o ao vivo
            </button>
          )}
          <button
            type="button"
            onClick={salvarFoto}
            aria-label="Salvar foto deste momento"
            title="Salvar foto deste momento"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity focus-visible:opacity-100 group-hover:opacity-100 touch:h-10 touch:w-10 touch:opacity-100"
          >
            <ImageDown className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/** `portao_2026-11-16_14h32.jpg` (hora local de quem salva). */
function nomeFoto(camera: string): string {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  const nome =
    camera
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'camera';
  return `${nome}_${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}_${dois(d.getHours())}h${dois(d.getMinutes())}m${dois(d.getSeconds())}.jpg`;
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
