import { useChart } from '@/components/charts/chart-context';

/**
 * Camadas extras sobre os gráficos do bklit para a análise de geração (NEXON-16). O bklit não
 * tem marcador por barra, linha com buraco nem clique em barra; estes filhos leem as escalas
 * do próprio gráfico (`useChart`) e desenham por cima, no mesmo sistema de coordenadas.
 */

interface PontoLinha {
  date: Date;
  valor: number | null;
}

/**
 * Linha tracejada que PARA onde não há valor (GER-12: o esperado termina onde há dado de
 * satélite, sem extrapolar). Usar dentro de LineChart/AreaChart.
 */
export function LinhaTracejadaParcial({ pontos, cor, largura = 1.75, tracejado = '6,4' }: {
  pontos: PontoLinha[];
  cor: string;
  largura?: number;
  tracejado?: string;
}) {
  const { xScale, yScale } = useChart();
  const trechos: string[] = [];
  let atual = '';
  for (const p of pontos) {
    const x = xScale(p.date);
    if (p.valor == null || x == null || !Number.isFinite(x)) {
      if (atual) trechos.push(atual);
      atual = '';
      continue;
    }
    const y = yScale(p.valor);
    atual += `${atual ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  if (atual) trechos.push(atual);
  return (
    <g pointerEvents="none">
      {trechos.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={cor} strokeWidth={largura} strokeDasharray={tracejado} strokeLinejoin="round" />
      ))}
    </g>
  );
}
(LinhaTracejadaParcial as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;

/**
 * Marcador horizontal do esperado sobre cada barra (GER-21). `chave` = campo do esperado em
 * cada linha de `data` do BarChart; o eixo precisa alcançar o valor (série de folga empilhada).
 */
export function MarcadorEsperadoBarras({ chave, cor }: { chave: string; cor: string }) {
  const { data, barScale, bandWidth, barXAccessor, yScale } = useChart();
  if (!barScale || !barXAccessor || bandWidth == null) return null;
  const sobra = Math.min(6, bandWidth * 0.25);
  return (
    <g pointerEvents="none">
      {data.map((d, i) => {
        const v = d[chave];
        if (typeof v !== 'number' || !Number.isFinite(v)) return null;
        const x = barScale(barXAccessor(d));
        if (x == null) return null;
        const y = yScale(v);
        return (
          <line
            key={i}
            x1={x - sobra}
            x2={x + bandWidth + sobra}
            y1={y}
            y2={y}
            stroke={cor}
            strokeWidth={2}
            strokeDasharray="4,2"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}
(MarcadorEsperadoBarras as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;

/**
 * Faixa clicável por barra: tocar abre aquele dia/mês (GER-21). Também escreve "sem dados"
 * na faixa das barras ausentes (GER-22) quando `semDados(d)` for verdadeiro.
 */
export function CliqueBarras({ onClick, semDados, rotuloSemDados = 'sem dados' }: {
  onClick?: (indice: number) => void;
  semDados?: (d: Record<string, unknown>) => boolean;
  rotuloSemDados?: string;
}) {
  const { data, barScale, bandWidth, barXAccessor, innerHeight, columnWidth } = useChart();
  if (!barScale || !barXAccessor || bandWidth == null) return null;
  const vertical = columnWidth >= 12 && bandWidth < 26;
  return (
    <g>
      {data.map((d, i) => {
        const x = barScale(barXAccessor(d));
        if (x == null) return null;
        const vazio = semDados?.(d) ?? false;
        const largura = Math.max(bandWidth, columnWidth * 0.9);
        const x0 = x + bandWidth / 2 - largura / 2;
        return (
          <g key={i}>
            {vazio && (
              <>
                <rect x={x0} y={0} width={largura} height={innerHeight} rx={3} className="fill-black/5 dark:fill-white/10" pointerEvents="none" />
                <text
                  x={x + bandWidth / 2}
                  y={innerHeight - 6}
                  textAnchor={vertical ? 'start' : 'middle'}
                  transform={vertical ? `rotate(-90 ${x + bandWidth / 2} ${innerHeight - 6})` : undefined}
                  dy={vertical ? '0.32em' : undefined}
                  className="fill-muted-foreground"
                  fontSize={10}
                  pointerEvents="none"
                >
                  {rotuloSemDados}
                </text>
              </>
            )}
            {onClick && (
              <rect
                x={x0}
                y={0}
                width={largura}
                height={innerHeight}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => onClick(i)}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
(CliqueBarras as unknown as { __isPostOverlay: boolean }).__isPostOverlay = true;
