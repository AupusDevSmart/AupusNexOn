// Regra dos gráficos de equipamento (NEXON-99): a aba do dia é linha; as abas
// de período mais longo (semana, mês, ano) são barras, uma por dia.
// Este helper transforma leituras soltas (`{ t, d }`) em linhas de `BarChart`
// do bklit: `rotulo` é a categoria do eixo X ("05/11"), cada série guarda a
// média do dia em `<chave>` (0 quando o dia não tem leitura, para a barra não
// quebrar o gráfico) e o valor real em `<chave>Bruto` (null sem leitura, para o
// tooltip mostrar "—" em vez de inventar número).

export type LinhaDia = Record<string, unknown> & { rotulo: string; date: Date };

type Ponto = { t: number; d: Record<string, unknown> };

/** Início de cada dia (horário local) entre `ini` e `fim`, inclusive. */
export function diasEntre(ini: Date, fim: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(ini);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() <= fim.getTime()) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Média diária de cada série; `null` no dia sem leitura. */
export function mediasPorDia<P extends Ponto>(
  pts: P[],
  dias: Date[],
  series: Record<string, (d: P['d']) => number | null>,
): Record<string, Array<number | null>> {
  const ids = Object.keys(series);
  const acc: Record<string, Array<{ s: number; c: number }>> = {};
  ids.forEach((id) => { acc[id] = dias.map(() => ({ s: 0, c: 0 })); });
  const inicio = dias.map((d) => d.getTime());
  const indice = (t: number) => {
    // busca do último dia com início ≤ t (dias em ordem crescente)
    let lo = 0, hi = inicio.length - 1, r = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (inicio[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  };
  const fimUltimo = dias.length ? inicio[inicio.length - 1] + 86400000 : 0;
  for (const p of pts) {
    if (p.t >= fimUltimo) continue;
    const i = indice(p.t);
    if (i < 0) continue;
    ids.forEach((id) => {
      const v = series[id](p.d);
      if (v == null || !Number.isFinite(v)) return;
      acc[id][i].s += v; acc[id][i].c += 1;
    });
  }
  const out: Record<string, Array<number | null>> = {};
  ids.forEach((id) => { out[id] = acc[id].map((a) => (a.c ? a.s / a.c : null)); });
  return out;
}

/** Linhas do `BarChart` (uma por dia). `base` é subtraída do valor desenhado (zoom em V/Hz/FP). */
export function linhasPorDia(
  dias: Date[],
  valores: Record<string, Array<number | null>>,
  base: (id: string) => number = () => 0,
): LinhaDia[] {
  const ids = Object.keys(valores);
  return dias.map((dia, i) => {
    const linha: LinhaDia = {
      rotulo: dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      date: dia,
    };
    ids.forEach((id) => {
      const v = valores[id][i];
      const b = base(id);
      linha[id] = v == null ? 0 : Math.max(0, v - b);
      linha[`${id}Bruto`] = v == null ? null : v - b;
    });
    return linha;
  });
}
