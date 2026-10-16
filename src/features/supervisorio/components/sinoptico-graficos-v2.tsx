import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Activity, Settings, TrendingUp, Zap, AlertTriangle, Loader2, Expand, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";
import { useDemandaAgregada, type PeriodoFiltro } from "@/hooks/useDemandaAgregada";
import { useDadosM160 } from "@/hooks/useDadosM160";
import { ConfiguracaoDemandaModal, type ConfiguracaoDemanda, type EquipamentoConfig } from "./ConfiguracaoDemandaModal";
import { CATEGORIA_FLUXO, resolverFluxoEquipamento } from "../utils/categoria-fluxo";
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
  type Dominio,
  type FasesAtivas,
  type PontoDemanda,
} from "./sinoptico-graficos-v2/dados";
import { GraficoDemanda, type ReferenciasDemanda } from "./sinoptico-graficos-v2/GraficoDemanda";
import { GraficoEnergia } from "./sinoptico-graficos-v2/GraficoEnergia";
import { GraficoFases } from "./sinoptico-graficos-v2/GraficoFases";
import { ControlesFases } from "./sinoptico-graficos-v2/ControlesFases";

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
  percentualAdicional?: number;
  onConfigSaved?: () => void;
  /** Quando definido, renderiza apenas um dos graficos (controlado externamente). */
  apenasGrafico?: 'demanda' | 'tensao' | 'fp';
  /** Conteudo extra ao lado do titulo do grafico (ex.: toggles de variavel). */
  controleVariavel?: ReactNode;
}

/** Configuração salva na API, já convertida para o formato do front. */
interface ConfiguracaoApi {
  fonte: string;
  mostrarDetalhes: boolean;
  intervaloAtualizacao: number;
  aplicarPerdas: boolean;
  fatorPerdas: number;
  valorContratado: number;
  percentualAdicional: number;
  /** IDs selecionados, processados depois que os equipamentos chegam. */
  equipamentosIds: string[];
  fluxoManual: NonNullable<ConfiguracaoDemanda['fluxoManual']>;
}

/** Equipamento como vem de GET /unidades/:id/equipamentos. */
interface EquipamentoApi {
  id: string;
  nome: string;
  status?: string;
  tipo_equipamento?: string;
  tipo_equipamento_rel?: { codigo?: string; categoria?: { nome?: string } };
}

const FASES_TODAS: FasesAtivas = { A: true, B: true, C: true };
/** Altura dos gráficos no modo compacto (toggle Demanda/Tensão/FP do sinóptico). */
const ALTURA_COMPACTA = 'h-[150px] xl:h-auto xl:flex-1 xl:min-h-0';
const SEM_DEMANDA = { pontos: [] as PontoDemanda[], dominio: undefined as Dominio | undefined };

