import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Settings2 } from 'lucide-react';
import { curveMonotoneX } from '@visx/curve';
import { LineChart } from '@/components/charts/line-chart';
import { Line } from '@/components/charts/line';
import { Area } from '@/components/charts/area';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque, type LinhaTooltip } from '@/components/graficos/tooltip-destaque';
import { linhasDeBuckets, LINHA_SO_DOMINIO } from '@/components/graficos/linhas-de-buckets';
import { CliqueBarras, LinhaTracejadaParcial, MarcadorEsperadoBarras } from '@/components/graficos/marcadores-esperado';
import { useUserStore } from '@/store/useUserStore';
import { formatEnergy } from '@/utils/formatEnergy';
import { geracaoApi, ROTULO_FONTE, type AnaliseGeracao as Analise, type PeriodoAnalise, type PontoAnalise } from './api';
import { CardFechamento, CardPerdas, CardPrevisao, CardResumo } from './CardsAnalise';
import { nf } from './formato';
import { ConfigUsinaDialog } from './ConfigUsinaDialog';

/**
 * Análise de geração da instalação com usina (NEXON-16): Dia | Semana | Mês | Ano com
 * navegação por data, esperado (satélite/solarímetro) sobre a geração, perdas, fechamento do
 * mês e previsão de amanhã. Só inversores (GER-2). Sem inversor com leitura, mostra `fallback`
 * (o gráfico de antes).
 */

const PERIODOS: Array<{ k: PeriodoAnalise; rotulo: string }> = [
  { k: 'dia', rotulo: 'Dia' },
  { k: 'semana', rotulo: 'Semana' },
  { k: 'mes', rotulo: 'Mês' },
  { k: 'ano', rotulo: 'Ano' },
];
const PAPEIS_EDITORES = ['super_admin', 'admin', 'analista'];
const MARGEM = { top: 12, right: 16, bottom: 28, left: 56 };

const hojeSP = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const compacto = (v: number) => (Math.abs(v) >= 1000 ? `${nf(v / 1000, 1)}k` : nf(v, 0));
const dataBr = (d: string) => d.split('-').reverse().join('/');

