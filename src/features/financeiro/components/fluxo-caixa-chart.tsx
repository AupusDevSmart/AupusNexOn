import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { curveMonotoneX } from '@visx/curve';
import { ComposedChart } from '@/components/charts/composed-chart';
import { Line } from '@/components/charts/line';
import { SeriesBar } from '@/components/charts/series-bar';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import type { FluxoCaixaData, ChartType } from '@/types/dtos/financeiro';

interface FluxoCaixaChartProps {
  data: FluxoCaixaData[];
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const COR_RESULTADO = COR.potencia;
const COR_ENTRADAS = COR.geracao;
const COR_SAIDAS = 'var(--destructive)';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
/** Eixo Y curto: "R$ 25 mil", "-R$ 3 mil". */
const brlEixo = (v: number) =>
  Math.abs(v) >= 1000
    ? `${v < 0 ? '-' : ''}R$ ${(Math.abs(v) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
    : brl.format(v);

interface PontoFluxo extends Record<string, unknown> {
  date: Date;
  month: string;
  entradas: number;
  saidas: number;
  resultado: number;
}

/**
 * O dado vem só com o nome do mês ("Jan".."Dez", ou "Jan/26"); o gráfico de tempo do
 * bklit precisa de Date. Monta dia 1 de cada mês em horário local, na ordem recebida,
 * virando o ano quando a sequência volta (Nov, Dez, Jan…). Sem ano no dado, assume o
 * ano corrente e recua um ano se a sequência passaria do mês atual.
 */
function comDatas(data: FluxoCaixaData[]): PontoFluxo[] {
  const agora = new Date();
  let ano = agora.getFullYear();
  let mesAnterior = -1;
  const pontos = data.map((item, i) => {
    const chave = item.month.slice(0, 3).toLowerCase();
    const idx = MESES.indexOf(chave);
    const mes = idx >= 0 ? idx : i % 12;
    const anoTxt = /(\d{2,4})\s*$/.exec(item.month)?.[1];
    if (anoTxt) ano = anoTxt.length === 2 ? 2000 + Number(anoTxt) : Number(anoTxt);
    else if (mes < mesAnterior) ano += 1;
    mesAnterior = mes;
    return {
      date: new Date(ano, mes, 1),
      month: item.month,
      entradas: item.entradas || 0,
      saidas: item.saidas || 0,
      resultado: item.resultado || 0,
    };
  });
  const ultimo = pontos[pontos.length - 1];
  const temAnoNoDado = data.some((item) => /\d{2,4}\s*$/.test(item.month));
  if (!temAnoNoDado && ultimo && ultimo.date > agora) {
    for (const p of pontos) p.date = new Date(p.date.getFullYear() - 1, p.date.getMonth(), 1);
  }
  return pontos;
}

export function FluxoCaixaChart({ data }: FluxoCaixaChartProps): React.JSX.Element {
  const [chartType, setChartType] = useState<ChartType>('line');

  const pontos = useMemo(() => comDatas(data), [data]);

  // Calcular totais para os cards laterais
  const totals = data.reduce((acc, item) => {
    acc.entradas += item.entradas || 0;
    acc.saidas += item.saidas || 0;
    return acc;
  }, { entradas: 0, saidas: 0 });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gráfico Principal */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Resultado nos últimos 12 meses</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={chartType === 'line' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('line')}
              >
                Linha
              </Button>
              <Button
                variant={chartType === 'bar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('bar')}
              >
                Barras
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {pontos.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem dados no período.
              </div>
            ) : (
              <ComposedChart
                data={pontos}
                aspectRatio="auto"
                className="h-full"
                margin={{ top: 12, right: 16, bottom: 28, left: 80 }}
                maxBarSize={36}
                animationDuration={600}
              >
                <Grid horizontal numTicksRows={5} highlightRowValues={[0]} highlightRowStroke={COR.neutro} />
                {chartType === 'line' ? (
                  <Line
                    dataKey="resultado"
                    stroke={COR_RESULTADO}
                    strokeWidth={3}
                    curve={curveMonotoneX}
                    fadeEdges={false}
                    showMarkers
                  />
                ) : (
                  <SeriesBar dataKey="resultado" fill={COR_RESULTADO} radius={4} />
                )}
                <XAxis numTicks={6} />
                <YAxis numTicks={5} formatValue={brlEixo} />
                <ChartTooltip
                  showDatePill={false}
                  showDots={chartType === 'line'}
                  content={({ point }) => {
                    const p = point as PontoFluxo;
                    return (
                      <TooltipDestaque
                        titulo={p.month}
                        valor={brl.format(p.resultado)}
                        rotulo="Resultado"
                        linhas={[
                          { label: 'Entradas', value: brl.format(p.entradas), cor: COR_ENTRADAS },
                          { label: 'Saídas', value: brl.format(p.saidas), cor: COR_SAIDAS },
                        ]}
                      />
                    );
                  }}
                />
              </ComposedChart>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="space-y-4">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Entradas no período</p>
                <p className="text-3xl font-bold">R$ {totals.entradas.toLocaleString('pt-BR')}</p>
                <p className="text-green-100 text-xs">Total acumulado</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-100" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Saídas no período</p>
                <p className="text-3xl font-bold">R$ {totals.saidas.toLocaleString('pt-BR')}</p>
                <p className="text-red-100 text-xs">Total acumulado</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-100" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
