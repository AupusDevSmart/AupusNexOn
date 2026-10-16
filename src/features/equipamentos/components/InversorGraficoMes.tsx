import { useMemo } from 'react';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { Grid } from '@/components/charts/grid';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { Estatisticas } from '@/components/graficos/estatisticas';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { formatEnergy, formatPower, getEnergyValue } from '@/utils/formatEnergy';

interface GraficoMesData {
  mes: string;
  total_dias: number;
  energia_total_kwh: number;
  dados: Array<{
    data: string;
    dia: number;
    energia_kwh: number;
    potencia_media_kw: number;
    num_registros: number;
  }>;
}

interface InversorGraficoMesProps {
  data: GraficoMesData | null;
  loading: boolean;
  height?: number;
}

interface PontoMes extends Record<string, unknown> {
  dia: string;
  data: string;
  energia: number;
  potencia_media: number;
  registros: number;
}

export function InversorGraficoMes({ data, loading, height = 400 }: InversorGraficoMesProps) {
  const chartData = useMemo<PontoMes[]>(() => {
    if (!data?.dados) return [];
    return data.dados.map((point) => ({
      dia: `${point.dia}`,
      data: point.data,
      energia: point.energia_kwh,
      potencia_media: point.potencia_media_kw,
      registros: point.num_registros,
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return { max: 0, min: 0, avg: 0 };
    const energias = chartData.map((d) => d.energia);
    return {
      max: Math.max(...energias),
      min: Math.min(...energias),
      avg: energias.reduce((acc, val) => acc + val, 0) / energias.length,
    };
  }, [chartData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">Carregando dados do mês...</div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Nenhum dado disponível para este mês
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Estatisticas
        itens={[
          { rotulo: 'Energia total', valor: formatEnergy(data.energia_total_kwh), cor: COR.geracao },
          { rotulo: 'Média diária', valor: formatEnergy(stats.avg) },
          { rotulo: 'Melhor dia', valor: formatEnergy(stats.max) },
          { rotulo: 'Dias com dados', valor: data.total_dias, detalhe: `Mês ${data.mes}` },
        ]}
      />

      <div style={{ height }}>
        <BarChart
          data={chartData}
          xDataKey="dia"
          aspectRatio="auto"
          className="h-full"
          margin={{ top: 12, right: 12, bottom: 28, left: 56 }}
          barGap={0.25}
          animationDuration={600}
        >
          <Grid horizontal numTicksRows={4} />
          <Bar dataKey="energia" fill={COR.geracao} lineCap={4} />
          <BarXAxis maxLabels={16} />
          <YAxis numTicks={4} formatValue={(v) => formatEnergy(v, 0)} />
          <ChartTooltip
            showDatePill={false}
            showCrosshair={false}
            showDots={false}
            content={({ point }) => {
              const p = point as PontoMes;
              const energia = getEnergyValue(p.energia);
              return (
                <TooltipDestaque
                  titulo={`Dia ${p.dia} · ${new Date(`${p.data}T00:00:00`).toLocaleDateString('pt-BR')}`}
                  valor={energia.value}
                  unidade={energia.unit}
                  rotulo="Energia gerada"
                  linhas={[
                    { label: 'Potência média', value: formatPower(p.potencia_media) },
                    { label: 'Registros', value: p.registros.toLocaleString('pt-BR') },
                  ]}
                />
              );
            }}
          />
        </BarChart>
      </div>

      <div className="text-center text-xs text-muted-foreground">Energia gerada por dia em {data.mes}</div>
    </div>
  );
}
