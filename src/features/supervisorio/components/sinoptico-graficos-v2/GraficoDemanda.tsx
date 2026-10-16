import { useState } from 'react';
import { curveLinear, curveMonotoneX } from '@visx/curve';
import { LineChart } from '@/components/charts/line-chart';
import { Line } from '@/components/charts/line';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { weekdayDateFmt } from '@/components/charts/chart-formatters';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Dominio, PontoDemanda } from './dados';
import { formatarKw, potenciaEixo } from './formatos';
import { FaixaBrush } from './FaixaBrush';
import { LegendaSeries, type ItemLegenda } from './Legenda';
import { useJanelaZoom, useRodaZoom } from './use-janela-zoom';

const MARGEM = { top: 12, right: 16, bottom: 28, left: 64 };
/** Séries de referência: sem bolinha no hover (só a demanda tem). */
const CHAVES_REFERENCIA = new Set(['valorContratado', 'valorAdicional']);

export interface ReferenciasDemanda {
  contratado: number;
  adicional: number;
  percentualAdicional: number;
}

interface GraficoDemandaProps {
  pontos: PontoDemanda[];
  /** Eixo fixo do dia; sem ele o eixo é a extensão dos dados (personalizado). */
  dominio?: Dominio;
  /** Linhas de contratado e contratado + adicional (só no período "dia"). */
  referencias?: ReferenciasDemanda;
  /** Muda → zoom volta ao total (troca de período). */
  chaveZoom: string;
  /** No diálogo: brush embaixo; no card: roda do mouse + duplo clique. */
  expandido?: boolean;
  /** Classes do wrapper no card (altura). */
  className?: string;
}

/**
 * Demanda (kW) ao longo do tempo. As linhas de contratado e contratado +
 * adicional entram como séries constantes (e não só como linha da grade) para
 * o eixo Y sempre incluí-las — é a comparação que o gráfico existe para mostrar.
 */
export function GraficoDemanda({
  pontos,
  dominio,
  referencias,
  chaveZoom,
  expandido = false,
  className,
}: GraficoDemandaProps) {
  const isMobile = useIsMobile();
  const janela = useJanelaZoom(pontos, dominio, chaveZoom);
  const [areaEl, setAreaEl] = useState<HTMLDivElement | null>(null);
  useRodaZoom(expandido ? null : areaEl, janela.rolar, true);

  const rotuloAdicional = `Contratado +${referencias?.percentualAdicional ?? 0}%`;

  const grafico = (
    <LineChart
      data={pontos}
      xDomain={janela.xDomain}
      aspectRatio="auto"
      className="h-full"
      margin={MARGEM}
      animationDuration={0}
    >
      <Grid horizontal numTicksRows={4} />
      <Line
        dataKey="potencia"
        stroke={COR.potencia}
        strokeWidth={2}
        curve={curveMonotoneX}
        fadeEdges={false}
        animate={false}
      />
      {referencias && (
        <Line
          dataKey="valorContratado"
          stroke={COR.neutro}
          strokeWidth={1.5}
          dashFromIndex={0}
          dashArray="6,4"
          curve={curveLinear}
          fadeEdges={false}
          animate={false}
          showHighlight={false}
        />
      )}
      {referencias && (
        <Line
          dataKey="valorAdicional"
          stroke={COR.consumo}
          strokeWidth={1.5}
          dashFromIndex={0}
          dashArray="3,3"
          curve={curveLinear}
          fadeEdges={false}
          animate={false}
          showHighlight={false}
        />
      )}
      <XAxis numTicks={isMobile ? 4 : 6} tickMode={janela.xDomain ? 'domain' : 'data'} />
      <YAxis numTicks={4} formatValue={potenciaEixo} />
      <ChartTooltip
        showDots
        dotColor={(_ponto, linha) => (CHAVES_REFERENCIA.has(linha.dataKey) ? 'transparent' : linha.stroke)}
        content={({ point }) => {
          const p = point as PontoDemanda;
          return (
            <TooltipDestaque
              titulo={weekdayDateFmt.format(p.date)}
              valor={formatarKw(p.potencia)}
              unidade="kW"
              rotulo="Demanda"
              linhas={
                referencias
                  ? [
                      { label: 'Contratado', value: `${formatarKw(referencias.contratado)} kW`, cor: COR.neutro },
                      { label: rotuloAdicional, value: `${formatarKw(referencias.adicional)} kW`, cor: COR.consumo },
                    ]
                  : undefined
              }
            />
          );
        }}
      />
    </LineChart>
  );

  const itensLegenda: ItemLegenda[] = referencias
    ? [
        { rotulo: 'Demanda', cor: COR.potencia },
        { rotulo: 'Contratado', cor: COR.neutro, tracejada: true },
        { rotulo: rotuloAdicional, cor: COR.consumo, tracejada: true },
      ]
    : [];

  if (expandido) {
    return (
      <div className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1">{grafico}</div>
        <LegendaSeries itens={itensLegenda} />
        <FaixaBrush pontos={pontos} dataKey="potencia" cor={COR.potencia} dominio={dominio} janela={janela} />
      </div>
    );
  }

  return (
    <>
      <div
        ref={setAreaEl}
        onDoubleClick={janela.resetar}
        title="Roda do mouse = zoom nas horas · duplo clique = restaurar"
        className={className}
      >
        {grafico}
      </div>
      <LegendaSeries
        className="mt-1"
        itens={itensLegenda}
        acao={
          janela.zoomAtivo && (
            <button
              type="button"
              onClick={janela.resetar}
              className="font-medium text-foreground transition-opacity hover:opacity-60"
            >
              Restaurar zoom
            </button>
          )
        }
      />
    </>
  );
}
