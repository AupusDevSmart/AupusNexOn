import { AlarmClock, CheckCircle2, CircleDot, Hourglass, Timer, Zap } from 'lucide-react';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { BarYAxis } from '@/components/charts/bar-y-axis';
import { Grid } from '@/components/charts/grid';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { LegendaSeries } from '@/features/supervisorio/components/sinoptico-graficos-v2/Legenda';
import { KpiCard } from '@/features/supervisorio/sinoptico/components/KpiCard';
import { Card } from '@/components/ui/card';
import type { EstatisticasChamados, ItemRanking } from '../types';
import { formatarDuracao, rotuloMes } from '../utils/datas';

const COR_ABERTOS = COR.consumo;
const COR_RESOLVIDOS = COR.geracao;
const inteiro = (v: number) => String(Math.round(v));

/**
 * Indicadores da página de chamados: KPIs, abertos × resolvidos por mês e rankings
 * (órgão, motivo, planta, equipamento). Mesmos filtros da lista.
 */
export function ChamadosIndicadores({
  dados,
  loading,
  onFiltrar,
}: {
  dados: EstatisticasChamados | null;
  loading: boolean;
  /** Clique numa barra do ranking filtra a lista (ex.: motivo). */
  onFiltrar?: (filtro: { motivo?: string; orgao?: string }) => void;
}) {
  const t = dados?.totais;
  const mensal = (dados?.por_mes ?? []).map((m) => ({ ...m, rotulo: rotuloMes(m.mes) }));
  const temMensal = mensal.some((m) => m.abertos || m.resolvidos);

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={CircleDot} titulo="Abertos agora" abrev="Abertos" valor={t?.abertos} loading={loading}
          legenda={t ? `${t.externos_abertos} externo(s) · ${t.internos_abertos} reparo(s)` : undefined} />
        <KpiCard icon={AlarmClock} titulo="Previsão vencida (ainda abertos)" abrev="Previsão vencida" valor={t?.previsao_vencida} loading={loading} />
        <KpiCard icon={CheckCircle2} titulo="Resolvidos neste mês" abrev="Resolvidos no mês" valor={t?.resolvidos_no_mes} loading={loading} />
        <KpiCard icon={Timer} titulo="Tempo médio até resolver" abrev="Tempo médio" valor={t ? formatarDuracao(t.horas_media_resolucao) : undefined} loading={loading}
          legenda="Do início do problema (ou abertura) até resolvido/fechado" />
        <KpiCard icon={Zap} titulo="Duração média da falta de energia" abrev="Falta de energia" valor={t ? formatarDuracao(t.horas_media_falta_energia) : undefined} loading={loading}
          legenda="Chamados de falta de energia resolvidos" />
        <KpiCard icon={Hourglass} titulo="Aberto há mais tempo" abrev="Mais antigo" valor={t ? formatarDuracao(t.horas_aberto_mais_antigo) : undefined} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Abertos × resolvidos por mês" extra={<LegendaSeries itens={[{ rotulo: 'Abertos', cor: COR_ABERTOS }, { rotulo: 'Resolvidos', cor: COR_RESOLVIDOS }]} />}>
          <div style={{ height: 220 }}>
            {!temMensal ? (
              <SemDados loading={loading} />
            ) : (
              <BarChart data={mensal} xDataKey="rotulo" aspectRatio="auto" className="h-full" margin={{ top: 8, right: 12, bottom: 28, left: 32 }} barGap={0.3} animationDuration={500}>
                <Grid horizontal numTicksRows={4} />
                <Bar dataKey="abertos" fill={COR_ABERTOS} lineCap={3} />
                <Bar dataKey="resolvidos" fill={COR_RESOLVIDOS} lineCap={3} />
                <BarXAxis maxLabels={12} />
                <YAxis numTicks={4} formatValue={inteiro} />
                <ChartTooltip
                  showDatePill={false}
                  showCrosshair={false}
                  showDots={false}
                  content={({ point }) => {
                    const p = point as (typeof mensal)[number];
                    return (
                      <TooltipDestaque
                        titulo={p.rotulo}
                        linhas={[
                          { label: 'Abertos', value: String(p.abertos), cor: COR_ABERTOS },
                          { label: 'Resolvidos', value: String(p.resolvidos), cor: COR_RESOLVIDOS },
                        ]}
                      />
                    );
                  }}
                />
              </BarChart>
            )}
          </div>
        </Painel>

        <Ranking titulo="Por motivo" itens={dados?.por_motivo ?? []} loading={loading} cor={COR.potencia}
          onClick={onFiltrar ? (i) => onFiltrar({ motivo: i.chave }) : undefined} />
        <Ranking titulo="Externos por órgão" itens={dados?.por_orgao ?? []} loading={loading} cor={COR.tensao}
          onClick={onFiltrar ? (i) => i.chave !== '—' && onFiltrar({ orgao: i.chave }) : undefined} />
        <Ranking titulo="Plantas com mais chamados" itens={dados?.por_planta ?? []} loading={loading} cor={COR.corrente} />
        <Ranking titulo="Equipamentos com mais chamados" itens={dados?.por_equipamento ?? []} loading={loading} cor={COR.consumo} />
        <Ranking titulo="Por status" itens={dados?.por_status ?? []} loading={loading} cor={COR.neutro} />
      </div>
    </div>
  );
}

function Painel({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">{titulo}</h4>
        {extra}
      </div>
      {children}
    </Card>
  );
}

function SemDados({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {loading ? <div className="h-full w-full animate-pulse rounded bg-muted/50" /> : 'Sem chamados no período'}
    </div>
  );
}

function Ranking({
  titulo,
  itens,
  loading,
  cor,
  onClick,
}: {
  titulo: string;
  itens: ItemRanking[];
  loading: boolean;
  cor: string;
  onClick?: (i: ItemRanking) => void;
}) {
  const linhas = itens.map((i) => ({ ...i, categoria: i.rotulo.length > 28 ? `${i.rotulo.slice(0, 27)}…` : i.rotulo }));
  const altura = Math.max(120, linhas.length * 30 + 16);
  return (
    <Painel titulo={titulo}>
      <div style={{ height: altura }}>
        {linhas.length === 0 ? (
          <SemDados loading={loading} />
        ) : (
          <BarChart data={linhas} xDataKey="categoria" orientation="horizontal" aspectRatio="auto" className="h-full"
            margin={{ top: 4, right: 16, bottom: 4, left: 140 }} barGap={0.35} animationDuration={500}>
            <Grid horizontal={false} vertical numTicksColumns={4} />
            <Bar dataKey="total" fill={cor} lineCap={3} />
            <BarYAxis />
            <ChartTooltip
              showDatePill={false}
              showCrosshair={false}
              showDots={false}
              content={({ point }) => {
                const r = point as (typeof linhas)[number];
                return <TooltipDestaque titulo={r.rotulo} valor={String(r.total)} rotulo={onClick ? 'chamado(s) · toque para filtrar' : 'chamado(s)'} />;
              }}
            />
          </BarChart>
        )}
      </div>
      {onClick && linhas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {linhas.map((i) => (
            <button key={i.chave} type="button" onClick={() => onClick(i)} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground touch:py-1">
              {i.rotulo} · {i.total}
            </button>
          ))}
        </div>
      )}
    </Painel>
  );
}
