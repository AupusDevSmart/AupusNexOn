import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Activity, Settings, TrendingUp, Zap, AlertTriangle, Expand, ChevronLeft, ChevronRight } from "lucide-react";
import { memo, useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useDemandaAgregada, type PeriodoFiltro } from "@/hooks/useDemandaAgregada";
import { useDadosM160 } from "@/hooks/useDadosM160";
import { ConfiguracaoDemandaModal } from "./ConfiguracaoDemandaModal";
import { useEquipamentosDemanda } from "./sinoptico-graficos-v2/use-equipamentos-demanda";
import {
  analisarQualidadeDados,
  deslocarPeriodo,
  ehDiaAtual,
  inicioISO,
  podeAvancarPeriodo,
  rotuloPeriodo,
} from "./sinoptico-graficos-v2/periodo";
import { formatarEnergia } from "./sinoptico-graficos-v2/formatos";
import {
  montarPontosDemanda,
  montarPontosEnergia,
  montarPontosFases,
  mesclarEnergia,
  mesclarFluxo,
  PERCENTUAL_LIMITE_CARGA,
  PERCENTUAL_LIMITE_GERACAO,
  type Dominio,
  type FasesAtivas,
  type PontoDemanda,
} from "./sinoptico-graficos-v2/dados";
import { GraficoDemanda as GraficoDemandaBase, type ReferenciasDemanda } from "./sinoptico-graficos-v2/GraficoDemanda";
import { GraficoEnergia as GraficoEnergiaBase } from "./sinoptico-graficos-v2/GraficoEnergia";
import { GraficoFases as GraficoFasesBase } from "./sinoptico-graficos-v2/GraficoFases";
import { GraficoSkeleton } from "@/components/graficos/grafico-skeleton";
import { ControlesFases } from "./sinoptico-graficos-v2/ControlesFases";

// memo: os gráficos só redesenham quando os pontos/props mudam — abrir um modal,
// trocar a pílula ou o poll de outro gráfico não refaz o SVG inteiro.
const GraficoDemanda = memo(GraficoDemandaBase);
const GraficoEnergia = memo(GraficoEnergiaBase);
const GraficoFases = memo(GraficoFasesBase);

