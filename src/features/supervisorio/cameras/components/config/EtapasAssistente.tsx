import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  Copy,
  CreditCard,
  Cpu,
  Download,
  HardDrive,
  Keyboard,
  Laptop,
  Loader2,
  Network,
  Plug,
  Power,
  RefreshCw,
  Terminal,
  Usb,
  Video,
} from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Expandir } from '@/components/ui/expandir';
import { cn } from '@/lib/utils';
import type { Agente, Camera, InstaladorAparelho } from '../../types';
import { duracaoTexto, validadeTexto, type JeitoGravar } from '../../utils/assistente-raspberry';
import { mensagemErro } from '../../utils/erros';
import { rotuloFabricante } from '../../utils/sensibilidade';
import type { DescobertaDoAgente } from '../../hooks/useConfigCameras';
import { VERDE_TEXTO } from '../estilo-filtro';

/* Estilos da marca. Opacidade em cor de tema (`bg-nexon-verde/15`) não gera CSS aqui: color-mix. */
export const CAIXA_VERDE =
  'border border-[color-mix(in_srgb,var(--nx-verde)_45%,transparent)] bg-[color-mix(in_srgb,var(--nx-verde)_10%,transparent)]';
const CAIXA_AVISO = 'border border-amber-500/40 bg-amber-500/10';
const BOTAO_GRANDE = 'h-11 px-5 text-sm';
const BOTAO_PRINCIPAL = 'h-14 w-full gap-2 text-base font-semibold sm:w-auto sm:px-8';

const HOMEBREW = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

/* ------------------------------------------------------------------ peças */

export function TituloEtapa({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} tabIndex={-1} className="text-lg font-semibold outline-none">
      {children}
    </h3>
  );
}

/** Passo com ícone grande e número: uma frase curta. */
function Passo({ n, icone, children }: { n: number; icone: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-4">
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&_svg]:h-6 [&_svg]:w-6">
        {icone}
        <span
          aria-hidden
          className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-nexon-verde text-xs font-bold tabular-nums text-nexon-azul"
        >
          {n}
        </span>
      </span>
      <span className="min-w-0 flex-1 text-base font-medium">
        <span className="sr-only">{n}. </span>
        {children}
      </span>
    </li>
  );
}

/** Seção que abre e fecha ("Deu problema?", "Não apareceu?"). */
function Expansivel({
  titulo,
  inicial = false,
  aviso = true,
  children,
}: {
  titulo: string;
  inicial?: boolean;
  aviso?: boolean;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(inicial);
  const id = useId();
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-4 py-2 text-left text-sm font-semibold mouse:hover:bg-muted"
      >
        {aviso && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />}
        <span className="flex-1">{titulo}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none', aberto && 'rotate-180')}
          aria-hidden
        />
      </button>
      <Expandir aberto={aberto}>
        <div id={id} className="px-4 pb-4">
          {children}
        </div>
      </Expandir>
    </div>
  );
}

/** Linha de "Deu problema?": sintoma em negrito, saída curta. */
function Dica({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-1 border-t border-border pt-3 text-sm first:border-t-0 first:pt-0">
      <span className="font-semibold">{titulo}</span>
      {children && <div className="text-muted-foreground">{children}</div>}
    </li>
  );
}

/**
 * Botão grande que copia o texto; o texto fica embaixo, pequeno. Sem permissão de área de
 * transferência, deixa o texto selecionado para o Cmd+C.
 */
export function CaixaComando({ texto, rotulo, grande = false }: { texto: string; rotulo: string; grande?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      const sel = window.getSelection();
      if (ref.current && sel) sel.selectAllChildren(ref.current);
      toast.error('Não copiou. O texto ficou selecionado: aperte Cmd+C.');
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={grande ? 'default' : 'outline'}
        onClick={() => void copiar()}
        className={cn(grande ? BOTAO_PRINCIPAL : cn(BOTAO_GRANDE, 'gap-2 self-start'))}
      >
        {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copiado ? 'Copiado' : rotulo}
      </Button>
      <code ref={ref} className="select-all break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
        {texto}
      </code>
      <span aria-live="polite" className="sr-only">
        {copiado ? 'Copiado' : ''}
      </span>
    </div>
  );
}

