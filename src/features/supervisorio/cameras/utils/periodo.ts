import { chaveHoje, deslocarDia, diaCurto, semanaCurta } from './agrupar-por-dia';

/** Filtro de período da lista de eventos (datas e horas em Brasília). `null` = sem limite. */
export interface PeriodoEventos {
  /** AAAA-MM-DD */
  de: string | null;
  /** AAAA-MM-DD (inclusive); null = só o dia `de`. */
  ate: string | null;
  /** HH:MM */
  horaDe: string | null;
  horaAte: string | null;
}

export const PERIODO_VAZIO: PeriodoEventos = { de: null, ate: null, horaDe: null, horaAte: null };

/** A API aceita até 92 dias por consulta. */
export const PERIODO_MAX_DIAS = 92;

const RE_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const horaMinValida = (s: string) => RE_HHMM.test(s);

export type AtalhoDia = 'qualquer' | 'hoje' | 'ontem' | '7dias' | '30dias';
export const ATALHOS_DIA: { valor: AtalhoDia; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: '7dias', rotulo: 'Últimos 7 dias' },
  { valor: '30dias', rotulo: 'Últimos 30 dias' },
  { valor: 'qualquer', rotulo: 'Qualquer dia' },
];

export type AtalhoHora = 'qualquer' | 'madrugada' | 'manha' | 'tarde' | 'noite';
export const ATALHOS_HORA: { valor: AtalhoHora; rotulo: string; de: string | null; ate: string | null }[] = [
  { valor: 'qualquer', rotulo: 'Qualquer hora', de: null, ate: null },
  { valor: 'madrugada', rotulo: 'Madrugada', de: '00:00', ate: '06:00' },
  { valor: 'manha', rotulo: 'Manhã', de: '06:00', ate: '12:00' },
  { valor: 'tarde', rotulo: 'Tarde', de: '12:00', ate: '18:00' },
  { valor: 'noite', rotulo: 'Noite', de: '18:00', ate: '06:00' },
];

/** Datas do atalho (hoje vem de fora para teste). */
export function diasDoAtalho(a: AtalhoDia, hoje: string = chaveHoje()): Pick<PeriodoEventos, 'de' | 'ate'> {
  switch (a) {
    case 'hoje':
      return { de: hoje, ate: null };
    case 'ontem':
      return { de: deslocarDia(hoje, -1), ate: null };
    case '7dias':
      return { de: deslocarDia(hoje, -6), ate: hoje };
    case '30dias':
      return { de: deslocarDia(hoje, -29), ate: hoje };
    default:
      return { de: null, ate: null };
  }
}

/** Qual atalho de dia bate com o período (para marcar o botão); `null` = dias escolhidos no calendário. */
export function atalhoDiaAtual(p: PeriodoEventos, hoje: string = chaveHoje()): AtalhoDia | null {
  for (const a of ATALHOS_DIA) {
    const d = diasDoAtalho(a.valor, hoje);
    if (d.de === p.de && (d.ate ?? d.de) === (p.ate ?? p.de)) return a.valor;
  }
  return null;
}

export function atalhoHoraAtual(p: PeriodoEventos): AtalhoHora | null {
  const a = ATALHOS_HORA.find((x) => x.de === p.horaDe && x.ate === p.horaAte);
  return a?.valor ?? null;
}

export function temPeriodo(p: PeriodoEventos): boolean {
  return !!(p.de || p.horaDe || p.horaAte);
}

/** `18:00` → `18h`; `08:30` → `8h30`. */
export function horaCurtaTexto(h: string): string {
  const [hh, mm] = h.split(':');
  return `${Number(hh)}h${mm === '00' ? '' : mm}`;
}

/** Texto do botão: "Hoje", "Últimos 7 dias", "14/11 – 16/11", "Hoje · 18h–6h", "Período". */
export function rotuloPeriodo(p: PeriodoEventos, hoje: string = chaveHoje()): string {
  let dias = '';
  if (p.de) {
    const atalho = atalhoDiaAtual(p, hoje);
    if (atalho) dias = ATALHOS_DIA.find((a) => a.valor === atalho)!.rotulo;
    else if (!p.ate || p.ate === p.de) dias = diaCurto(p.de);
    else dias = `${diaCurto(p.de)} – ${diaCurto(p.ate)}`;
  }
  let horas = '';
  if (p.horaDe || p.horaAte) {
    const a = atalhoHoraAtual(p);
    horas =
      a && a !== 'qualquer'
        ? ATALHOS_HORA.find((x) => x.valor === a)!.rotulo
        : `${horaCurtaTexto(p.horaDe ?? '00:00')}–${horaCurtaTexto(p.horaAte ?? '23:59')}`;
  }
  if (dias && horas) return `${dias} · ${horas}`;
  return dias || horas || 'Período';
}

/** Parâmetros da API (`de`, `ate`, `hora_de`, `hora_ate`) sem chaves vazias. */
export function paramsPeriodo(p: PeriodoEventos): { de?: string; ate?: string; hora_de?: string; hora_ate?: string } {
  const r: { de?: string; ate?: string; hora_de?: string; hora_ate?: string } = {};
  if (p.de) r.de = p.de;
  if (p.de && p.ate && p.ate !== p.de) r.ate = p.ate;
  if (p.horaDe) r.hora_de = p.horaDe;
  if (p.horaAte) r.hora_ate = p.horaAte;
  return r;
}

