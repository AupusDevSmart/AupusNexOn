/**
 * Formatos pt-BR dos relatórios de operação (padrão §11).
 * Datas sempre no horário de Brasília, independente do fuso da máquina.
 */

const FUSO = 'America/Sao_Paulo';

export const TRACO = '—';

/** Número pt-BR com `d` casas fixas (1.234,5). */
export function nf(v: number, d = 0): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Número ou "—" quando nulo / não finito. */
export function nfOu(v: number | null | undefined, d = 0): string {
  return v == null || !Number.isFinite(v) ? TRACO : nf(v, d);
}

/** Casas só quando o número não é inteiro (22 kW, 7,4 kW). */
export function nfAuto(v: number, dMax = 1): string {
  return Number.isInteger(v) ? nf(v) : nf(v, dMax);
}

/** kWh → MWh quando |kWh| ≥ 10.000. */
export function energia(kwh: number): { valor: string; unidade: 'kWh' | 'MWh' } {
  if (Math.abs(kwh) >= 10_000) return { valor: nf(kwh / 1000, 1), unidade: 'MWh' };
  return { valor: nf(kwh), unidade: 'kWh' };
}

export function energiaTexto(kwh: number): string {
  const e = energia(kwh);
  return `${e.valor} ${e.unidade}`;
}

export function reais(v: number, d = 2): string {
  return `R$ ${nf(v, d)}`;
}

/** Variação percentual com sinal tipográfico: "+6,2%" / "−4,8%". */
export function variacao(atual: number, anterior: number, d = 1): string | null {
  if (!anterior) return null;
  const p = (atual / anterior - 1) * 100;
  const s = nf(Math.abs(p), d);
  if (s === nf(0, d)) return `${s}%`;
  return `${p > 0 ? '+' : '−'}${s}%`;
}

/** Percentual com sinal para desvios ("−15,7%"). */
export function desvio(p: number, d = 1): string {
  const s = nf(Math.abs(p), d);
  if (s === nf(0, d)) return `${s}%`;
  return `${p > 0 ? '+' : '−'}${s}%`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Minutos → "2 h 40" (sempre h + minutos com 2 dígitos). */
export function duracaoMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)} h ${pad(m % 60)}`;
}

/** Intervalo em ms → "2 d 3 h" (≥ 1 dia) ou "19 h 20". */
export function duracaoLonga(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(min / 1440);
  if (d >= 1) return `${d} d ${Math.floor((min % 1440) / 60)} h`;
  return duracaoMin(min);
}

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  /** 0 = domingo. */
  semana: number;
}

const fmtPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hour12: false,
});
const SEMANA_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Partes de uma data em Brasília. Aceita ISO com hora ou só 'YYYY-MM-DD'. */
export function partes(iso: string): Partes {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [a, m, d] = iso.split('-').map(Number);
    return { ano: a, mes: m, dia: d, hora: 0, minuto: 0, semana: new Date(Date.UTC(a, m - 1, d)).getUTCDay() };
  }
  const p: Record<string, string> = {};
  for (const x of fmtPartes.formatToParts(new Date(iso))) p[x.type] = x.value;
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24,
    minuto: Number(p.minute),
    semana: SEMANA_EN.indexOf(p.weekday),
  };
}

export function dataCurta(iso: string): string {
  const p = partes(iso);
  return `${pad(p.dia)}/${pad(p.mes)}`;
}

export function dataLonga(iso: string): string {
  const p = partes(iso);
  return `${pad(p.dia)}/${pad(p.mes)}/${p.ano}`;
}

export function hora(iso: string): string {
  const p = partes(iso);
  return `${pad(p.hora)}:${pad(p.minuto)}`;
}

export function dataHora(iso: string): string {
  return `${dataCurta(iso)} ${hora(iso)}`;
}

/** Para planilha: "2026-10-11 07:02". */
export function dataHoraPlanilha(iso: string): string {
  const p = partes(iso);
  return `${p.ano}-${pad(p.mes)}-${pad(p.dia)} ${pad(p.hora)}:${pad(p.minuto)}`;
}

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export const SEMANA_CURTA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** '2026-10' → "Outubro de 2026". */
export function mesExtenso(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return `${cap(MESES[m - 1])} de ${a}`;
}

/** '2026-10' → "outubro". */
export function nomeMes(mes: string): string {
  return MESES[Number(mes.split('-')[1]) - 1];
}

/** '2026-10' → "out". */
export function mesAbrev(mes: string): string {
  return nomeMes(mes).slice(0, 3);
}

/** Desloca 'YYYY-MM' em n meses. */
export function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

/** Mês 'YYYY-MM' de uma data (em Brasília). */
export function mesDe(d: Date): string {
  const p = partes(d.toISOString());
  return `${p.ano}-${pad(p.mes)}`;
}

/** Lista com "a" e "e": ["a","b","c"] → "a, b e c". */
export function juntarE(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Teto "redondo" para escala de gráfico (1, 2, 2,5, 5 × 10ⁿ). */
export function tetoRedondo(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
