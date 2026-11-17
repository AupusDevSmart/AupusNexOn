import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Moon,
  MoonStar,
  Sun,
  Sunrise,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { useIsMobile } from '@/core/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ChipFiltro } from './ChipFiltro';
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  FOCO,
  ITEM_ATIVO,
  ITEM_INATIVO,
  VERDE_FUNDO,
  VERDE_FUNDO_LEVE,
  VERDE_TEXTO,
} from './estilo-filtro';
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
  interpretarHora,
} from '../utils/periodo';

interface FiltroPeriodoProps {
  periodo: PeriodoEventos;
  onPeriodo: (p: PeriodoEventos) => void;
  /** Quantos eventos o filtro achou (botão "Ver 12 eventos"); `null` enquanto carrega. */
  resultado?: number | null;
  /**
   * Pílula de uma linha (40 px, 44 no toque) para a linha de filtros dos eventos
   * (NEXON-108). Sem ele, o bloco alto com "Período" em cima do resumo.
   */
  compacto?: boolean;
  className?: string;
}

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

/**
 * Filtro de período da lista de eventos. A barra mostra o resumo em texto de gente
 * ("Ontem · Noite, 18h–6h") e tem X para limpar. Abre um popover de duas colunas (dia | hora)
 * no desktop e uma folha de baixo no celular. Tudo aplica na hora; o rodapé fecha com
 * "Ver 12 eventos".
 */
