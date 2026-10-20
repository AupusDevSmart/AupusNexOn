import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { Grid } from '@/components/charts/grid';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PontoEnergia } from './dados';
import { energiaEixo, partesEnergia } from './formatos';
import { LegendaSeries } from './Legenda';

const MARGEM = { top: 12, right: 12, bottom: 28, left: 64 };

interface GraficoEnergiaProps {
  pontos: PontoEnergia[];
  /** "mes" = barra por dia; "ano" = barra por mês. */
  tipo: 'mes' | 'ano';
  /** Classes do wrapper (altura). */
  className?: string;
}

/** Energia (kWh) por período em barras categóricas. */
export function GraficoEnergia({ pontos, tipo, className }: GraficoEnergiaProps) {
  const isMobile = useIsMobile();
  const temConsumo = pontos.some((p) => p.consumo != null);
  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      <div className="min-h-0 flex-1">
      <BarChart
        data={pontos}
        xDataKey="label"
        aspectRatio="auto"
        className="h-full"
        margin={MARGEM}
        barGap={0.25}
        animationDuration={600}
      >
        <Grid horizontal numTicksRows={4} />
        <Bar dataKey="energia" fill={COR.geracao} lineCap={4} />
        {temConsumo && <Bar dataKey="consumo" fill={COR.potencia} lineCap={4} />}
        <BarXAxis maxLabels={isMobile ? 8 : 16} />
        <YAxis numTicks={4} formatValue={energiaEixo} />
        <ChartTooltip
          showDatePill={false}
          showCrosshair={false}
          showDots={false}
          content={({ point }) => {
            const p = point as PontoEnergia;
            const titulo = tipo === 'mes' ? `Dia ${p.label}` : p.label;
            if (temConsumo) {
              const txt = (v: number) => { const e = partesEnergia(v); return `${e.valor} ${e.unidade}`; };
              return (
                <TooltipDestaque
                  titulo={titulo}
                  linhas={[
                    { label: 'Geração', value: txt(p.energia), cor: COR.geracao },
                    { label: 'Consumo', value: txt(p.consumo ?? 0), cor: COR.potencia },
                  ]}
                />
              );
            }
            const energia = partesEnergia(p.energia);
            return (
              <TooltipDestaque
                titulo={titulo}
                valor={energia.valor}
                unidade={energia.unidade}
                rotulo="Energia"
              />
            );
          }}
        />
      </BarChart>
      </div>
      {temConsumo && (
        <LegendaSeries
          className="mt-1"
          itens={[{ rotulo: 'Geração', cor: COR.geracao }, { rotulo: 'Consumo', cor: COR.potencia }]}
        />
      )}
    </div>
  );
}
