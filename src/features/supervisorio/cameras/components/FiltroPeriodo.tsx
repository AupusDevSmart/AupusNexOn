import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Moon,
  MoonStar,
  SlidersHorizontal,
  Sun,
  Sunrise,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { useIsMobile } from '@/core/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
  faixaHoras,
  horaCurtaTexto,
  horaMinValida,
  passaMeiaNoite,
  resumoPeriodo,
  segmentosHora,
  temPeriodo,
  type AtalhoHora,
  type PeriodoEventos,
} from '../utils/periodo';

interface FiltroPeriodoProps {
  periodo: PeriodoEventos;
  onPeriodo: (p: PeriodoEventos) => void;
  /** Quantos eventos o filtro achou (botão "Ver 12 eventos"); `null` enquanto carrega. */
  resultado?: number | null;
}

// Tailwind 3 não aplica opacidade em cor `var(...)`: o tom claro do verde sai por color-mix.
const VERDE_FAIXA = 'bg-[color-mix(in_srgb,var(--nx-verde)_18%,transparent)]';
const VERDE_BORDA = 'border-[color-mix(in_srgb,var(--nx-verde)_55%,transparent)]';
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background';

const ICONE_HORA: Record<AtalhoHora, LucideIcon> = {
  qualquer: Clock3,
  madrugada: MoonStar,
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

const paraData = (chave: string) => {
  const [a, m, d] = chave.split('-').map(Number);
  return new Date(a, m - 1, d);
};
const paraChave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Opções de hora a cada 30 min (`8h`, `8h30`); inclui a hora da URL se for quebrada (ex. 08:45). */
function opcoesHora(atual: string | null): string[] {
  const lista: string[] = [];
  for (let m = 0; m < 1440; m += 30) lista.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  if (atual && !lista.includes(atual)) {
    lista.push(atual);
    lista.sort();
  }
  return lista;
}

/**
 * Filtro de período da lista de eventos. A barra mostra o resumo em texto de gente
 * ("Ontem · Noite, 18h–6h") e tem X para limpar. Abre um popover de duas colunas (dia | hora)
 * no desktop e uma folha de baixo no celular. Tudo aplica na hora; o rodapé fecha com
 * "Ver 12 eventos".
 */
export function FiltroPeriodo({ periodo, onPeriodo, resultado = null }: FiltroPeriodoProps) {
  const [aberto, setAberto] = useState(false);
  const celular = useIsMobile();
  const hoje = chaveHoje();
  const ativo = temPeriodo(periodo);
  const resumo = resumoPeriodo(periodo, hoje);

  const gatilho = (
    <button
      type="button"
      aria-label={`Filtrar por período: ${resumo}`}
      className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-[inherit] py-1.5 pl-1.5 text-left', ativo ? 'pr-1' : 'pr-2.5', FOCO)}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          ativo ? `${VERDE_FAIXA} text-nexon-verde` : 'bg-muted text-muted-foreground',
        )}
      >
        <CalendarDays className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-medium leading-tight text-muted-foreground">Período</span>
        <span className="truncate text-[13px] font-semibold leading-snug text-foreground">{resumo}</span>
      </span>
      {!ativo && <ChevronDown aria-hidden className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
  );

  const conteudo = (layout: 'lado' | 'coluna') => (
    <ConteudoPeriodo
      layout={layout}
      periodo={periodo}
      onPeriodo={onPeriodo}
      hoje={hoje}
      resumo={resumo}
      resultado={resultado}
      onFechar={() => setAberto(false)}
    />
  );

  return (
    <div
      className={cn(
        'flex min-h-11 items-center rounded-lg border bg-card transition-colors touch:min-h-12',
        ativo ? VERDE_BORDA : 'border-border mouse:hover:border-muted-foreground',
      )}
    >
      {celular ? (
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetTrigger asChild>{gatilho}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl p-0 [&>button:first-child]:hidden"
          >
            {conteudo('coluna')}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
          <PopoverContent
            align="end"
            collisionPadding={16}
            className="flex max-h-[min(640px,var(--radix-popover-content-available-height))] w-[600px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl p-0"
          >
            {conteudo('lado')}
          </PopoverContent>
        </Popover>
      )}
      {ativo && (
        <button
          type="button"
          aria-label="Limpar período"
          onClick={() => onPeriodo(PERIODO_VAZIO)}
          className={cn(
            'mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground mouse:hover:bg-muted mouse:hover:text-foreground touch:h-10 touch:w-10',
            FOCO,
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

interface ConteudoProps {
  layout: 'lado' | 'coluna';
  periodo: PeriodoEventos;
  onPeriodo: (p: PeriodoEventos) => void;
  hoje: string;
  resumo: string;
  resultado: number | null;
  onFechar: () => void;
}

function ConteudoPeriodo({ layout, periodo, onPeriodo, hoje, resumo, resultado, onFechar }: ConteudoProps) {
  /** Primeiro dia clicado esperando o segundo (intervalo); `null` = próximo clique começa de novo. */
  const [ancora, setAncora] = useState<string | null>(null);
  const [cortado, setCortado] = useState(false);
  const atalhoDia = atalhoDiaAtual(periodo, hoje);
  const atalhoHora = atalhoHoraAtual(periodo);
  const temHora = !!(periodo.horaDe || periodo.horaAte);
  const [escolhendo, setEscolhendo] = useState(temHora && !atalhoHora);
  const personalizada = escolhendo || (temHora && !atalhoHora);
  const ativo = temPeriodo(periodo);
  const lado = layout === 'lado';

  const intervalo: DateRange | undefined = periodo.de
    ? { from: paraData(periodo.de), to: paraData(periodo.ate ?? periodo.de) }
    : undefined;

  const clicarDia = (data: Date) => {
    const dia = paraChave(data);
    setCortado(false);
    if (!ancora || dia === ancora) {
      // primeiro clique: já filtra o dia e espera o segundo para virar intervalo
      setAncora(dia === ancora ? null : dia);
      onPeriodo({ ...periodo, de: dia, ate: null });
      return;
    }
    const de = dia < ancora ? dia : ancora;
    let ate = dia < ancora ? ancora : dia;
    const limite = deslocarDia(de, PERIODO_MAX_DIAS - 1);
    if (ate > limite) {
      // a API aceita até 92 dias: corta o fim em vez de recusar
      ate = limite;
      setCortado(true);
    }
    setAncora(null);
    onPeriodo({ ...periodo, de, ate });
  };

  const trocarHora = (campo: 'horaDe' | 'horaAte', valor: string) => {
    onPeriodo({ ...periodo, [campo]: valor && horaMinValida(valor) ? valor : null });
  };

  const limpar = () => {
    setAncora(null);
    setCortado(false);
    setEscolhendo(false);
    onPeriodo(PERIODO_VAZIO);
  };

  const dicaCalendario = cortado
    ? `Até ${PERIODO_MAX_DIAS} dias por vez: o fim foi ajustado.`
    : ancora
      ? 'Agora escolha o último dia.'
      : 'Escolha um dia, ou dois para um intervalo.';

  const secaoDia = (
    <Secao titulo="Dia" className={lado ? 'w-[312px] p-4 touch:w-[340px]' : 'px-4 pb-4'}>
      <div role="group" aria-label="Atalhos de dia" className="flex flex-wrap gap-1.5">
        {ATALHOS_DIA.map((a) => (
          <Pilula
            key={a.valor}
            ativo={atalhoDia === a.valor}
            onClick={() => {
              setAncora(null);
              setCortado(false);
              onPeriodo({ ...periodo, ...diasDoAtalho(a.valor, hoje) });
            }}
          >
            {a.rotulo}
          </Pilula>
        ))}
      </div>
      <DayPicker
        mode="range"
        locale={ptBR}
        selected={intervalo}
        onSelect={(_r, dia) => clicarDia(dia)}
        defaultMonth={intervalo?.to ?? paraData(hoje)}
        disabled={{ after: paraData(hoje) }}
        endMonth={paraData(hoje)}
        className="mt-2"
        classNames={CLASSES_CALENDARIO}
      />
      <p aria-live="polite" className={cn('text-center text-[11px]', cortado ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
        {dicaCalendario}
      </p>
    </Secao>
  );

  const secaoHora = (
    <Secao titulo="Hora" className={lado ? 'p-4' : 'border-t border-border p-4'}>
      <div role="group" aria-label="Faixa de hora" className={cn('grid gap-1.5', lado ? 'grid-cols-2' : 'grid-cols-3')}>
        {ATALHOS_HORA.map((a) => {
          const Icone = ICONE_HORA[a.valor];
          return (
            <Bloco
              key={a.valor}
              ativo={!personalizada && atalhoHora === a.valor}
              icone={Icone}
              titulo={a.rotulo}
              detalhe={a.de && a.ate ? faixaHoras(a.de, a.ate) : 'O dia todo'}
              onClick={() => {
                setEscolhendo(false);
                onPeriodo({ ...periodo, horaDe: a.de, horaAte: a.ate });
              }}
            />
          );
        })}
        <Bloco
          ativo={personalizada}
          icone={SlidersHorizontal}
          titulo="Escolher"
          detalhe={
            temHora && !atalhoHora
              ? `${horaCurtaTexto(periodo.horaDe ?? '00:00')}–${periodo.horaAte ? horaCurtaTexto(periodo.horaAte) : '24h'}`
              : 'De … até'
          }
          onClick={() => setEscolhendo(true)}
        />
      </div>

      <ReguaHoras periodo={periodo} />

      {personalizada && <HorasPersonalizadas periodo={periodo} onTrocar={trocarHora} />}

      {passaMeiaNoite(periodo) && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs leading-snug text-foreground">
          <Moon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {periodo.horaDe === periodo.horaAte
            ? 'Início e fim iguais: pega as 24 horas.'
            : `Passa da meia-noite: das ${horaCurtaTexto(periodo.horaDe!)} de cada dia até ${horaCurtaTexto(periodo.horaAte!)} do dia seguinte.`}
        </p>
      )}
    </Secao>
  );

  const rotuloPronto = resultado && resultado > 0 ? `Ver ${resultado} evento${resultado > 1 ? 's' : ''}` : 'Pronto';

  return (
    <>
      <header className={cn('flex shrink-0 items-start gap-3 border-b border-border px-4', lado ? 'py-3' : 'pb-3 pt-2')}>
        <div className="min-w-0 flex-1">
          {!lado && <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-border" />}
          {lado ? (
            <p className="text-[11px] font-medium text-muted-foreground">Mostrando</p>
          ) : (
            <SheetTitle className="text-base">Período</SheetTitle>
          )}
          {lado ? (
            <p aria-live="polite" className="truncate text-sm font-semibold">
              {resumo}
            </p>
          ) : (
            <SheetDescription aria-live="polite" className="truncate text-[13px] font-medium text-foreground">
              {resumo}
            </SheetDescription>
          )}
        </div>
        {!lado && (
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className={cn('mt-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground', FOCO)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </header>

      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', lado ? 'grid grid-cols-[auto_minmax(0,1fr)] divide-x divide-border' : 'pt-3')}>
        {secaoDia}
        {secaoHora}
      </div>

      <footer
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-t border-border px-4',
          lado ? 'py-3' : 'pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
      >
        <button
          type="button"
          disabled={!ativo}
          onClick={limpar}
          className={cn(
            'h-9 rounded-md px-3 text-[13px] font-medium text-muted-foreground mouse:hover:bg-muted mouse:hover:text-foreground disabled:pointer-events-none disabled:opacity-40 touch:h-11',
            FOCO,
          )}
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={onFechar}
          className={cn(
            'h-9 rounded-md bg-foreground px-4 text-[13px] font-semibold text-background tabular-nums mouse:hover:opacity-90 touch:h-11',
            !lado && 'flex-1',
            FOCO,
          )}
        >
          {rotuloPronto}
        </button>
      </footer>
    </>
  );
}

const CLASSES_CALENDARIO = {
  root: 'mx-auto w-fit',
  months: 'relative',
  month_caption: 'flex h-9 items-center justify-center',
  caption_label: 'text-sm font-semibold capitalize',
  nav: 'absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between',
  button_previous: `flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground mouse:hover:bg-muted mouse:hover:text-foreground disabled:pointer-events-none disabled:opacity-30 touch:h-10 touch:w-10 ${FOCO}`,
  button_next: `flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground mouse:hover:bg-muted mouse:hover:text-foreground disabled:pointer-events-none disabled:opacity-30 touch:h-10 touch:w-10 ${FOCO}`,
  chevron: 'h-4 w-4 fill-current',
  month_grid: 'mt-2 border-collapse',
  weekdays: 'flex',
  weekday: 'w-10 pb-1.5 text-center text-[11px] font-medium capitalize text-muted-foreground touch:w-11',
  week: 'mt-0.5 flex',
  // a célula pinta a faixa do intervalo; o botão redondo fica por cima (início e fim cheios)
  day: 'h-10 w-10 p-0 text-center text-[13px] touch:h-11 touch:w-11',
  day_button: `relative flex h-full w-full items-center justify-center rounded-full font-medium tabular-nums text-foreground transition-colors mouse:hover:bg-muted ${FOCO}`,
  today:
    "[&>button]:font-bold [&>button]:text-nexon-verde [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:h-1 [&>button]:after:w-1 [&>button]:after:rounded-full [&>button]:after:bg-nexon-verde [&>button]:after:content-['']",
  outside: 'invisible',
  hidden: 'invisible',
  disabled: '[&>button]:pointer-events-none [&>button]:font-normal [&>button]:text-muted-foreground [&>button]:opacity-40',
  selected: VERDE_FAIXA,
  range_start:
    'rounded-l-full [&>button]:!bg-nexon-verde [&>button]:!text-neutral-950 [&>button]:font-semibold [&>button]:after:!bg-neutral-950',
  range_end:
    'rounded-r-full [&>button]:!bg-nexon-verde [&>button]:!text-neutral-950 [&>button]:font-semibold [&>button]:after:!bg-neutral-950',
  range_middle: 'first:rounded-l-lg last:rounded-r-lg',
};

/** Régua de 0h a 24h com o trecho escolhido em verde (dois trechos quando vira a noite). */
function ReguaHoras({ periodo }: { periodo: PeriodoEventos }) {
  const segs = segmentosHora(periodo);
  const dia = segs.length === 0;
  return (
    <div aria-hidden className="pt-1">
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        {(dia ? [[0, 1440] as [number, number]] : segs).map(([a, b]) => (
          <span
            key={a}
            className={cn('absolute inset-y-0', dia ? VERDE_FAIXA : 'bg-nexon-verde')}
            style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>24h</span>
      </div>
    </div>
  );
}

function HorasPersonalizadas({
  periodo,
  onTrocar,
}: {
  periodo: PeriodoEventos;
  onTrocar: (campo: 'horaDe' | 'horaAte', valor: string) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <SeletorHora rotulo="De" valor={periodo.horaDe} onTrocar={(v) => onTrocar('horaDe', v)} />
      <span aria-hidden className="pb-2.5 text-muted-foreground touch:pb-3">
        →
      </span>
      <SeletorHora rotulo="Até" valor={periodo.horaAte} onTrocar={(v) => onTrocar('horaAte', v)} />
    </div>
  );
}

function SeletorHora({ rotulo, valor, onTrocar }: { rotulo: string; valor: string | null; onTrocar: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
        {rotulo}
      </label>
      <div className="relative">
        <select
          id={id}
          value={valor ?? ''}
          onChange={(e) => onTrocar(e.target.value)}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border border-border bg-background pl-3 pr-8 text-sm font-medium tabular-nums text-foreground touch:h-11',
            FOCO,
          )}
        >
          <option value="">Qualquer</option>
          {opcoesHora(valor).map((h) => (
            <option key={h} value={h}>
              {horaCurtaTexto(h)}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function Secao({ titulo, className, children }: { titulo: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function Pilula({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors touch:h-10',
        ativo ? `${VERDE_BORDA} ${VERDE_FAIXA} text-foreground` : 'border-border text-foreground mouse:hover:bg-muted',
        FOCO,
      )}
    >
      {children}
    </button>
  );
}

function Bloco({
  ativo,
  icone: Icone,
  titulo,
  detalhe,
  onClick,
}: {
  ativo: boolean;
  icone: LucideIcon;
  titulo: string;
  detalhe: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'flex min-h-12 min-w-0 flex-col items-start justify-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors touch:min-h-14',
        ativo ? `${VERDE_BORDA} ${VERDE_FAIXA}` : 'border-border mouse:hover:bg-muted',
        FOCO,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icone aria-hidden className={cn('h-3.5 w-3.5 shrink-0', ativo ? 'text-nexon-verde' : 'text-muted-foreground')} />
        {titulo}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground">{detalhe}</span>
    </button>
  );
}
