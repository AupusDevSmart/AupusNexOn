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
  Info,
  HardDrive,
  Laptop,
  Loader2,
  Network,
  Plug,
  RefreshCw,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContarAteTres, DesenhoRaspberry, Quadro, Teclas, TelaTerminal } from './IlustracoesRaspberry';

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

/** Jeitos de gravar, do mais rápido ao mais lento. `porque` aparece no tooltip e embaixo do escolhido. */
const JEITOS: { valor: JeitoGravar; titulo: string; detalhe: string; tempo: string; recomendado?: boolean; porque: string; icone: ReactNode }[] = [
  {
    valor: 'cartao',
    titulo: 'Cartão no computador',
    detalhe: 'Entrada SD ou leitor USB',
    tempo: '~5 min',
    recomendado: true,
    porque:
      'O computador grava direto no cartão, na velocidade do leitor (dezenas de MB por segundo). Precisa de entrada de cartão SD no computador ou de um leitor USB. A chave da usina vai junto: o Raspberry entra sozinho no NexON.',
    icone: <CreditCard aria-hidden />,
  },
  {
    valor: 'pc',
    titulo: 'Cabo USB-C',
    detalhe: 'Sem tirar o cartão',
    tempo: '10 a 30 min',
    porque:
      'O cartão fica dentro do Raspberry e a gravação passa pela entrada USB-C dele, que é bem mais lenta e depende do cabo e do cartão. Use quando não der para tirar o cartão. A chave da usina também vai junto.',
    icone: <Laptop aria-hidden />,
  },
  {
    valor: 'pendrive',
    titulo: 'Pendrive',
    detalhe: 'Computador longe do Raspberry',
    tempo: '~25 min',
    porque:
      'Você grava um pendrive com o Raspberry Pi Imager e, no local, o Raspberry copia do pendrive para o cartão e desliga. Use quando o computador não está perto do Raspberry. O vínculo com a usina é feito depois, pelo código.',
    icone: <Usb aria-hidden />,
  },
];

export type SistemaPc = 'mac' | 'linux' | 'windows';

interface PassoGuiado {
  titulo: ReactNode;
  /** Uma frase de ajuda, embaixo do título. */
  ajuda?: ReactNode;
  visual: ReactNode;
  /** Botão ou peça extra (copiar comando, baixar imagem). */
  extra?: ReactNode;
}

const ROTULO_SO: Record<SistemaPc, string> = { mac: 'Mac', linux: 'Linux', windows: 'Windows' };

/** O que muda de um sistema para outro: nome do programa, teclas e como o Terminal escreve "certo". */
function doSistema(so: SistemaPc) {
  const win = so === 'windows';
  const ok = (t: string) => (win ? t.replace(/^(\s*)✓ /, '$1OK: ') : t);
  return {
    win,
    app: win ? 'PowerShell' : 'Terminal',
    ok,
    abrir: {
      titulo: win ? 'Abra o PowerShell' : 'Abra o Terminal',
      ajuda:
        so === 'mac' ? (
          <>
            Aperte as duas teclas juntas, escreva <strong>Terminal</strong> e aperte Enter.
          </>
        ) : so === 'linux' ? (
          'Aperte as três teclas juntas. Se não abrir, procure Terminal no menu de aplicativos.'
        ) : (
          <>
            Aperte a tecla Windows, escreva <strong>PowerShell</strong> e aperte Enter.
          </>
        ),
      teclas:
        so === 'mac'
          ? ['Cmd', '+', 'Espaço']
          : so === 'linux'
            ? ['Ctrl', '+', 'Alt', '+', 'T']
            : ['Windows', 'depois', 'PowerShell', 'depois', 'Enter'],
    },
    colar: {
      titulo: win ? 'Cole no PowerShell e aperte Enter' : 'Cole no Terminal e aperte Enter',
      ajuda:
        so === 'mac'
          ? 'Se pedir a senha do Mac (Password), digite e aperte Enter. Ela não aparece enquanto você digita.'
          : so === 'linux'
            ? 'No Terminal do Linux, colar é Ctrl + Shift + V. Se pedir a senha (sudo), digite a do seu usuário e aperte Enter: ela não aparece.'
            : 'Vai abrir uma janela pedindo permissão de administrador: clique em Sim. Continua numa janela nova.',
      teclas:
        so === 'mac'
          ? ['Cmd', '+', 'V', 'depois', 'Enter']
          : so === 'linux'
            ? ['Ctrl', '+', 'Shift', '+', 'V', 'depois', 'Enter']
            : ['Ctrl', '+', 'V', 'depois', 'Enter'],
    },
  };
}

