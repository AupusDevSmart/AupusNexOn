import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Settings, Settings2, Zap } from 'lucide-react';
import { COR } from '@/components/graficos/cores';
import { useUserStore } from '@/store/useUserStore';
import { formatEnergy } from '@/utils/formatEnergy';
import { useDemandaAgregada, type PeriodoFiltro } from '@/hooks/useDemandaAgregada';
import { useDadosM160 } from '@/hooks/useDadosM160';
import { ConfiguracaoDemandaModal } from '@/features/supervisorio/components/ConfiguracaoDemandaModal';
import { SinopticoGraficosV2 } from '@/features/supervisorio/components/sinoptico-graficos-v2';
import { GraficoDemanda } from '@/features/supervisorio/components/sinoptico-graficos-v2/GraficoDemanda';
import { PERCENTUAL_LIMITE_GERACAO } from '@/features/supervisorio/components/sinoptico-graficos-v2/dados';
import { useEquipamentosDemanda } from '@/features/supervisorio/components/sinoptico-graficos-v2/use-equipamentos-demanda';
import { useDemandasUnidade } from '@/features/supervisorio/sinoptico/hooks/useConfiguracaoDemanda';
import { ROTULO_FONTE, type PeriodoAnalise } from './api';
import { BarrasEnergia } from './BarrasEnergia';
import { CardFechamento, CardPerdas, CardPrevisao, CardResumo } from './CardsAnalise';
import { ConfigUsinaDialog } from './ConfigUsinaDialog';
import {
  alternarSerie,
  consumoNoPeriodo,
  consumoPorChave,
  montarBarrasEnergia,
  montarDiaEnergia,
  periodosConsumo,
  seriesEfetivas,
  type Serie,
  type SeriesLigadas,
} from './energia';
import { linhasSelo } from './fonte';
import { nf } from './formato';
import { SeloFonte } from './SeloFonte';
import { rotuloReferencia, useAnaliseGeracao } from './useAnaliseGeracao';

/**
 * Cartão "Energia" da Visão Geral (NEXON-37): junta a análise de geração (NEXON-16) e o
 * gráfico de Demanda num cartão só. Período Dia · Semana · Mês · Ano · Total com ‹ data ›;
 * séries Carga · Geração · Esperado (carga e geração juntas = espelhado: consumo para cima,
 * geração para baixo). Tensão e FP seguem como abas, pelo SinopticoGraficosV2. Abaixo, os
 * cartões da análise sem mudar regra.
 *
 * Sem análise (unidade sem inversor, sem dado ou API fora) mostra `fallback` (o gráfico de
 * antes); sem permissão de ver geração (403) mostra `semAcesso`.
 */

const PERIODOS: Array<{ k: PeriodoAnalise; rotulo: string }> = [
  { k: 'dia', rotulo: 'Dia' },
  { k: 'semana', rotulo: 'Semana' },
  { k: 'mes', rotulo: 'Mês' },
  { k: 'ano', rotulo: 'Ano' },
  { k: 'total', rotulo: 'Total' },
];
const SUBTITULO: Record<PeriodoAnalise, string> = {
  dia: 'Potência (kW) ao longo do dia',
  semana: 'kWh por dia · toque para abrir o dia',
  mes: 'kWh por dia · toque para abrir o dia',
  ano: 'kWh por mês · toque para abrir o mês',
  total: 'kWh por ano · toque para abrir o ano',
};
const PROXIMO_NIVEL: Record<PeriodoAnalise, PeriodoAnalise> = { dia: 'dia', semana: 'dia', mes: 'dia', ano: 'mes', total: 'ano' };
const SEM_PERIODO: PeriodoFiltro = { tipo: 'dia' };
const COR_SERIE: Record<Serie, string> = { carga: COR.potencia, geracao: COR.geracao, esperado: COR.neutro };

type Aba = 'energia' | 'tensao' | 'fp';
const ABAS: Array<{ k: Aba; rotulo: string }> = [
  { k: 'energia', rotulo: 'Energia' },
  { k: 'tensao', rotulo: 'Tensão' },
  { k: 'fp', rotulo: 'FP' },
];

