import { CalendarDays, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { chaveHoje, deslocarDia } from '../utils/agrupar-por-dia';
import {
  ATALHOS_DIA,
  ATALHOS_HORA,
  PERIODO_MAX_DIAS,
  PERIODO_VAZIO,
  atalhoDiaAtual,
  atalhoHoraAtual,
  diasDoAtalho,
  horaMinValida,
  rotuloPeriodo,
  temPeriodo,
  type PeriodoEventos,
} from '../utils/periodo';

interface FiltroPeriodoProps {
  periodo: PeriodoEventos;
  onPeriodo: (p: PeriodoEventos) => void;
}

const paraData = (chave: string) => {
  const [a, m, d] = chave.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const paraChave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Botão "Período" da lista de eventos: atalhos de dia (Hoje, Ontem, 7 e 30 dias), calendário para escolher
 * um dia ou um intervalo, e faixa de hora (madrugada, manhã, tarde, noite ou de/até). Aplica na hora;
 * o botão mostra o resumo ("Ontem · Noite") e tem um X para limpar.
 */
export function FiltroPeriodo({ periodo, onPeriodo }: FiltroPeriodoProps) {
  const [aberto, setAberto] = useState(false);
  const hoje = chaveHoje();
  const ativo = temPeriodo(periodo);
  const atalhoDia = atalhoDiaAtual(periodo, hoje);
  const atalhoHora = atalhoHoraAtual(periodo);
  const personalizada = !atalhoHora;
  const [mostrarHoras, setMostrarHoras] = useState(personalizada);

  const intervalo: DateRange | undefined = periodo.de
    ? { from: paraData(periodo.de), to: periodo.ate ? paraData(periodo.ate) : paraData(periodo.de) }
    : undefined;

  const escolherDias = (r: DateRange | undefined) => {
    if (!r?.from) {
      onPeriodo({ ...periodo, de: null, ate: null });
      return;
    }
    const de = paraChave(r.from);
    let ate = r.to ? paraChave(r.to) : null;
    // a API aceita até 92 dias: corta o fim em vez de recusar
    if (ate && ate > deslocarDia(de, PERIODO_MAX_DIAS - 1)) ate = deslocarDia(de, PERIODO_MAX_DIAS - 1);
    onPeriodo({ ...periodo, de, ate: ate === de ? null : ate });
  };

  const trocarHora = (campo: 'horaDe' | 'horaAte', valor: string) => {
    onPeriodo({ ...periodo, [campo]: valor && horaMinValida(valor) ? valor : null });
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <div
        className={cn(
          'inline-flex h-8 items-center rounded-full border text-xs font-semibold transition-colors touch:h-9',
          ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground/80',
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={ativo ? `Período: ${rotuloPeriodo(periodo, hoje)}. Trocar` : 'Filtrar por período'}
            className={cn('inline-flex h-full items-center gap-1.5 rounded-full pl-3', ativo ? 'pr-1.5' : 'pr-3 mouse:hover:bg-muted')}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            <span className="max-w-[180px] truncate">{rotuloPeriodo(periodo, hoje)}</span>
          </button>
        </PopoverTrigger>
        {ativo && (
          <button
            type="button"
            aria-label="Limpar período"
            onClick={() => onPeriodo(PERIODO_VAZIO)}
            className="mr-1 flex h-6 w-6 items-center justify-center rounded-full opacity-80 mouse:hover:bg-background/20 mouse:hover:opacity-100 touch:h-7 touch:w-7"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      <PopoverContent align="start" className="w-[min(340px,calc(100vw-2rem))] p-0">
        <div className="flex flex-col gap-3 p-3">
          <Secao titulo="Dia">
            <div className="flex flex-wrap gap-1.5">
              {ATALHOS_DIA.map((a) => (
                <Pilula
                  key={a.valor}
                  ativo={atalhoDia === a.valor}
                  onClick={() => onPeriodo({ ...periodo, ...diasDoAtalho(a.valor, hoje) })}
                >
                  {a.rotulo}
                </Pilula>
              ))}
            </div>
            <DayPicker
              mode="range"
              locale={ptBR}
              selected={intervalo}
              onSelect={escolherDias}
              defaultMonth={intervalo?.from ?? paraData(hoje)}
              disabled={{ after: paraData(hoje) }}
              endMonth={paraData(hoje)}
              showOutsideDays
              className="mt-1"
              classNames={{
                months: 'relative',
                month_caption: 'flex h-8 items-center justify-center text-sm font-semibold capitalize',
                nav: 'absolute inset-x-0 top-0 flex h-8 items-center justify-between',
                button_previous:
                  'flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 mouse:hover:bg-muted disabled:opacity-30',
                button_next:
                  'flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 mouse:hover:bg-muted disabled:opacity-30',
                chevron: 'h-4 w-4 fill-current',
                month_grid: 'mt-1 w-full border-collapse',
                weekdays: 'flex',
                weekday: 'flex-1 pb-1 text-center text-[11px] font-medium uppercase text-muted-foreground',
                week: 'mt-0.5 flex',
                day: 'flex-1 p-0 text-center text-[13px]',
                day_button:
                  'mx-auto flex h-9 w-full items-center justify-center rounded-md tabular-nums transition-colors mouse:hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                today: 'font-bold text-nexon-verde',
                outside: 'text-muted-foreground/40',
                disabled: 'pointer-events-none text-muted-foreground/30',
                selected: '[&>button]:bg-foreground/10',
                range_start: '[&>button]:!bg-foreground [&>button]:!text-background',
                range_end: '[&>button]:!bg-foreground [&>button]:!text-background',
                range_middle: '[&>button]:!rounded-none [&>button]:!bg-foreground/10',
              }}
            />
          </Secao>

          <Secao titulo="Hora">
            <div className="flex flex-wrap gap-1.5">
              {ATALHOS_HORA.map((a) => (
                <Pilula
                  key={a.valor}
                  ativo={!mostrarHoras && atalhoHora === a.valor}
                  onClick={() => {
                    setMostrarHoras(false);
                    onPeriodo({ ...periodo, horaDe: a.de, horaAte: a.ate });
                  }}
                  dica={a.de ? `${a.de.slice(0, 2)}h às ${a.ate!.slice(0, 2)}h` : undefined}
                >
                  {a.rotulo}
                </Pilula>
              ))}
              <Pilula ativo={mostrarHoras || (personalizada && temHora(periodo))} onClick={() => setMostrarHoras(true)}>
                Escolher
              </Pilula>
            </div>
            {(mostrarHoras || (personalizada && temHora(periodo))) && (
              <div className="flex items-center gap-2 pt-1">
                <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                  De
                  <input
                    type="time"
                    value={periodo.horaDe ?? ''}
                    onChange={(e) => trocarHora('horaDe', e.target.value)}
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm tabular-nums text-foreground"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                  Até
                  <input
                    type="time"
                    value={periodo.horaAte ?? ''}
                    onChange={(e) => trocarHora('horaAte', e.target.value)}
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm tabular-nums text-foreground"
                  />
                </label>
              </div>
            )}
            {periodo.horaDe && periodo.horaAte && periodo.horaAte <= periodo.horaDe && (
              <p className="text-[11px] text-muted-foreground">Passa da meia-noite: vai até {periodo.horaAte} do dia seguinte.</p>
            )}
          </Secao>
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <button
            type="button"
            disabled={!ativo}
            onClick={() => {
              setMostrarHoras(false);
              onPeriodo(PERIODO_VAZIO);
            }}
            className="h-8 rounded-md px-2 text-xs font-medium text-muted-foreground mouse:hover:text-foreground disabled:opacity-40 touch:h-10"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="h-8 rounded-md bg-foreground px-3 text-xs font-semibold text-background touch:h-10"
          >
            Pronto
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const temHora = (p: PeriodoEventos) => !!(p.horaDe || p.horaAte);

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function Pilula({ ativo, onClick, children, dica }: { ativo: boolean; onClick: () => void; children: ReactNode; dica?: string }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      title={dica}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors touch:h-9',
        ativo ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground/80 mouse:hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