function linhasInicio(ok: (t: string) => string) {
  return [
    '==== PASSO 1 de 5: Imagem do NexON ====',
    ok('✓ Baixada e conferida.'),
    '==== PASSO 2 de 5: Programa da Raspberry ====',
    ok('✓ Pronto.'),
    '==== PASSO 3 de 5: Ligar o Raspberry no computador ====',
  ];
}

/** Passos comuns aos dois jeitos com comando: abrir o Terminal, copiar, colar e esperar a primeira pergunta. */
function passosComando(so: SistemaPc, comando: ReactNode, esperaTitulo: string): PassoGuiado[] {
  const d = doSistema(so);
  return [
    { titulo: d.abrir.titulo, ajuda: d.abrir.ajuda, visual: <Teclas teclas={d.abrir.teclas} /> },
    { titulo: 'Copie o comando', ajuda: 'Clique no botão verde.', visual: <Copy className="h-16 w-16 text-muted-foreground" aria-hidden />, extra: comando },
    { titulo: d.colar.titulo, ajuda: d.colar.ajuda, visual: <Teclas teclas={d.colar.teclas} /> },
    {
      titulo: esperaTitulo,
      ajuda: 'Na primeira vez pode levar alguns minutos (ele baixa o NexON).',
      visual: <TelaTerminal sistema={so} titulo={d.app} linhas={linhasInicio(d.ok)} destaque=">> Tire TODOS os cabos do Raspberry (fonte, rede, tudo)." />,
    },
  ];
}

function passosFinais(so: SistemaPc, minutos: string): PassoGuiado[] {
  const d = doSistema(so);
  return [
    {
      titulo: 'Escreva SIM e aperte Enter',
      ajuda: 'Isso apaga o cartão e grava o NexON nele.',
      visual: (
        <TelaTerminal
          sistema={so}
          titulo={d.app}
          linhas={['  Achei o cartão SD do Raspberry (32 GB).', '  Tudo o que estiver nele será apagado.']}
          destaque="  >> Escreva SIM e aperte Enter para gravar: SIM"
        />
      ),
    },
    {
      titulo: 'Espere a faixa verde "DEU TUDO CERTO!"',
      ajuda: `A barra enche de 0 a 100% (${minutos}). Se aparecer a faixa vermelha "DEU ERRO", rode o comando de novo.`,
      visual: (
        <TelaTerminal
          sistema={so}
          titulo={d.app}
          linhas={[
            '==== PASSO 4 de 5: Gravando o NexON no cartão ====',
            '  [##############################] 100%  gravado em 4 min',
            d.ok('  ✓ NexON gravado e conferido no cartão.'),
            d.ok('  ✓ Chave da usina gravada.'),
          ]}
          destaque="   DEU TUDO CERTO! Pode tirar o cabo."
        />
      ),
    },
  ];
}

