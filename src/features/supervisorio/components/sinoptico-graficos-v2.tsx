import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Activity, Settings, TrendingUp, Zap, AlertTriangle, Loader2, Expand } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ConfiguracaoDemandaModal, ConfiguracaoDemanda, EquipamentoConfig } from "./ConfiguracaoDemandaModal";
import { CATEGORIA_FLUXO, resolverFluxoEquipamento } from "../utils/categoria-fluxo";
import { useDemandaAgregada, PeriodoFiltro } from "@/hooks/useDemandaAgregada";
import { useDadosM160 } from "@/hooks/useDadosM160";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";
import { useTheme } from "@/components/theme-provider";

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
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  unidade?: string;
}

const CustomTooltip = ({ active, payload, label, unidade = '' }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {`${entry.name}: ${entry.value.toFixed(2)}${unidade ? ' ' + unidade : ''}`}
        </p>
      ))}
    </div>
  );
};

/**
 * Qualidade dos dados — limitado a SEM_DADOS e DESATUALIZADO.
 * Só faz sentido para período "dia" (live); mês/ano são consultas históricas.
 */
function analisarQualidadeDados(dados: Array<{ timestamp?: string }>) {
  if (!dados || dados.length === 0) {
    return { status: 'SEM_DADOS' as const, mensagem: 'Nenhum dado disponível' };
  }
  const ultimo = dados[dados.length - 1]?.timestamp;
  if (!ultimo) return { status: 'OK' as const, mensagem: '' };
  const diferencaHoras = (Date.now() - new Date(ultimo).getTime()) / 3_600_000;
  if (diferencaHoras > 2) {
    return {
      status: 'DESATUALIZADO' as const,
      mensagem: `Último dado: ${Math.floor(diferencaHoras)}h atrás`,
    };
  }
  return { status: 'OK' as const, mensagem: '' };
}

function formatarEnergia(kwh: number): string {
  if (Math.abs(kwh) >= 1000) {
    return `${(kwh / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh`;
  }
  return `${kwh.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`;
}

