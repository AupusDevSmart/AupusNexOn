import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AlarmClock, CheckCircle2, CircleDot, Hourglass, Timer, Zap } from 'lucide-react';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { BarYAxis } from '@/components/charts/bar-y-axis';
import { Grid } from '@/components/charts/grid';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { useChartHover, useChartStable } from '@/components/charts/chart-context';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { LegendaSeries } from '@/features/supervisorio/components/sinoptico-graficos-v2/Legenda';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { EstatisticasChamados, ItemRanking } from '../types';
import { formatarDuracao, plural, rotuloMes } from '../utils/datas';

const COR_ABERTOS = COR.consumo;
const COR_RESOLVIDOS = COR.geracao;
const inteiro = (v: number) => String(Math.round(v));

/**
 * Indicadores da página de chamados: KPIs, abertos × resolvidos por mês e rankings
 * (status, motivo, órgão, planta, equipamento). Mesmo recorte de tipo, motivo e período da lista.
 */
export function ChamadosIndicadores({
  dados,
  loading,
  onFiltrar,
}: {
  dados: EstatisticasChamados | null;
  loading: boolean;
  /** Clique numa barra do ranking filtra a lista (motivo ou órgão). */
  onFiltrar?: (filtro: { motivo?: string; orgao?: string }) => void;
}) {
  const t = dados?.totais;
  // Número que já existia fica no lugar enquanto o novo chega: esqueleto só na primeira carga.
  const primeiraCarga = loading && !dados;
  const mensal = (dados?.por_mes ?? []).map((m) => ({ ...m, rotulo: rotuloMes(m.mes) }));
  const temMensal = mensal.some((m) => m.abertos || m.resolvidos);

  return (
    <div className={cn('space-y-4 pb-6 transition-opacity', loading && dados && 'opacity-60')}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icone={CircleDot} rotulo="Abertos agora" valor={t ? String(t.abertos) : null} carregando={primeiraCarga}
          detalhe={t ? `${plural(t.externos_abertos, 'externo', 'externos')} · ${plural(t.internos_abertos, 'reparo', 'reparos')}` : undefined} />
        <Kpi icone={AlarmClock} rotulo="Previsão vencida" valor={t ? String(t.previsao_vencida) : null} carregando={primeiraCarga}
          detalhe="ainda abertos" alerta={!!t?.previsao_vencida} />
        <Kpi icone={CheckCircle2} rotulo="Resolvidos no mês" valor={t ? String(t.resolvidos_no_mes) : null} carregando={primeiraCarga}
          detalhe={t ? `${plural(t.abertos_no_mes, 'aberto', 'abertos')} no mês` : undefined} />
        <Kpi icone={Timer} rotulo="Tempo até resolver" valor={t ? formatarDuracao(t.horas_media_resolucao) : null} carregando={primeiraCarga}
          detalhe="média, do início ao fim" />
        <Kpi icone={Zap} rotulo="Falta de energia" valor={t ? formatarDuracao(t.horas_media_falta_energia) : null} carregando={primeiraCarga}
          detalhe="duração média" />
        <Kpi icone={Hourglass} rotulo="Mais antigo" valor={t ? formatarDuracao(t.horas_aberto_mais_antigo) : null} carregando={primeiraCarga}
          detalhe="aberto há" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Painel
          titulo="Abertos × resolvidos por mês"
          className="lg:col-span-2"
          extra={<LegendaSeries itens={[{ rotulo: 'Abertos', cor: COR_ABERTOS }, { rotulo: 'Resolvidos', cor: COR_RESOLVIDOS }]} />}
        >
          <div className="h-[220px] sm:h-[260px]">
            {!temMensal ? (
              <SemDados carregando={primeiraCarga} />
            ) : (
              <BarChart data={mensal} xDataKey="rotulo" aspectRatio="auto" className="h-full" margin={{ top: 8, right: 8, bottom: 28, left: 32 }} barGap={0.3} animationDuration={500}>
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

        <Ranking titulo="Por status" itens={dados?.por_status ?? []} carregando={primeiraCarga} cor={COR.neutro} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Ranking titulo="Por motivo" itens={dados?.por_motivo ?? []} carregando={primeiraCarga} cor={COR.potencia}
          onClick={onFiltrar ? (i) => onFiltrar({ motivo: i.chave }) : undefined} />
        <Ranking titulo="Externos por órgão" itens={dados?.por_orgao ?? []} carregando={primeiraCarga} cor={COR.tensao}
          onClick={onFiltrar ? (i) => i.chave !== '—' && onFiltrar({ orgao: i.chave }) : undefined} />
        <Ranking titulo="Plantas com mais chamados" itens={dados?.por_planta ?? []} carregando={primeiraCarga} cor={COR.corrente} />
        <Ranking titulo="Equipamentos com mais chamados" itens={dados?.por_equipamento ?? []} carregando={primeiraCarga} cor={COR.consumo} />
      </div>
    </div>
  );
}

function Kpi({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  alerta,
  carregando,
}: {
  icone: typeof Zap;
  rotulo: string;
  valor: string | null;
  detalhe?: string;
  alerta?: boolean;
  carregando: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icone className={cn('h-3.5 w-3.5 shrink-0', alerta && 'text-destructive')} />
        <span className="truncate">{rotulo}</span>
      </div>
      {carregando ? (
        <>
          <Skeleton className="mt-2 h-7 w-16" />
          <Skeleton className="mt-1.5 h-3 w-24" />
        </>
      ) : (
        <>
          <div className={cn('mt-1.5 truncate text-2xl font-bold tabular-nums', alerta && 'text-destructive')}>{valor ?? '—'}</div>
          {detalhe && <div className="mt-0.5 truncate text-xs text-muted-foreground">{detalhe}</div>}
        </>
      )}
    </div>
  );
}

function Painel({ titulo, extra, className, children }: { titulo: string; extra?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card className={cn('min-w-0 p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold">{titulo}</h4>
        {extra}
      </div>
      {children}
    </Card>
  );
}

function SemDados({ carregando }: { carregando: boolean }) {
  if (carregando) return <Skeleton className="h-full w-full" />;
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nada no período</div>;
}

/**
 * Clique (ou toque) numa barra do bklit chama `onClique` com a linha. O gráfico já marca a
 * barra sob o dedo/ponteiro em `tooltipData`; aqui só ouvimos o clique do contêiner.
 */
function CliqueNaBarra<T>({ onClique }: { onClique: (linha: T) => void }) {
  const { containerRef } = useChartStable();
  const { tooltipData } = useChartHover();
  const atual = useRef(tooltipData);
  atual.current = tooltipData;
  const cb = useRef(onClique);
  cb.current = onClique;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ouvir = () => {
      const p = atual.current?.point;
      if (p) cb.current(p as T);
    };
    el.addEventListener('click', ouvir);
    return () => el.removeEventListener('click', ouvir);
  }, [containerRef]);

  return null;
}

const ALTURA_LINHA = 30;
const MAX_ROTULO = 24;

function Ranking({
  titulo,
  itens,
  carregando,
  cor,
  onClick,
}: {
  titulo: string;
  itens: ItemRanking[];
  carregando: boolean;
  cor: string;
  onClick?: (i: ItemRanking) => void;
}) {
  // Valor vem na frente do rótulo ("12 · Falta de energia"): o bklit horizontal não tem
  // eixo de valor, e assim o número nunca é cortado. Categoria precisa ser única.
  const linhas = useMemo(() => {
    const vistos = new Set<string>();
    return itens.map((i) => {
      const nome = i.rotulo.length > MAX_ROTULO ? `${i.rotulo.slice(0, MAX_ROTULO - 1)}…` : i.rotulo;
      let categoria = `${i.total} · ${nome}`;
      while (vistos.has(categoria)) categoria += ' ';
      vistos.add(categoria);
      return { ...i, categoria };
    });
  }, [itens]);
  const altura = Math.max(120, linhas.length * ALTURA_LINHA + 16);

  return (
    <Painel
      titulo={titulo}
      extra={onClick && linhas.length > 0 ? <span className="text-xs text-muted-foreground">Toque na barra para ver na lista</span> : undefined}
    >
      <div style={{ height: carregando || linhas.length === 0 ? 120 : altura }} className={cn(onClick && '[&_g]:!cursor-pointer')}>
        {linhas.length === 0 ? (
          <SemDados carregando={carregando} />
        ) : (
          <BarChart data={linhas} xDataKey="categoria" orientation="horizontal" aspectRatio="auto" className="h-full"
            margin={{ top: 4, right: 12, bottom: 4, left: 164 }} barGap={0.35} animationDuration={500}>
            <Grid horizontal={false} vertical numTicksColumns={4} />
            <Bar dataKey="total" fill={cor} lineCap={3} />
            <BarYAxis maxLabelWidth={156} />
            <ChartTooltip
              showDatePill={false}
              showCrosshair={false}
              showDots={false}
              content={({ point }) => {
                const r = point as (typeof linhas)[number];
                return <TooltipDestaque titulo={r.rotulo} valor={String(r.total)} rotulo={r.total === 1 ? 'chamado' : 'chamados'} />;
              }}
            />
            {onClick && <CliqueNaBarra<(typeof linhas)[number]> onClique={onClick} />}
          </BarChart>
        )}
      </div>
    </Painel>
  );
}