function passosComputador(so: SistemaPc, comando: ReactNode): PassoGuiado[] {
  const d = doSistema(so);
  return [
    {
      titulo: 'Separe o Raspberry e um cabo USB-C',
      ajuda: 'O cartão SD fica dentro do Raspberry. Use um cabo de celular. O cabo da fonte do Raspberry não serve.',
      visual: <DesenhoRaspberry destaque={['sd', 'usbc']} />,
    },
    ...passosComando(so, comando, 'Espere aparecer esta frase'),
    {
      titulo: `Tire todos os cabos do Raspberry e aperte Enter no ${d.app}`,
      ajuda: 'Fonte, rede, tudo. O Raspberry fica sem nenhum cabo.',
      visual: <DesenhoRaspberry />,
    },
    { titulo: 'Aperte e segure o botão', ajuda: 'É o botãozinho ao lado da entrada USB-C. Não solte ainda.', visual: <DesenhoRaspberry destaque={['botao']} dedo /> },
    {
      titulo: 'Segurando o botão, ligue o cabo',
      ajuda: 'Uma ponta no Raspberry, a outra no computador. Direto no computador, sem adaptador.',
      visual: <DesenhoRaspberry destaque={['botao', 'cabo']} dedo />,
    },
    { titulo: 'Conte até 3 e solte o botão', visual: <ContarAteTres /> },
    {
      titulo: 'Espere aparecer "Encontrei o cartão!"',
      ajuda: 'Não precisa apertar nada: ele percebe sozinho. Se não aparecer em 3 minutos, o Terminal explica o que fazer.',
      visual: (
        <TelaTerminal
          sistema={so}
          titulo={d.app}
          linhas={['     … esperando o Raspberry (10 s)', '     … esperando o Raspberry (20 s)']}
          destaque={d.ok('  ✓ Encontrei o cartão! Pode soltar o botão.')}
        />
      ),
    },
    ...passosFinais(so, '10 a 30 minutos pelo cabo'),
  ];
}

function passosCartao(so: SistemaPc, comando: ReactNode): PassoGuiado[] {
  const d = doSistema(so);
  return [
    {
      titulo: 'Tire o cartão SD do Raspberry',
      ajuda: 'Ele fica embaixo da placa, na ponta. Puxe com cuidado. O Raspberry precisa estar desligado.',
      visual: <DesenhoRaspberry destaque={['sd']} />,
    },
    ...passosComando(so, comando, 'Espere aparecer esta frase e aperte Enter'),
    {
      titulo: 'Coloque o cartão no computador',
      ajuda: 'Na entrada de cartão SD ou num leitor USB. Se for microSD, use o adaptador. Não precisa ligar o Raspberry.',
      visual: <CreditCard className="h-16 w-16 text-muted-foreground" aria-hidden />,
    },
    {
      titulo: 'Espere ele achar o cartão',
      ajuda: 'Não precisa apertar nada. Leva alguns segundos.',
      visual: <TelaTerminal sistema={so} titulo={d.app} linhas={['     … esperando o Raspberry (4 s)']} destaque={d.ok('  ✓ Encontrei o cartão!')} />,
    },
    ...passosFinais(so, 'uns 5 minutos'),
    {
      titulo: 'Tire o cartão do computador',
      ajuda: so === 'mac' ? 'Se aparecer aviso de disco não ejetado, pode ignorar: ele já foi ejetado.' : 'Ele já foi desligado do computador: pode tirar.',
      visual: <CreditCard className="h-16 w-16 text-muted-foreground" aria-hidden />,
    },
    { titulo: 'Coloque o cartão de volta no Raspberry', ajuda: 'Pronto. Agora é só levar o Raspberry para o lugar dele.', visual: <DesenhoRaspberry destaque={['sd']} /> },
  ];
}

