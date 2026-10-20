import { useState } from 'react';
import { curveLinear, curveMonotoneX } from '@visx/curve';
import { LineChart } from '@/components/charts/line-chart';
import { Line } from '@/components/charts/line';
import { Area } from '@/components/charts/area';
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
const CHAVES_REFERENCIA = new Set(['valorContratado', 'valorAdicional', 'valorContratadoCarga', 'valorAdicionalCarga']);
const COR_CONSUMO = COR.potencia;
/** Eixo do fluxo: consumo fica abaixo do zero, mas o rótulo mostra o módulo. */
const eixoFluxo = (kw: number) => potenciaEixo(Math.abs(kw));

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
  /** Pontos com `geracao`/`consumo` (mesclarFluxo): geração para cima, consumo para baixo. */
  fluxo?: boolean;
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
  fluxo = false,
}: GraficoDemandaProps) {
  const isMobile = useIsMobile();
  const janela = useJanelaZoom(pontos, dominio, chaveZoom);
  const [areaEl, setAreaEl] = useState<HTMLDivElement | null>(null);
  useRodaZoom(expandido ? null : areaEl, janela.rolar, true);

  const rotuloAdicional = `Contratado +${referencias?.percentualAdicional ?? 0}%`;
  const temGeracao = fluxo && pontos.some((p) => p.geracao != null);
  const temConsumo = fluxo && pontos.some((p) => (p.consumo ?? 0) !== 0);
  const temRefCarga = fluxo && pontos.some((p) => p.valorContratadoCarga != null);
  const temRefGeracao = !!referencias && (!fluxo || temGeracao);
  const linhaRef = (dataKey: string, cor: string, dash: string) => (
    <Line
      key={dataKey}
      dataKey={dataKey}
      stroke={cor}
      strokeWidth={1.5}
      dashFromIndex={0}
      dashArray={dash}
      curve={curveLinear}
      fadeEdges={false}
      animate={false}
      showHighlight={false}
    />
  );

  const seriesFluxo = (
    <>
      {temGeracao && (
        <Area dataKey="geracao" fill={COR.geracao} fillOpacity={0.3} gradientToOpacity={0.04}
          showLine={false} showHighlight={false} curve={curveMonotoneX} animate={false} />
      )}
      {temConsumo && (
        <Area dataKey="consumo" fill={COR_CONSUMO} fillOpacity={0.18} gradientToOpacity={0.18}
          showLine={false} showHighlight={false} curve={curveMonotoneX} animate={false} />
      )}
      {temGeracao && (
        <Line dataKey="geracao" stroke={COR.geracao} strokeWidth={2} curve={curveMonotoneX} fadeEdges={false} animate={false} />
      )}
      {temConsumo && (
        <Line dataKey="consumo" stroke={COR_CONSUMO} strokeWidth={2} curve={curveMonotoneX} fadeEdges={false} animate={false} />
      )}
      {temRefGeracao && linhaRef('valorContratado', COR.neutro, '6,4')}
      {temRefGeracao && linhaRef('valorAdicional', COR.consumo, '3,3')}
      {temRefCarga && linhaRef('valorContratadoCarga', COR.neutro, '6,4')}
      {temRefCarga && linhaRef('valorAdicionalCarga', COR.consumo, '3,3')}
    </>
  );

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
      {fluxo ? seriesFluxo : (<>
      {/* Área verde sob a curva de demanda (NEXON-11). Sem linha própria: o
          traço continua sendo o `Line` abaixo, que define o domínio do eixo. */}
      <Area
        dataKey="potencia"
        fill={COR.geracao}
        fillOpacity={0.3}
        gradientToOpacity={0.04}
        showLine={false}
        showHighlight={false}
        curve={curveMonotoneX}
        animate={false}
      />
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
      </>)}
      <XAxis numTicks={isMobile ? 4 : 6} tickMode={janela.xDomain ? 'domain' : 'data'} />
      <YAxis numTicks={fluxo ? 6 : 4} formatValue={fluxo ? eixoFluxo : potenciaEixo} />
      <ChartTooltip
        showDots
        dotColor={(_ponto, linha) => (CHAVES_REFERENCIA.has(linha.dataKey) ? 'transparent' : linha.stroke)}
        content={({ point }) => {
          const p = point as PontoDemanda;
          if (fluxo) {
            const refs = [
              ...(temRefGeracao && referencias ? [{ label: 'Contratado (geração)', value: `${formatarKw(referencias.contratado)} kW`, cor: COR.neutro }] : []),
              ...(temRefCarga && p.valorContratadoCarga != null ? [{ label: 'Contratado (carga)', value: `${formatarKw(Math.abs(p.valorContratadoCarga))} kW`, cor: COR.neutro }] : []),
            ];
            return (
              <TooltipDestaque
                titulo={weekdayDateFmt.format(p.date)}
                linhas={[
                  ...(temGeracao ? [{ label: 'Geração', value: `${formatarKw(p.geracao ?? 0)} kW`, cor: COR.geracao }] : []),
                  ...(temConsumo ? [{ label: 'Consumo', value: `${formatarKw(Math.abs(p.consumo ?? 0))} kW`, cor: COR_CONSUMO }] : []),
                  ...(temGeracao && temConsumo ? [{ label: 'Saldo', value: `${formatarKw(p.potencia)} kW` }] : []),
                  ...refs,
                ]}
              />
            );
          }
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

  const itensLegenda: ItemLegenda[] = fluxo
    ? [
        ...(temGeracao ? [{ rotulo: 'Geração', cor: COR.geracao }] : []),
        ...(temConsumo ? [{ rotulo: 'Consumo', cor: COR_CONSUMO }] : []),
        ...(temRefGeracao || temRefCarga
          ? [
              { rotulo: 'Contratado', cor: COR.neutro, tracejada: true },
              { rotulo: rotuloAdicional, cor: COR.consumo, tracejada: true },
            ]
          : []),
      ]
    : referencias
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