/** Faixa curta de um atalho de hora: `18h–6h`. */
export function faixaHoras(de: string, ate: string): string {
  return `${horaCurtaTexto(de)}–${horaCurtaTexto(ate)}`;
}

/** Fim antes (ou igual) do início: a faixa atravessa a meia-noite (a API lê assim). */
export function passaMeiaNoite(p: Pick<PeriodoEventos, 'horaDe' | 'horaAte'>): boolean {
  return !!(p.horaDe && p.horaAte && p.horaAte <= p.horaDe);
}

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Trechos do dia cobertos pela faixa de hora, em minutos [início, fim) (para a régua de 24h). */
export function segmentosHora(p: Pick<PeriodoEventos, 'horaDe' | 'horaAte'>): [number, number][] {
  const de = p.horaDe ? minutos(p.horaDe) : null;
  const ate = p.horaAte ? minutos(p.horaAte) : null;
  if (de === null && ate === null) return [];
  if (ate === null) return [[de!, 1440]];
  if (de === null) return [[0, ate]];
  if (ate > de) return [[de, ate]];
  if (ate === 0) return [[de, 1440]];
  return [
    [0, ate],
    [de, 1440],
  ];
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** `14 de nov` (com ano quando não é o ano de hoje). */
function diaMes(chave: string, hoje: string, comMes = true): string {
  const [a, m, d] = chave.split('-').map(Number);
  let t = String(d);
  if (comMes) t += ` de ${MESES[m - 1]}`;
  if (comMes && chave.slice(0, 4) !== hoje.slice(0, 4)) t += ` de ${a}`;
  return t;
}

/** `das 18h` / `da 1h` / `da meia-noite` / `do meio-dia`. */
function inicioHora(h: string): string {
  if (h === '00:00') return 'da meia-noite';
  if (h === '12:00') return 'do meio-dia';
  return `${h.startsWith('01:') ? 'da' : 'das'} ${horaCurtaTexto(h)}`;
}

/** `às 6h` / `à 1h` / `à meia-noite` / `ao meio-dia`. */
function fimHora(h: string): string {
  if (h === '00:00') return 'à meia-noite';
  if (h === '12:00') return 'ao meio-dia';
  return `${h.startsWith('01:') ? 'à' : 'às'} ${horaCurtaTexto(h)}`;
}

const TODO_ATALHO: Record<Exclude<AtalhoHora, 'qualquer'>, string> = {
  madrugada: 'Toda madrugada',
  manha: 'Toda manhã',
  tarde: 'Toda tarde',
  noite: 'Toda noite',
};

/** Só a parte dos dias, em texto de gente: "Ontem", "Sex, 14 de nov", "10 a 12 de nov", "28 de out a 3 de nov". */
export function resumoDias(p: PeriodoEventos, hoje: string = chaveHoje()): string | null {
  if (!p.de) return null;
  const atalho = atalhoDiaAtual(p, hoje);
  if (atalho && atalho !== 'qualquer') return ATALHOS_DIA.find((a) => a.valor === atalho)!.rotulo;
  if (!p.ate || p.ate === p.de) {
    const sem = semanaCurta(p.de);
    return `${sem ? `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ` : ''}${diaMes(p.de, hoje)}`;
  }
  const mesmoMes = p.de.slice(0, 7) === p.ate.slice(0, 7);
  return `${diaMes(p.de, hoje, !mesmoMes)} a ${diaMes(p.ate, hoje)}`;
}

/**
 * Resumo completo para ler de relance: "Todo o período", "Ontem", "Ontem · Noite, 18h–6h",
 * "10 a 12 de nov, das 8h30 às 12h", "Toda noite, 18h–6h", "Todo dia, a partir das 18h".
 */
export function resumoPeriodo(p: PeriodoEventos, hoje: string = chaveHoje()): string {
  const dias = resumoDias(p, hoje);
  if (!p.horaDe && !p.horaAte) return dias ?? 'Todo o período';
  const a = atalhoHoraAtual(p);
  if (a && a !== 'qualquer') {
    const atalho = ATALHOS_HORA.find((x) => x.valor === a)!;
    const faixa = faixaHoras(atalho.de!, atalho.ate!);
    return dias ? `${dias} · ${atalho.rotulo}, ${faixa}` : `${TODO_ATALHO[a]}, ${faixa}`;
  }
  let horas: string;
  if (p.horaDe && p.horaAte) horas = `${inicioHora(p.horaDe)} ${fimHora(p.horaAte)}`;
  else if (p.horaDe) horas = `a partir ${inicioHora(p.horaDe)}`;
  else horas = `até ${fimHora(p.horaAte!).replace(/^às /, 'as ').replace(/^à /, 'a ').replace(/^ao /, 'o ')}`;
  return `${dias ?? 'Todo dia'}, ${horas}`;
}

/** "8" → 08:00 · "18" → 18:00 · "830" → 08:30 · "1830" ou "18:30" → 18:30; inválido → null. */
export function interpretarHora(texto: string): string | null {
  const d = texto.replace(/\D/g, '').slice(0, 4);
  if (!d) return null;
  let h: number;
  let m = 0;
  if (d.length <= 2) h = Number(d);
  else if (d.length === 3) [h, m] = [Number(d.slice(0, 1)), Number(d.slice(1))];
  else [h, m] = [Number(d.slice(0, 2)), Number(d.slice(2))];
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
