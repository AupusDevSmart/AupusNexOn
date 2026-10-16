// Ponte entre o `bucketize` dos sheets (média por intervalo, `null` = sem
// leitura) e os gráficos de tempo do bklit (`LineChart`/`AreaChart`/
// `ComposedChart`), que exigem `date: Date` por linha e NÃO desenham buraco:
// um `null` vira 0 px (topo do gráfico). Regras:
//  - intervalo sem leitura em nenhuma série é descartado (a linha atravessa o
//    buraco em reta — o bklit não tem gap);
//  - série sem valor num intervalo que tem outras recebe interpolação linear só
//    para o traço; o valor bruto fica em `<chave>Bruto` (null) para o tooltip
//    mostrar "—" em vez de inventar número.
// A data é o início do intervalo, em horário local (rótulos do eixo caem em
// "06:00", não "06:07").

export type LinhaBucket = Record<string, unknown> & { date: Date };

export function linhasDeBuckets(
  ini: number,
  fim: number,
  series: Record<string, Array<number | null>>,
): LinhaBucket[] {
  const chaves = Object.keys(series);
  const n = Math.max(0, ...chaves.map((k) => series[k].length));
  if (!chaves.length || n === 0) return [];
  const linhas: LinhaBucket[] = [];
  for (let i = 0; i < n; i++) {
    if (!chaves.some((k) => series[k][i] != null)) continue;
    const linha: LinhaBucket = { date: new Date(ini + (i / n) * (fim - ini)) };
    chaves.forEach((k) => {
      const v = series[k][i];
      linha[k] = v == null ? interpola(series[k], i) : v;
      linha[`${k}Bruto`] = v ?? null;
    });
    linhas.push(linha);
  }
  return linhas;
}

/** Valor para o traço num índice sem leitura: reta entre vizinhos; na ponta, o vizinho mais próximo; sem nada, 0. */
function interpola(arr: Array<number | null>, i: number): number {
  let a = i - 1;
  while (a >= 0 && arr[a] == null) a--;
  let b = i + 1;
  while (b < arr.length && arr[b] == null) b++;
  const va = a >= 0 ? arr[a] : null;
  const vb = b < arr.length ? arr[b] : null;
  if (va != null && vb != null) return va + ((vb - va) * (i - a)) / (b - a);
  return va ?? vb ?? 0;
}

/**
 * Props de uma `Line` invisível que só estica o domínio Y: o bklit não tem
 * `yDomain` (o eixo vai de 0 ao maior valor das séries), então uma linha de
 * referência acima dos dados (contratada, potência nominal) ficaria fora do
 * gráfico. Use com uma chave constante nas linhas (ex.: `teto`) e
 * `showDots={false}` no tooltip.
 */
export const LINHA_SO_DOMINIO = {
  stroke: 'transparent',
  strokeWidth: 0,
  showHighlight: false,
  fadeEdges: false,
  animate: false,
  loading: false,
} as const;
