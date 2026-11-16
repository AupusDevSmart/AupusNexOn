import { Download, Loader2, Maximize, Minimize, Pause, Play, RefreshCw, RotateCcw, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const VELOCIDADES = [1, 2, 0.5] as const;
/** Controles somem depois deste tempo parado com o vídeo tocando. */
const ESCONDER_MS = 2_500;
const PULO_S = 5;

interface PlayerVideoProps {
  /** MP4 (clipe do evento ou trecho do histórico), já com token. */
  src: string;
  poster?: string | null;
  /** Link de download (anexo com nome legível); sem ele o botão não aparece. */
  baixarUrl?: string | null;
  rotulo: string;
  /** Ação extra na barra (ex.: baixar a foto). */
  extra?: ReactNode;
}

/**
 * Player de vídeo gravado (clipe do evento, trecho do histórico) com controles próprios, iguais em todo
 * navegador: tocar/pausar, voltar/avançar 5 s, barra de tempo com o que já carregou, velocidade
 * (1x, 2x, 0,5x), baixar e tela cheia. Teclado: espaço/K toca e pausa, ← → pulam 5 s, F tela cheia.
 * Clique no vídeo toca/pausa; duplo clique abre a tela cheia. Os controles somem com o vídeo tocando.
 */
export function PlayerVideo({ src, poster, baixarUrl, rotulo, extra }: PlayerVideoProps) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const esconderRef = useRef<number | undefined>(undefined);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [carregado, setCarregado] = useState(0);
  const [esperando, setEsperando] = useState(true);
  const [erro, setErro] = useState(false);
  const [velocidade, setVelocidade] = useState<(typeof VELOCIDADES)[number]>(1);
  const [cheia, setCheia] = useState(false);
  const [visiveis, setVisiveis] = useState(true);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    setTempo(0);
    setDuracao(0);
    setCarregado(0);
    setErro(false);
    setEsperando(true);
  }, [src]);

  useEffect(() => {
    const aoMudar = () => setCheia(document.fullscreenElement === caixaRef.current);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  const mostrarControles = useCallback(() => {
    setVisiveis(true);
    window.clearTimeout(esconderRef.current);
    esconderRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setVisiveis(false);
    }, ESCONDER_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(esconderRef.current), []);

  const alternar = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) void v.play().catch(() => undefined);
    else v.pause();
    mostrarControles();
  };

  const pular = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration || v.currentTime + delta);
    mostrarControles();
  };

  const trocarVelocidade = () => {
    const prox = VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length];
    setVelocidade(prox);
    if (videoRef.current) videoRef.current.playbackRate = prox;
  };

  const telaCheia = () => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (caixa.requestFullscreen) {
      void caixa.requestFullscreen();
    } else {
      // iPhone: só o <video> entra em tela cheia.
      (videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)?.webkitEnterFullscreen?.();
    }
  };

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === ' ' || e.key.toLowerCase() === 'k') {
      e.preventDefault();
      alternar();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      pular(-PULO_S);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      pular(PULO_S);
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      telaCheia();
    }
  };

  const atualizarCarregado = () => {
    const v = videoRef.current;
    if (!v || !v.duration || v.buffered.length === 0) return;
    setCarregado(v.buffered.end(v.buffered.length - 1) / v.duration);
  };

  const pct = duracao > 0 ? (tempo / duracao) * 100 : 0;

  return (
    <div
      ref={caixaRef}
      role="group"
      aria-label={rotulo}
      tabIndex={0}
      onKeyDown={teclas}
      onMouseMove={mostrarControles}
      onMouseLeave={() => videoRef.current && !videoRef.current.paused && setVisiveis(false)}
      onFocus={mostrarControles}
      className={cn(
        'group relative h-full w-full select-none bg-black outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40',
        !visiveis && 'cursor-none',
      )}
    >
      <video
        key={`${src}#${tentativa}`}
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        autoPlay
        playsInline
        preload="auto"
        className="h-full w-full object-contain"
        onClick={alternar}
        onDoubleClick={telaCheia}
        onPlay={() => {
          setTocando(true);
          mostrarControles();
        }}
        onPause={() => {
          setTocando(false);
          setVisiveis(true);
        }}
        onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuracao(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onProgress={atualizarCarregado}
        onWaiting={() => setEsperando(true)}
        onCanPlay={(e) => {
          setEsperando(false);
          e.currentTarget.playbackRate = velocidade;
          atualizarCarregado();
        }}
        onPlaying={() => setEsperando(false)}
        onError={() => {
          setErro(true);
          setEsperando(false);
        }}
      />

      {esperando && !erro && (
        <div role="status" aria-label="Carregando vídeo" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
            <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
          </span>
        </div>
      )}

      {erro && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center text-white/80">
          <span className="text-sm">Não foi possível carregar o vídeo</span>
          <button
            type="button"
            onClick={() => {
              setErro(false);
              setEsperando(true);
              setTentativa((n) => n + 1);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/30 px-3 text-xs font-medium text-white mouse:hover:bg-white/10 touch:h-10"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Tentar de novo
          </button>
        </div>
      )}

      {/* Botão grande no meio quando pausado (alvo fácil no celular). */}
      {!tocando && !esperando && !erro && (
        <button
          type="button"
          aria-label="Tocar"
          onClick={alternar}
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-transform mouse:hover:scale-105"
        >
          <Play className="ml-0.5 h-7 w-7" fill="currentColor" aria-hidden />
        </button>
      )}

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2.5 pb-2 pt-8 text-white transition-opacity duration-200',
          visiveis || !tocando ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="relative flex h-4 items-center">
          <div aria-hidden className="absolute inset-x-0 h-1 rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${carregado * 100}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-nexon-verde" style={{ width: `${pct}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={duracao || 0}
            step={0.1}
            value={tempo}
            aria-label="Posição do vídeo"
            aria-valuetext={`${relogio(tempo)} de ${relogio(duracao)}`}
            onChange={(e) => {
              const v = videoRef.current;
              if (v) v.currentTime = Number(e.target.value);
              setTempo(Number(e.target.value));
              mostrarControles();
            }}
            className="barra-video relative h-4 w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>

        <div className="flex items-center gap-0.5">
          <BotaoBarra rotulo={tocando ? 'Pausar (espaço)' : 'Tocar (espaço)'} onClick={alternar}>
            {tocando ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden /> : <Play className="h-4 w-4" fill="currentColor" aria-hidden />}
          </BotaoBarra>
          <BotaoBarra rotulo="Voltar 5 segundos (←)" onClick={() => pular(-PULO_S)}>
            <RotateCcw className="h-4 w-4" aria-hidden />
          </BotaoBarra>
          <BotaoBarra rotulo="Avançar 5 segundos (→)" onClick={() => pular(PULO_S)}>
            <RotateCw className="h-4 w-4" aria-hidden />
          </BotaoBarra>
          <span className="ml-1.5 text-xs tabular-nums text-white/85">
            {relogio(tempo)} <span className="text-white/50">/ {relogio(duracao)}</span>
          </span>

          <span className="ml-auto flex items-center gap-0.5">
            <BotaoBarra rotulo="Velocidade" onClick={trocarVelocidade} largo>
              <span className="text-xs font-semibold tabular-nums">{velocidade === 0.5 ? '0,5x' : `${velocidade}x`}</span>
            </BotaoBarra>
            {extra}
            {baixarUrl && (
              <a
                href={baixarUrl}
                aria-label="Baixar vídeo"
                title="Baixar vídeo"
                className="flex h-8 w-8 items-center justify-center rounded-md text-white/90 transition-colors mouse:hover:bg-white/15 touch:h-10 touch:w-10"
              >
                <Download className="h-4 w-4" aria-hidden />
              </a>
            )}
            <BotaoBarra rotulo={cheia ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'} onClick={telaCheia}>
              {cheia ? <Minimize className="h-4 w-4" aria-hidden /> : <Maximize className="h-4 w-4" aria-hidden />}
            </BotaoBarra>
          </span>
        </div>
      </div>
    </div>
  );
}

function BotaoBarra({ rotulo, onClick, children, largo }: { rotulo: string; onClick: () => void; children: ReactNode; largo?: boolean }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
      className={cn(
        'flex h-8 items-center justify-center rounded-md text-white/90 transition-colors mouse:hover:bg-white/15 touch:h-10',
        largo ? 'min-w-10 px-1.5' : 'w-8 touch:w-10',
      )}
    >
      {children}
    </button>
  );
}

/** 75 → "1:15"; 3725 → "1:02:05". */
function relogio(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const t = Math.floor(s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const seg = String(t % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${seg}` : `${m}:${seg}`;
}
