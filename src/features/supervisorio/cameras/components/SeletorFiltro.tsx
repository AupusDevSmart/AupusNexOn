import { Check, ChevronDown, Search, X, type LucideIcon } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/core/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { AreaRolagem } from './AreaRolagem';
import { BOTAO_SECUNDARIO, FOCO, ITEM_ATIVO, ITEM_INATIVO, VERDE_FUNDO, VERDE_TEXTO } from './estilo-filtro';

export interface OpcaoSeletor<T extends string> {
  valor: T;
  rotulo: string;
  /** Bolinha de situação (câmera online / sem sinal). */
  status?: 'online' | 'offline';
  /** Contador à direita (não vistos); 0 não aparece. */
  contador?: number;
  /** Etiqueta discreta ao lado do nome (ex.: "no player"). */
  nota?: string;
}

interface SeletorFiltroProps<T extends string> {
  /** Nome do filtro ("Câmera", "Tipo"): título do sheet e começo do rótulo acessível. */
  rotulo: string;
  icone: LucideIcon;
  valor: T;
  /** Valor neutro (sem filtro): o gatilho fica sem destaque verde. */
  padrao: T;
  opcoes: OpcaoSeletor<T>[];
  onValor: (v: T) => void;
  /** Texto do gatilho; padrão = rótulo da opção escolhida. */
  textoGatilho?: string;
  className?: string;
}

/** A partir daqui a lista ganha busca (10, 20, 30 câmeras). */
const MINIMO_BUSCA = 9;

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Seletor compacto da linha de filtros dos eventos (NEXON-108): gatilho em pílula de
 * 40 px (44 no toque) e lista em popover no desktop ou em sheet de baixo no celular.
 * Com muitas opções aparece a busca. Escolhido = verde translúcido + borda verde.
 */
