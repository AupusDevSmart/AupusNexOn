import {
  AlertTriangle,
  Cable,
  Camera as IconeCamera,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  Copy,
  Cpu,
  Download,
  HardDrive,
  Laptop,
  Loader2,
  MemoryStick,
  Network,
  Plug,
  RefreshCw,
  Router,
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

const HOMEBREW = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

/* ------------------------------------------------------------------ peças */

export function TituloEtapa({ id, children, sub }: { id: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 id={id} tabIndex={-1} className="text-base font-semibold outline-none sm:text-lg">
        {children}
      </h3>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      {children}
    </section>
  );
}

function Passo({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  );
}

function ItemPrecisa({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:h-[18px] [&_svg]:w-[18px]">{icone}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

/** Seção que abre e fecha ("Deu erro?", "Não apareceu?"). */
function Expansivel({ titulo, inicial = false, children }: { titulo: string; inicial?: boolean; children: ReactNode }) {
  const [aberto, setAberto] = useState(inicial);
  const id = useId();
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold mouse:hover:bg-muted rounded-xl"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <span className="flex-1">{titulo}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none', aberto && 'rotate-180')} aria-hidden />
      </button>
      <Expandir aberto={aberto}>
        <div id={id} className="px-4 pb-4">
          {children}
        </div>
      </Expandir>
    </div>
  );
}

function Problema({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1 border-t border-border pt-3 text-sm first:border-t-0 first:pt-0">
      <span className="font-semibold">{titulo}</span>
      <div className="leading-relaxed text-muted-foreground">{children}</div>
    </li>
  );
}

/**
 * Texto para copiar com botão grande. Sem permissão de área de transferência, deixa o texto
 * selecionado para o Cmd+C.
 */
export function CaixaComando({ texto, rotulo, onCopiado }: { texto: string; rotulo: string; onCopiado?: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      onCopiado?.();
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      const sel = window.getSelection();
      if (ref.current && sel) sel.selectAllChildren(ref.current);
      toast.error('Não deu para copiar sozinho. O texto ficou selecionado: aperte Cmd+C (ou Ctrl+C).');
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-[#0d0d1f] p-3 sm:flex-row sm:items-center">
      <code ref={ref} className="min-w-0 flex-1 select-all break-all font-mono text-[13px] leading-relaxed text-zinc-200">
        {texto}
      </code>
      <Button type="button" onClick={() => void copiar()} aria-label={rotulo} className={cn(BOTAO_GRANDE, 'shrink-0 gap-2 sm:w-36')}>
        {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copiado ? 'Copiado' : 'Copiar'}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copiado ? 'Copiado' : ''}
      </span>
    </div>
  );
}

function OpcaoJeito({
  ativo,
  onClick,
  icone,
  titulo,
  dica,
  selo,
  aviso,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: ReactNode;
  titulo: string;
  dica: string;
  selo?: string;
  aviso?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={cn(
        'flex min-h-[88px] items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors',
        ativo ? 'border-nexon-verde bg-[color-mix(in_srgb,var(--nx-verde)_12%,transparent)]' : 'border-border mouse:hover:bg-muted',
      )}
    >
      <span className={cn('mt-0.5 [&_svg]:h-6 [&_svg]:w-6', ativo ? VERDE_TEXTO : 'text-muted-foreground')}>{icone}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold">
          {titulo}
          {selo && <span className={cn('text-sm font-semibold', VERDE_TEXTO)}>{selo}</span>}
        </span>
        <span className="text-sm text-muted-foreground">{dica}</span>
        {aviso && <span className="text-sm text-amber-600 dark:text-amber-400">{aviso}</span>}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ 1 · Gravar */

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
  usina,
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
  usina: string;
}) {
  const gb = instalador ? (instalador.tamanho / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '1,1';
  const vencido = instalador ? Date.parse(instalador.valido_ate) <= Date.now() : false;
  return (
    <div className="flex flex-col gap-6">
      <TituloEtapa id={tituloId} sub="Uma vez só por aparelho. Depois disso tudo é pela web: câmeras, atualizações e reinício.">
        Grave o cartão SD do Raspberry
      </TituloEtapa>

      {sistema === 'celular' && (
        <p className={cn('rounded-xl p-4 text-sm leading-relaxed', CAIXA_AVISO)}>
          Você está no celular. Para gravar o cartão, abra esta tela no computador. Se o cartão já está gravado, toque em <strong>Próximo</strong>.
        </p>
      )}

      <div role="radiogroup" aria-label="Como gravar" className="grid gap-3 sm:grid-cols-2">
        <OpcaoJeito
          ativo={jeito === 'pc'}
          onClick={() => onJeito('pc')}
          icone={<Laptop aria-hidden />}
          titulo="Pelo computador"
          selo="Recomendado"
          dica="Cabo USB-C do computador no Raspberry. Ele entra sozinho na usina."
          aviso={sistema === 'windows' ? 'Este computador é Windows. O comando roda só em Mac ou Linux.' : undefined}
        />
        <OpcaoJeito
          ativo={jeito === 'pendrive'}
          onClick={() => onJeito('pendrive')}
          icone={<Usb aria-hidden />}
          titulo="Pelo pendrive"
          dica="Para quem não tem Mac ou Linux. No fim você vincula com um toque."
        />
      </div>

      <Bloco titulo="O que você precisa">
        <ul className="grid gap-2 sm:grid-cols-2">
          <ItemPrecisa icone={<Cpu aria-hidden />}>Raspberry (sem estar na tomada)</ItemPrecisa>
          <ItemPrecisa icone={<MemoryStick aria-hidden />}>Cartão SD de 32 GB ou mais, dentro do Raspberry</ItemPrecisa>
          {jeito === 'pc' ? (
            <>
              <ItemPrecisa icone={<Cable aria-hidden />}>Cabo USB-C que passa dados (não só de carga)</ItemPrecisa>
              <ItemPrecisa icone={<Laptop aria-hidden />}>Mac ou Linux com internet</ItemPrecisa>
            </>
          ) : (
            <>
              <ItemPrecisa icone={<Usb aria-hidden />}>Pendrive de 16 GB ou mais (vai ser apagado)</ItemPrecisa>
              <ItemPrecisa icone={<Network aria-hidden />}>Cabo de rede, fonte oficial e internet no local</ItemPrecisa>
            </>
          )}
        </ul>
      </Bloco>

      {carregando ? (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparando o comando de {usina}…
        </div>
      ) : erro ? (
        <div role="alert" className={cn('flex flex-col gap-3 rounded-xl p-4 text-sm', CAIXA_AVISO)}>
          <p>{mensagemErro(erro, 'Não foi possível preparar o instalador.')}</p>
          <Button type="button" variant="outline" className={cn(BOTAO_GRANDE, 'self-start')} onClick={onTentarDeNovo}>
            <RefreshCw aria-hidden />
            Tentar de novo
          </Button>
        </div>
      ) : instalador && jeito === 'pc' ? (
        <Bloco titulo="Passo a passo">
          <ol className="flex flex-col gap-4">
            <Passo n={1}>
              Abra o <strong>Terminal</strong>. No Mac: aperte <kbd className="rounded border border-border px-1 font-mono text-[13px]">Cmd</kbd> +{' '}
              <kbd className="rounded border border-border px-1 font-mono text-[13px]">Espaço</kbd>, digite Terminal e aperte Enter.
            </Passo>
            <Passo n={2}>
              <span className="block">Copie o comando, cole no Terminal e aperte Enter.</span>
              <div className="mt-2 flex flex-col gap-2">
                {vencido ? (
                  <div role="alert" className={cn('flex flex-col gap-3 rounded-xl p-4', CAIXA_AVISO)}>
                    <p>Este comando venceu. Gere outro: leva um segundo.</p>
                    <Button type="button" className={cn(BOTAO_GRANDE, 'self-start')} onClick={onTentarDeNovo} disabled={gerando}>
                      {gerando ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                      Gerar comando novo
                    </Button>
                  </div>
                ) : (
                  <CaixaComando texto={instalador.comando} rotulo="Copiar comando de instalação" />
                )}
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Vale até {validadeTexto(instalador.valido_ate)}, para um Raspberry só.
                    {instalador.vinculo_automatico ? ` Ele já leva a chave de ${usina}.` : ' Este comando não leva a chave da usina: no passo 3 você vincula.'}
                  </span>
                </p>
              </div>
            </Passo>
            <Passo n={3}>
              Na primeira vez ele baixa a imagem do NexON (~{gb} GB) e prepara o programa da Raspberry. No Mac isso precisa do Homebrew: se faltar, ele avisa
              e mostra como instalar.
            </Passo>
            <Passo n={4}>
              Quando ele pedir:
              <ul className="mt-2 flex flex-col gap-1.5">
                <li>a. Tire o Raspberry da fonte.</li>
                <li>
                  b. <strong>Segure o botão de ligar</strong> (fica ao lado da entrada USB-C).
                </li>
                <li>
                  c. Sem soltar, ligue o <strong>cabo USB-C do computador</strong> no Raspberry.
                </li>
                <li>d. Solte o botão depois de 3 segundos.</li>
              </ul>
            </Passo>
            <Passo n={5}>
              Ele acha o cartão SD de dentro e pergunta se pode apagar. Digite <strong>SIM</strong> e aperte Enter. Se pedir a senha do computador, digite: ela
              não aparece enquanto você digita.
            </Passo>
            <Passo n={6}>
              Espere gravar e conferir: <strong>5 a 15 minutos</strong>. No fim ele grava a chave da usina e ejeta sozinho. Quando aparecer que terminou, tire o
              cabo.
            </Passo>
          </ol>
        </Bloco>
      ) : instalador ? (
        <Bloco titulo="Passo a passo">
          <ol className="flex flex-col gap-4">
            <Passo n={1}>
              <span className="block">Baixe a imagem do NexON (~{gb} GB, versão {instalador.versao}).</span>
              <Button asChild className={cn(BOTAO_GRANDE, 'mt-2 gap-2')}>
                <a href={instalador.url_imagem} download>
                  <Download aria-hidden />
                  Baixar imagem
                </a>
              </Button>
            </Passo>
            <Passo n={2}>
              Abra o <strong>Raspberry Pi Imager</strong> (baixe em raspberrypi.com/software se não tiver). Em Sistema, escolha <em>Usar personalizado</em> e
              a imagem baixada. Em Armazenamento, o pendrive.
            </Passo>
            <Passo n={3}>
              Quando ele perguntar se quer personalizar, responda <strong>Não</strong>. Espere gravar e tire o pendrive.
            </Passo>
            <Passo n={4}>Ligue no Raspberry: o pendrive, o cabo de rede e, por último, a fonte. O cartão SD fica dentro.</Passo>
            <Passo n={5}>
              Ele copia tudo para o SD e <strong>desliga sozinho</strong> (cerca de 10 minutos; a luz verde para de piscar).
            </Passo>
            <Passo n={6}>Tire o pendrive, tire a fonte e ligue de novo.</Passo>
          </ol>
          <p className={cn('rounded-xl p-4 text-sm leading-relaxed', CAIXA_AVISO)}>
            Pelo pendrive ele <strong>não entra sozinho</strong> na usina. No passo 3 você vincula com um toque.
          </p>
        </Bloco>
      ) : null}

      {jeito === 'pc' && (
        <Expansivel titulo="Deu erro? Veja as causas comuns">
          <ul className="flex flex-col gap-3">
            <Problema titulo="Pediu o Homebrew (só Mac)">
              Cole este comando no Terminal, aperte Enter e siga o que ele pedir. Depois rode o comando do NexON de novo.
              <div className="mt-2">
                <CaixaComando texto={HOMEBREW} rotulo="Copiar comando do Homebrew" />
              </div>
            </Problema>
            <Problema titulo="Não achou o Raspberry ou o cartão SD">
              Tire o cabo e a fonte. Segure o botão de ligar <strong>antes</strong> de ligar o cabo USB-C e solte só depois de 3 segundos. Rode o comando de
              novo.
            </Problema>
            <Problema titulo="Continua sem achar">
              O cabo pode ser só de carga (o de carregador de celular costuma ser). Use um cabo que passa dados.
            </Problema>
            <Problema titulo="Usando hub ou adaptador">Ligue o cabo direto numa porta do computador.</Problema>
            <Problema titulo="Disse que o comando venceu ou que a chave não vale">
              Cada comando serve para um Raspberry e vale 48 horas. Gere outro aqui.
              <Button type="button" variant="outline" className={cn(BOTAO_GRANDE, 'mt-2 flex')} onClick={onTentarDeNovo} disabled={gerando}>
                {gerando ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                Gerar comando novo
              </Button>
            </Problema>
          </ul>
        </Expansivel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ 2 · Ligar */

export const ITENS_LIGAR = [
  { id: 'sd', icone: <MemoryStick aria-hidden />, texto: 'Cartão SD gravado dentro do Raspberry', dica: 'Pelo pendrive: tire o pendrive.' },
  { id: 'rede', icone: <Network aria-hidden />, texto: 'Cabo de rede no switch das câmeras', dica: 'A luz do conector de rede acende.' },
  { id: 'internet', icone: <Router aria-hidden />, texto: 'Switch ligado no roteador com internet', dica: 'Sem internet ele não chega ao NexON.' },
  { id: 'fonte', icone: <Plug aria-hidden />, texto: 'Fonte oficial de 27 W na tomada', dica: 'Fonte de celular faz ele desligar sozinho.' },
  { id: 'hd', icone: <HardDrive aria-hidden />, texto: 'HD ou SSD na porta USB (opcional)', dica: 'Guarda 7 dias de vídeo. Ele prepara sozinho.' },
] as const;

export function EtapaLigar({ tituloId, marcados, onMarcar }: { tituloId: string; marcados: string[]; onMarcar: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <TituloEtapa id={tituloId} sub="Leve o Raspberry até o local das câmeras e ligue nesta ordem. Marque cada item.">
        Ligue o Raspberry no local
      </TituloEtapa>

      <ul className="flex flex-col gap-2" aria-label="O que ligar">
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
                  'flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  feito ? 'border-nexon-verde bg-[color-mix(in_srgb,var(--nx-verde)_10%,transparent)]' : 'border-border mouse:hover:bg-muted',
                )}
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:h-5 [&_svg]:w-5', feito ? VERDE_TEXTO : 'text-muted-foreground')}>
                  {item.icone}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{item.texto}</span>
                  <span className="text-sm text-muted-foreground">{item.dica}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2',
                    feito ? 'border-nexon-verde bg-nexon-verde text-nexon-azul' : 'border-zinc-400 dark:border-zinc-500',
                  )}
                >
                  {feito && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm leading-relaxed">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          Na primeira vez ele leva <strong>cerca de 15 minutos</strong> instalando sozinho. Não tire da tomada nesse tempo.
        </span>
      </p>

      <Bloco titulo="O que as luzes querem dizer">
        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex items-center gap-3">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full bg-nexon-verde motion-safe:animate-pulse" />
            <span>
              <strong>Verde piscando:</strong> trabalhando. Está tudo certo, só espere.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full bg-red-500" />
            <span>
              <strong>Só a vermelha:</strong> desligado ou sem sistema. Confira o cartão SD e ligue de novo.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border-2 border-zinc-400 dark:border-zinc-500" />
            <span>
              <strong>Nenhuma luz:</strong> sem energia. Confira a fonte e a tomada.
            </span>
          </li>
        </ul>
      </Bloco>

      <p className="text-sm text-muted-foreground">Pode seguir para o próximo passo: o NexON avisa quando ele chegar.</p>
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
      <div className="flex flex-col gap-6">
        <TituloEtapa id={tituloId}>Raspberry conectado</TituloEtapa>
        <div role="status" className={cn('flex flex-col items-center gap-3 rounded-2xl p-6 text-center', CAIXA_VERDE)}>
          <CircleCheck className={cn('h-14 w-14', VERDE_TEXTO)} strokeWidth={1.75} aria-hidden />
          <p className="text-lg font-semibold">Raspberry &lsquo;{novo.nome}&rsquo; conectado!</p>
          <p className="text-sm text-muted-foreground">
            Entrou em {usina}
            {novo.versao ? ` · versão ${novo.versao}` : ''}
            {novo.host && novo.host !== novo.nome ? ` · ${novo.host}` : ''}
          </p>
        </div>
        <p className="text-sm">Agora ele procura as câmeras da rede. Toque em Ver câmeras para acompanhar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TituloEtapa id={tituloId} sub={automatico ? `Ele entra sozinho em ${usina}. Não precisa fazer nada aqui, só esperar.` : undefined}>
        Esperando o Raspberry chegar
      </TituloEtapa>

      <div role="status" aria-live="polite" className="flex items-center gap-4 rounded-2xl border border-border p-5">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--nx-verde)_20%,transparent)] motion-safe:animate-ping" />
          <span aria-hidden className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--nx-verde)_14%,transparent)]">
            <Cpu className={cn('h-6 w-6', VERDE_TEXTO)} />
          </span>
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[15px] font-semibold">Procurando o Raspberry…</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            Esperando há {duracaoTexto(esperandoMs)}. Na primeira vez leva uns 15 minutos.
          </p>
        </div>
      </div>

      {erroLista && (
        <p role="alert" className={cn('rounded-xl p-4 text-sm', CAIXA_AVISO)}>
          Sem conexão com o NexON agora. Continuamos tentando a cada 5 segundos.
        </p>
      )}

      {!automatico && (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold">Gravou pelo pendrive? Vincule quando ele ligar.</p>
          <p className="text-sm text-muted-foreground">
            Na mesma internet do Raspberry, ele aparece na lista. Longe dele, use o código de 6 dígitos da página do aparelho.
          </p>
          <Button type="button" className={cn(BOTAO_GRANDE, 'self-start')} onClick={onVincular}>
            Vincular aparelho
          </Button>
        </div>
      )}

      {mostrarAjuda && (
        <Expansivel titulo="Não apareceu? Confira estes pontos" inicial>
          <ul className="flex flex-col gap-3">
            <Problema titulo="Luz verde piscando?">Se só a vermelha acende, o cartão não foi gravado. Volte ao passo 1.</Problema>
            <Problema titulo="Cabo de rede">O cabo vai no switch das câmeras e a luz do conector acende. Troque o cabo ou a porta do switch.</Problema>
            <Problema titulo="Internet do local">Ligue o celular no mesmo roteador e abra um site. Sem internet, ele não chega.</Problema>
            <Problema titulo="Fonte">Use a fonte oficial de 27 W. Fonte de celular faz ele reiniciar sem parar.</Problema>
            <Problema titulo="Gravou pelo pendrive?">Tire o pendrive, tire a fonte e ligue de novo. Depois vincule pelo código.</Problema>
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
      <div className="flex flex-col gap-4">
        <TituloEtapa id={tituloId}>Câmeras</TituloEtapa>
        <p className="text-sm text-muted-foreground">O Raspberry novo ainda não chegou. Volte para Conectar e espere ele aparecer.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <TituloEtapa id={tituloId} sub={`Ele procura câmeras na rede a cada 5 minutos. Esta lista atualiza sozinha.`}>
        Câmeras do {novo.nome}
      </TituloEtapa>

      <ul className="flex flex-col gap-2 text-sm leading-relaxed">
        <li className="flex gap-2">
          <Check className={cn('mt-1 h-4 w-4 shrink-0', VERDE_TEXTO)} aria-hidden />
          <span>
            <strong>Intelbras de fábrica</strong> entra sozinha. O aparelho cria uma senha forte para ela.
          </span>
        </li>
        <li className="flex gap-2">
          <Check className={cn('mt-1 h-4 w-4 shrink-0', VERDE_TEXTO)} aria-hidden />
          <span>
            Câmera com a <strong>mesma senha</strong> das outras da usina também entra sozinha.
          </span>
        </li>
        <li className="flex gap-2">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <span>
            Senha diferente: aparece <strong>Câmera nova na rede</strong> na tela de câmeras. Toque em Adicionar e digite a senha.
          </span>
        </li>
      </ul>

      <Bloco titulo={`Câmeras ligadas a ele (${cameras.length})`}>
        {carregando ? (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando câmeras…
          </div>
        ) : cameras.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Video className="h-5 w-5 shrink-0" aria-hidden />
            Nenhuma ainda. A primeira busca acontece poucos minutos depois que ele liga.
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Câmeras do aparelho">
            {cameras.map((c) => {
              const online = c.status === 'online';
              return (
                <li key={c.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 py-2">
                  <span role="img" aria-label={online ? 'online' : 'offline'} className={cn('h-2.5 w-2.5 shrink-0 rounded-full', online ? 'bg-nexon-verde' : 'bg-zinc-500')} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nome}</span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{c.ip}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Bloco>

      {descobertas.length > 0 && (
        <Bloco titulo={`Encontradas na rede, esperando senha (${descobertas.length})`}>
          <ul className="flex flex-col gap-2" aria-label="Câmeras encontradas na rede">
            {descobertas.map(({ descoberta: d }) => (
              <li key={d.ip} className={cn('flex min-h-12 items-center gap-3 rounded-xl px-3 py-2', CAIXA_AVISO)}>
                <IconeCamera className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {[rotuloFabricante(d.fabricante) ?? 'Câmera', d.modelo].filter(Boolean).join(' ')}
                  {d.inicializada === false ? ' · de fábrica' : ''}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{d.ip}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </div>
  );
}
