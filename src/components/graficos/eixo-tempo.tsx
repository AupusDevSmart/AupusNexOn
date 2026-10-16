import type { CSSProperties } from 'react';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Régua de tempo HTML sob um gráfico de tempo do bklit. O `XAxis` do registry
 * escreve só a hora em ponto que tem hora ("14:30") e, quando o domínio vai
 * além dos dados, inventa marcas na cauda vazia — não serve para "Hoje"
 * (00h–24h com o dia inteiro no eixo) nem para semana/mês (dd/mm). Aqui os
 * rótulos ficam nas mesmas margens do gráfico, o primeiro encostado à esquerda
 * e o último à direita, como o SVG antigo dos sheets.
 */
export function EixoTempo({ ini, fim, margemEsq, margemDir, n = 5, formato = 'dia', style }: {
  ini: Date; fim: Date; margemEsq: number; margemDir: number; n?: number;
  /** `hora`: "00h … 24h" (dia inteiro); `dia`: "16/10". */
  formato?: 'dia' | 'hora'; style?: CSSProperties;
}) {
  const t0 = ini.getTime(), t1 = fim.getTime();
  const rotulo = (d: Date, f: number) => (formato === 'hora'
    ? (f >= 1 ? '24h' : `${pad2(d.getHours())}h`)
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: 14, marginLeft: margemEsq, marginRight: margemDir, fontSize: 11, lineHeight: '14px', color: 'var(--chart-label)', fontVariantNumeric: 'tabular-nums', ...style }}>
      {Array.from({ length: n }, (_, i) => {
        const f = n > 1 ? i / (n - 1) : 0;
        return (
          <span key={i} style={{ position: 'absolute', left: `${f * 100}%`, transform: `translateX(${i === 0 ? '0' : i === n - 1 ? '-100%' : '-50%'})`, whiteSpace: 'nowrap' }}>
            {rotulo(new Date(t0 + (t1 - t0) * f), f)}
          </span>
        );
      })}
    </div>
  );
}