export function SinopticoGraficosV2({
  unidadeId,
  valorContratado = 2500,
  percentualAdicional = 5,
  onConfigSaved,
  apenasGrafico,
  controleVariavel,
}: SinopticoGraficosV2Props) {
  const [modalOpen, setModalOpen] = useState(false);
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

  // OTIMIZAÇÃO: Buscar configuração da API com prioridade alta
  const { data: configData, refetch: refetchConfig } = useQuery({
    queryKey: ['configuracao-demanda', unidadeId],
    queryFn: async (): Promise<ConfiguracaoApi | null> => {
      if (!unidadeId) return null;

      try {
        const response = await api.get(`/configuracao-demanda/unidade/${unidadeId}`);

        // Converter formato do banco para formato do frontend
        if (response.data) {
          // A API retorna dentro de response.data.data
          const apiData = response.data.data || response.data;

          return {
            fonte: apiData.fonte || 'AGRUPAMENTO',
            mostrarDetalhes: apiData.mostrar_detalhes !== false,
            intervaloAtualizacao: apiData.intervalo_atualizacao || 30,
            aplicarPerdas: apiData.aplicar_perdas !== false,
            fatorPerdas: Number(apiData.fator_perdas) || 3,
            valorContratado: Number(apiData.valor_contratado) || valorContratado,
            percentualAdicional: Number(apiData.percentual_adicional) || percentualAdicional,
            // Guardar os IDs selecionados para processar depois
            equipamentosIds: Array.isArray(apiData.equipamentos_ids) ? apiData.equipamentos_ids : [],
            fluxoManual: apiData.fluxo_manual ?? apiData.fluxoManual ?? {},
          };
        }
      } catch {
        // Erro silencioso - não há config salva ainda
      }
      return null;
    },
    enabled: !!unidadeId,
    refetchOnMount: true,
    staleTime: 10000, // OTIMIZAÇÃO: Reduzido para 10s
    networkMode: 'online' // OTIMIZAÇÃO: Forçar carregamento imediato
  });

  // Estado local da configuração (inicializa com valores padrão ou da API)
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDemanda>(() => ({
    equipamentos: [],
    fluxoManual: {},
    mostrarDetalhes: true,
    intervaloAtualizacao: 30,
    aplicarPerdas: true,
    fatorPerdas: 3,
    demandaContratada: valorContratado,
  }));

  // Buscar equipamentos disponíveis
  const {
    data: equipamentosData,
    refetch: refetchEquipamentos
  } = useQuery({
    queryKey: ['equipamentos-agrupamento', unidadeId],
    queryFn: async (): Promise<EquipamentoConfig[]> => {
      if (!unidadeId) return [];

      try {
        const response = await api.get(`/unidades/${unidadeId}/equipamentos`, {
          params: {
            mqtt_habilitado: true,
            limit: 100
          }
        });

        const equipamentosArray: EquipamentoApi[] = response.data?.data || [];

        if (equipamentosArray && equipamentosArray.length > 0) {
          // Mapear para formato do modal. Fluxo padrao vem da categoria —
          // ver utils/categoria-fluxo.ts pra tabela completa. AMBIGUO fica
          // como literal aqui; resolveFluxoManual() embaixo substitui pela
          // escolha do admin quando aplicavel.
          return equipamentosArray.map((equip): EquipamentoConfig => {
            const tipo = equip.tipo_equipamento_rel?.codigo || equip.tipo_equipamento || '';
            const categoria = equip.tipo_equipamento_rel?.categoria?.nome || '';
            const fluxoPadrao = CATEGORIA_FLUXO[categoria] ?? 'NEUTRO';
            return {
              id: equip.id.trim(),
              nome: equip.nome,
              tipo,
              categoria,
              fluxoEnergia: fluxoPadrao,
              selecionado: false,
              multiplicador: 1,
              online: equip.status === 'ONLINE' || equip.status === 'online' || true,
            };
          });
        }
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!unidadeId,
    staleTime: 10000, // OTIMIZAÇÃO: Reduzido para 10s
    gcTime: 60000, // OTIMIZAÇÃO: Reduzido para 1 minuto
    refetchOnWindowFocus: false,
    refetchOnMount: 'always' // OTIMIZAÇÃO: Sempre refaz ao montar
  });

  // Forçar refetch quando modal abrir
  useEffect(() => {
    if (modalOpen && unidadeId) {
      refetchEquipamentos();
    }
  }, [modalOpen, unidadeId, refetchEquipamentos]);

  // Atualizar configuração quando dados da API chegarem
  useEffect(() => {
    if (configData && equipamentosData && equipamentosData.length > 0) {
      // Limpar espaços dos IDs para comparação
      const equipamentosIdsTrimmed = configData.equipamentosIds.map((id) => id.trim());

      // Mesclar equipamentos disponíveis com os IDs selecionados da configuração
      const equipamentosComSelecao = equipamentosData.map(equip => ({
        ...equip,
        selecionado: equipamentosIdsTrimmed.includes(equip.id.trim()),
      }));

      setConfiguracao({
        equipamentos: equipamentosComSelecao,
        fluxoManual: configData.fluxoManual,
        mostrarDetalhes: configData.mostrarDetalhes,
        intervaloAtualizacao: configData.intervaloAtualizacao,
        aplicarPerdas: configData.aplicarPerdas,
        fatorPerdas: configData.fatorPerdas,
        demandaContratada: valorContratado,
      });
    } else if (equipamentosData && equipamentosData.length > 0 && !configData) {
      // Se não tem config na API, usar equipamentos disponíveis
      setConfiguracao(prev => ({
        ...prev,
        equipamentos: equipamentosData,
        demandaContratada: valorContratado, // Garantir que sempre tenha o valor atualizado da unidade
      }));
    }
  }, [configData, equipamentosData, valorContratado]);

  // Resolve fluxo final por equipamento: substitui AMBIGUO pela escolha manual
  // do admin (configuracao.fluxoManual). NEUTRO continua NEUTRO e eh filtrado
  // dentro do hook (nao entra no request).
  const equipamentosResolvidos = useMemo<EquipamentoConfig[]>(() => {
    const fluxoManual = configuracao.fluxoManual ?? {};
    return configuracao.equipamentos.map((e) => ({
      ...e,
      fluxoEnergia: resolverFluxoEquipamento(e.categoria, e.id, fluxoManual),
    }));
  }, [configuracao.equipamentos, configuracao.fluxoManual]);

  // Dados de demanda — período selecionável (dia/mes/ano/custom), agregados no backend.
  const {
    dados,
    energiaPeriodo,
    isInitialLoading,
  } = useDemandaAgregada({
    equipamentos: equipamentosResolvidos,
    periodo,
    fatorPerdas: configuracao.aplicarPerdas ? configuracao.fatorPerdas : 0,
    intervaloAtualizacao: configuracao.intervaloAtualizacao,
  });

  // Usar hook de dados M160 para tensão e FP
  const { dados: dadosM160, equipamentosM160, isInitialLoading: isInitialLoadingM160 } = useDadosM160(unidadeId, m160Selecionado);

  // Selecionar automaticamente o primeiro M160 disponível
  useEffect(() => {
    if (equipamentosM160.length > 0 && !m160Selecionado) {
      setM160Selecionado(equipamentosM160[0].id);
    }
  }, [equipamentosM160, m160Selecionado]);

  // Salvar configuração na API
  const handleSalvarConfiguracao = async (novaConfig: ConfiguracaoDemanda) => {
    if (!unidadeId) return;

    // Converter formato para o banco. `fonte` mantido como 'AGRUPAMENTO' fixo
    // pra compat com schema existente — única fonte real desde a remoção do
    // dropdown AUTO/A966.
    const configParaBanco = {
      fonte: 'AGRUPAMENTO',
      equipamentos_ids: novaConfig.equipamentos
        .filter(e => e.selecionado)
        .map(e => e.id.trim()),
      // NÃO enviar `fluxo_manual`: o backend (UpdateConfiguracaoDemandaDto) não
      // tem esse campo e o ValidationPipe roda com forbidNonWhitelisted, então
      // qualquer campo extra rejeita TODO o PUT com 400 (era a causa de "salvo,
      // recarrego e não muda"). A escolha manual de equipamentos AMBIGUO (ex:
      // Medidor SSU) fica só em memória até existir coluna fluxo_manual no schema.
      mostrar_detalhes: novaConfig.mostrarDetalhes,
      intervalo_atualizacao: novaConfig.intervaloAtualizacao,
      aplicar_perdas: novaConfig.aplicarPerdas,
      fator_perdas: novaConfig.fatorPerdas,
      valor_contratado: novaConfig.demandaContratada || valorContratado,
      percentual_adicional: percentualAdicional,
    };

    // Persistência. NÃO engolir erro aqui: se o PUT falhar (ex: 400), propaga
    // pro modal exibir o erro real (toast.error) e manter-se aberto. Antes o
    // catch silencioso + toast.success sem await mascaravam falhas de save.
    await api.put(`/configuracao-demanda/unidade/${unidadeId}`, configParaBanco);

    // Se houver demanda contratada, atualizar na unidade
    if (novaConfig.demandaContratada !== undefined) {
      await api.put(`/unidades/${unidadeId}`, {
        demanda_geracao: novaConfig.demandaContratada
      });
    }

    // Sucesso: atualizar estado local e fechar.
    setConfiguracao(novaConfig);
    setModalOpen(false);

    // Revalidação é secundária — uma falha de refetch não invalida o save.
    try {
      await refetchConfig();
      await refetchEquipamentos();
      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (error) {
      console.error('Erro ao revalidar dados após salvar:', error);
    }
  };

  // Séries dos gráficos no formato do bklit (ponto com Date, ordenado, sem nulos).
  // - dia: potência com eixo fixo 00:00 → agora e linhas contratado/adicional
  // - custom: potência com eixo = extensão dos dados
  // - mes/ano: barras de energia (kWh) por dia/mês
  const demanda = useMemo(() => {
    if (!dados || dados.length === 0) return SEM_DEMANDA;
    if (periodo.tipo !== 'dia' && periodo.tipo !== 'custom') return SEM_DEMANDA;
    return montarPontosDemanda(dados, periodo, valorContratado, percentualAdicional);
  }, [dados, periodo, valorContratado, percentualAdicional]);

  const energia = useMemo(
    () => (dados && (periodo.tipo === 'mes' || periodo.tipo === 'ano') ? montarPontosEnergia(dados, periodo.tipo) : []),
    [dados, periodo.tipo],
  );

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
    () =>
      periodo.tipo === 'dia'
        ? { contratado: valorContratado, adicional: valorContratado * (1 + percentualAdicional / 100), percentualAdicional }
        : undefined,
    [periodo.tipo, valorContratado, percentualAdicional],
  );
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

            {energiaPeriodo > 0 && (
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
            <div className={`flex flex-col items-center justify-center space-y-3 ${alturaVazioDemanda}`}>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados do gráfico...</p>
            </div>
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
            />
          ) : (
            <GraficoEnergia pontos={energia} tipo={tipoEnergia} className={alturaDemanda} />
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
            <div className={`flex flex-col items-center justify-center space-y-3 ${alturaM160}`}>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
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
            <div className={`flex flex-col items-center justify-center space-y-3 ${alturaM160}`}>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
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
                  <span className="font-semibold text-foreground">{formatarEnergia(energiaPeriodo)}</span> no período
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="w-full flex-1 min-h-0 md:flex-none md:h-[75vh]">
            {isInitialLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando dados do gráfico...</p>
              </div>
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
              />
            ) : (
              <GraficoEnergia pontos={energia} tipo={tipoEnergia} className="h-full" />
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
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
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
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
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
        configuracao={configuracao}
        onSalvar={handleSalvarConfiguracao}
        equipamentosDisponiveis={equipamentosData || []}
      />
    </div>
  );
}