/** Pílula das abas e das séries (mesmo desenho do painel Demanda/Tensão/FP). */
function Pilula({ ativo, onClick, disabled, title, children }: {
  ativo: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        ativo ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

export function CartaoEnergia({ unidadeId, fallback, semAcesso }: {
  unidadeId: string;
  fallback?: ReactNode;
  semAcesso?: ReactNode;
}) {
  const an = useAnaliseGeracao(unidadeId);
  const { a, periodo, ref, hoje, loading, erro } = an;
  // Grupo "Usina" da configuração: só papéis globais (NEXON-20, capacidades.configUsina).
  const podeConfigurar = useUserStore((s) => s.capacidades.configUsina);
  const [configAberta, setConfigAberta] = useState(false);
  const [aba, setAba] = useState<Aba>('energia');
  const [ligadas, setLigadas] = useState<SeriesLigadas>({ carga: true, geracao: true, esperado: true });

  // Demanda: contratados da unidade e equipamentos de consumo da configuração de demanda.
  const { demandaGeracao, demandaCarga } = useDemandasUnidade(unidadeId);
  const dem = useEquipamentosDemanda({ unidadeId, valorContratado: demandaGeracao ?? 0, percentualAdicional: PERCENTUAL_LIMITE_GERACAO });
  const { equipamentosM160 } = useDadosM160(unidadeId, '', false);
  const temMedidor = equipamentosM160.length > 0;

  const comFonte = a?.config.fonte != null && a.config.fonte !== 'nenhuma';
  const rotuloEsperado = comFonte ? `Esperado (${ROTULO_FONTE[a!.config.fonte]})` : 'Esperado';
  const periodoAtual = a?.periodo ?? periodo;
  // Total não tem agregado de consumo na API: Carga fica desabilitada com dica.
  const disponivel: SeriesLigadas = { carga: dem.temConsumo && periodoAtual !== 'total', geracao: true, esperado: comFonte };
  const ef = seriesEfetivas(ligadas, disponivel);

  // Consumo do período (endpoints da Demanda). A semana pode precisar de dois meses.
  const consultas = useMemo(() => (a ? periodosConsumo(a) : []), [a]);
  const buscaConsumo = ef.carga && aba === 'energia';
  const con = useDemandaAgregada({
    equipamentos: dem.equipamentosConsumo,
    periodo: consultas[0] ?? SEM_PERIODO,
    fatorPerdas: 0,
    intervaloAtualizacao: dem.configuracao.intervaloAtualizacao,
    ativo: buscaConsumo && consultas.length > 0,
  });
  const con2 = useDemandaAgregada({
    equipamentos: dem.equipamentosConsumo,
    periodo: consultas[1] ?? SEM_PERIODO,
    fatorPerdas: 0,
    intervaloAtualizacao: dem.configuracao.intervaloAtualizacao,
    ativo: buscaConsumo && consultas.length > 1,
  });
  const mapaConsumo = useMemo(() => {
    const m = new Map<string, number>();
    if (!ef.carga) return m;
    if (consultas[0] && consultas[0].tipo !== 'dia') consumoPorChave(con.dados, consultas[0], m);
    if (consultas[1]) consumoPorChave(con2.dados, consultas[1], m);
    return m;
  }, [ef.carga, consultas, con.dados, con2.dados]);

  const dia = useMemo(() => {
    if (!a || a.periodo !== 'dia') return null;
    return montarDiaEnergia({
      data: a.referencia,
      geracao: a.pontos,
      consumo: ef.carga ? con.dados : [],
      ef,
      contratadoGeracao: demandaGeracao,
      contratadoCarga: demandaCarga,
    });
    // ef é recalculado a cada render; as chaves dele bastam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, con.dados, ef.modo, ef.esperado, ef.carga, demandaGeracao, demandaCarga]);

  const barras = useMemo(() => {
    if (!a || a.periodo === 'dia') return null;
    return montarBarrasEnergia(a.pontos, a.periodo, mapaConsumo, ef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, mapaConsumo, ef.modo, ef.esperado, ef.carga]);

  if (an.semAcesso) return <>{semAcesso ?? null}</>;
  if (a && (!a.tem_inversor || a.tem_dados === false)) return <>{fallback ?? null}</>;
  // API fora (ou ainda não publicada): com gráfico antigo disponível, ele fica no lugar.
  if (erro && !a && fallback) return <>{fallback}</>;

  const btnNav = 'grid h-8 w-8 place-items-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40';
  const temGrafico = dia
    ? dia.pontos.length > 1
    : !!barras && barras.linhas.some((l) => l.geracao != null || l.consumo != null || l.esperado != null);
  const carregandoConsumo = ef.carga && (con.isInitialLoading || con2.isInitialLoading);
  // Hoje depois do pôr do sol: destaque é a energia do dia, não "0,0 kW" (GER-24).
  const destaque = a?.agora?.gerando
    ? { rotulo: 'Gerando agora', valor: `${nf(a.agora.potencia_kw ?? 0, 1)} kW` }
    : { rotulo: a?.periodo === 'dia' && a.referencia === hoje ? 'Gerado hoje' : 'Energia no período', valor: a?.resumo ? formatEnergy(a.resumo.energia_kwh) : '—' };
  const consumido = !ef.carga || !a
    ? null
    : a.periodo === 'dia'
      ? (con.dados.length ? Math.abs(con.energiaPeriodo) : null)
      : consumoNoPeriodo(a.pontos, a.periodo, mapaConsumo);

  const abrirBarra = (i: number) => {
    const p = barras?.linhas[i]?.ponto;
    if (!p || p.futuro || !a) return;
    an.abrir(PROXIMO_NIVEL[a.periodo], p.data);
  };

  const abas = temMedidor && (
    <div className="flex items-center gap-1" role="tablist" aria-label="Gráfico">
      {ABAS.map((x) => (
        <Pilula key={x.k} ativo={aba === x.k} onClick={() => setAba(x.k)}>{x.rotulo}</Pilula>
      ))}
    </div>
  );

  const botaoSerie = (k: Serie, rotulo: string, extra?: { disabled?: boolean; title?: string }) => {
    const ativo = ef[k];
    const cor = COR_SERIE[k];
    return (
      <Pilula key={k} ativo={ativo} onClick={() => setLigadas((l) => alternarSerie(l, k, disponivel))} disabled={extra?.disabled} title={extra?.title}>
        {k === 'esperado' ? (
          <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: cor }} />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ativo ? cor : 'transparent', boxShadow: `inset 0 0 0 1.5px ${cor}` }} />
        )}
        {rotulo}
      </Pilula>
    );
  };

  const engrenagens = (
    <div className="flex items-center gap-1">
      {(dem.equipamentosData?.length ?? 0) > 0 && (
        <button type="button" className={btnNav} title="Configuração de demanda" aria-label="Configuração de demanda" onClick={() => dem.setModalOpen(true)}>
          <Settings className="h-4 w-4" />
        </button>
      )}
      {podeConfigurar && (
        <button type="button" className={btnNav} title="Configuração da usina" aria-label="Configuração da usina" onClick={() => setConfigAberta(true)}>
          <Settings2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {aba !== 'energia' ? (
        // Tensão e FP: o mesmo gráfico do painel do sinóptico, com as abas no título.
        <div className="flex min-h-[240px] flex-col xl:h-[440px] xl:min-h-0">
          <SinopticoGraficosV2
            unidadeId={unidadeId}
            valorContratado={demandaGeracao ?? undefined}
            valorContratadoCarga={demandaCarga}
            percentualAdicional={PERCENTUAL_LIMITE_GERACAO}
            apenasGrafico={aba}
            controleVariavel={abas}
          />
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-base font-semibold">Energia</span>
            {abas}
            <div className="ml-auto">{engrenagens}</div>
          </div>

          <div className="flex flex-wrap items-end gap-3 px-4 pt-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{destaque.rotulo}</div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-2xl font-bold tabular-nums">{destaque.valor}</span>
                {a?.fonte_geracao?.selo && (
                  <SeloFonte texto={a.fonte_geracao.selo} divergem={a.fonte_geracao.divergem} linhas={linhasSelo(a.fonte_geracao)} />
                )}
                {consumido != null && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatEnergy(consumido)}</span> consumidos
                  </span>
                )}
              </div>
            </div>
            <div className="ml-auto flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-muted p-0.5" role="group" aria-label="Período">
              {PERIODOS.filter((p) => p.k !== 'total' || !an.semTotal).map((p) => (
                <button
                  key={p.k}
                  type="button"
                  aria-pressed={periodo === p.k}
                  onClick={() => an.escolherPeriodo(p.k)}
                  className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    periodo === p.k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            {periodo === 'total' ? (
              <span className="text-sm font-medium">{a ? rotuloReferencia(a) : '…'}</span>
            ) : (
              <>
                <button type="button" className={btnNav} aria-label="Período anterior" disabled={!a} onClick={() => a && an.abrir(periodo, a.anterior)}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {periodo === 'dia' ? (
                  <input
                    type="date"
                    value={ref}
                    max={hoje}
                    onChange={(e) => e.target.value && an.abrir('dia', e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-base sm:text-sm"
                    aria-label="Escolher dia"
                  />
                ) : (
                  <span className="min-w-[130px] text-center text-sm font-medium">{a ? rotuloReferencia(a) : '…'}</span>
                )}
                <button type="button" className={btnNav} aria-label="Próximo período" disabled={!a?.proximo} onClick={() => a?.proximo && an.abrir(periodo, a.proximo)}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1" role="group" aria-label="Séries do gráfico">
              {dem.temConsumo && botaoSerie('carga', 'Carga', periodoAtual === 'total' ? { disabled: true, title: 'Consumo não tem total por ano' } : undefined)}
              {botaoSerie('geracao', 'Geração', !disponivel.carga ? { disabled: true } : undefined)}
              {comFonte && botaoSerie('esperado', 'Esperado', !ef.geracao ? { disabled: true, title: 'O esperado é da geração' } : undefined)}
            </div>
          </div>

          <div className="px-4 pt-2 text-[11px] text-muted-foreground">{SUBTITULO[periodoAtual]}</div>
          <div className="relative px-2 pb-3 pt-1">
            {(loading || carregandoConsumo) && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-white/50 dark:bg-black/30">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && !carregandoConsumo && (erro || !temGrafico) ? (
              <div className="grid h-72 place-items-center px-6 text-center text-sm text-muted-foreground">
                {erro ?? 'Sem dados de energia neste período.'}
              </div>
            ) : dia ? (
              dia.pontos.length > 1 && (
                <GraficoDemanda
                  pontos={dia.pontos}
                  dominio={dia.dominio}
                  referencias={dia.referencias}
                  chaveZoom={`${a?.referencia}|${ef.modo}`}
                  className="h-72"
                  fluxo={ef.modo === 'fluxo'}
                  serie={ef.modo === 'fluxo' ? undefined : ef.modo}
                  esperado={dia.esperado.length ? { pontos: dia.esperado, rotulo: rotuloEsperado } : undefined}
                />
              )
            ) : barras && a ? (
              <BarrasEnergia
                linhas={barras.linhas}
                zero={barras.zero}
                ef={ef}
                periodo={a.periodo}
                rotuloEsperado={rotuloEsperado}
                onAbrir={abrirBarra}
                className="h-72"
              />
            ) : (
              <div className="h-72" />
            )}
          </div>
        </div>
      )}

      {a && a.tem_dados !== false && (
        // Cards dividem a largura (flex-wrap): os que existirem ocupam a linha juntos, sem
        // um cartão sozinho na largura toda e outro pela metade embaixo. Perdas (barra de
        // categorias) quebra para a linha dela.
        <div className="flex flex-wrap gap-3 [&>*]:min-w-[280px] [&>*]:flex-1 [&>*]:basis-[320px]">
          <CardResumo a={a} />
          <CardFechamento a={a} />
          <CardPrevisao a={a} />
          {comFonte && <div className="!basis-full"><CardPerdas a={a} /></div>}
        </div>
      )}

      {podeConfigurar && (
        <ConfigUsinaDialog unidadeId={unidadeId} open={configAberta} onOpenChange={setConfigAberta} onSalvo={an.carregar} />
      )}
      <ConfiguracaoDemandaModal
        open={dem.modalOpen}
        onOpenChange={dem.setModalOpen}
        configuracao={dem.configuracaoModal}
        onSalvar={dem.handleSalvarConfiguracao}
        equipamentosDisponiveis={dem.equipamentosData || []}
      />
    </div>
  );
}

export default CartaoEnergia;