const MESES_PT_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function inicioISO(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function SinopticoGraficosV2({
  unidadeId,
  valorContratado = 2500,
  percentualAdicional = 5,
  onConfigSaved,
}: SinopticoGraficosV2Props) {
  const { theme } = useTheme();
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
  const [fasesTensao, setFasesTensao] = useState({ A: true, B: true, C: true });
  const [fasesFP, setFasesFP] = useState({ A: true, B: true, C: true });
  const [modalTensaoOpen, setModalTensaoOpen] = useState(false);
  const [modalFPOpen, setModalFPOpen] = useState(false);

  // Determinar cor da linha de demanda baseada no tema
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const corLinhaDemanda = isDark ? '#ffffff' : '#000000';

  // OTIMIZAÇÃO: Buscar configuração da API com prioridade alta
  const { data: configData, refetch: refetchConfig } = useQuery({
    queryKey: ['configuracao-demanda', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return null;

      try {
        const response = await api.get(`/configuracao-demanda/unidade/${unidadeId}`);

        // Converter formato do banco para formato do frontend
        if (response.data) {
          // A API retorna dentro de response.data.data
          const apiData = response.data.data || response.data;

          // Primeiro, criar o objeto de configuração básico
          const config = {
            fonte: apiData.fonte || 'AGRUPAMENTO',
            equipamentos: [], // Vamos preencher depois
            mostrarDetalhes: apiData.mostrar_detalhes !== false,
            intervaloAtualizacao: apiData.intervalo_atualizacao || 30,
            aplicarPerdas: apiData.aplicar_perdas !== false,
            fatorPerdas: Number(apiData.fator_perdas) || 3,
            valorContratado: Number(apiData.valor_contratado) || valorContratado,
            percentualAdicional: Number(apiData.percentual_adicional) || percentualAdicional
          };

          // Guardar os IDs selecionados para processar depois
          (config as any).equipamentosIds = apiData.equipamentos_ids || [];

          return config;
        }
      } catch (error) {
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
    isLoading: isLoadingEquipamentos,
    refetch: refetchEquipamentos
  } = useQuery({
    queryKey: ['equipamentos-agrupamento', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];

      try {
        const response = await api.get(`/unidades/${unidadeId}/equipamentos`, {
          params: {
            mqtt_habilitado: true,
            limit: 100
          }
        });

        const equipamentosArray = response.data?.data || [];

        if (equipamentosArray && equipamentosArray.length > 0) {
          // Mapear para formato do modal. Fluxo padrao vem da categoria —
          // ver utils/categoria-fluxo.ts pra tabela completa. AMBIGUO fica
          // como literal aqui; resolveFluxoManual() embaixo substitui pela
          // escolha do admin quando aplicavel.
          return equipamentosArray.map((equip: any): EquipamentoConfig => {
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
      } catch (error) {
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
      // Verificar se configData tem equipamentosIds ou equipamentos_ids
      const equipamentosIds = (configData as any).equipamentosIds ||
                              (configData as any).equipamentos_ids ||
                              [];

      // Limpar espaços dos IDs para comparação
      const equipamentosIdsTrimmed = Array.isArray(equipamentosIds)
        ? equipamentosIds.map((id: string) => id.trim())
        : [];

      // Mesclar equipamentos disponíveis com os IDs selecionados da configuração
      const equipamentosComSelecao = equipamentosData.map(equip => {
        const equipIdTrimmed = equip.id.trim();
        const estaSelecionado = equipamentosIdsTrimmed.includes(equipIdTrimmed);
        return {
          ...equip,
          selecionado: estaSelecionado
        };
      });

      const fluxoManualApi =
        (configData as any).fluxoManual ?? (configData as any).fluxo_manual ?? {};

      setConfiguracao({
        ...(configData as ConfiguracaoDemanda),
        equipamentos: equipamentosComSelecao,
        fluxoManual: fluxoManualApi,
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
  const { dados: dadosM160, equipamentosM160, isLoading: isLoadingM160, isInitialLoading: isInitialLoadingM160 } = useDadosM160(unidadeId, m160Selecionado);

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

  // Dados formatados conforme o período selecionado.
  // - dia: template de slots de 5min + merge (linhas contratado/adicional)
  // - custom: pontos brutos com label "dd/MM HH:mm"
  // - mes: barras por dia (energia kWh)
  // - ano: barras por mês (energia kWh)
  const dadosFormatadosPotencia = useMemo(() => {
    if (!dados || dados.length === 0) return [];

    if (periodo.tipo === 'dia') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const inicioDeHoje = hoje.getTime();
      const valorAdicional = valorContratado * (1 + percentualAdicional / 100);

      const dadosDeHoje = dados.filter(item => {
        if (!item.timestamp) return false;
        return new Date(item.timestamp).getTime() >= inicioDeHoje;
      });

      const agora = new Date();
      const todosOsHorarios: any[] = [];
      const horaFinal = agora.getHours();
      const minutoFinal = agora.getMinutes();

      for (let h = 0; h <= horaFinal; h++) {
        const maxMinutos = h === horaFinal ? minutoFinal : 59;
        for (let m = 0; m <= maxMinutos; m += 5) {
          const ts = new Date(hoje);
          ts.setHours(h, m, 0, 0);
          todosOsHorarios.push({
            timestamp: ts.toISOString(),
            hora: ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            potencia: null,
            valorContratado,
            valorAdicional,
          });
        }
      }

      const dadosMap = new Map(
        dadosDeHoje.map(item => {
          const hora = new Date(item.timestamp!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return [hora, { hora, timestamp: item.timestamp, potencia: item.potencia_kw, valorContratado, valorAdicional }];
        }),
      );

      return todosOsHorarios.map(slot => dadosMap.get(slot.hora) ?? slot);
    }

    if (periodo.tipo === 'custom') {
      return dados.map(item => {
        const ts = item.timestamp ? new Date(item.timestamp) : null;
        return {
          timestamp: item.timestamp,
          hora: ts
            ? ts.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '',
          potencia: item.potencia_kw,
        };
      });
    }

    if (periodo.tipo === 'mes') {
      return dados.map(item => ({
        label: String(item.dia ?? ''),
        energia: item.energia_kwh,
      }));
    }

    // ano
    return dados.map(item => ({
      label: item.mes_nome ? item.mes_nome.slice(0, 3) : MESES_PT_CURTOS[(item.mes_numero ?? 1) - 1],
      energia: item.energia_kwh,
    }));
  }, [dados, periodo.tipo, valorContratado, percentualAdicional]);

  // Formatar dados de tensão e FP do M160 - com período completo de 00:00 até agora
  const dadosFormatadosTensao = useMemo(() => {
    if (!dadosM160 || dadosM160.length === 0) return [];

    // Criar array com todas as horas do dia de 00:00 até agora
    const agora = new Date();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const todosOsHorarios: any[] = [];

    // Ir até a hora atual
    const horaFinal = agora.getHours();
    const minutoFinal = agora.getMinutes();

    for (let h = 0; h <= horaFinal; h++) {
      const maxMinutos = (h === horaFinal) ? minutoFinal : 59;
      for (let m = 0; m <= maxMinutos; m += 5) { // ✅ De 5 em 5 minutos
        const timestamp = new Date(hoje);
        timestamp.setHours(h, m, 0, 0);
        todosOsHorarios.push({
          hora: timestamp.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          tensaoA: null,
          tensaoB: null,
          tensaoC: null,
        });
      }
    }

    // Mesclar dados reais com o template
    const dadosMap = new Map(
      dadosM160.map((item) => [
        new Date(item.timestamp).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: 'America/Sao_Paulo',
        }),
        {
          hora: new Date(item.timestamp).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: 'America/Sao_Paulo',
          }),
          tensaoA: item.tensaoA,
          tensaoB: item.tensaoB,
          tensaoC: item.tensaoC,
        }
      ])
    );

    return todosOsHorarios.map(slot => dadosMap.get(slot.hora) || slot);
  }, [dadosM160]);

  const dadosFormatadosFP = useMemo(() => {
    if (!dadosM160 || dadosM160.length === 0) return [];

    // Criar array com todas as horas do dia de 00:00 até agora
    const agora = new Date();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const todosOsHorarios: any[] = [];

    // Ir até a hora atual
    const horaFinal = agora.getHours();
    const minutoFinal = agora.getMinutes();

    for (let h = 0; h <= horaFinal; h++) {
      const maxMinutos = (h === horaFinal) ? minutoFinal : 59;
      for (let m = 0; m <= maxMinutos; m += 5) { // ✅ De 5 em 5 minutos
        const timestamp = new Date(hoje);
        timestamp.setHours(h, m, 0, 0);
        todosOsHorarios.push({
          hora: timestamp.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          fatorPotenciaA: null,
          fatorPotenciaB: null,
          fatorPotenciaC: null,
        });
      }
    }

    // Mesclar dados reais com o template
    const dadosMap = new Map(
      dadosM160.map((item) => [
        new Date(item.timestamp).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: 'America/Sao_Paulo',
        }),
        {
          hora: new Date(item.timestamp).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: 'America/Sao_Paulo',
          }),
          fatorPotenciaA: item.fatorPotenciaA,
          fatorPotenciaB: item.fatorPotenciaB,
          fatorPotenciaC: item.fatorPotenciaC,
        }
      ])
    );

    return todosOsHorarios.map(slot => dadosMap.get(slot.hora) || slot);
  }, [dadosM160]);

  // Há equipamentos cadastrados na unidade (com MQTT). Mostra card mesmo sem seleção.
  const temEquipamentosDisponiveis = equipamentosData && equipamentosData.length > 0;
  const temEquipamentosSelecionados = configuracao.equipamentos.some(e => e.selecionado);
  const temM160Disponivel = equipamentosM160.length > 0;

  // Qualidade só faz sentido para 'dia' (live). Mês/ano/custom são consultas históricas.
  const qualidadeDados = useMemo(
    () => (periodo.tipo === 'dia' ? analisarQualidadeDados(dados) : { status: 'OK' as const, mensagem: '' }),
    [dados, periodo.tipo],
  );

  const ehSeriesPotencia = periodo.tipo === 'dia' || periodo.tipo === 'custom';
  const unidadeGrafico = ehSeriesPotencia ? 'kW' : 'kWh';

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
    <div className="w-full flex flex-col gap-4">
      {/* Gráfico de Demanda */}
      {temEquipamentosDisponiveis && (
      <Card>
        <CardHeader className="p-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <CardTitle>Demanda</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalExpandidoOpen(true)}
                title="Expandir gráfico"
                className="h-8 w-8 hover:bg-transparent"
              >
                <Expand className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalOpen(true)}
                title="Configurações"
                className="h-8 w-8 hover:bg-transparent"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs de período + energia inline */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Tabs value={periodo.tipo === 'custom' ? '' : periodo.tipo} onValueChange={handlePeriodoTipoChange}>
                <TabsList className="h-8 gap-1 rounded-[2px] bg-transparent p-0">
                  <TabsTrigger value="dia" className="text-xs h-7 px-3 rounded-[2px] data-[state=active]:bg-accent">Dia</TabsTrigger>
                  <TabsTrigger value="mes" className="text-xs h-7 px-3 rounded-[2px] data-[state=active]:bg-accent">Mês</TabsTrigger>
                  <TabsTrigger value="ano" className="text-xs h-7 px-3 rounded-[2px] data-[state=active]:bg-accent">Ano</TabsTrigger>
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

        <CardContent className="p-2">
          {/* Alerta de qualidade — só em modo 'dia' */}
          {periodo.tipo === 'dia' && qualidadeDados.status !== 'OK' && (
            <div className="mb-3 p-2 rounded-md bg-muted/40">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground/70" />
                <p className="text-xs text-muted-foreground">
                  {qualidadeDados.status === 'SEM_DADOS' && <>Nenhum dado disponível · <span className="text-muted-foreground/60">Verifique serviço MQTT</span></>}
                  {qualidadeDados.status === 'DESATUALIZADO' && <>Dados desatualizados ({qualidadeDados.mensagem}) · <span className="text-muted-foreground/60">Conexão MQTT interrompida ou equipamentos offline</span></>}
                </p>
              </div>
            </div>
          )}

          {isInitialLoading ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados do gráfico...</p>
            </div>
          ) : dadosFormatadosPotencia.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
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
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={dadosFormatadosPotencia}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="hora" fontSize={12} />
                <YAxis fontSize={12} label={{ value: unidadeGrafico, angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip unidade={unidadeGrafico} />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} iconType="line" />
                <Line
                  type="monotone"
                  dataKey="potencia"
                  name="Demanda"
                  stroke={corLinhaDemanda}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={true}
                />
                {periodo.tipo === 'dia' && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="valorContratado"
                      name="Valor Contratado"
                      stroke="#9ca3af"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="valorAdicional"
                      name={`Contratado + ${percentualAdicional}%`}
                      stroke="#6b7280"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dadosFormatadosPotencia}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} label={{ value: unidadeGrafico, angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip unidade={unidadeGrafico} />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} iconType="rect" />
                <Bar dataKey="energia" name="Energia" fill={corLinhaDemanda} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      )}

      {/* Gráfico de Tensão - Só mostra se tiver M160 */}
      {temM160Disponivel && (
      <Card>
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <CardTitle>Tensão</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalTensaoOpen(true)}
                title="Expandir gráfico"
                className="h-8 w-8 hover:bg-transparent"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {/* Controles */}
          <div className="mb-4 space-y-3">
            {/* Select M160 */}
            <div className="flex items-center gap-2">
              <Label htmlFor="m160-tensao" className="text-sm min-w-[80px]">
                Medidor:
              </Label>
              <Select value={m160Selecionado} onValueChange={setM160Selecionado}>
                <SelectTrigger id="m160-tensao" className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Selecione um M160" />
                </SelectTrigger>
                <SelectContent>
                  {equipamentosM160.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.tag || eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checkboxes Fases */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Label className="text-sm min-w-[80px]">Fases:</Label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fase-a-tensao"
                    checked={fasesTensao.A}
                    onCheckedChange={(checked) =>
                      setFasesTensao((prev) => ({ ...prev, A: !!checked }))
                    }
                  />
                  <Label htmlFor="fase-a-tensao" className="text-sm cursor-pointer">
                    Fase A
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fase-b-tensao"
                    checked={fasesTensao.B}
                    onCheckedChange={(checked) =>
                      setFasesTensao((prev) => ({ ...prev, B: !!checked }))
                    }
                  />
                  <Label htmlFor="fase-b-tensao" className="text-sm cursor-pointer">
                    Fase B
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fase-c-tensao"
                    checked={fasesTensao.C}
                    onCheckedChange={(checked) =>
                      setFasesTensao((prev) => ({ ...prev, C: !!checked }))
                    }
                  />
                  <Label htmlFor="fase-c-tensao" className="text-sm cursor-pointer">
                    Fase C
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico */}
          {isInitialLoadingM160 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : !m160Selecionado ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <Activity className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum M160 disponível
                </p>
                <p className="text-xs text-muted-foreground">
                  Adicione um M160 com MQTT habilitado à unidade
                </p>
              </div>
            </div>
          ) : dadosFormatadosTensao.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <Activity className="h-12 w-12 text-muted-foreground/50" />
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
            <div className="bg-card p-4 rounded-lg border">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dadosFormatadosTensao}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="hora" fontSize={12} />
                <YAxis
                  fontSize={12}
                  domain={["dataMin - 5", "dataMax + 5"]}
                  label={{
                    value: "V",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="line" />

                {fasesTensao.A && (
                  <Line
                    type="monotone"
                    dataKey="tensaoA"
                    name="Tensão Fase A"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}
                {fasesTensao.B && (
                  <Line
                    type="monotone"
                    dataKey="tensaoB"
                    name="Tensão Fase B"
                    stroke="#ffffff"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}
                {fasesTensao.C && (
                  <Line
                    type="monotone"
                    dataKey="tensaoC"
                    name="Tensão Fase C"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Gráfico de Fator de Potência - Só mostra se tiver M160 */}
      {temM160Disponivel && (
      <Card>
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <CardTitle>Fator de Potência</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalFPOpen(true)}
                title="Expandir gráfico"
                className="h-8 w-8 hover:bg-transparent"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {/* Controles */}
          <div className="mb-4 space-y-3">
            {/* Select M160 */}
            <div className="flex items-center gap-2">
              <Label htmlFor="m160-fp" className="text-sm min-w-[80px]">
                Medidor:
              </Label>
              <Select value={m160Selecionado} onValueChange={setM160Selecionado}>
                <SelectTrigger id="m160-fp" className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Selecione um M160" />
                </SelectTrigger>
                <SelectContent>
                  {equipamentosM160.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.tag || eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checkboxes Fases */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Label className="text-sm min-w-[80px]">Fases:</Label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fase-a-fp"
                    checked={fasesFP.A}
                    onCheckedChange={(checked) =>
                      setFasesFP((prev) => ({ ...prev, A: !!checked }))
                    }
                  />
                  <Label htmlFor="fase-a-fp" className="text-sm cursor-pointer">
                    Fase A
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fase-b-fp"
                    checked={fasesFP.B}
                    onCheckedChange={(checked) =>
                      setFasesFP((prev) => ({ ...prev, B: !!checked }))
                    }
                  />
                  <Label htmlFor="fase-b-fp" className="text-sm cursor-pointer">
                    Fase B
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fase-c-fp"
                    checked={fasesFP.C}
                    onCheckedChange={(checked) =>
                      setFasesFP((prev) => ({ ...prev, C: !!checked }))
                    }
                  />
                  <Label htmlFor="fase-c-fp" className="text-sm cursor-pointer">
                    Fase C
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico */}
          {isInitialLoadingM160 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : !m160Selecionado ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum M160 disponível
                </p>
                <p className="text-xs text-muted-foreground">
                  Adicione um M160 com MQTT habilitado à unidade
                </p>
              </div>
            </div>
          ) : dadosFormatadosFP.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
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
            <div className="bg-card p-4 rounded-lg border">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dadosFormatadosFP}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="hora" fontSize={12} />
                <YAxis
                  fontSize={12}
                  domain={[-1.0, 1.0]}
                  label={{
                    value: "FP",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="line" />

                {fasesFP.A && (
                  <Line
                    type="monotone"
                    dataKey="fatorPotenciaA"
                    name="FP Fase A"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}
                {fasesFP.B && (
                  <Line
                    type="monotone"
                    dataKey="fatorPotenciaB"
                    name="FP Fase B"
                    stroke="#ffffff"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}
                {fasesFP.C && (
                  <Line
                    type="monotone"
                    dataKey="fatorPotenciaC"
                    name="FP Fase C"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}

                {/* Linha de limite superior +0.92 */}
                <Line
                  type="monotone"
                  dataKey={() => 0.92}
                  name="Limite Superior (+0.92)"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />

                {/* Linha de limite inferior -0.92 */}
                <Line
                  type="monotone"
                  dataKey={() => -0.92}
                  name="Limite Inferior (-0.92)"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Modal Expandido - Gráfico de Demanda */}
      <Dialog open={modalExpandidoOpen} onOpenChange={setModalExpandidoOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh]">
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

          <div className="w-full h-[75vh]">
            {isInitialLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando dados do gráfico...</p>
              </div>
            ) : dadosFormatadosPotencia.length === 0 ? (
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
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosFormatadosPotencia}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="hora" fontSize={12} />
                  <YAxis fontSize={12} label={{ value: unidadeGrafico, angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<CustomTooltip unidade={unidadeGrafico} />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} iconType="line" />
                  <Brush
                    dataKey="hora"
                    height={30}
                    stroke="hsl(var(--muted-foreground) / 0.3)"
                    fill="hsl(var(--muted))"
                    travellerWidth={10}
                  />
                  <Line
                    type="monotone"
                    dataKey="potencia"
                    name="Demanda"
                    stroke={corLinhaDemanda}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={true}
                  />
                  {periodo.tipo === 'dia' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="valorContratado"
                        name="Valor Contratado"
                        stroke="#9ca3af"
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="valorAdicional"
                        name={`Contratado + ${percentualAdicional}%`}
                        stroke="#6b7280"
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFormatadosPotencia}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} label={{ value: unidadeGrafico, angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<CustomTooltip unidade={unidadeGrafico} />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} iconType="rect" />
                  <Bar dataKey="energia" name="Energia" fill={corLinhaDemanda} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Expandido - Gráfico de Tensão */}
      <Dialog open={modalTensaoOpen} onOpenChange={setModalTensaoOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Gráfico de Tensão - Expandido
            </DialogTitle>
          </DialogHeader>

          <div className="w-full flex flex-col gap-4" style={{ height: '70vh' }}>
            {/* Controles */}
            <div className="space-y-3 flex-shrink-0">
              {/* Select M160 */}
              <div className="flex items-center gap-2">
                <Label htmlFor="m160-tensao-modal" className="text-sm min-w-[80px]">
                  Medidor:
                </Label>
                <Select value={m160Selecionado} onValueChange={setM160Selecionado}>
                  <SelectTrigger id="m160-tensao-modal" className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Selecione um M160" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentosM160.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.tag || eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Checkboxes Fases */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Label className="text-sm min-w-[80px]">Fases:</Label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="fase-a-tensao-modal"
                      checked={fasesTensao.A}
                      onCheckedChange={(checked) =>
                        setFasesTensao((prev) => ({ ...prev, A: !!checked }))
                      }
                    />
                    <Label htmlFor="fase-a-tensao-modal" className="text-sm cursor-pointer">
                      Fase A
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="fase-b-tensao-modal"
                      checked={fasesTensao.B}
                      onCheckedChange={(checked) =>
                        setFasesTensao((prev) => ({ ...prev, B: !!checked }))
                      }
                    />
                    <Label htmlFor="fase-b-tensao-modal" className="text-sm cursor-pointer">
                      Fase B
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="fase-c-tensao-modal"
                      checked={fasesTensao.C}
                      onCheckedChange={(checked) =>
                        setFasesTensao((prev) => ({ ...prev, C: !!checked }))
                      }
                    />
                    <Label htmlFor="fase-c-tensao-modal" className="text-sm cursor-pointer">
                      Fase C
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico */}
            <div className="flex-1 min-h-0">
            {isInitialLoadingM160 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
            ) : dadosFormatadosTensao.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Activity className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Sem dados de tensão</p>
              </div>
            ) : (
              <div className="bg-card p-4 rounded-lg border h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosFormatadosTensao}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="hora" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    domain={["dataMin - 5", "dataMax + 5"]}
                    label={{
                      value: "V",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} iconType="line" />

                  {/* Brush para zoom - apenas no modal expandido */}
                  <Brush
                    dataKey="hora"
                    height={30}
                    stroke="hsl(var(--muted-foreground) / 0.3)"
                    fill="hsl(var(--muted))"
                    travellerWidth={10}
                  />

                  {fasesTensao.A && (
                    <Line
                      type="monotone"
                      dataKey="tensaoA"
                      name="Tensão Fase A"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {fasesTensao.B && (
                    <Line
                      type="monotone"
                      dataKey="tensaoB"
                      name="Tensão Fase B"
                      stroke="#ffffff"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {fasesTensao.C && (
                    <Line
                      type="monotone"
                      dataKey="tensaoC"
                      name="Tensão Fase C"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
              </div>
            )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Expandido - Gráfico de Fator de Potência */}
      <Dialog open={modalFPOpen} onOpenChange={setModalFPOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Gráfico de Fator de Potência - Expandido
            </DialogTitle>
          </DialogHeader>

          <div className="w-full flex flex-col gap-4" style={{ height: '70vh' }}>
            {/* Controles */}
            <div className="space-y-3 flex-shrink-0">
              {/* Select M160 */}
              <div className="flex items-center gap-2">
                <Label htmlFor="m160-fp-modal" className="text-sm min-w-[80px]">
                  Medidor:
                </Label>
                <Select value={m160Selecionado} onValueChange={setM160Selecionado}>
                  <SelectTrigger id="m160-fp-modal" className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Selecione um M160" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentosM160.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.tag || eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Checkboxes Fases */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Label className="text-sm min-w-[80px]">Fases:</Label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="fase-a-fp-modal"
                      checked={fasesFP.A}
                      onCheckedChange={(checked) =>
                        setFasesFP((prev) => ({ ...prev, A: !!checked }))
                      }
                    />
                    <Label htmlFor="fase-a-fp-modal" className="text-sm cursor-pointer">
                      Fase A
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="fase-b-fp-modal"
                      checked={fasesFP.B}
                      onCheckedChange={(checked) =>
                        setFasesFP((prev) => ({ ...prev, B: !!checked }))
                      }
                    />
                    <Label htmlFor="fase-b-fp-modal" className="text-sm cursor-pointer">
                      Fase B
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="fase-c-fp-modal"
                      checked={fasesFP.C}
                      onCheckedChange={(checked) =>
                        setFasesFP((prev) => ({ ...prev, C: !!checked }))
                      }
                    />
                    <Label htmlFor="fase-c-fp-modal" className="text-sm cursor-pointer">
                      Fase C
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico */}
            <div className="flex-1 min-h-0">
            {isInitialLoadingM160 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
            ) : dadosFormatadosFP.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Sem dados de fator de potência</p>
              </div>
            ) : (
              <div className="bg-card p-4 rounded-lg border h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosFormatadosFP}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="hora" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    domain={[-1.0, 1.0]}
                    label={{
                      value: "FP",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} iconType="line" />

                  {/* Brush para zoom - apenas no modal expandido */}
                  <Brush
                    dataKey="hora"
                    height={30}
                    stroke="hsl(var(--muted-foreground) / 0.3)"
                    fill="hsl(var(--muted))"
                    travellerWidth={10}
                  />

                  {fasesFP.A && (
                    <Line
                      type="monotone"
                      dataKey="fatorPotenciaA"
                      name="FP Fase A"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {fasesFP.B && (
                    <Line
                      type="monotone"
                      dataKey="fatorPotenciaB"
                      name="FP Fase B"
                      stroke="#ffffff"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {fasesFP.C && (
                    <Line
                      type="monotone"
                      dataKey="fatorPotenciaC"
                      name="FP Fase C"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}

                  {/* Linha de limite superior +0.92 */}
                  <Line
                    type="monotone"
                    dataKey={() => 0.92}
                    name="Limite Superior (+0.92)"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />

                  {/* Linha de limite inferior -0.92 */}
                  <Line
                    type="monotone"
                    dataKey={() => -0.92}
                    name="Limite Inferior (-0.92)"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
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