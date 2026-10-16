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

interface GraficoAnoData {
  ano: number;
  total_meses: number;
  energia_total_kwh: number;
  dados: Array<{
    mes: string;
    mes_numero: number;
    mes_nome: string;
    energia_kwh: number;
    potencia_media_kw: number;
    num_registros: number;
  }>;
}

interface InversorGraficoAnoProps {
  data: GraficoAnoData | null;
  loading: boolean;
  height?: number;
}

interface PontoAno extends Record<string, unknown> {
  mes: string;
  mes_completo: string;
  mes_numero: number;
  energia: number;
  potencia_media: number;
  registros: number;
}

export function InversorGraficoAno({ data, loading, height = 400 }: InversorGraficoAnoProps) {
  const chartData = useMemo<PontoAno[]>(() => {
    if (!data?.dados) return [];
    return data.dados.map((point) => ({
      mes: point.mes_nome.substring(0, 3),
      mes_completo: point.mes_nome,
      mes_numero: point.mes_numero,
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
      <div className="flex h-full items-center justify-center text-muted-foreground">Carregando dados do ano...</div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Nenhum dado disponível para este ano
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Estatisticas
        itens={[
          { rotulo: 'Energia total', valor: formatEnergy(data.energia_total_kwh), cor: COR.geracao },
          { rotulo: 'Média mensal', valor: formatEnergy(stats.avg) },
          { rotulo: 'Melhor mês', valor: formatEnergy(stats.max) },
          { rotulo: 'Meses com dados', valor: data.total_meses, detalhe: `Ano ${data.ano}` },
        ]}
      />

      <div style={{ height }}>
        <BarChart
          data={chartData}
          xDataKey="mes"
          aspectRatio="auto"
          className="h-full"
          margin={{ top: 12, right: 12, bottom: 28, left: 56 }}
          barGap={0.3}
          animationDuration={600}
        >
          <Grid horizontal numTicksRows={4} />
          <Bar dataKey="energia" fill={COR.geracao} lineCap={4} />
          <BarXAxis showAllLabels />
          <YAxis numTicks={4} formatValue={(v) => formatEnergy(v, 0)} />
          <ChartTooltip
            showDatePill={false}
            showCrosshair={false}
            showDots={false}
            content={({ point }) => {
              const p = point as PontoAno;
              const energia = getEnergyValue(p.energia);
              return (
                <TooltipDestaque
                  titulo={`${p.mes_completo} de ${data.ano}`}
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

      <div className="text-center text-xs text-muted-foreground">Energia gerada por mês em {data.ano}</div>
    </div>
  );
}