export function SeletorFiltro<T extends string>({
  rotulo,
  icone: Icone,
  valor,
  padrao,
  opcoes,
  onValor,
  textoGatilho,
  className,
}: SeletorFiltroProps<T>) {
  const [aberto, setAberto] = useState(false);
  const celular = useIsMobile();
  const atual = opcoes.find((o) => o.valor === valor);
  const texto = textoGatilho ?? atual?.rotulo ?? '';
  const ativo = valor !== padrao;

  const escolher = (v: T) => {
    setAberto(false);
    if (v !== valor) onValor(v);
  };

  const gatilho = (
    <button
      type="button"
      aria-label={`${rotulo}: ${texto}`}
      aria-haspopup="dialog"
      className={cn(
        'inline-flex h-10 min-w-0 items-center gap-2 rounded-full border pl-3 pr-2.5 text-sm font-medium transition-colors touch:h-11',
        ativo ? ITEM_ATIVO : ITEM_INATIVO,
        FOCO,
        className,
      )}
    >
      <Icone aria-hidden className={cn('h-[18px] w-[18px] shrink-0', ativo ? VERDE_TEXTO : 'text-muted-foreground')} />
      {atual?.status && <Bolinha status={atual.status} />}
      <span className="min-w-0 flex-1 truncate text-left">{texto}</span>
      <ChevronDown aria-hidden className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
    </button>
  );

  const lista = (layout: 'popover' | 'sheet') => (
    <ListaOpcoes rotulo={rotulo} opcoes={opcoes} valor={valor} onEscolher={escolher} layout={layout} />
  );

  if (celular) {
    return (
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetTrigger asChild>{gatilho}</SheetTrigger>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 rounded-t-2xl p-0 [&>button:first-child]:hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 pb-2 pt-3">
            <div className="min-w-0 flex-1">
              <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-full bg-border" />
              <SheetTitle className="text-lg font-semibold">{rotulo}</SheetTitle>
              <SheetDescription className="sr-only">Escolha uma opção para filtrar os eventos.</SheetDescription>
            </div>
            <button type="button" aria-label="Fechar" onClick={() => setAberto(false)} className={cn(BOTAO_SECUNDARIO, 'h-11 w-11 shrink-0')}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {lista('sheet')}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        aria-label={rotulo}
        className="flex w-[300px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border-border bg-card p-0 shadow-xl"
      >
        {lista('popover')}
      </PopoverContent>
    </Popover>
  );
}

function ListaOpcoes<T extends string>({
  rotulo,
  opcoes,
  valor,
  onEscolher,
  layout,
}: {
  rotulo: string;
  opcoes: OpcaoSeletor<T>[];
  valor: T;
  onEscolher: (v: T) => void;
  layout: 'popover' | 'sheet';
}) {
  const [busca, setBusca] = useState('');
  const idBusca = useId();
  const comBusca = opcoes.length >= MINIMO_BUSCA;
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return termo ? opcoes.filter((o) => normalizar(o.rotulo).includes(termo)) : opcoes;
  }, [busca, opcoes]);

  // Setas para cima/baixo andam entre as opções (o foco começa na busca ou na escolhida).
  const mover = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const botoes = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-opcao]'));
    if (botoes.length === 0) return;
    e.preventDefault();
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const alvo = atual < 0 ? botoes[delta > 0 ? 0 : botoes.length - 1] : botoes[(atual + delta + botoes.length) % botoes.length];
    alvo?.focus();
  };

  const grande = layout === 'sheet';

  return (
    <div onKeyDown={mover} className="flex min-h-0 flex-col">
      {comBusca && (
        <div className="relative shrink-0 border-b border-border p-2">
          <label htmlFor={idBusca} className="sr-only">
            Buscar {rotulo.toLowerCase()}
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            id={idBusca}
            type="search"
            autoFocus={!grande}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar"
            className={cn(
              'w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground',
              grande ? 'h-11' : 'h-10',
              FOCO,
            )}
          />
        </div>
      )}
      <AreaRolagem className="min-h-0" classeViewport={grande ? 'max-h-[60dvh]' : 'max-h-[340px]'}>
        <div role="group" aria-label={rotulo} className="flex flex-col gap-0.5 p-1.5">
          {filtradas.map((o) => {
            const escolhida = o.valor === valor;
            return (
              <button
                key={o.valor}
                type="button"
                data-opcao
                aria-pressed={escolhida}
                aria-label={rotuloOpcao(o)}
                autoFocus={!comBusca && escolhida && !grande}
                onClick={() => onEscolher(o.valor)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg border px-3 text-left text-sm font-medium transition-colors',
                  grande ? 'min-h-12 text-[15px]' : 'min-h-10',
                  escolhida ? `border-nexon-verde ${VERDE_FUNDO}` : 'border-transparent mouse:hover:bg-muted',
                  FOCO,
                )}
              >
                {o.status && <Bolinha status={o.status} />}
                <span className="min-w-0 flex-1 truncate">
                  {o.rotulo}
                  {o.nota && <span className="ml-2 text-xs font-normal text-muted-foreground">{o.nota}</span>}
                </span>
                {!!o.contador && (
                  <span
                    aria-hidden
                    className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white tabular-nums"
                  >
                    {o.contador > 99 ? '99+' : o.contador}
                  </span>
                )}
                <Check aria-hidden className={cn('h-[18px] w-[18px] shrink-0', escolhida ? VERDE_TEXTO : 'invisible')} />
              </button>
            );
          })}
          {filtradas.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Nada com “{busca.trim()}”.</p>
              <button type="button" onClick={() => setBusca('')} className={cn(BOTAO_SECUNDARIO, 'h-10 px-3 text-sm text-foreground')}>
                Limpar busca
              </button>
            </div>
          )}
        </div>
      </AreaRolagem>
    </div>
  );
}

/** "Arranjo IV3, sem sinal, 2 não vistos" (nome que o leitor de tela lê na opção). */
function rotuloOpcao<T extends string>(o: OpcaoSeletor<T>): string {
  const partes = [o.rotulo];
  if (o.status === 'offline') partes.push('sem sinal');
  if (o.nota) partes.push(o.nota);
  if (o.contador) partes.push(`${o.contador} não ${o.contador === 1 ? 'visto' : 'vistos'}`);
  return partes.join(', ');
}

function Bolinha({ status }: { status: 'online' | 'offline' }) {
  return (
    <span
      aria-hidden
      className={cn('h-2 w-2 shrink-0 rounded-full', status === 'offline' ? 'bg-zinc-400' : 'bg-nexon-verde')}
    />
  );
}
