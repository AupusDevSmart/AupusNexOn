import { useMemo, useState } from 'react';
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
import { COR_FASE, FASES, type Dominio, type Fase, type FasesAtivas, type Grandeza, type PontoFases } from './dados';
import { formatarFp, formatarTensao, fpEixo } from './formatos';
import { FaixaBrush } from './FaixaBrush';
import { LegendaSeries } from './Legenda';
import { useJanelaZoom, useRodaZoom } from './use-janela-zoom';

/** Limite regulatório do fator de potência (±0,92). */
const LIMITE_FP = 0.92;
const MARGEM = { top: 12, right: 16, bottom: 28, left: 56 };
/** Linhas de limite: sem bolinha no hover. */
const CHAVES_LIMITE = new Set(['limiteSuperior', 'limiteInferior']);

/** Linha do gráfico: A/B/C é o que se desenha (tensão já deslocada), realX o valor de verdade. */
interface LinhaFases extends Record<string, unknown> {
  date: Date;
  A: number;
  B: number;
  C: number;
  realA: number;
  realB: number;
  realC: number;
  limiteSuperior?: number;
  limiteInferior?: number;
}

const valorReal = (p: LinhaFases, f: Fase) => (f === 'A' ? p.realA : f === 'B' ? p.realB : p.realC);

interface GraficoFasesProps {
  pontos: PontoFases[];
  /** Eixo do dia (00:00 até agora). */
  dominio: Dominio;
  grandeza: Grandeza;
  fases: FasesAtivas;
  /** Muda → zoom volta ao total (troca de medidor). */
  chaveZoom: string;
  /** No diálogo: brush embaixo; no card: roda do mouse + duplo clique. */
  expandido?: boolean;
  /** Classes do wrapper no card (altura, borda). */
  className?: string;
}

/**
 * Tensão ou fator de potência por fase.
 *
 * Deslocamento da tensão: o bklit começa o eixo Y em zero quando a série é
 * toda positiva, o que esconde ±5 V numa escala de 0–240 V. Desenhamos
 * (valor − base), com base num múltiplo de 10 abaixo do mínimo visível, e
 * devolvemos a base nos rótulos do eixo; o tooltip lê o valor real. É o mesmo
 * recorte "dataMin − 5" do gráfico antigo.
 *
 * FP: os limites ±0,92 entram como séries constantes tracejadas, assim o eixo
 * vai de −1 a 1 como antes, mesmo com as fases todas perto de 1.
 */
export function GraficoFases({
  pontos,
  dominio,
  grandeza,
  fases,
  chaveZoom,
  expandido = false,
  className,
}: GraficoFasesProps) {
  const isMobile = useIsMobile();
  const ehTensao = grandeza === 'tensao';
  const ativas = useMemo(() => FASES.filter((f) => fases[f]), [fases]);

  const base = useMemo(() => {
    if (!ehTensao || ativas.length === 0 || pontos.length === 0) return 0;
    let minimo = Number.POSITIVE_INFINITY;
    for (const p of pontos) for (const f of ativas) minimo = Math.min(minimo, p[f]);
    return Number.isFinite(minimo) ? Math.floor((minimo - 5) / 10) * 10 : 0;
  }, [ehTensao, ativas, pontos]);

  const linhas = useMemo<LinhaFases[]>(
    () =>
      pontos.map((p) => ({
        date: p.date,
        A: p.A - base,
        B: p.B - base,
        C: p.C - base,
        realA: p.A,
        realB: p.B,
        realC: p.C,
        ...(ehTensao ? {} : { limiteSuperior: LIMITE_FP, limiteInferior: -LIMITE_FP }),
      })),
    [pontos, base, ehTensao],
  );

  const janela = useJanelaZoom(linhas, dominio, chaveZoom);
  const [areaEl, setAreaEl] = useState<HTMLDivElement | null>(null);
  useRodaZoom(expandido ? null : areaEl, janela.rolar, true);

  const formatar = ehTensao ? formatarTensao : formatarFp;
  const faseMiniatura = ativas[0] ?? 'A';

  const grafico = (
    <LineChart
      data={linhas}
      xDomain={janela.xDomain}
      aspectRatio="auto"
      className="h-full"
      margin={MARGEM}
      animationDuration={0}
    >
      <Grid horizontal numTicksRows={4} />
      {ativas.map((f) => (
        <Line
          key={f}
          dataKey={f}
          stroke={COR_FASE[f]}
          strokeWidth={2}
          curve={curveMonotoneX}
          fadeEdges={false}
          animate={false}
        />
      ))}
      {!ehTensao && (
        <Line
          dataKey="limiteSuperior"
          stroke={COR.tensao}
          strokeWidth={1.5}
          dashFromIndex={0}
          dashArray="6,4"
          curve={curveLinear}
          fadeEdges={false}
          animate={false}
          showHighlight={false}
        />
      )}
      {!ehTensao && (
        <Line
          dataKey="limiteInferior"
          stroke={COR.tensao}
          strokeWidth={1.5}
          dashFromIndex={0}
          dashArray="6,4"
          curve={curveLinear}
          fadeEdges={false}
          animate={false}
          showHighlight={false}
        />
      )}
      <XAxis numTicks={isMobile ? 4 : 6} tickMode="domain" />
      <YAxis numTicks={4} formatValue={(v) => (ehTensao ? `${Math.round(v + base)} V` : fpEixo(v))} />
      <ChartTooltip
        showDots
        dotColor={(_ponto, linha) => (CHAVES_LIMITE.has(linha.dataKey) ? 'transparent' : linha.stroke)}
        content={({ point }) => {
          const p = point as LinhaFases;
          return (
            <TooltipDestaque
              titulo={weekdayDateFmt.format(p.date)}
              linhas={ativas.map((f) => ({ label: `Fase ${f}`, value: formatar(valorReal(p, f)), cor: COR_FASE[f] }))}
            />
          );
        }}
      />
    </LineChart>
  );

  const itensLegenda = ehTensao ? [] : [{ rotulo: 'Limite ±0,92', cor: COR.tensao, tracejada: true }];

  if (expandido) {
    return (
      <div className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1">{grafico}</div>
        <LegendaSeries itens={itensLegenda} />
        <FaixaBrush
          pontos={linhas}
          dataKey={faseMiniatura}
          cor={COR_FASE[faseMiniatura]}
          dominio={dominio}
          janela={janela}
        />
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
