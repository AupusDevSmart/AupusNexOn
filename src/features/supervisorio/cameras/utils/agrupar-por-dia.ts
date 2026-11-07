/**
 * Dias em America/Sao_Paulo para a lista de eventos das câmeras: a API filtra por
 * `dia=AAAA-MM-DD` nesse fuso e a tela agrupa em "Hoje · 07/11", "Ontem · 06/11",
 * "qui · 05/11". Tudo por chave de texto, sem depender do fuso do navegador.
 */

export const FUSO_BRASILIA = 'America/Sao_Paulo';

const FMT_CHAVE = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_BRASILIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const FMT_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });

const RE_CHAVE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` do instante em Brasília. Data inválida devolve ''. */
export function chaveDia(instante: string | number | Date): string {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return '';
  return FMT_CHAVE.format(d);
}

/** Chave de hoje em Brasília (parâmetro `agora` só para teste). */
export function chaveHoje(agora: Date = new Date()): string {
  return chaveDia(agora);
}

function partes(chave: string): [number, number, number] | null {
  const m = RE_CHAVE.exec(chave);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Soma `delta` dias à chave (aritmética em UTC, sem horário de verão no caminho). */
export function deslocarDia(chave: string, delta: number): string {
  const p = partes(chave);
  if (!p) return chave;
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + delta));
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

/** `07/11` a partir da chave. */
export function diaCurto(chave: string): string {
  const p = partes(chave);
  if (!p) return chave;
  return `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}`;
}

/** `07/11/2026` a partir da chave. */
export function diaCompleto(chave: string): string {
  const p = partes(chave);
  if (!p) return chave;
  return `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}/${p[0]}`;
}

/** `qui` (minúsculo, sem ponto) do dia da chave. */
export function semanaCurta(chave: string): string {
  const p = partes(chave);
  if (!p) return '';
  return FMT_SEMANA.format(new Date(Date.UTC(p[0], p[1] - 1, p[2])))
    .replace(/\.$/, '')
    .toLowerCase();
}

/** "Hoje · 07/11" · "Ontem · 06/11" · "qui · 05/11" (demais dias). */
export function rotuloDia(chave: string, hoje: string = chaveHoje()): string {
  if (!partes(chave)) return chave;
  if (chave === hoje) return `Hoje · ${diaCurto(chave)}`;
  if (chave === deslocarDia(hoje, -1)) return `Ontem · ${diaCurto(chave)}`;
  return `${semanaCurta(chave)} · ${diaCurto(chave)}`;
}

export interface GrupoDia<T> {
  chave: string;
  rotulo: string;
  itens: T[];
}

/**
 * Agrupa mantendo a ordem de chegada (a API manda do mais recente ao mais antigo).
 * Item sem data válida cai num grupo "Sem data" no fim.
 */
export function agruparPorDia<T>(
  itens: readonly T[],
  dataDe: (item: T) => string | null | undefined,
  hoje: string = chaveHoje(),
): GrupoDia<T>[] {
  const grupos = new Map<string, GrupoDia<T>>();
  for (const item of itens) {
    const iso = dataDe(item);
    const chave = iso ? chaveDia(iso) : '';
    const atual = grupos.get(chave);
    if (atual) {
      atual.itens.push(item);
    } else {
      grupos.set(chave, { chave, rotulo: chave ? rotuloDia(chave, hoje) : 'Sem data', itens: [item] });
    }
  }
  const lista = [...grupos.values()];
  const semData = lista.filter((g) => !g.chave);
  return [...lista.filter((g) => g.chave), ...semData];
}
