import { chaveHoje, deslocarDia, diaCurto } from './agrupar-por-dia';

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
  { valor: 'qualquer', rotulo: 'Qualquer dia' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: '7dias', rotulo: 'Últimos 7 dias' },
  { valor: '30dias', rotulo: 'Últimos 30 dias' },
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
function horaCurtaTexto(h: string): string {
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