function passosImagem(baixar: ReactNode): PassoGuiado[] {
  const midia = 'pendrive';
  const inicio: PassoGuiado[] = [
    { titulo: 'Baixe o NexON', ajuda: 'É um arquivo grande (1 GB). Espere terminar.', visual: <Download className="h-16 w-16 text-muted-foreground" aria-hidden />, extra: baixar },
    {
      titulo: 'Instale o Raspberry Pi Imager',
      ajuda: 'Programa grátis da Raspberry, para Mac, Windows e Linux.',
      visual: <Laptop className="h-16 w-16 text-muted-foreground" aria-hidden />,
      extra: (
        <Button asChild variant="outline" className={BOTAO_GRANDE}>
          <a href="https://www.raspberrypi.com/software/" target="_blank" rel="noreferrer">
            Abrir o site do Imager
          </a>
        </Button>
      ),
    },
    {
      titulo: `Coloque o ${midia} no computador`,
      ajuda: `Use um ${midia} de 16 GB ou mais. Tudo nele será apagado.`,
      visual: <Usb className="h-16 w-16 text-muted-foreground" aria-hidden />,
    },
    {
      titulo: 'No Imager, grave o arquivo baixado',
      ajuda: (
        <>
          Sistema: <strong>Usar personalizado</strong> e escolha o arquivo do NexON. Armazenamento: o {midia}. Clique em Próximo e,
          em personalizar, <strong>Não</strong>.
        </>
      ),
      visual: <Teclas teclas={['Usar personalizado', 'depois', 'Não']} />,
    },
  ];
  return [
    ...inicio,
    { titulo: 'Coloque o pendrive no Raspberry', ajuda: 'O cartão SD fica dentro do Raspberry.', visual: <DesenhoRaspberry destaque={['sd', 'rede']} /> },
    { titulo: 'Ligue o cabo de rede e a fonte', visual: <DesenhoRaspberry destaque={['rede', 'fonte']} /> },
    { titulo: 'Espere ele desligar sozinho', ajuda: 'Leva uns 10 minutos: ele copia tudo para o cartão SD e desliga.', visual: <Clock className="h-16 w-16 text-muted-foreground" aria-hidden /> },
    { titulo: 'Tire o pendrive', ajuda: 'O Raspberry agora liga pelo cartão SD.', visual: <Usb className="h-16 w-16 text-muted-foreground" aria-hidden /> },
  ];
}

