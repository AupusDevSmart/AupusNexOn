import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { OPCOES_ANTES, OPCOES_DEPOIS } from '../../utils/clipe';

interface ClipeEventoProps {
  ativo: boolean;
  antes: number;
  depois: number;
  desabilitado?: boolean;
  onAtivo: (v: boolean) => void;
  onAntes: (s: number) => void;
  onDepois: (s: number) => void;
}

/**
 * "Vídeo do evento": liga/desliga o clipe e escolhe quantos segundos antes e depois do movimento ele grava.
 * A barra mostra a proporção (antes | momento do evento | depois) e o total, para quem configura entender
 * na hora o que vai ver no clipe. O "depois" estica sozinho enquanto o movimento continuar.
 */
export function ClipeEvento({ ativo, antes, depois, desabilitado, onAtivo, onAntes, onDepois }: ClipeEventoProps) {
  const total = antes + depois;
  const desligado = desabilitado || !ativo;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Guardar vídeo de cada evento
          <span className="block text-[11px] text-muted-foreground">Desligado, o evento chega só com a foto.</span>
        </span>
        <Switch checked={ativo} disabled={desabilitado} onCheckedChange={onAtivo} aria-label="Guardar vídeo de cada evento" />
      </label>

      <div className={cn('flex flex-col gap-3 transition-opacity', desligado && 'pointer-events-none opacity-40')} aria-disabled={desligado}>
        <BarraClipe antes={antes} depois={depois} />

        <Escolha
          rotulo="Antes do movimento"
          dica="Mostra quem chegou e de onde veio."
          opcoes={OPCOES_ANTES}
          valor={antes}
          onValor={onAntes}
          desabilitado={desligado}
        />
        <Escolha
          rotulo="Depois do movimento"
          dica="Continua gravando enquanto houver movimento."
          opcoes={OPCOES_DEPOIS}
          valor={depois}
          onValor={onDepois}
          desabilitado={desligado}
        />
        <p className="text-[11px] text-muted-foreground">
          Clipe de cerca de <strong className="font-semibold text-foreground">{total} s</strong>
          {total > 45 ? ' · clipes longos ocupam mais espaço e demoram mais para chegar.' : '.'}
        </p>
      </div>
    </div>
  );
}

/** Linha do tempo do clipe: trecho antes, marcador do evento e trecho depois, proporcionais. */
function BarraClipe({ antes, depois }: { antes: number; depois: number }) {
  const total = Math.max(1, antes + depois);
  const pctAntes = (antes / total) * 100;
  return (
    <div aria-hidden className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted p-3">
      <div className="relative flex h-2.5 overflow-hidden rounded-full bg-background">
        <div className="h-full bg-muted-foreground transition-[width] duration-300" style={{ width: `${pctAntes}%` }} />
        <div className="h-full flex-1 bg-nexon-verde transition-[width] duration-300" />
      </div>
      <div className="relative h-4 text-[11px] tabular-nums text-muted-foreground">
        <span className="absolute left-0">{antes > 0 ? `−${antes} s` : 'início'}</span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap font-semibold text-foreground"
          style={{ left: `clamp(1.5rem, ${pctAntes}%, calc(100% - 1.5rem))` }}
        >
          movimento
        </span>
        <span className="absolute right-0">+{depois} s</span>
      </div>
    </div>
  );
}

function Escolha({
  rotulo,
  dica,
  opcoes,
  valor,
  onValor,
  desabilitado,
}: {
  rotulo: string;
  dica: string;
  opcoes: readonly number[];
  valor: number;
  onValor: (s: number) => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{rotulo}</span>
        <span className="text-[11px] text-muted-foreground">{dica}</span>
      </div>
      <div role="radiogroup" aria-label={rotulo} className="flex gap-1 rounded-lg bg-muted p-1">
        {opcoes.map((s) => {
          const ativo = valor === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-label={s === 0 ? 'Nada antes' : `${s} segundos`}
              disabled={desabilitado}
              onClick={() => onValor(s)}
              className={cn(
                'h-8 min-w-0 flex-1 rounded-md text-xs font-semibold tabular-nums transition-colors touch:h-10',
                ativo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground mouse:hover:text-foreground',
              )}
            >
              {s === 0 ? '0' : `${s}s`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
