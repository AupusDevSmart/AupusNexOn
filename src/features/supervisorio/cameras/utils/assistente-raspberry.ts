import type { Agente } from '../types';

/** Etapas do assistente "Adicionar Raspberry novo" (NEXON-108). */
export const ETAPAS_ASSISTENTE = ['Gravar', 'Ligar', 'Conectar', 'Câmeras'] as const;
export type EtapaAssistente = 1 | 2 | 3 | 4;
/** pc = cabo USB-C; cartao = cartão no computador; pendrive = pendrive instalador (copia para o cartão); usb = pendrive como memória (sem microSD). */
export type JeitoGravar = 'pc' | 'pendrive' | 'cartao' | 'usb';

/** Quantas telas tem o guia de gravar de cada jeito (sem contar a tela de escolha). */
export function totalPassosGravar(jeito: JeitoGravar): number {
  return jeito === 'pc' ? 12 : jeito === 'pendrive' ? 8 : jeito === 'usb' ? 13 : 9;
}

/** Depois disto sem aparecer, a etapa Conectar mostra "Não apareceu?". */
export const ESPERA_ANTES_DE_AJUDA_MS = 20 * 60_000;
/** Sessão guardada mais velha que isto recomeça do zero (a chave da usina vale 48 h). */
export const VALIDADE_SESSAO_MS = 48 * 3_600_000;

/** O que o assistente guarda para fechar e reabrir no mesmo ponto (sessionStorage). */
export interface SessaoAssistente {
  etapa: EtapaAssistente;
  jeito: JeitoGravar;
  /** Início desta instalação (ms); também separa o comando gerado para ela. */
  iniciadoEm: number;
  /** Aparelhos que a usina já tinha ao abrir: qualquer outro que surgir é o novo. */
  idsIniciais: string[] | null;
  /** Quando entrou na etapa Conectar (ms). */
  procurandoDesde: number | null;
  /** Itens marcados na etapa Ligar. */
  marcados: string[];
  /** Tela dentro da etapa Gravar: 0 = escolher o jeito; 1..N = um passo por tela. */
  subpasso: number;
}

const chave = (unidadeId: string) => `nexon.assistente-raspberry.${unidadeId.trim()}`;

export function sessaoNova(jeito: JeitoGravar = 'cartao', agora = Date.now()): SessaoAssistente {
  return { etapa: 1, jeito, iniciadoEm: agora, idsIniciais: null, procurandoDesde: null, marcados: [], subpasso: 0 };
}

function etapaValida(n: unknown): n is EtapaAssistente {
  return n === 1 || n === 2 || n === 3 || n === 4;
}

/** Lê a sessão desta usina; `null` se não houver, estiver corrompida, vencida ou o storage falhar. */
export function lerSessao(unidadeId: string, agora = Date.now()): SessaoAssistente | null {
  try {
    const bruto = window.sessionStorage.getItem(chave(unidadeId));
    if (!bruto) return null;
    const s = JSON.parse(bruto) as Partial<SessaoAssistente>;
    if (!etapaValida(s.etapa) || typeof s.iniciadoEm !== 'number') return null;
    if (agora - s.iniciadoEm > VALIDADE_SESSAO_MS) return null;
    return {
      etapa: s.etapa,
      jeito: s.jeito === 'pendrive' || s.jeito === 'cartao' || s.jeito === 'usb' ? s.jeito : 'pc',
      iniciadoEm: s.iniciadoEm,
      idsIniciais: Array.isArray(s.idsIniciais) ? s.idsIniciais.filter((x): x is string => typeof x === 'string') : null,
      procurandoDesde: typeof s.procurandoDesde === 'number' ? s.procurandoDesde : null,
      marcados: Array.isArray(s.marcados) ? s.marcados.filter((x): x is string => typeof x === 'string') : [],
      subpasso: typeof s.subpasso === 'number' && s.subpasso >= 0 ? Math.floor(s.subpasso) : 0,
    };
  } catch {
    return null;
  }
}

/** Etapa guardada desta usina (para o botão dizer "Continuar"), ou `null`. */
export function etapaGuardada(unidadeId: string): EtapaAssistente | null {
  return lerSessao(unidadeId)?.etapa ?? null;
}

export function gravarSessao(unidadeId: string, s: SessaoAssistente): void {
  try {
    window.sessionStorage.setItem(chave(unidadeId), JSON.stringify(s));
  } catch {
    /* aba anônima ou storage cheio: o assistente segue funcionando, só não lembra */
  }
}

export function limparSessao(unidadeId: string): void {
  try {
    window.sessionStorage.removeItem(chave(unidadeId));
  } catch {
    /* idem */
  }
}

/**
 * Aparelho que não estava na usina quando o assistente abriu. Se surgirem vários, o criado por
 * último. `null` enquanto a lista inicial não foi guardada.
 */
export function acharAparelhoNovo(agentes: Agente[] | undefined, idsIniciais: string[] | null): Agente | null {
  if (!agentes || !idsIniciais) return null;
  const antes = new Set(idsIniciais);
  const novos = agentes.filter((a) => !antes.has(a.id));
  if (novos.length === 0) return null;
  return novos.reduce((a, b) => (Date.parse(b.created_at) > Date.parse(a.created_at) ? b : a));
}

/** "4 min 05 s", "1 h 02 min", "12 s". */
export function duracaoTexto(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(seg).padStart(2, '0')} s`;
  return `${seg} s`;
}

/** "hoje às 14:30", "amanhã às 09:00" ou "18/11 às 14:30". */
export function validadeTexto(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dia(d) - dia(agora)) / 86_400_000);
  if (diff === 0) return `hoje às ${hora}`;
  if (diff === 1) return `amanhã às ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora}`;
}

/** Sistema de quem está na tela, para recomendar o jeito de gravar. */
export function sistemaDoComputador(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): 'mac' | 'linux' | 'windows' | 'celular' {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return 'celular';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Linux|X11|CrOS|FreeBSD/i.test(ua)) return 'linux';
  return 'mac';
}

/** O comando do NexON com o jeito escolhido (o instalador pula o que não é desse jeito). */
export function comandoComModo(comando: string, modo: 'cartao' | 'cabo' | 'pendrive', win: boolean): string {
  if (win) return comando.replace('-Command "', `-Command "$env:NEXON_MODO='${modo}'; `);
  return comando.replace(/\| bash$/, `| NEXON_MODO=${modo} bash`);
}
