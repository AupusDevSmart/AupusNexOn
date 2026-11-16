import { ChevronLeft, ChevronRight, HardDrive, History, Loader2, RefreshCw, VideoOff } from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTrechoHistorico, type FaseTrecho } from '../hooks/useTrechoHistorico';
import type { Camera, CameraEvento, TipoEvento } from '../types';
import { rotuloDia } from '../utils/agrupar-por-dia';
import { rotuloTipo } from '../utils/eventos';
import { paraBaixar } from '../utils/midia';
import { PlayerVideo } from './PlayerVideo';
import {
  TRECHO_S,
  deslocarTrecho,
  faixaGravada,
  foraDaGravacao,
  horaDeSegundos,
  inicioDoTrecho,
  instante,
  marcadoresDoDia,
  pctDoDia,
  rotuloTrecho,
  segundosDeHora,
  segundosDoToque,
  textoDisco,
} from '../utils/historico';

/** Cor da marca do evento na barra (mesma família de cores das etiquetas da lista). */
const COR_MARCA: Record<TipoEvento, string> = {
  pessoa: 'bg-red-500',
  veiculo: 'bg-amber-500',
  animal: 'bg-sky-500',
  movimento: 'bg-foreground/50',
  sem_sinal: 'bg-zinc-500',
  sinal_restabelecido: 'bg-nexon-verde',
  foto: 'bg-foreground/40',
};

const MARCAS_HORA = [0, 6, 12, 18, 24];

interface HistoricoCameraProps {
  camera: Camera;
  /** Eventos da câmera no dia escolhido (viram marcas na barra). */
  eventos: readonly CameraEvento[];
  dias: string[];
  dia: string;
  /** Início do trecho (`HH:MM:SS`, Brasília); null = nada escolhido ainda. */
  hora: string | null;
  onDia: (dia: string) => void;
  /** Vai para outro trecho (pode trocar o dia, ao atravessar a meia-noite). */
  onTrecho: (dia: string, hora: string) => void;
  urlMidia: (caminho: string | null | undefined) => string | null;
  agora?: Date;
}

/**
 * Histórico gravado no aparelho (NEXON-108): o vídeo do trecho de 60 s no lugar do ao vivo,
 * o dia (últimos 7, cortados pelo que o aparelho tem), a linha do tempo de 24 h com as
 * marcas dos eventos e a faixa gravada, e o uso do disco. O vídeo vem do aparelho por
 * comando (ADR 0004: nada da usina fica exposto na internet).
 */