// Desabilitar logs de debug em produção
const noop = () => {};
if (import.meta.env.PROD) {
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

interface SinopticoGraficosV2Props {
  unidadeId?: string;
  valorContratado?: number;
  /** Demanda contratada da CARGA (unidade.demanda_carga) — linha no lado do consumo. */
  valorContratadoCarga?: number | null;
  percentualAdicional?: number;
  onConfigSaved?: () => void;
  /** Quando definido, renderiza apenas um dos graficos (controlado externamente). */
  apenasGrafico?: 'demanda' | 'tensao' | 'fp';
  /** Conteudo extra ao lado do titulo do grafico (ex.: toggles de variavel). */
  controleVariavel?: ReactNode;
}

const FASES_TODAS: FasesAtivas = { A: true, B: true, C: true };
/** Altura dos gráficos no modo compacto (toggle Demanda/Tensão/FP do sinóptico). */
const ALTURA_COMPACTA = 'h-[150px] xl:h-auto xl:flex-1 xl:min-h-0';
// Abas do gráfico de demanda pré-carregadas em segundo plano (a aba aberta é pulada).
const PERIODOS_PREFETCH: PeriodoFiltro[] = [{ tipo: 'dia' }, { tipo: 'mes' }, { tipo: 'ano' }];
const SEM_DEMANDA = { pontos: [] as PontoDemanda[], dominio: undefined as Dominio | undefined };

/** Limite acima do contratado (NEXON-14) — moram em dados.ts; reexportados para quem já importa daqui. */
export { PERCENTUAL_LIMITE_GERACAO, PERCENTUAL_LIMITE_CARGA };

export function SinopticoGraficosV2({
  unidadeId,
  valorContratado = 2500,
  valorContratadoCarga,
  percentualAdicional = PERCENTUAL_LIMITE_CARGA,
  onConfigSaved,
  apenasGrafico,
  controleVariavel,
}: SinopticoGraficosV2Props) {
  const [modalExpandidoOpen, setModalExpandidoOpen] = useState(false);

  // Período do gráfico de Demanda
  const [periodo, setPeriodo] = useState<PeriodoFiltro>({ tipo: 'dia' });
  const [customAberto, setCustomAberto] = useState(false);
  const [customInicio, setCustomInicio] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return inicioISO(d);
  });
  const [customFim, setCustomFim] = useState<string>(() => inicioISO(new Date()));

  // Estados para gráficos de tensão e FP
  const [m160Selecionado, setM160Selecionado] = useState<string>('');
  const [fasesTensao, setFasesTensao] = useState<FasesAtivas>(FASES_TODAS);
  const [fasesFP, setFasesFP] = useState<FasesAtivas>(FASES_TODAS);
  const [modalTensaoOpen, setModalTensaoOpen] = useState(false);
  const [modalFPOpen, setModalFPOpen] = useState(false);

  // Config de demanda + equipamentos (geração × consumo) — hook compartilhado com o cartão Energia.
  const {
    modalOpen,
    setModalOpen,
    configuracao,
    configuracaoModal,
    equipamentosData,
    equipamentosGeracao,
    equipamentosConsumo,
    temConsumo,
    temGeracao,
    handleSalvarConfiguracao,
  } = useEquipamentosDemanda({ unidadeId, valorContratado, percentualAdicional, onConfigSaved });
  // Só busca/polla o que está na tela: no painel do sinóptico (apenasGrafico) um
  // gráfico por vez; os modais de Tensão/FP e o expandido também contam.
  const demandaVisivel = !apenasGrafico || apenasGrafico === 'demanda' || modalExpandidoOpen;
  const m160Visivel = !apenasGrafico || apenasGrafico !== 'demanda' || modalTensaoOpen || modalFPOpen;
  const ger = useDemandaAgregada({
    equipamentos: equipamentosGeracao,
    periodo,
    fatorPerdas: configuracao.aplicarPerdas ? configuracao.fatorPerdas : 0,
    intervaloAtualizacao: configuracao.intervaloAtualizacao,
    ativo: demandaVisivel,
    prefetch: PERIODOS_PREFETCH,
  });
  const con = useDemandaAgregada({
    equipamentos: equipamentosConsumo,
    periodo,
    fatorPerdas: 0,
    intervaloAtualizacao: configuracao.intervaloAtualizacao,
    ativo: demandaVisivel,
    prefetch: PERIODOS_PREFETCH,
  });
  // Filtro Carga/Geração (só aparece com as duas): as duas = espelhado (consumo para cima,
  // geração para baixo); uma só = essa série para cima, com o contratado dela. Nunca as
  // duas desligadas.
  const [verCarga, setVerCarga] = useState(true);
  const [verGeracao, setVerGeracao] = useState(true);
  const temAmbos = temConsumo && temGeracao;
  const mostraCarga = temConsumo && (!temAmbos || verCarga);
  const mostraGeracao = !temConsumo || (temGeracao && (!temAmbos || verGeracao));
  const modoFluxo = mostraCarga && mostraGeracao;
  const soCarga = mostraCarga && !mostraGeracao;
  const alternarSerie = (qual: 'carga' | 'geracao') => {
    if (qual === 'carga') {
      if (verCarga && !verGeracao) setVerGeracao(true);
      setVerCarga(!verCarga);
    } else {
      if (verGeracao && !verCarga) setVerCarga(true);
      setVerGeracao(!verGeracao);
    }
  };
  const dados = mostraGeracao ? ger.dados : con.dados;
  const energiaPeriodo = ger.energiaPeriodo;
  const energiaConsumida = Math.abs(con.energiaPeriodo);
  const isInitialLoading = ger.isInitialLoading || con.isInitialLoading;

  // Usar hook de dados M160 para tensão e FP
  const {
    dados: dadosM160,
    equipamentosM160,
    carregandoLista: carregandoListaM160,
    isInitialLoading: isInitialLoadingCurvaM160,
  } = useDadosM160(unidadeId, m160Selecionado, m160Visivel);
  // Entre a lista chegar e o efeito abaixo escolher o 1º medidor também é carga.
  const isInitialLoadingM160 =
    isInitialLoadingCurvaM160 || (equipamentosM160.some((e) => !!e.id) && !m160Selecionado);

  // Selecionar automaticamente o primeiro M160 disponível
  useEffect(() => {
    if (equipamentosM160.length > 0 && !m160Selecionado) {
      setM160Selecionado(equipamentosM160[0].id);
    }
  }, [equipamentosM160, m160Selecionado]);


  // Séries dos gráficos no formato do bklit (ponto com Date, ordenado, sem nulos).
  // - dia: potência com eixo fixo 00:00 → agora e linhas contratado/adicional
  // - custom: potência com eixo = extensão dos dados
  // - mes/ano: barras de energia (kWh) por dia/mês
  const demanda = useMemo(() => {
    if (periodo.tipo !== 'dia' && periodo.tipo !== 'custom') return SEM_DEMANDA;
    if (soCarga) {
      // Consumo vem negativo do backend (sinal −1): para cima aqui.
      const consumo = (con.dados ?? []).map((d) => ({ ...d, potencia_kw: d.potencia_kw == null ? d.potencia_kw : Math.abs(Number(d.potencia_kw)) }));
      if (consumo.length === 0) return SEM_DEMANDA;
      return montarPontosDemanda(consumo, periodo, valorContratadoCarga ?? 0, PERCENTUAL_LIMITE_CARGA);
    }
    if (!modoFluxo) {
      if (!ger.dados || ger.dados.length === 0) return SEM_DEMANDA;
      return montarPontosDemanda(ger.dados, periodo, valorContratado, percentualAdicional);
    }
    const g = montarPontosDemanda(ger.dados ?? [], periodo, valorContratado, percentualAdicional);
    const c = montarPontosDemanda(con.dados ?? [], periodo, 0, 0);
    const carga = periodo.tipo === 'dia' && valorContratadoCarga
      ? { contratado: valorContratadoCarga, adicional: valorContratadoCarga * (1 + PERCENTUAL_LIMITE_CARGA / 100) }
      : undefined;
    const pontos = mesclarFluxo(g.pontos, c.pontos, carga);
    // Eixo do dia: o que for mais longe entre as duas séries (dia corrente termina no último ponto).
    const dominio = g.dominio && c.dominio
      ? (g.dominio[1] >= c.dominio[1] ? g.dominio : c.dominio)
      : g.dominio ?? c.dominio;
    return { pontos, dominio };
  }, [ger.dados, con.dados, soCarga, modoFluxo, periodo, valorContratado, valorContratadoCarga, percentualAdicional]);

  const energia = useMemo(() => {
    if (periodo.tipo !== 'mes' && periodo.tipo !== 'ano') return [];
    const c = con.dados ? montarPontosEnergia(con.dados, periodo.tipo).map((p) => ({ ...p, energia: Math.abs(p.energia) })) : [];
    if (soCarga) return c;
    const g = ger.dados ? montarPontosEnergia(ger.dados, periodo.tipo) : [];
    if (!modoFluxo) return g;
    return mesclarEnergia(g, c);
  }, [ger.dados, con.dados, soCarga, modoFluxo, periodo.tipo]);

  // Tensão e FP do M160 — sempre o dia corrente, eixo de 00:00 até agora
  const tensao = useMemo(() => montarPontosFases(dadosM160, 'tensao'), [dadosM160]);
  const fp = useMemo(() => montarPontosFases(dadosM160, 'fp'), [dadosM160]);

  // Há equipamentos cadastrados na unidade (com MQTT). Mostra card mesmo sem seleção.
  const temEquipamentosDisponiveis = equipamentosData && equipamentosData.length > 0;
  const temEquipamentosSelecionados = configuracao.equipamentos.some(e => e.selecionado);
  const temM160Disponivel = equipamentosM160.length > 0;
  // So a Demanda visivel (sem PM/M160): no desktop o card preenche a altura da
  // coluna em vez de deixar um vazio embaixo. So aplica em xl (layout em coluna);
  // abaixo disso e bottom-sheet e os graficos mantem altura fixa.
  const soDemanda = !!temEquipamentosDisponiveis && !temM160Disponivel;

  // Qualidade só faz sentido para 'dia' (live). Mês/ano/custom são consultas históricas.
  const qualidadeDados = useMemo(
    // Só faz sentido avaliar "desatualizado" no dia CORRENTE — num dia passado o
    // último ponto é sempre antigo.
    () => (periodo.tipo === 'dia' && ehDiaAtual(periodo) ? analisarQualidadeDados(dados) : { status: 'OK' as const, mensagem: '' }),
    [dados, periodo],
  );

  const ehSeriesPotencia = periodo.tipo === 'dia' || periodo.tipo === 'custom';
  const tipoEnergia: 'mes' | 'ano' = periodo.tipo === 'mes' ? 'mes' : 'ano';
  const temDadosDemanda = ehSeriesPotencia ? demanda.pontos.length > 0 : energia.length > 0;
  // Linhas de referência (contratado e contratado + adicional) só no período "dia".
  const referencias = useMemo<ReferenciasDemanda | undefined>(
    () => {
      if (periodo.tipo !== 'dia') return undefined;
      if (soCarga) {
        return valorContratadoCarga
          ? { contratado: valorContratadoCarga, adicional: valorContratadoCarga * (1 + PERCENTUAL_LIMITE_CARGA / 100), percentualAdicional: PERCENTUAL_LIMITE_CARGA }
          : undefined;
      }
      return { contratado: valorContratado, adicional: valorContratado * (1 + percentualAdicional / 100), percentualAdicional };
    },
    [periodo.tipo, soCarga, valorContratado, valorContratadoCarga, percentualAdicional],
  );
  const serieUnica: 'carga' | 'geracao' | undefined = soCarga ? 'carga' : temConsumo ? 'geracao' : undefined;
  // Troca de período zera o zoom
  const chaveZoomDemanda = `${periodo.tipo}|${periodo.data ?? ''}|${periodo.inicio ?? ''}|${periodo.fim ?? ''}`;

  const alturaDemanda = apenasGrafico
    ? ALTURA_COMPACTA
    : soDemanda
      ? 'h-[350px] xl:h-auto xl:flex-1 xl:min-h-0'
      : 'h-[350px]';
  const alturaM160 = apenasGrafico ? ALTURA_COMPACTA : 'h-[300px]';
  const alturaVazioDemanda = apenasGrafico ? ALTURA_COMPACTA : 'h-[300px]';

  const handlePeriodoTipoChange = (novoTipo: string) => {
    if (novoTipo === 'dia') setPeriodo({ tipo: 'dia' });
    else if (novoTipo === 'mes') setPeriodo({ tipo: 'mes' });
    else if (novoTipo === 'ano') setPeriodo({ tipo: 'ano' });
  };

  const aplicarCustom = () => {
    const inicio = new Date(customInicio);
    const fim = new Date(customFim);
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || fim <= inicio) return;
    const dias = (fim.getTime() - inicio.getTime()) / 86_400_000;
    if (dias > 31) return;
    setPeriodo({ tipo: 'custom', inicio: inicio.toISOString(), fim: fim.toISOString() });
    setCustomAberto(false);
  };

  const customLabel = useMemo(() => {
    if (periodo.tipo !== 'custom' || !periodo.inicio || !periodo.fim) return 'Personalizado';
    const fmt = (iso: string) =>
      new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `${fmt(periodo.inicio)} – ${fmt(periodo.fim)}`;
  }, [periodo]);

  return (
    <div className={`w-full flex flex-col gap-4 ${(soDemanda && !apenasGrafico) || apenasGrafico ? 'xl:flex-1 xl:min-h-0' : ''}`}>
      {/* Gráfico de Demanda */}
      {temEquipamentosDisponiveis && (!apenasGrafico || apenasGrafico === 'demanda') && (
      <Card className={(soDemanda && !apenasGrafico) || apenasGrafico ? 'xl:flex-1 xl:min-h-0 xl:flex xl:flex-col' : undefined}>
        <CardHeader className={apenasGrafico ? 'p-1.5 space-y-1' : 'p-2 space-y-2'}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={apenasGrafico ? 'h-4 w-4 text-yellow-500' : 'h-5 w-5 text-yellow-500'} />
              <CardTitle className={apenasGrafico ? 'text-base' : undefined}>Demanda</CardTitle>
              {controleVariavel}
              {temAmbos && (
                <div className="ml-1 flex items-center gap-1 border-l pl-2" role="group" aria-label="Séries do gráfico">
                  {([['carga', 'Carga', verCarga, 'var(--chart-2)'], ['geracao', 'Geração', verGeracao, 'var(--chart-1)']] as const).map(([k, rotulo, ativo, cor]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => alternarSerie(k)}
                      className={`flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium transition-colors ${ativo ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
                    >
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ativo ? cor : 'transparent', boxShadow: `inset 0 0 0 1.5px ${cor}` }} />
                      {rotulo}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalExpandidoOpen(true)}
                title="Expandir gráfico"
                className={`hover:bg-transparent ${apenasGrafico ? 'h-7 w-7' : 'h-8 w-8'}`}
              >
                <Expand className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalOpen(true)}
                title="Configurações"
                className={`hover:bg-transparent ${apenasGrafico ? 'h-7 w-7' : 'h-8 w-8'}`}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs de período + energia inline */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Tabs value={periodo.tipo === 'custom' ? '' : periodo.tipo} onValueChange={handlePeriodoTipoChange}>
                <TabsList className={`gap-1 rounded-[2px] bg-transparent p-0 ${apenasGrafico ? 'h-7' : 'h-8'}`}>
                  <TabsTrigger value="dia" className={`text-xs rounded-[2px] data-[state=active]:bg-accent ${apenasGrafico ? 'h-6 px-2' : 'h-7 px-3'}`}>Dia</TabsTrigger>
                  <TabsTrigger value="mes" className={`text-xs rounded-[2px] data-[state=active]:bg-accent ${apenasGrafico ? 'h-6 px-2' : 'h-7 px-3'}`}>Mês</TabsTrigger>
                  <TabsTrigger value="ano" className={`text-xs rounded-[2px] data-[state=active]:bg-accent ${apenasGrafico ? 'h-6 px-2' : 'h-7 px-3'}`}>Ano</TabsTrigger>
                </TabsList>
              </Tabs>

              <Popover open={customAberto} onOpenChange={setCustomAberto}>
                <PopoverTrigger asChild>
                  <Button
                    variant={periodo.tipo === 'custom' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 text-xs"
                  >
                    {customLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="custom-inicio" className="text-xs">Início</Label>
                      <Input
                        id="custom-inicio"
                        type="datetime-local"
                        value={customInicio}
                        onChange={e => setCustomInicio(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-fim" className="text-xs">Fim</Label>
                      <Input
                        id="custom-fim"
                        type="datetime-local"
                        value={customFim}
                        onChange={e => setCustomFim(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Range máximo: 31 dias.</p>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setCustomAberto(false)}>Cancelar</Button>
                      <Button size="sm" onClick={aplicarCustom}>Aplicar</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* ‹ › navega o período (dia/mês/ano); o rótulo volta pro atual */}
              {periodo.tipo !== 'custom' && (
                <div className="flex items-center gap-0.5 ml-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Período anterior"
                    aria-label="Período anterior"
                    onClick={() => setPeriodo(deslocarPeriodo(periodo, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    className="min-w-[88px] text-center text-xs font-medium tabular-nums hover:underline"
                    title="Voltar para o período atual"
                    onClick={() => handlePeriodoTipoChange(periodo.tipo)}
                  >
                    {rotuloPeriodo(periodo)}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Próximo período"
                    aria-label="Próximo período"
                    disabled={!podeAvancarPeriodo(periodo)}
                    onClick={() => setPeriodo(deslocarPeriodo(periodo, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {temConsumo ? (
              (energiaPeriodo > 0 || energiaConsumida > 0) && (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  {mostraGeracao && temGeracao && (
                    <span className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold">{formatarEnergia(energiaPeriodo)}</span>
                      <span className="text-xs text-muted-foreground">gerados</span>
                    </span>
                  )}
                  {mostraCarga && (
                    <span className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold">{formatarEnergia(energiaConsumida)}</span>
                      <span className="text-xs text-muted-foreground">consumidos</span>
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">no período</span>
                </div>
              )
            ) : energiaPeriodo > 0 && (
              <div className="flex items-baseline gap-1.5">
                <TrendingUp className="h-4 w-4 text-muted-foreground self-center" />
                <span className="text-sm font-semibold">{formatarEnergia(energiaPeriodo)}</span>
                <span className="text-xs text-muted-foreground">no período</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className={`p-2 ${(soDemanda && !apenasGrafico) || apenasGrafico ? 'xl:flex-1 xl:min-h-0 xl:flex xl:flex-col' : ''}`}>
          {/* Alerta de qualidade — só em modo 'dia' */}
          {periodo.tipo === 'dia' && qualidadeDados.status !== 'OK' && (
            <div className="mb-3 p-2 rounded-md bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground opacity-70" />
                <p className="text-xs text-muted-foreground">
                  {qualidadeDados.status === 'SEM_DADOS' && <>Nenhum dado disponível · <span className="text-muted-foreground opacity-60">Verifique serviço MQTT</span></>}
                  {qualidadeDados.status === 'DESATUALIZADO' && <>Dados desatualizados ({qualidadeDados.mensagem}) · <span className="text-muted-foreground opacity-60">Conexão MQTT interrompida ou equipamentos offline</span></>}
                </p>
              </div>
            </div>
          )}

          {isInitialLoading ? (
            <GraficoSkeleton className={alturaVazioDemanda} />
          ) : !temDadosDemanda ? (
            <div className={`flex flex-col items-center justify-center space-y-3 ${alturaVazioDemanda}`}>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {temEquipamentosSelecionados ? 'Nenhum dado disponível' : 'Nenhum equipamento selecionado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {temEquipamentosSelecionados
                    ? 'Aguardando dados dos equipamentos selecionados'
                    : 'Clique no botão de configuração para selecionar equipamentos'}
                </p>
              </div>
            </div>
          ) : ehSeriesPotencia ? (
            <GraficoDemanda
              pontos={demanda.pontos}
              dominio={demanda.dominio}
              referencias={referencias}
              chaveZoom={chaveZoomDemanda}
              className={alturaDemanda}
              fluxo={modoFluxo}
              serie={serieUnica}
            />
          ) : (
            <GraficoEnergia pontos={energia} tipo={tipoEnergia} className={alturaDemanda} serie={serieUnica} />
          )}
        </CardContent>
      </Card>
      )}

      {/* Gráfico de Tensão - Só mostra se tiver M160 */}
      {temM160Disponivel && (!apenasGrafico || apenasGrafico === 'tensao') && (
      <Card className={apenasGrafico ? 'xl:flex-1 xl:min-h-0 xl:flex xl:flex-col' : undefined}>
        <CardHeader className={apenasGrafico ? 'p-1.5' : 'p-2'}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className={apenasGrafico ? 'h-4 w-4 text-blue-500' : 'h-5 w-5 text-blue-500'} />
              <CardTitle className={apenasGrafico ? 'text-base' : undefined}>Tensão</CardTitle>
              {controleVariavel}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalTensaoOpen(true)}
                title="Expandir gráfico"
                className={`hover:bg-transparent ${apenasGrafico ? 'h-7 w-7' : 'h-8 w-8'}`}
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={`p-2 ${apenasGrafico ? 'xl:flex-1 xl:min-h-0 xl:flex xl:flex-col' : ''}`}>
          {/* Controles: medidor + fases (as fases levam a cor da série) */}
          <ControlesFases
            sufixo="tensao"
            variante="card"
            className={apenasGrafico ? 'mb-2' : 'mb-4'}
            medidores={equipamentosM160}
            medidorSelecionado={m160Selecionado}
            onMedidor={setM160Selecionado}
            fases={fasesTensao}
            onFases={setFasesTensao}
          />

          {/* Gráfico */}
          {isInitialLoadingM160 ? (
            <GraficoSkeleton className={alturaM160} />
          ) : !m160Selecionado ? (
            <div className={`flex flex-col items-center justify-center space-y-3 ${alturaM160}`}>
              <Activity className="h-12 w-12 text-muted-foreground opacity-50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum M160 disponível
                </p>
                <p className="text-xs text-muted-foreground">
                  Adicione um M160 com MQTT habilitado à unidade
                </p>
              </div>
            </div>
          ) : tensao.pontos.length === 0 ? (
            <div className={`flex flex-col items-center justify-center space-y-3 ${alturaM160}`}>
              <Activity className="h-12 w-12 text-muted-foreground opacity-50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Sem dados de tensão
                </p>
                <p className="text-xs text-muted-foreground">
                  Aguardando dados do M160 selecionado
                </p>
              </div>
            </div>
          ) : (
            <GraficoFases
              pontos={tensao.pontos}
              dominio={tensao.dominio}
              grandeza="tensao"
              fases={fasesTensao}
              chaveZoom={m160Selecionado}
              className={`rounded-lg border bg-card p-2 ${alturaM160}`}
            />
          )}
        </CardContent>
      </Card>
      )}

      {/* Gráfico de Fator de Potência - Só mostra se tiver M160 */}
      {temM160Disponivel && (!apenasGrafico || apenasGrafico === 'fp') && (
      <Card className={apenasGrafico ? 'xl:flex-1 xl:min-h-0 xl:flex xl:flex-col' : undefined}>
        <CardHeader className={apenasGrafico ? 'p-1.5' : 'p-2'}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className={apenasGrafico ? 'h-4 w-4 text-purple-500' : 'h-5 w-5 text-purple-500'} />
              <CardTitle className={apenasGrafico ? 'text-base' : undefined}>Fator de Potência</CardTitle>
              {controleVariavel}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalFPOpen(true)}
                title="Expandir gráfico"
                className={`hover:bg-transparent ${apenasGrafico ? 'h-7 w-7' : 'h-8 w-8'}`}
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={`p-2 ${apenasGrafico ? 'xl:flex-1 xl:min-h-0 xl:flex xl:flex-col' : ''}`}>
          {/* Controles: medidor + fases (as fases levam a cor da série) */}
          <ControlesFases
            sufixo="fp"
            variante="card"
            className={apenasGrafico ? 'mb-2' : 'mb-4'}
            medidores={equipamentosM160}
            medidorSelecionado={m160Selecionado}
            onMedidor={setM160Selecionado}
            fases={fasesFP}
            onFases={setFasesFP}
          />

          {/* Gráfico */}
          {isInitialLoadingM160 ? (
            <GraficoSkeleton className={alturaM160} />
          ) : !m160Selecionado ? (
            <div className={`flex flex-col items-center justify-center space-y-3 ${alturaM160}`}>
              <TrendingUp className="h-12 w-12 text-muted-foreground opacity-50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum M160 disponível
                </p>
                <p className="text-xs text-muted-foreground">
                  Adicione um M160 com MQTT habilitado à unidade
                </p>
              </div>
            </div>
          ) : fp.pontos.length === 0 ? (
            <div className={`flex flex-col items-center justify-center space-y-3 ${alturaM160}`}>
              <TrendingUp className="h-12 w-12 text-muted-foreground opacity-50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Sem dados de fator de potência
                </p>
                <p className="text-xs text-muted-foreground">
                  Aguardando dados do M160 selecionado
                </p>
              </div>
            </div>
          ) : (
            <GraficoFases
              pontos={fp.pontos}
              dominio={fp.dominio}
              grandeza="fp"
              fases={fasesFP}
              chaveZoom={m160Selecionado}
              className={`rounded-lg border bg-card p-2 ${alturaM160}`}
            />
          )}
        </CardContent>
      </Card>
      )}

      {/* Fallback: a variavel selecionada nao tem como renderizar (ex.: Tensao/FP
          numa unidade SEM Power Meter — caso comum em prod). Evita o "buraco"
          transparente e mantem os toggles pro usuario voltar pra Demanda.
          flex/flex-col + min-h em TODOS os breakpoints (so xl: nao basta — em telas
          menores o card colapsa pra altura do texto e sobra vazio). */}
      {apenasGrafico &&
        ((apenasGrafico === 'demanda' && !temEquipamentosDisponiveis) ||
          ((apenasGrafico === 'tensao' || apenasGrafico === 'fp') && !temM160Disponivel)) && (
        <Card className="flex flex-col min-h-[240px] xl:min-h-0 xl:flex-1">
          <CardHeader className="p-1.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {apenasGrafico === 'tensao'
                  ? 'Tensão'
                  : apenasGrafico === 'fp'
                    ? 'Fator de Potência'
                    : 'Demanda'}
              </CardTitle>
              {controleVariavel}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center p-2">
            {/* Lista de equipamentos ainda chegando: silhueta, não "nenhum equipamento". */}
            {(apenasGrafico === 'demanda' ? equipamentosData === undefined : carregandoListaM160) ? (
            <GraficoSkeleton className="h-full min-h-[150px] self-stretch" />
            ) : (
            <div className="text-center text-sm text-muted-foreground">
              {apenasGrafico === 'demanda'
                ? 'Nenhum equipamento disponível nesta unidade.'
                : 'Nenhum Power Meter disponível nesta unidade.'}
              <div className="mt-1 text-xs">
                {apenasGrafico === 'demanda'
                  ? 'Adicione equipamentos com MQTT para ver a demanda.'
                  : 'Tensão e fator de potência precisam de um Power Meter com MQTT.'}
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Expandido - Gráfico de Demanda */}
      <Dialog open={modalExpandidoOpen} onOpenChange={setModalExpandidoOpen}>
        <DialogContent className="flex flex-col gap-2 p-3 w-screen h-[100dvh] max-w-none rounded-none sm:rounded-none md:w-full md:h-auto md:max-w-[90vw] md:gap-4 md:p-6 md:rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Demanda — Expandido
              {energiaPeriodo > 0 && (
                <span className="ml-3 text-sm font-normal text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatarEnergia(energiaPeriodo)}</span> {temConsumo ? 'gerados' : 'no período'}
                </span>
              )}
              {mostraCarga && energiaConsumida > 0 && (
                <span className="ml-3 text-sm font-normal text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatarEnergia(energiaConsumida)}</span> consumidos
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="w-full flex-1 min-h-0 md:flex-none md:h-[75vh]">
            {isInitialLoading ? (
              <GraficoSkeleton className="h-full" />
            ) : !temDadosDemanda ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {temEquipamentosSelecionados ? 'Nenhum dado disponível' : 'Nenhum equipamento selecionado'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {temEquipamentosSelecionados
                      ? 'Aguardando dados dos equipamentos selecionados'
                      : 'Feche este modal e clique no botão de configuração para selecionar equipamentos'}
                  </p>
                </div>
              </div>
            ) : ehSeriesPotencia ? (
              <GraficoDemanda
                expandido
                pontos={demanda.pontos}
                dominio={demanda.dominio}
                referencias={referencias}
                chaveZoom={chaveZoomDemanda}
                fluxo={modoFluxo}
                serie={serieUnica}
              />
            ) : (
              <GraficoEnergia pontos={energia} tipo={tipoEnergia} className="h-full" serie={serieUnica} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Expandido - Gráfico de Tensão */}
      <Dialog open={modalTensaoOpen} onOpenChange={setModalTensaoOpen}>
        <DialogContent className="flex flex-col gap-2 p-3 w-screen h-[100dvh] max-w-none rounded-none sm:rounded-none md:w-full md:h-auto md:max-w-[90vw] md:gap-4 md:p-6 md:rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Gráfico de Tensão - Expandido
            </DialogTitle>
          </DialogHeader>

          <div className="w-full flex flex-col gap-4 flex-1 min-h-0 md:flex-none md:h-[70vh]">
            <ControlesFases
              sufixo="tensao-modal"
              variante="dialogo"
              medidores={equipamentosM160}
              medidorSelecionado={m160Selecionado}
              onMedidor={setM160Selecionado}
              fases={fasesTensao}
              onFases={setFasesTensao}
            />

            {/* Gráfico */}
            <div className="flex-1 min-h-0">
            {isInitialLoadingM160 ? (
              <GraficoSkeleton className="h-full" />
            ) : tensao.pontos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Activity className="h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">Sem dados de tensão</p>
              </div>
            ) : (
              <GraficoFases
                expandido
                pontos={tensao.pontos}
                dominio={tensao.dominio}
                grandeza="tensao"
                fases={fasesTensao}
                chaveZoom={m160Selecionado}
              />
            )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Expandido - Gráfico de Fator de Potência */}
      <Dialog open={modalFPOpen} onOpenChange={setModalFPOpen}>
        <DialogContent className="flex flex-col gap-2 p-3 w-screen h-[100dvh] max-w-none rounded-none sm:rounded-none md:w-full md:h-auto md:max-w-[90vw] md:gap-4 md:p-6 md:rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Gráfico de Fator de Potência - Expandido
            </DialogTitle>
          </DialogHeader>

          <div className="w-full flex flex-col gap-4 flex-1 min-h-0 md:flex-none md:h-[70vh]">
            <ControlesFases
              sufixo="fp-modal"
              variante="dialogo"
              medidores={equipamentosM160}
              medidorSelecionado={m160Selecionado}
              onMedidor={setM160Selecionado}
              fases={fasesFP}
              onFases={setFasesFP}
            />

            {/* Gráfico */}
            <div className="flex-1 min-h-0">
            {isInitialLoadingM160 ? (
              <GraficoSkeleton className="h-full" />
            ) : fp.pontos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <TrendingUp className="h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">Sem dados de fator de potência</p>
              </div>
            ) : (
              <GraficoFases
                expandido
                pontos={fp.pontos}
                dominio={fp.dominio}
                grandeza="fp"
                fases={fasesFP}
                chaveZoom={m160Selecionado}
              />
            )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuração */}
      <ConfiguracaoDemandaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        configuracao={configuracaoModal}
        onSalvar={handleSalvarConfiguracao}
        equipamentosDisponiveis={equipamentosData || []}
      />
    </div>
  );
}
