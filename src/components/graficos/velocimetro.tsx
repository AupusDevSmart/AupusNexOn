import type { ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { Gauge, type GaugeProps } from '@/components/charts/gauge';
import { cn } from '@/lib/utils';

type PropsGauge = Omit<
  GaugeProps,
  | 'width'
  | 'height'
  | 'centerValue'
  | 'defaultLabel'
  | 'prefix'
  | 'suffix'
  | 'formatOptions'
  | 'labelPlacement'
  | 'labelAlign'
  | 'className'
>;

export interface VelocimetroProps extends PropsGauge {
  /** Lado do quadrado do velocímetro, em px. */
  size: number;
  /** Número no centro do arco; null/undefined mostra `vazio`. */
  valor?: number | null;
  /** Unidade abaixo do número ("kW"). */
  unidade?: ReactNode;
  /** Linha pequena abaixo ("85% da contratada"); quebra em até 2 linhas. */
  rotulo?: ReactNode;
  /** Casas decimais; sem informar: 1 abaixo de 100, 0 acima. */
  casas?: number;
  /** O que mostrar sem valor. Padrão "—". */
  vazio?: ReactNode;
  className?: string;
}

const fmt = (valor: number, casas: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas }).format(valor);

/**
 * Velocímetro: `Gauge` do bklit com o número DENTRO do arco (o bklit só põe o
 * rótulo fora, acima ou ao lado, e em tamanho de tela — num mostrador de
 * 100 px o número vazava). O arco é de 270° (abre embaixo); o diâmetro interno
 * é 0,56 × size, e a fonte encolhe com a quantidade de dígitos para caber.
 */
export function Velocimetro({ size, valor, unidade, rotulo, casas, vazio = '—', className, ...gauge }: VelocimetroProps) {
  const temValor = typeof valor === 'number' && Number.isFinite(valor);
  const decimais = casas ?? (temValor && Math.abs(valor) >= 100 ? 0 : 1);
  const texto = temValor ? fmt(valor, decimais) : '';
  // Largura útil ~ metade do size; dígito tabular bold ~ 0,6 em.
  const fonteValor = Math.max(
    11,
    Math.floor(Math.min(size * 0.18, (size * 0.5) / (Math.max(texto.length, 2) * 0.6))),
  );
  const fonteUnidade = Math.max(9, Math.round(size * 0.1));
  const fonteRotulo = Math.max(9, Math.round(size * 0.085));

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <Gauge width={size} height={size} {...gauge} />
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        style={{ paddingTop: Math.round(size * 0.04) }}
      >
        <span className="font-bold tabular-nums leading-none text-foreground" style={{ fontSize: fonteValor }}>
          {temValor ? (
            <NumberFlow
              value={valor}
              locales="pt-BR"
              format={{ maximumFractionDigits: decimais, minimumFractionDigits: decimais }}
            />
          ) : (
            <span className="text-muted-foreground">{vazio}</span>
          )}
        </span>
        {unidade && (
          <span className="mt-0.5 font-semibold leading-none text-muted-foreground" style={{ fontSize: fonteUnidade }}>
            {unidade}
          </span>
        )}
        {rotulo && (
          <span
            className="mt-0.5 line-clamp-2 leading-tight text-muted-foreground"
            style={{ fontSize: fonteRotulo, maxWidth: Math.round(size * 0.58) }}
          >
            {rotulo}
          </span>
        )}
      </div>
    </div>
  );
}