function BotaoGerarOutro({ onClick, gerando, principal = false }: { onClick: () => void; gerando: boolean; principal?: boolean }) {
  return (
    <Button
      type="button"
      variant={principal ? 'default' : 'outline'}
      className={cn(principal ? BOTAO_PRINCIPAL : cn(BOTAO_GRANDE, 'mt-1 self-start'))}
      onClick={onClick}
      disabled={gerando}
    >
      {gerando ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      Gerar outro comando
    </Button>
  );
}

/* ------------------------------------------------------------------ 1 · Gravar */

const JEITOS: { valor: JeitoGravar; titulo: string; detalhe: string; icone: ReactNode }[] = [
  { valor: 'pc', titulo: 'Computador', detalhe: 'Cabo USB-C', icone: <Laptop aria-hidden /> },
  { valor: 'pendrive', titulo: 'Pendrive', detalhe: 'Copia pro SD', icone: <Usb aria-hidden /> },
  { valor: 'cartao', titulo: 'Cartão SD', detalhe: 'Leitor no PC', icone: <CreditCard aria-hidden /> },
];

export function EtapaGravar({
  tituloId,
  jeito,
  onJeito,
  sistema,
  instalador,
  carregando,
  erro,
  onTentarDeNovo,
  gerando,
}: {
  tituloId: string;
  jeito: JeitoGravar;
  onJeito: (j: JeitoGravar) => void;
  sistema: 'mac-linux' | 'windows' | 'celular';
  instalador: InstaladorAparelho | undefined;
  carregando: boolean;
  erro: unknown;
  onTentarDeNovo: () => void;
  gerando: boolean;
}) {
  const vencido = instalador ? Date.parse(instalador.valido_ate) <= Date.now() : false;
  const pc = jeito === 'pc';
  const [so, setSo] = useState<'mac-linux' | 'windows'>(sistema === 'windows' ? 'windows' : 'mac-linux');
  const win = so === 'windows';
  const comando = win ? instalador?.comando_windows : instalador?.comando;

  return (
    <div className="flex flex-col gap-6">
      <TituloEtapa id={tituloId}>Como vai gravar?</TituloEtapa>

      <div role="radiogroup" aria-label="Jeito de gravar" className="grid grid-cols-3 gap-2">
        {JEITOS.map((j) => {
          const marcado = j.valor === jeito;
          return (
            <button
              key={j.valor}
              type="button"
              role="radio"
              aria-checked={marcado}
              onClick={() => onJeito(j.valor)}
              className={cn(
                'flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2 text-center transition-colors',
                marcado ? cn('border-nexon-verde', CAIXA_VERDE) : 'border-border mouse:hover:border-muted-foreground',
              )}
            >
              <span className={cn('[&_svg]:h-6 [&_svg]:w-6', marcado ? VERDE_TEXTO : 'text-muted-foreground')}>{j.icone}</span>
              <span className="text-sm font-semibold leading-tight">{j.titulo}</span>
              <span className="text-xs leading-tight text-muted-foreground">{j.detalhe}</span>
            </button>
          );
        })}
      </div>

      {sistema === 'celular' && (
        <p className={cn('flex items-center gap-2 rounded-xl p-3 text-sm', CAIXA_AVISO)}>
          <Laptop className="h-4 w-4 shrink-0" aria-hidden />
          Abra no computador para gravar.
        </p>
      )}
      {pc && (
        <div role="radiogroup" aria-label="Sistema do computador" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(['mac-linux', 'windows'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={so === v}
              onClick={() => setSo(v)}
              className={cn(
                'min-h-11 rounded-lg text-sm font-semibold transition-colors',
                so === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground mouse:hover:text-foreground',
              )}
            >
              {v === 'windows' ? 'Windows' : 'Mac ou Linux'}
            </button>
          ))}
        </div>
      )}

      {carregando ? (
        <div role="status" className="flex h-14 items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparando o comando…
        </div>
      ) : erro ? (
        <div role="alert" className={cn('flex flex-col gap-3 rounded-xl p-4 text-sm', CAIXA_AVISO)}>
          <p>{mensagemErro(erro, 'Não deu para preparar o comando.')}</p>
          <Button type="button" variant="outline" className={cn(BOTAO_GRANDE, 'self-start')} onClick={onTentarDeNovo}>
            <RefreshCw aria-hidden />
            Tentar de novo
          </Button>
        </div>
      ) : instalador && pc && !comando ? (
        <p className={cn('flex items-center gap-2 rounded-xl p-3 text-sm', CAIXA_AVISO)}>
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          Windows ainda não liberado. Use Pendrive ou Cartão SD.
        </p>
      ) : instalador && pc && comando ? (
        <>
          <div className="flex flex-col gap-2">
            {vencido ? (
              <>
                <p role="alert" className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Comando vencido.
                </p>
                <BotaoGerarOutro onClick={onTentarDeNovo} gerando={gerando} principal />
              </>
            ) : (
              <CaixaComando texto={comando} rotulo="Copiar comando" grande />
            )}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              Vale até {validadeTexto(instalador.valido_ate)}, um Raspberry só.
            </p>
            {!instalador.vinculo_automatico && <p className="text-sm text-muted-foreground">Sem chave da usina: vincule no passo 3.</p>}
          </div>

          <ol className="flex flex-col gap-4" aria-label="Passo a passo">
            <Passo n={1} icone={<Terminal aria-hidden />}>
              {win ? (
                <>
                  Cole no <strong>PowerShell</strong> e clique em <strong>Sim</strong>
                </>
              ) : (
                <>
                  Cole no <strong>Terminal</strong>
                </>
              )}
            </Passo>
            <Passo n={2} icone={<Power aria-hidden />}>
              Segure o botão e ligue o cabo USB-C
            </Passo>
            <Passo n={3} icone={<Keyboard aria-hidden />}>
              Digite <strong>SIM</strong>
            </Passo>
          </ol>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            Leva 5 a 15 min.
          </p>
        </>
      ) : instalador ? (
        <>
          <Button asChild className={BOTAO_PRINCIPAL}>
            <a href={instalador.url_imagem} download>
              <Download aria-hidden />
              Baixar imagem
            </a>
          </Button>
          {jeito === 'cartao' ? (
            <ol className="flex flex-col gap-4" aria-label="Passo a passo">
              <Passo n={1} icone={<CreditCard aria-hidden />}>
                Grave no cartão SD (Pi Imager)
              </Passo>
              <Passo n={2} icone={<Cpu aria-hidden />}>
                Coloque o cartão no Raspberry
              </Passo>
            </ol>
          ) : (
            <ol className="flex flex-col gap-4" aria-label="Passo a passo">
              <Passo n={1} icone={<Usb aria-hidden />}>
                Grave no pendrive (Pi Imager)
              </Passo>
              <Passo n={2} icone={<Plug aria-hidden />}>
                Ligue pendrive, rede e fonte
              </Passo>
              <Passo n={3} icone={<Clock aria-hidden />}>
                Espere desligar (~10 min)
              </Passo>
              <Passo n={4} icone={<RefreshCw aria-hidden />}>
                Tire o pendrive e religue
              </Passo>
            </ol>
          )}
          <p className="text-sm text-muted-foreground">No passo 3 você vincula.</p>
        </>
      ) : null}

      <div className="flex flex-col gap-3">
        <Expansivel titulo="Deu problema?">
          {pc ? (
            <ul className="flex flex-col gap-3">
              {win ? (
                <Dica titulo="Achar o PowerShell">Tecla Windows, digite PowerShell, Enter.</Dica>
              ) : (
                <>
                  <Dica titulo="Achar o Terminal">Mac: Cmd + Espaço, digite Terminal. Linux: Ctrl + Alt + T.</Dica>
                  <Dica titulo="Pediu o Homebrew (Mac)">
                    <div className="mt-1">
                      <CaixaComando texto={HOMEBREW} rotulo="Copiar Homebrew" />
                    </div>
                  </Dica>
                </>
              )}
              <Dica titulo="Não achou o Raspberry">Segure o botão antes de ligar o cabo.</Dica>
              <Dica titulo="Continua sem achar">Troque o cabo: precisa passar dados.</Dica>
              <Dica titulo="Usa hub?">Ligue direto no computador.</Dica>
              <Dica titulo="Comando venceu">
                <BotaoGerarOutro onClick={onTentarDeNovo} gerando={gerando} />
              </Dica>
            </ul>
          ) : (
            <ul className="flex flex-col gap-3">
              <Dica titulo="Pi Imager">raspberrypi.com/software</Dica>
              <Dica titulo="Na gravação">Usar personalizado. Personalizar: Não.</Dica>
              <Dica titulo={jeito === 'cartao' ? 'Cartão' : 'Pendrive'}>16 GB ou mais. Vai ser apagado.</Dica>
            </ul>
          )}
        </Expansivel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2 · Ligar */

export const ITENS_LIGAR = [
  { id: 'rede', icone: <Network aria-hidden />, texto: 'Rede (cabo)' },
  { id: 'fonte', icone: <Plug aria-hidden />, texto: 'Fonte' },
  { id: 'hd', icone: <HardDrive aria-hidden />, texto: 'HD (opcional)' },
] as const;

export function EtapaLigar({ tituloId, marcados, onMarcar }: { tituloId: string; marcados: string[]; onMarcar: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <TituloEtapa id={tituloId}>Ligue no local</TituloEtapa>

      <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="O que ligar">
        {ITENS_LIGAR.map((item) => {
          const feito = marcados.includes(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={feito}
                onClick={() => onMarcar(item.id)}
                className={cn(
                  'relative flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-colors',
                  feito ? 'border-nexon-verde bg-[color-mix(in_srgb,var(--nx-verde)_10%,transparent)]' : 'border-border mouse:hover:bg-muted',
                )}
              >
                <span className={cn('[&_svg]:h-8 [&_svg]:w-8', feito ? VERDE_TEXTO : 'text-muted-foreground')}>{item.icone}</span>
                <span className="text-sm font-semibold">{item.texto}</span>
                {feito && (
                  <span
                    aria-hidden
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-nexon-verde text-nexon-azul"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="flex items-center gap-3 rounded-xl border border-border p-4 text-base font-medium">
        <Clock className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
        Espere ~15 min
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 · Conectar */

export function EtapaConectar({
  tituloId,
  novo,
  usina,
  automatico,
  esperandoMs,
  mostrarAjuda,
  erroLista,
  onVincular,
}: {
  tituloId: string;
  novo: Agente | null;
  usina: string;
  automatico: boolean;
  esperandoMs: number;
  mostrarAjuda: boolean;
  erroLista: boolean;
  onVincular: () => void;
}) {
  if (novo) {
    return (
      <div role="status" className={cn('flex flex-col items-center gap-3 rounded-2xl px-4 py-10 text-center', CAIXA_VERDE)}>
        <CircleCheck className={cn('h-16 w-16', VERDE_TEXTO)} strokeWidth={1.75} aria-hidden />
        <TituloEtapa id={tituloId}>
          <span className="text-2xl">Conectado!</span>
        </TituloEtapa>
        <p className="text-sm text-muted-foreground">
          {novo.nome} · {usina}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 px-4 py-8 text-center">
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--nx-verde)_20%,transparent)] motion-safe:animate-ping" />
          <span aria-hidden className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--nx-verde)_14%,transparent)]">
            <Cpu className={cn('h-8 w-8', VERDE_TEXTO)} />
          </span>
        </span>
        <TituloEtapa id={tituloId}>Procurando o Raspberry…</TituloEtapa>
        <p className="text-sm tabular-nums text-muted-foreground">há {duracaoTexto(esperandoMs)}</p>
      </div>

      {erroLista && (
        <p role="alert" className={cn('rounded-xl p-3 text-sm', CAIXA_AVISO)}>
          Sem conexão. Tentando de novo…
        </p>
      )}

      {!automatico && (
        <Button type="button" className={BOTAO_PRINCIPAL} onClick={onVincular}>
          Vincular aparelho
        </Button>
      )}

      {mostrarAjuda && (
        <Expansivel titulo="Não apareceu?" inicial>
          <ul className="flex flex-col gap-3">
            <Dica titulo="Só luz vermelha?">Grave o cartão de novo.</Dica>
            <Dica titulo="Cabo de rede">A luz do conector acende?</Dica>
            <Dica titulo="Internet">Tem internet no local?</Dica>
            <Dica titulo="Fonte">Use a oficial de 27 W.</Dica>
          </ul>
          <Button type="button" variant="outline" className={cn(BOTAO_GRANDE, 'mt-4')} onClick={onVincular}>
            Vincular pelo código
          </Button>
        </Expansivel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ 4 · Câmeras */

export function EtapaCameras({
  tituloId,
  novo,
  cameras,
  carregando,
  descobertas,
}: {
  tituloId: string;
  novo: Agente | null;
  cameras: Camera[];
  carregando: boolean;
  descobertas: DescobertaDoAgente[];
}) {
  if (!novo) {
    return (
      <div className="flex flex-col gap-3">
        <TituloEtapa id={tituloId}>Câmeras</TituloEtapa>
        <p className="text-sm text-muted-foreground">Raspberry ainda não chegou.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <TituloEtapa id={tituloId}>Câmeras ({cameras.length})</TituloEtapa>
        <p className="text-sm text-muted-foreground">{novo.nome} · atualiza sozinho</p>
      </div>

      {carregando ? (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando…
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          <Video className="h-8 w-8" aria-hidden />
          Procurando câmeras na rede…
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Câmeras do aparelho">
          {cameras.map((c) => {
            const online = c.status === 'online';
            return (
              <li key={c.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 py-2">
                <span
                  role="img"
                  aria-label={online ? 'online' : 'offline'}
                  className={cn('h-2.5 w-2.5 shrink-0 rounded-full', online ? 'bg-nexon-verde' : 'bg-zinc-500')}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nome}</span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{c.ip}</span>
              </li>
            );
          })}
        </ul>
      )}

      {descobertas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">Pedem senha ({descobertas.length})</h4>
          <ul className="flex flex-col gap-2" aria-label="Câmeras encontradas na rede">
            {descobertas.map(({ descoberta: d }) => (
              <li key={d.ip} className={cn('flex min-h-12 items-center gap-3 rounded-xl px-3 py-2', CAIXA_AVISO)}>
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {[rotuloFabricante(d.fabricante) ?? 'Câmera', d.modelo].filter(Boolean).join(' ')}
                  {d.inicializada === false ? ' · de fábrica' : ''}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{d.ip}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">Adicione na tela de câmeras.</p>
        </section>
      )}
    </div>
  );
}
