import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { Grid } from '@/components/charts/grid';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque, type LinhaTooltip } from '@/components/graficos/tooltip-destaque';
import { CliqueBarras, MarcadorEsperadoBarras } from '@/components/graficos/marcadores-esperado';
import { LegendaSeries, type ItemLegenda } from '@/features/supervisorio/components/sinoptico-graficos-v2/Legenda';
import { energiaEixo } from '@/features/supervisorio/components/sinoptico-graficos-v2/formatos';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PeriodoAnalise } from './api';
import type { LinhaEnergia, SeriesEfetivas } from './energia';
import { linhasFonteDoPonto } from './fonte';
import { nf } from './formato';

const MARGEM = { top: 12, right: 16, bottom: 28, left: 64 };
const NUM_TICKS = 4;
/** Carga = azul, como na Demanda (COR_CONSUMO do GraficoDemanda). */
const COR_CARGA = COR.potencia;

const dataBr = (d: string) => d.split('-').reverse().join('/');

/**
 * Barras de energia do cartão Energia (Semana/Mês/Ano/Total): geração da análise (fonte
 * escolhida), consumo da Demanda e marcador do esperado. Espelhado = consumo para cima e
 * geração para baixo a partir de `zero` (ver `montarBarrasEnergia`).
 */
export function BarrasEnergia({ linhas, zero, ef, periodo, rotuloEsperado, onAbrir, className }: {
  linhas: LinhaEnergia[];
  zero: number;
  ef: SeriesEfetivas;
  periodo: PeriodoAnalise;
  rotuloEsperado: string;
  onAbrir?: (indice: number) => void;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const eixo = ef.modo === 'fluxo' ? (v: number) => energiaEixo(Math.abs(v - zero)) : energiaEixo;
  const titulo = (l: LinhaEnergia) => (periodo === 'ano' || periodo === 'total' ? l.rotulo : dataBr(l.ponto.data));
  const legenda: ItemLegenda[] = [
    ...(ef.carga ? [{ rotulo: 'Consumo', cor: COR_CARGA }] : []),
    ...(ef.geracao ? [{ rotulo: 'Geração', cor: COR.geracao }] : []),
    ...(ef.esperado ? [{ rotulo: rotuloEsperado, cor: COR.neutro, tracejada: true }] : []),
  ];

  return (
    <>
      <div className={className}>
        <BarChart
          key={ef.modo}
          data={linhas}
          xDataKey="rotulo"
          aspectRatio="auto"
          className="h-full"
          margin={MARGEM}
          barGap={0.3}
          stacked
          animationDuration={500}
        >
          <Grid horizontal numTicksRows={NUM_TICKS} highlightRowValues={ef.modo === 'fluxo' ? [zero] : undefined} />
          {ef.modo === 'fluxo' && <Bar dataKey="base" fill="transparent" />}
          {ef.modo !== 'carga' && <Bar dataKey="barraGeracao" fill={COR.geracao} lineCap={ef.modo === 'fluxo' ? 2 : 4} />}
          {ef.modo === 'geracao' && <Bar dataKey="folga" fill="transparent" />}
          {ef.modo !== 'geracao' && <Bar dataKey="barraConsumo" fill={COR_CARGA} lineCap={ef.modo === 'fluxo' ? 2 : 4} />}
          {ef.esperado && <MarcadorEsperadoBarras chave="marcaEsperado" cor={COR.neutro} />}
          <CliqueBarras onClick={onAbrir} semDados={(d) => (d as LinhaEnergia).ponto.sem_dados && (d as LinhaEnergia).consumo == null} />
          <BarXAxis maxLabels={periodo === 'mes' ? (isMobile ? 8 : 16) : 12} showAllLabels={periodo !== 'mes'} />
          <YAxis numTicks={NUM_TICKS} formatValue={eixo} />
          <ChartTooltip
            showDatePill={false}
            showCrosshair={false}
            showDots={false}
            content={({ point }) => {
              const l = point as LinhaEnergia;
              if (l.ponto.futuro) return <TooltipDestaque titulo={titulo(l)} rotulo="Ainda não aconteceu" />;
              const linhasTip: LinhaTooltip[] = [];
              if (ef.carga) linhasTip.push({ label: 'Consumo', value: l.consumo != null ? `${nf(l.consumo, 0)} kWh` : '—', cor: COR_CARGA });
              if (ef.geracao && ef.carga) linhasTip.push({ label: 'Geração', value: l.geracao != null ? `${nf(l.geracao, 0)} kWh` : '—', cor: COR.geracao });
              if (l.esperado != null) {
                linhasTip.push({ label: rotuloEsperado, value: `${nf(l.esperado, 0)} kWh`, cor: COR.neutro });
                if (l.geracao != null && l.esperado > 0) linhasTip.push({ label: 'do esperado', value: `${nf((l.geracao / l.esperado) * 100, 0)}%` });
              }
              if (ef.geracao) linhasTip.push(...linhasFonteDoPonto(l.ponto));
              if (ef.modo === 'fluxo') return <TooltipDestaque titulo={titulo(l)} linhas={linhasTip} />;
              const v = ef.modo === 'carga' ? l.consumo : l.geracao;
              if (v == null) return <TooltipDestaque titulo={titulo(l)} rotulo="Sem dados" linhas={linhasTip} />;
              return (
                <TooltipDestaque titulo={titulo(l)} valor={nf(v, 0)} unidade="kWh" rotulo={ef.modo === 'carga' ? 'Consumo' : 'Geração'} linhas={linhasTip} />
              );
            }}
          />
        </BarChart>
      </div>
      <LegendaSeries className="mt-1" itens={legenda} />
    </>
  );
}

export default BarrasEnergia;