export function EtapaGravar({
  tituloId,
  jeito,
  onJeito,
  so,
  onSo,
  subpasso,
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
  so: SistemaPc;
  onSo: (s: SistemaPc) => void;
  subpasso: number;
  sistema: SistemaPc | 'celular';
  instalador: InstaladorAparelho | undefined;
  carregando: boolean;
  erro: unknown;
  onTentarDeNovo: () => void;
  gerando: boolean;
}) {
  const pc = jeito !== 'pendrive';
  const win = so === 'windows';

  if (subpasso === 0) {
    return (
      <div className="flex flex-col gap-6">
        <TituloEtapa id={tituloId}>Como vai gravar?</TituloEtapa>
        {sistema === 'celular' && (
          <p className={cn('flex items-center gap-2 rounded-xl p-3 text-sm', CAIXA_AVISO)}>
            <Laptop className="h-4 w-4 shrink-0" aria-hidden />
            Abra no computador para gravar.
          </p>
        )}
        <TooltipProvider delayDuration={150}>
        <div role="radiogroup" aria-label="Jeito de gravar" className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {JEITOS.map((j) => {
            const marcado = j.valor === jeito;
            return (
              <div key={j.valor} className="relative">
                <button
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  onClick={() => onJeito(j.valor)}
                  className={cn(
                    'flex min-h-[72px] w-full items-center gap-3 rounded-xl border-2 p-3 pr-11 text-left transition-colors sm:min-h-[148px] sm:flex-col sm:justify-center sm:pr-3 sm:text-center',
                    marcado ? cn('border-nexon-verde', CAIXA_VERDE) : 'border-border mouse:hover:border-muted-foreground',
                  )}
                >
                  <span className={cn('shrink-0 [&_svg]:h-7 [&_svg]:w-7', marcado ? VERDE_TEXTO : 'text-muted-foreground')}>{j.icone}</span>
                  <span className="flex min-w-0 flex-col gap-0.5 sm:items-center">
                    {j.recomendado && (
                      <span className="w-fit rounded-full bg-nexon-verde px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-nexon-azul">
                        Mais rápido
                      </span>
                    )}
                    <span className="text-sm font-semibold leading-tight">{j.titulo}</span>
                    <span className="text-xs leading-tight text-muted-foreground">{j.detalhe}</span>
                    <span className={cn('text-xs font-semibold tabular-nums', marcado ? VERDE_TEXTO : 'text-foreground')}>{j.tempo}</span>
                  </span>
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Por que ${j.titulo}?`}
                      className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground mouse:hover:bg-muted mouse:hover:text-foreground"
                    >
                      <Info className="h-4 w-4" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] text-sm leading-snug">
                    {j.porque}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
        </TooltipProvider>
        {(() => {
          const j = JEITOS.find((x) => x.valor === jeito);
          return j ? (
            <p className="flex gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <strong className="text-foreground">Por quê: </strong>
                {j.porque}
              </span>
            </p>
          ) : null;
        })()}
        {pc && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Qual é o computador?</p>
            <div role="radiogroup" aria-label="Sistema do computador" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {(['mac', 'linux', 'windows'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={so === v}
                  onClick={() => onSo(v)}
                  className={cn(
                    'min-h-11 rounded-lg text-sm font-semibold transition-colors',
                    so === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground mouse:hover:text-foreground',
                  )}
                >
                  {ROTULO_SO[v]}
                  {sistema === v && <span className="block text-[11px] font-normal text-muted-foreground">este computador</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground">Depois é uma coisa por tela. Clique em Começar.</p>
      </div>
    );
  }

  const comandoTexto = win ? instalador?.comando_windows : instalador?.comando;
  const vencido = instalador ? Date.parse(instalador.valido_ate) <= Date.now() : false;
  const pecaComando = carregando ? (
    <div role="status" className="flex h-14 items-center justify-center gap-2 rounded-xl bg-background text-sm text-muted-foreground">
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
  ) : vencido ? (
    <div className="flex flex-col gap-2">
      <p role="alert" className="text-sm font-medium text-amber-600 dark:text-amber-400">
        Este comando venceu. Gere outro.
      </p>
      <BotaoGerarOutro onClick={onTentarDeNovo} gerando={gerando} principal />
    </div>
  ) : comandoTexto ? (
    <div className="flex flex-col gap-1">
      <CaixaComando texto={comandoTexto} rotulo="Copiar comando" grande />
      {instalador && <p className="text-xs text-muted-foreground">Vale até {validadeTexto(instalador.valido_ate)}, para um Raspberry.</p>}
    </div>
  ) : (
    <p className={cn('rounded-xl p-3 text-sm', CAIXA_AVISO)}>Não tem comando para este computador. Volte e escolha Pendrive ou Cartão SD.</p>
  );

  const baixar = instalador ? (
    <Button asChild className={BOTAO_PRINCIPAL}>
      <a href={instalador.url_imagem} download>
        <Download aria-hidden />
        Baixar o NexON
      </a>
    </Button>
  ) : (
    pecaComando
  );

  const passos = jeito === 'cartao' ? passosCartao(so, pecaComando) : jeito === 'pc' ? passosComputador(so, pecaComando) : passosImagem(baixar);
  const i = Math.min(subpasso, passos.length) - 1;
  const p = passos[i];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className={cn('text-sm font-semibold tabular-nums', VERDE_TEXTO)}>
          Passo {i + 1} de {passos.length}
        </p>
        <div aria-hidden className="flex gap-1">
          {passos.map((_, k) => (
            <span key={k} className={cn('h-1 flex-1 rounded-full', k <= i ? 'bg-nexon-verde' : 'bg-muted')} />
          ))}
        </div>
      </div>
      <Quadro>{p.visual}</Quadro>
      <div className="flex flex-col gap-2">
        <h3 id={tituloId} tabIndex={-1} className="text-2xl font-semibold leading-tight outline-none">
          {p.titulo}
        </h3>
        {p.ajuda && <p className="text-base text-muted-foreground">{p.ajuda}</p>}
      </div>
      {p.extra}
      {jeito === 'pc' && i >= 5 && (
        <Expansivel titulo="Não deu certo?">
          <ul className="flex flex-col gap-3">
            <Dica titulo="Não apareceu o Raspberry">Tire o cabo, segure o botão antes de ligar o cabo de novo e só solte depois de 3 segundos.</Dica>
            <Dica titulo="Continua sem aparecer">Troque o cabo: alguns só carregam e não passam dados. Ligue direto no computador.</Dica>
            {so === 'mac' && (
              <Dica titulo="Pediu o Homebrew (Mac)">
                <div className="mt-1">
                  <CaixaComando texto={HOMEBREW} rotulo="Copiar Homebrew" />
                </div>
              </Dica>
            )}
            <Dica titulo="Comando venceu">
              <BotaoGerarOutro onClick={onTentarDeNovo} gerando={gerando} />
            </Dica>
          </ul>
        </Expansivel>
      )}
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
