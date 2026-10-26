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
  /** Série única filtrada: "carga" pinta de azul e chama de Consumo. */
  serie?: 'carga' | 'geracao';
}

/** Energia (kWh) por período em barras categóricas. */
export function GraficoEnergia({ pontos, tipo, className, serie }: GraficoEnergiaProps) {
  const isMobile = useIsMobile();
  const temConsumo = pontos.some((p) => p.consumo != null);
  const temGeracao = pontos.some((p) => p.energia !== 0) || !pontos.some((p) => p.rede != null);
  const temRede = pontos.some((p) => p.rede != null);
  // Barras não aceitam negativo: a rede vai pelo módulo; o tooltip diz se exportou ou importou.
  const dados = temRede ? pontos.map((p) => ({ ...p, redeBarra: p.rede == null ? undefined : Math.abs(p.rede) })) : pontos;
  const multi = temConsumo || temRede;
  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      <div className="min-h-0 flex-1">
      <BarChart
        data={dados}
        xDataKey="label"
        aspectRatio="auto"
        className="h-full"
        margin={MARGEM}
        barGap={0.25}
        animationDuration={600}
      >
        <Grid horizontal numTicksRows={4} />
        {temGeracao && <Bar dataKey="energia" fill={serie === 'carga' ? COR.potencia : COR.geracao} lineCap={4} />}
        {temConsumo && <Bar dataKey="consumo" fill={COR.potencia} lineCap={4} />}
        {temRede && <Bar dataKey="redeBarra" fill={COR.tensao} lineCap={4} />}
        <BarXAxis maxLabels={isMobile ? 8 : 16} />
        <YAxis numTicks={4} formatValue={energiaEixo} />
        <ChartTooltip
          showDatePill={false}
          showCrosshair={false}
          showDots={false}
          content={({ point }) => {
            const p = point as PontoEnergia;
            const titulo = tipo === 'mes' ? `Dia ${p.label}` : p.label;
            if (multi) {
              const txt = (v: number) => { const e = partesEnergia(v); return `${e.valor} ${e.unidade}`; };
              return (
                <TooltipDestaque
                  titulo={titulo}
                  linhas={[
                    ...(temGeracao ? [{ label: 'Geração', value: txt(p.energia), cor: COR.geracao }] : []),
                    ...(temConsumo ? [{ label: 'Consumo', value: txt(p.consumo ?? 0), cor: COR.potencia }] : []),
                    ...(temRede && p.rede != null ? [{ label: p.rede >= 0 ? 'Rede · exportado (líq.)' : 'Rede · importado (líq.)', value: txt(Math.abs(p.rede)), cor: COR.tensao }] : []),
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
                rotulo={serie === 'carga' ? 'Consumo' : serie === 'geracao' ? 'Geração' : 'Energia'}
              />
            );
          }}
        />
      </BarChart>
      </div>
      {multi && (
        <LegendaSeries
          className="mt-1"
          itens={[
            ...(temGeracao ? [{ rotulo: 'Geração', cor: COR.geracao }] : []),
            ...(temConsumo ? [{ rotulo: 'Consumo', cor: COR.potencia }] : []),
            ...(temRede ? [{ rotulo: 'Rede (líquido)', cor: COR.tensao }] : []),
          ]}
        />
      )}
    </div>
  );
}