export function HistoricoCamera({ camera, eventos, dias, dia, hora, onDia, onTrecho, urlMidia, agora = new Date() }: HistoricoCameraProps) {
  const g = camera.gravacao;
  const inicio = hora ? instante(dia, hora) : null;
  const semGravacaoLocal = !!inicio && foraDaGravacao(g, inicio, TRECHO_S, agora);
  const trecho = useTrechoHistorico(camera.id, inicio && !semGravacaoLocal ? inicio.toISOString() : null);
  const fase: FaseTrecho = semGravacaoLocal ? 'sem_gravacao' : trecho.fase;

  const anterior = hora ? deslocarTrecho(dia, hora, -TRECHO_S) : null;
  const seguinte = hora ? deslocarTrecho(dia, hora, TRECHO_S) : null;
  const seguinteNoFuturo = !!seguinte && instante(seguinte.dia, seguinte.hora).getTime() > agora.getTime();

  return (
    <>
      <div className="relative aspect-video w-full overflow-hidden bg-black lg:max-h-[calc(100dvh-30rem)] lg:min-h-[240px]">
        <TelaTrecho fase={fase} url={urlMidia(trecho.url)} mensagem={trecho.mensagem} onTentar={trecho.tentarDeNovo} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dia} onValueChange={onDia}>
            <SelectTrigger aria-label="Dia do histórico" className="h-9 w-[128px] touch:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dias.map((d) => (
                <SelectItem key={d} value={d}>
                  {rotuloDia(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-1">
            <BotaoTrecho rotulo={`${TRECHO_S} s antes`} icone="anterior" desabilitado={!anterior} onClick={() => anterior && onTrecho(anterior.dia, anterior.hora)} />
            <span className="min-w-[7rem] text-center text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
              {hora ? rotuloTrecho(hora) : 'Escolha um horário'}
            </span>
            <BotaoTrecho
              rotulo={`${TRECHO_S} s depois`}
              icone="seguinte"
              desabilitado={!seguinte || seguinteNoFuturo}
              onClick={() => seguinte && onTrecho(seguinte.dia, seguinte.hora)}
            />
          </div>
        </div>

        <LinhaDoTempo
          dia={dia}
          hora={hora}
          eventos={eventos}
          cameraId={camera.id}
          gravacao={g}
          onPonto={(s) => onTrecho(dia, horaDeSegundos(inicioDoTrecho(s)))}
          onPasso={(delta) => {
            const alvo = delta < 0 ? anterior : seguinte;
            if (alvo && !(delta > 0 && seguinteNoFuturo)) onTrecho(alvo.dia, alvo.hora);
          }}
        />

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HardDrive className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{textoDisco(g)}</span>
        </p>
      </div>
    </>
  );
}

function TelaTrecho({ fase, url, mensagem, onTentar }: { fase: FaseTrecho; url: string | null; mensagem: string | null; onTentar: () => void }) {
  if (fase === 'pronto' && url) {
    return <PlayerVideo key={url} src={url} baixarUrl={paraBaixar(url)} rotulo="Trecho gravado" />;
  }
  const centro = 'flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[13px] text-white/70';
  if (fase === 'buscando') {
    return (
      <div role="status" className={centro}>
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        Buscando no aparelho…
      </div>
    );
  }
  if (fase === 'offline') {
    return (
      <div role="status" className={centro}>
        <VideoOff className="h-6 w-6" aria-hidden />
        Aparelho offline
        <span className="text-xs text-white/50">O histórico fica no aparelho da usina; ele precisa estar ligado à internet.</span>
      </div>
    );
  }
  if (fase === 'sem_gravacao') {
    return (
      <div role="status" className={centro}>
        <VideoOff className="h-6 w-6" aria-hidden />
        Sem gravação neste horário
      </div>
    );
  }
  if (fase === 'expirado' || fase === 'erro') {
    return (
      <div role="alert" className={centro}>
        <span>{mensagem ?? 'Não foi possível buscar o trecho'}</span>
        <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5 touch:h-10" onClick={onTentar}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Tentar de novo
        </Button>
      </div>
    );
  }
  return (
    <div className={centro}>
      <History className="h-6 w-6" aria-hidden />
      Toque na linha do tempo para ver um horário
    </div>
  );
}

function LinhaDoTempo({
  dia,
  hora,
  eventos,
  cameraId,
  gravacao,
  onPonto,
  onPasso,
}: {
  dia: string;
  hora: string | null;
  eventos: readonly CameraEvento[];
  cameraId: string;
  gravacao: Camera['gravacao'];
  onPonto: (segundos: number) => void;
  onPasso: (delta: number) => void;
}) {
  const marcas = marcadoresDoDia(eventos, dia, cameraId);
  const faixa = faixaGravada(gravacao, dia);
  const cursor = segundosDeHora(hora);

  const tocar = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onPonto(segundosDoToque(e.clientX - r.left, r.width));
  };
  const teclas = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onPasso(e.key === 'ArrowLeft' ? -1 : 1);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={tocar}
        onKeyDown={teclas}
        aria-label={`Linha do tempo de ${rotuloDia(dia)}: toque num horário para ver a gravação; setas andam ${TRECHO_S} s`}
        className="relative block h-10 w-full overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {faixa && (
          <span
            aria-hidden
            data-testid="faixa-gravada"
            className="absolute inset-y-0 bg-nexon-verde/25"
            style={{ left: `${faixa.inicioPct}%`, width: `${faixa.fimPct - faixa.inicioPct}%` }}
          />
        )}
        {MARCAS_HORA.slice(1, -1).map((h) => (
          <span key={h} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        {marcas.map((m) => (
          <span
            key={m.id}
            aria-hidden
            data-testid="marca-evento"
            title={rotuloTipo(m.tipo)}
            className={cn('absolute bottom-1 top-1 w-[3px] -translate-x-1/2 rounded-full', COR_MARCA[m.tipo] ?? COR_MARCA.movimento)}
            style={{ left: `${m.pct}%` }}
          />
        ))}
        {cursor !== null && (
          <span
            aria-hidden
            data-testid="cursor-trecho"
            className="absolute inset-y-0 bg-foreground/80"
            style={{ left: `${pctDoDia(cursor)}%`, width: `max(2px, ${pctDoDia(TRECHO_S)}%)` }}
          />
        )}
      </button>
      <div aria-hidden className="relative mt-1 h-3 text-[10px] tabular-nums text-muted-foreground">
        {MARCAS_HORA.map((h) => (
          <span
            key={h}
            className={cn('absolute', h === 0 ? 'left-0' : h === 24 ? 'right-0' : '-translate-x-1/2')}
            style={h === 0 || h === 24 ? undefined : { left: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, '0')}h
          </span>
        ))}
      </div>
    </div>
  );
}

function BotaoTrecho({ rotulo, icone, desabilitado, onClick }: { rotulo: string; icone: 'anterior' | 'seguinte'; desabilitado?: boolean; onClick: () => void }) {
  const Icone = icone === 'anterior' ? ChevronLeft : ChevronRight;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          disabled={desabilitado}
          onClick={onClick}
          className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 transition-colors disabled:opacity-40 mouse:hover:bg-muted touch:h-10 touch:w-10"
        >
          <Icone className="h-4 w-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{rotulo}</TooltipContent>
    </Tooltip>
  );
}