export function FiltroPeriodo({ periodo, onPeriodo, resultado = null, compacto = false, className }: FiltroPeriodoProps) {
  const [aberto, setAberto] = useState(false);
  const celular = useIsMobile();
  const hoje = chaveHoje();
  const ativo = temPeriodo(periodo);
  const resumo = resumoPeriodo(periodo, hoje);

  const gatilho = compacto ? (
    <button
      type="button"
      aria-label={`Filtrar por período: ${resumo}`}
      className={cn('flex h-full min-w-0 flex-1 items-center gap-2 rounded-[inherit] pl-3 text-left text-sm font-medium', ativo ? 'pr-1' : 'pr-2.5', FOCO)}
    >
      <CalendarDays aria-hidden className={cn('h-[18px] w-[18px] shrink-0', ativo ? VERDE_TEXTO : 'text-muted-foreground')} />
      <span className="min-w-0 flex-1 truncate text-foreground">{resumo}</span>
      {!ativo && <ChevronDown aria-hidden className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />}
    </button>
  ) : (
    <button
      type="button"
      aria-label={`Filtrar por período: ${resumo}`}
      className={cn('flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-[inherit] py-1.5 pl-2 text-left', ativo ? 'pr-1' : 'pr-3', FOCO)}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg touch:h-10 touch:w-10',
          ativo ? `${VERDE_FUNDO} ${VERDE_TEXTO}` : 'bg-muted text-muted-foreground',
        )}
      >
        <CalendarDays className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium leading-tight text-muted-foreground">Período</span>
        <span className="truncate text-[15px] font-semibold leading-snug text-foreground">{resumo}</span>
      </span>
      {!ativo && <ChevronDown aria-hidden className="ml-auto h-5 w-5 shrink-0 text-muted-foreground" />}
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
        'flex items-center border transition-colors',
        compacto ? 'h-10 min-w-0 rounded-full touch:h-11' : 'min-h-12 rounded-xl touch:min-h-14',
        ativo ? (compacto ? ITEM_ATIVO : `border-nexon-verde ${VERDE_FUNDO_LEVE}`) : ITEM_INATIVO,
        className,
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
            className="flex max-h-[min(720px,var(--radix-popover-content-available-height))] w-[680px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border-border bg-card p-0 shadow-xl"
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
            'flex shrink-0 items-center justify-center text-muted-foreground transition-colors mouse:hover:bg-muted mouse:hover:text-foreground',
            compacto ? 'h-full w-10 rounded-full touch:w-11' : 'mr-1.5 h-10 w-10 rounded-lg touch:h-11 touch:w-11',
            FOCO,
          )}
        >
          <X className="h-5 w-5" aria-hidden />
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
  const personalizada = temHora && !atalhoHora;
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
    onPeriodo(PERIODO_VAZIO);
  };

  const dicaCalendario = cortado
    ? `Até ${PERIODO_MAX_DIAS} dias por vez: o fim foi ajustado.`
    : ancora
      ? 'Agora escolha o último dia.'
      : 'Escolha um dia, ou dois para um intervalo.';

  const secaoDia = (
    <Secao titulo="Dia" className={lado ? 'w-[348px] p-5' : 'px-4 pb-5'}>
      <div role="group" aria-label="Atalhos de dia" className="flex flex-wrap gap-2">
        {ATALHOS_DIA.map((a) => (
          <ChipFiltro
            key={a.valor}
            ativo={atalhoDia === a.valor}
            onClick={() => {
              setAncora(null);
              setCortado(false);
              onPeriodo({ ...periodo, ...diasDoAtalho(a.valor, hoje) });
            }}
          >
            {a.rotulo}
          </ChipFiltro>
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
        className="mt-1"
        classNames={CLASSES_CALENDARIO}
      />
      <p aria-live="polite" className={cn('text-center text-[13px]', cortado ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
        {dicaCalendario}
      </p>
    </Secao>
  );

  const secaoHora = (
    <Secao titulo="Hora" className={lado ? 'p-5' : 'border-t border-border px-4 py-5'}>
      <div role="group" aria-label="Faixa de hora" className="grid grid-cols-2 gap-2">
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
                            onPeriodo({ ...periodo, horaDe: a.de, horaAte: a.ate });
              }}
            />
          );
        })}
      </div>

      <ReguaHoras periodo={periodo} />

      <HorasPersonalizadas periodo={periodo} onTrocar={trocarHora} />

      {passaMeiaNoite(periodo) && (
        <p className="flex items-start gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-[13px] leading-snug text-foreground">
          <Moon className={cn('mt-px h-[18px] w-[18px] shrink-0', VERDE_TEXTO)} aria-hidden />
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
      <header className={cn('flex shrink-0 items-start gap-3 border-b border-border', lado ? 'px-5 py-4' : 'px-4 pb-4 pt-2')}>
        <div className="min-w-0 flex-1">
          {!lado && <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-border" />}
          {lado ? (
            <p className="text-xs font-medium text-muted-foreground">Mostrando</p>
          ) : (
            <SheetTitle className="text-lg font-semibold">Período</SheetTitle>
          )}
          {lado ? (
            <p aria-live="polite" className="truncate text-base font-semibold">
              {resumo}
            </p>
          ) : (
            <SheetDescription aria-live="polite" className="truncate text-[15px] font-medium text-foreground">
              {resumo}
            </SheetDescription>
          )}
        </div>
        {!lado && (
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className={cn('mt-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground', FOCO)}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </header>

      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', lado ? 'grid grid-cols-[auto_minmax(0,1fr)] divide-x divide-border' : 'pt-3')}>
        {secaoDia}
        {secaoHora}
      </div>

      <footer
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-t border-border',
          lado ? 'px-5 py-4' : 'px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
      >
        <button
          type="button"
          disabled={!ativo}
          onClick={limpar}
          className={cn(BOTAO_SECUNDARIO, 'h-10 px-4 text-sm touch:h-12')}
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={onFechar}
          className={cn(BOTAO_PRIMARIO, 'h-10 min-w-[120px] px-5 text-sm tabular-nums touch:h-12', !lado && 'flex-1')}
        >
          {rotuloPronto}
        </button>
      </footer>
    </>
  );
}

const NAV_CALENDARIO = `flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors mouse:hover:bg-muted mouse:hover:text-foreground disabled:pointer-events-none disabled:opacity-30 touch:h-11 touch:w-11 ${FOCO}`;
/** Início e fim do intervalo: verde cheio com texto azul da marca. */
const PONTA_INTERVALO =
  '[&>button]:!bg-nexon-verde [&>button]:!text-nexon-azul [&>button]:font-semibold [&>button]:after:!bg-nexon-azul';

const CLASSES_CALENDARIO = {
  root: 'mx-auto w-fit',
  months: 'relative',
  month_caption: 'flex h-10 items-center justify-center touch:h-11',
  caption_label: 'text-base font-semibold capitalize',
  nav: 'absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between touch:h-11',
  button_previous: NAV_CALENDARIO,
  button_next: NAV_CALENDARIO,
  chevron: 'h-5 w-5 fill-current',
  month_grid: 'mt-3 border-collapse',
  weekdays: 'flex',
  weekday: 'w-11 pb-2 text-center text-xs font-medium capitalize text-muted-foreground',
  week: 'mt-1 flex',
  // a célula pinta a faixa do intervalo; o botão redondo fica por cima (início e fim cheios)
  day: 'h-11 w-11 p-0 text-center text-sm',
  day_button: `relative flex h-full w-full items-center justify-center rounded-full font-medium tabular-nums text-foreground transition-colors mouse:hover:bg-muted ${FOCO}`,
  today:
    "[&>button]:font-bold [&>button]:text-nexon-link-claro dark:[&>button]:text-nexon-verde [&>button]:after:absolute [&>button]:after:bottom-1.5 [&>button]:after:h-1 [&>button]:after:w-1 [&>button]:after:rounded-full [&>button]:after:bg-current [&>button]:after:content-['']",
  outside: 'invisible',
  hidden: 'invisible',
  disabled: '[&>button]:pointer-events-none [&>button]:font-normal [&>button]:text-muted-foreground [&>button]:opacity-40',
  selected: VERDE_FUNDO,
  range_start: `rounded-l-full ${PONTA_INTERVALO}`,
  range_end: `rounded-r-full ${PONTA_INTERVALO}`,
  range_middle: 'first:rounded-l-lg last:rounded-r-lg',
};

/** Régua de 0h a 24h com o trecho escolhido em verde (dois trechos quando vira a noite). */
function ReguaHoras({ periodo }: { periodo: PeriodoEventos }) {
  const segs = segmentosHora(periodo);
  const dia = segs.length === 0;
  return (
    <div aria-hidden className="pt-1">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        {(dia ? [[0, 1440] as [number, number]] : segs).map(([a, b]) => (
          <span
            key={a}
            className={cn('absolute inset-y-0', dia ? VERDE_FUNDO : 'bg-nexon-verde')}
            style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground">
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
      <span aria-hidden className="pb-3 text-muted-foreground touch:pb-3.5">
        →
      </span>
      <SeletorHora rotulo="Até" valor={periodo.horaAte} onTrocar={(v) => onTrocar('horaAte', v)} />
    </div>
  );
}

/** Campo de hora digitável (HH:MM): aceita "18", "1830", "18:30"; confirma ao sair do campo ou com Enter. */
function SeletorHora({ rotulo, valor, onTrocar }: { rotulo: string; valor: string | null; onTrocar: (v: string) => void }) {
  const id = useId();
  const [texto, setTexto] = useState(valor ?? '');
  const [invalido, setInvalido] = useState(false);
  useEffect(() => {
    setTexto(valor ?? '');
    setInvalido(false);
  }, [valor]);

  const confirmar = () => {
    if (!texto.trim()) {
      setInvalido(false);
      if (valor) onTrocar('');
      return;
    }
    const h = interpretarHora(texto);
    if (!h) {
      setInvalido(true);
      return;
    }
    setInvalido(false);
    setTexto(h);
    if (h !== valor) onTrocar(h);
  };

  const digitar = (v: string) => {
    // máscara leve: 4 dígitos viram HH:MM enquanto digita
    const d = v.replace(/\D/g, '').slice(0, 4);
    setTexto(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : v.replace(/[^\d:]/g, '').slice(0, 5));
    setInvalido(false);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {rotulo}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh:mm"
        value={texto}
        aria-invalid={invalido || undefined}
        onChange={(e) => digitar(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmar();
          }
        }}
        className={cn(
          'h-11 w-full rounded-lg border bg-background px-3 text-[17px] font-semibold tabular-nums tracking-wide text-foreground placeholder:font-normal placeholder:text-muted-foreground transition-colors touch:h-12',
          invalido ? 'border-red-500' : 'border-border mouse:hover:border-[color-mix(in_srgb,var(--nx-verde)_50%,var(--border))]',
          FOCO,
        )}
      />
      {invalido && <span className="text-xs text-red-500">Hora inválida (ex.: 18:30)</span>}
    </div>
  );
}

function Secao({ titulo, className, children }: { titulo: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className={cn('flex min-w-0 flex-col gap-3', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {children}
    </section>
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
        'flex min-h-14 min-w-0 flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2 text-left transition-colors touch:min-h-16',
        ativo ? ITEM_ATIVO : ITEM_INATIVO,
        FOCO,
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
        <Icone aria-hidden className={cn('h-[18px] w-[18px] shrink-0', ativo ? VERDE_TEXTO : 'text-muted-foreground')} />
        <span className="truncate">{titulo}</span>
      </span>
      <span className="text-[13px] tabular-nums text-muted-foreground">{detalhe}</span>
    </button>
  );
}