function rotuloReferencia(a: Pick<Analise, 'periodo' | 'inicio' | 'fim' | 'referencia'>): string {
  if (a.periodo === 'dia') return dataBr(a.referencia);
  if (a.periodo === 'semana') return `${dataBr(a.inicio).slice(0, 5)} – ${dataBr(a.fim)}`;
  const [y, m] = a.inicio.split('-').map(Number);
  if (a.periodo === 'mes') {
    const s = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return String(y);
}

function mensagemErro(e: unknown): string {
  const msg = (e as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof msg === 'string' && msg ? msg : 'Não foi possível carregar a análise de geração.';
}

/** "2026-10-20T06:15:00-03:00" → Date local (o bklit exige `date` local). */
function dataLocal(iso: string): Date {
  const [d, h] = iso.slice(0, 16).split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  return new Date(y, mo - 1, da, hh, mm);
}

interface LinhaBarra extends Record<string, unknown> {
  rotulo: string;
  real: number | null;
  folga: number;
  esperado: number | null;
  ponto: PontoAnalise;
}

export function AnaliseGeracao({ unidadeId, fallback }: { unidadeId: string; fallback?: ReactNode }) {
  // Recalculado a cada render: a tela aberta passando da meia-noite não pode ficar no dia velho.
  const hoje = hojeSP();
  const papel = useUserStore((s) => s.getUserRole());
  const podeConfigurar = PAPEIS_EDITORES.includes(papel);
  const [periodo, setPeriodo] = useState<PeriodoAnalise>('dia');
  const [ref, setRef] = useState(hoje);
  const [a, setA] = useState<Analise | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [configAberta, setConfigAberta] = useState(false);

  // Só a resposta do último pedido vale: clique rápido ou o refresh não podem trocar o período em tela.
  const pedido = useRef(0);
  const carregar = useCallback(async () => {
    if (!unidadeId) return;
    const meu = ++pedido.current;
    setLoading(true);
    setErro(null);
    try {
      const r = await geracaoApi.analise(unidadeId, periodo, ref);
      if (meu === pedido.current) setA(r);
    } catch (e: unknown) {
      if (meu !== pedido.current) return;
      setA(null);
      setErro(mensagemErro(e));
    } finally {
      if (meu === pedido.current) setLoading(false);
    }
  }, [unidadeId, periodo, ref]);

  useEffect(() => { carregar(); }, [carregar]);

  // Hoje: a geração anda minuto a minuto e o satélite chega de hora em hora.
  const incluiHoje = a != null && a.proximo == null;
  useEffect(() => {
    if (!incluiHoje) return undefined;
    const t = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [incluiHoje, carregar]);

  const comFonte = a?.config.fonte != null && a.config.fonte !== 'nenhuma';
  const rotuloEsperado = comFonte ? `esperado (${ROTULO_FONTE[a!.config.fonte]})` : '';

  const linhasDia = useMemo(() => {
    if (!a || a.periodo !== 'dia') return { linhas: [], esperado: [] as Array<{ date: Date; valor: number | null }> };
    const pts = a.pontos.filter((p) => !p.futuro && (p.real_kw != null || p.esperado_kw != null));
    if (!pts.length) return { linhas: [], esperado: [] };
    const ini = dataLocal(pts[0].inicio as string).getTime();
    const passo = 15 * 60 * 1000;
    const linhas = linhasDeBuckets(ini, ini + pts.length * passo, {
      real: pts.map((p) => p.real_kw ?? null),
      teto: pts.map((p) => Math.max(p.real_kw ?? 0, p.esperado_kw ?? 0)),
    }).map((l, i) => ({ ...l, date: dataLocal(pts[i].inicio as string), esperadoBruto: pts[i].esperado_kw ?? null }));
    return { linhas, esperado: pts.map((p) => ({ date: dataLocal(p.inicio as string), valor: p.esperado_kw ?? null })) };
  }, [a]);

  const linhasBarra = useMemo<LinhaBarra[]>(() => {
    if (!a || a.periodo === 'dia') return [];
    return a.pontos.map((p) => ({
      rotulo: p.rotulo,
      real: p.real_kwh,
      // Folga empilhada e transparente: estica o eixo até o esperado sem alargar a barra.
      folga: Math.max(0, (p.esperado_kwh ?? 0) - (p.real_kwh ?? 0)),
      esperado: comFonte ? p.esperado_kwh : null,
      ponto: p,
    }));
  }, [a, comFonte]);

  const abrirBarra = (i: number) => {
    const p = linhasBarra[i]?.ponto;
    if (!p || p.futuro || !a) return;
    setPeriodo(a.periodo === 'ano' ? 'mes' : 'dia');
    setRef(p.data);
  };

  if (a && (!a.tem_inversor || a.tem_dados === false)) return <>{fallback ?? null}</>;
  // API fora (ou ainda não publicada): com gráfico antigo disponível, ele fica no lugar.
  if (erro && !a && fallback) return <>{fallback}</>;

  const btnNav = 'grid h-8 w-8 place-items-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40';
  const temGrafico = a && (a.periodo === 'dia' ? linhasDia.linhas.length > 1 : linhasBarra.some((l) => l.real != null || l.esperado != null));
  // Hoje depois do pôr do sol: destaque é a energia do dia, não "0,0 kW" (GER-24).
  const destaque = a?.agora?.gerando
    ? { rotulo: 'Gerando agora', valor: `${nf(a.agora.potencia_kw ?? 0, 1)} kW` }
    : { rotulo: a?.periodo === 'dia' && a.referencia === hoje ? 'Gerado hoje' : 'Energia no período', valor: a?.resumo ? formatEnergy(a.resumo.energia_kwh) : '—' };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{destaque.rotulo}</div>
            <div className="text-2xl font-bold tabular-nums">{destaque.valor}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label="Período da análise">
              {PERIODOS.map((p) => (
                <button
                  key={p.k}
                  type="button"
                  aria-pressed={periodo === p.k}
                  onClick={() => { setPeriodo(p.k); setRef(hoje); }}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    periodo === p.k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.rotulo}
                </button>
              ))}
            </div>
            {podeConfigurar && (
              <button type="button" className={btnNav} title="Configuração da usina" aria-label="Configuração da usina" onClick={() => setConfigAberta(true)}>
                <Settings2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <button type="button" className={btnNav} aria-label="Período anterior" disabled={!a} onClick={() => a && setRef(a.anterior)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          {periodo === 'dia' ? (
            <input
              type="date"
              value={ref}
              max={hoje}
              onChange={(e) => e.target.value && setRef(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
              aria-label="Escolher dia"
            />
          ) : (
            <span className="min-w-[150px] text-center text-sm font-medium">{a ? rotuloReferencia(a) : '…'}</span>
          )}
          <button type="button" className={btnNav} aria-label="Próximo período" disabled={!a?.proximo} onClick={() => a?.proximo && setRef(a.proximo)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR.geracao }} />Geração</span>
            {comFonte && (
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: COR.neutro }} />
                {rotuloEsperado}
              </span>
            )}
          </div>
        </div>

        <div className="px-4 pt-2 text-[11px] text-muted-foreground">
          {(a?.periodo ?? periodo) === 'dia' ? 'Potência (kW) a cada 15 min' : (a?.periodo ?? periodo) === 'ano' ? 'kWh por mês · toque para abrir o mês' : 'kWh por dia · toque para abrir o dia'}
        </div>
        <div className="relative h-72 px-2 pb-3 pt-1">
          {loading && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-card/60">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && (erro || !temGrafico) ? (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
              {erro ?? 'Sem dados de geração neste período.'}
            </div>
          ) : a?.periodo === 'dia' ? (
            linhasDia.linhas.length > 1 && (
              <LineChart data={linhasDia.linhas} aspectRatio="auto" className="h-full" margin={MARGEM} animationDuration={500}>
                <Grid horizontal numTicksRows={4} />
                <Area dataKey="real" fill={COR.geracao} fillOpacity={0.35} gradientToOpacity={0.02} strokeWidth={2} curve={curveMonotoneX} fadeEdges={false} />
                <Line dataKey="teto" {...LINHA_SO_DOMINIO} />
                {comFonte && <LinhaTracejadaParcial pontos={linhasDia.esperado} cor={COR.neutro} />}
                <XAxis numTicks={7} />
                <YAxis numTicks={4} formatValue={compacto} />
                <ChartTooltip
                  showDots
                  dotColor={(_p, linha) => (linha.dataKey === 'teto' ? 'transparent' : linha.stroke)}
                  content={({ point }) => {
                    const p = point as Record<string, unknown> & { date: Date };
                    const real = p.realBruto as number | null;
                    const esp = p.esperadoBruto as number | null;
                    const hh = p.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const linhas: LinhaTooltip[] = [];
                    if (comFonte) linhas.push({ label: rotuloEsperado, value: esp != null ? `${nf(esp, 1)} kW` : 'aguardando satélite' });
                    if (comFonte && real != null && esp != null && esp > 0) linhas.push({ label: 'do esperado', value: `${nf((real / esp) * 100, 0)}%` });
                    return (
                      <TooltipDestaque titulo={hh} valor={real != null ? nf(real, 1) : '—'} unidade="kW" rotulo={real != null ? 'Geração' : 'Sem dados'} linhas={linhas} />
                    );
                  }}
                />
              </LineChart>
            )
          ) : (
            linhasBarra.length > 0 && (
              <BarChart data={linhasBarra} xDataKey="rotulo" aspectRatio="auto" className="h-full" margin={MARGEM} barGap={0.3} stacked animationDuration={500}>
                <Grid horizontal numTicksRows={4} />
                <Bar dataKey="real" fill={COR.geracao} lineCap={4} />
                <Bar dataKey="folga" fill="transparent" />
                {comFonte && <MarcadorEsperadoBarras chave="esperado" cor={COR.neutro} />}
                <CliqueBarras onClick={abrirBarra} semDados={(d) => (d as LinhaBarra).ponto.sem_dados} />
                <BarXAxis maxLabels={a?.periodo === 'mes' ? 16 : 12} showAllLabels={a?.periodo !== 'mes'} />
                <YAxis numTicks={4} formatValue={compacto} />
                <ChartTooltip
                  showDatePill={false}
                  showCrosshair={false}
                  showDots={false}
                  content={({ point }) => {
                    const l = point as LinhaBarra;
                    const titulo = a?.periodo === 'ano' ? l.rotulo : dataBr(l.ponto.data);
                    if (l.ponto.futuro) return <TooltipDestaque titulo={titulo} rotulo="Ainda não aconteceu" />;
                    const linhas: LinhaTooltip[] = [];
                    if (l.esperado != null) {
                      linhas.push({ label: rotuloEsperado, value: `${nf(l.esperado, 0)} kWh` });
                      if (l.real != null && l.esperado > 0) linhas.push({ label: 'do esperado', value: `${nf((l.real / l.esperado) * 100, 0)}%` });
                    }
                    if (l.real == null) return <TooltipDestaque titulo={titulo} rotulo="Sem dados" linhas={linhas} />;
                    return <TooltipDestaque titulo={titulo} valor={nf(l.real, 0)} unidade="kWh" rotulo="Geração" linhas={linhas} />;
                  }}
                />
              </BarChart>
            )
          )}
        </div>
      </div>

      {a && a.tem_dados !== false && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="lg:col-span-2"><CardResumo a={a} /></div>
          {comFonte && <div className="lg:col-span-2"><CardPerdas a={a} /></div>}
          <CardFechamento a={a} />
          <CardPrevisao a={a} />
        </div>
      )}

      {podeConfigurar && (
        <ConfigUsinaDialog unidadeId={unidadeId} open={configAberta} onOpenChange={setConfigAberta} onSalvo={carregar} />
      )}
    </div>
  );
}

export default AnaliseGeracao;
