import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DadosGrafico } from "@/types/dtos/sinoptico-ativo";
import { Activity, Settings, TrendingUp, Zap, AlertTriangle, CheckCircle, Loader2, Expand } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
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
import { useDadosDemanda } from "@/hooks/useDadosDemanda";
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
  dadosPotencia?: DadosGrafico[];
  dadosTensao?: DadosGrafico[];
  valorContratado?: number;
  percentualAdicional?: number;
}

// Função para formatar dados para o gráfico
const formatarDadosGrafico = (dados: any[]) => {
  return dados.map((item) => ({
    ...item,
    hora: new Date(item.timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
};

// Função para adicionar linhas de referência (valor contratado e adicional)
const adicionarLinhasReferencia = (
  dados: any[],
  valorContratado: number,
  percentualAdicional: number
) => {
  const valorAdicional = valorContratado * (1 + percentualAdicional / 100);

  return dados.map((item) => ({
    ...item,
    hora: new Date(item.timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    valorContratado: valorContratado,
    valorAdicional: valorAdicional,
  }));
};

// Componente customizado para o Tooltip
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium">{`Hora: ${label}`}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value.toFixed(2)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Função para verificar qualidade dos dados (detecta períodos sem dados)
const analisarQualidadeDados = (dados: any[]) => {
  if (!dados || dados.length === 0) {
    return {
      status: 'SEM_DADOS',
      mensagem: 'Nenhum dado disponível',
      cor: 'text-red-500',
      icone: AlertTriangle
    };
  }

  // Verificar se há lacunas grandes nos dados (mais de 2 horas sem dados)
  const agora = new Date();
  const ultimoDado = new Date(dados[dados.length - 1]?.timestamp || 0);
  const diferencaHoras = (agora.getTime() - ultimoDado.getTime()) / (1000 * 60 * 60);

  if (diferencaHoras > 2) {
    return {
      status: 'DESATUALIZADO',
      mensagem: `Último dado: ${Math.floor(diferencaHoras)}h atrás`,
      cor: 'text-orange-500',
      icone: AlertTriangle
    };
  }

  // Verificar cobertura dos últimos 24h
  const dadosUltimas24h = dados.filter(d => {
    const timestamp = new Date(d.timestamp);
    const diff = agora.getTime() - timestamp.getTime();
    return diff <= 24 * 60 * 60 * 1000; // 24 horas
  });

  const coberturaPercentual = (dadosUltimas24h.length / 288) * 100; // 288 = pontos esperados em 24h (5min cada)

  if (coberturaPercentual < 50) {
    return {
      status: 'PARCIAL',
      mensagem: `Cobertura: ${Math.round(coberturaPercentual)}%`,
      cor: 'text-yellow-500',
      icone: AlertTriangle
    };
  }

  return {
    status: 'OK',
    mensagem: 'Dados atualizados',
    cor: 'text-green-500',
    icone: CheckCircle
  };
};

// Função para obter badge de confiabilidade
const getConfiabilidadeBadge = (fonte: string, confiabilidade: number) => {
  if (fonte === 'A966') {
    return (
      <Badge variant="outline" className="ml-2 gap-1">
        <CheckCircle className="h-3 w-3 text-green-500" />
        A966 (Alta)
      </Badge>
    );
  } else if (fonte === 'AGRUPAMENTO') {
    return (
      <Badge variant="outline" className="ml-2 gap-1">
        <Activity className="h-3 w-3 text-blue-500" />
        Agrupamento ({confiabilidade}%)
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className="ml-2 gap-1">
        <AlertTriangle className="h-3 w-3 text-yellow-500" />
        Simulado
      </Badge>
    );
  }
};

export function SinopticoGraficosV2({
  unidadeId,
  dadosPotencia: dadosPotenciaLegacy,
  dadosTensao,
  valorContratado = 2500,
  percentualAdicional = 5,
}: SinopticoGraficosV2Props) {
  const { theme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalExpandidoOpen, setModalExpandidoOpen] = useState(false);

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
          config.equipamentosIds = apiData.equipamentos_ids || [];

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
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDemanda>(() => {
    return {
      fonte: 'AGRUPAMENTO',
      equipamentos: [],
      mostrarDetalhes: true,
      intervaloAtualizacao: 30,
      aplicarPerdas: true,
      fatorPerdas: 3,
      demandaContratada: valorContratado, // Inicializar com valor da unidade
    };
  });

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

        // A resposta vem em response.data.data.data (aninhamento triplo)
        const equipamentosArray = response.data?.data?.data || [];

        if (equipamentosArray && equipamentosArray.length > 0) {
        // Mapear para formato do modal
        const equipamentosMapeados = equipamentosArray.map((equip: any) => {
          let fluxoEnergia: 'GERACAO' | 'CONSUMO' | 'BIDIRECIONAL' = 'BIDIRECIONAL';

          // Determinar fluxo baseado no tipo ou classificação
          const tipo = equip.tipo_equipamento_rel?.codigo || equip.tipo_equipamento || '';
          const classificacao = equip.classificacao || '';

          // Primeiro verificar pela classificação (mais confiável)
          if (classificacao === 'GERACAO') {
            fluxoEnergia = 'GERACAO';
          } else if (classificacao === 'CONSUMO') {
            fluxoEnergia = 'CONSUMO';
          }
          // Depois verificar pelo tipo se não tiver classificação
          else if (tipo.includes('INVERSOR')) {
            fluxoEnergia = 'GERACAO';
          } else if (tipo.includes('M160') || tipo.includes('M-160') ||
                     tipo.includes('MOTOR') || tipo.includes('CARGA')) {
            fluxoEnergia = 'CONSUMO';
          } else if (tipo.includes('A966') || tipo.includes('LANDIS')) {
            fluxoEnergia = 'BIDIRECIONAL';
          }

          return {
            id: equip.id.trim(),
            nome: equip.nome,
            tipo: tipo,
            fluxoEnergia,
            selecionado: false,
            multiplicador: 1,
            online: equip.status === 'ONLINE' || equip.status === 'online' || true
          } as EquipamentoConfig;
        });

        return equipamentosMapeados;
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

      setConfiguracao({
        ...configData as ConfiguracaoDemanda,
        equipamentos: equipamentosComSelecao,
        demandaContratada: valorContratado, // Garantir que sempre tenha o valor atualizado da unidade
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

  // Usar hook de dados de demanda
  const { dados, fonte, confiabilidade, detalhes, isLoading, isInitialLoading, energiaDia } = useDadosDemanda(configuracao, unidadeId);

  // Usar hook de dados M160 para tensão e FP
  const { dados: dadosM160, equipamentosM160, isLoading: isLoadingM160, isInitialLoading: isInitialLoadingM160 } = useDadosM160(unidadeId, m160Selecionado);

  // Selecionar automaticamente o primeiro M160 disponível
  useEffect(() => {
    if (equipamentosM160.length > 0 && !m160Selecionado) {
      setM160Selecionado(equipamentosM160[0].id);
    }
  }, [equipamentosM160, m160Selecionado]);

  // Log para debug da energia do dia
  useEffect(() => {
    // Log removido
  }, [energiaDia]);

  // Salvar configuração na API
  const handleSalvarConfiguracao = async (novaConfig: ConfiguracaoDemanda) => {
    if (!unidadeId) return;

    try {
      // Converter formato para o banco
      const configParaBanco = {
        fonte: novaConfig.fonte,
        equipamentos_ids: novaConfig.equipamentos
          .filter(e => e.selecionado)
          .map(e => e.id.trim()),
        mostrar_detalhes: novaConfig.mostrarDetalhes,
        intervalo_atualizacao: novaConfig.intervaloAtualizacao,
        aplicar_perdas: novaConfig.aplicarPerdas,
        fator_perdas: novaConfig.fatorPerdas,
        valor_contratado: valorContratado,
        percentual_adicional: percentualAdicional
      };

      await api.put(`/configuracao-demanda/unidade/${unidadeId}`, configParaBanco);

      // Se houver demanda contratada, atualizar na unidade
      if (novaConfig.demandaContratada !== undefined) {
        await api.put(`/unidades/${unidadeId}`, {
          demanda_geracao: novaConfig.demandaContratada
        });
      }

      // Atualizar estado local imediatamente
      setConfiguracao(novaConfig);

      // Recarregar da API
      setTimeout(() => refetchConfig(), 500);

      // Fechar modal
      setModalOpen(false);

      // Se alterou a demanda contratada, recarregar a página para atualizar o gráfico
      if (novaConfig.demandaContratada !== undefined) {
        setTimeout(() => window.location.reload(), 600);
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
    }
  };

  // Preparar dados para o gráfico com useMemo para evitar re-cálculos desnecessários
  const dadosFormatadosPotencia = useMemo(() => {
    if (!dados || dados.length === 0) return [];

    // Filtrar apenas dados de hoje (00:00 até agora)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioDeHoje = hoje.getTime();

    const dadosDeHoje = dados.filter(item => {
      const timestamp = new Date(item.timestamp).getTime();
      return timestamp >= inicioDeHoje;
    });

    // Criar array com todas as horas do dia de 00:00 até agora
    const agora = new Date();
    const todosOsHorarios: any[] = [];
    const horaFinal = agora.getHours();
    const minutoFinal = agora.getMinutes();

    for (let h = 0; h <= horaFinal; h++) {
      const maxMinutos = (h === horaFinal) ? minutoFinal : 59;
      for (let m = 0; m <= maxMinutos; m += 5) { // ✅ De 5 em 5 minutos
        const timestamp = new Date(hoje);
        timestamp.setHours(h, m, 0, 0);
        todosOsHorarios.push({
          timestamp: timestamp.toISOString(),
          hora: timestamp.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          potencia: null,
          valorContratado: valorContratado,
          valorAdicional: valorContratado * (1 + percentualAdicional / 100),
        });
      }
    }

    // Mesclar dados reais com o template
    const dadosMap = new Map(
      dadosDeHoje.map((item) => [
        new Date(item.timestamp).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        {
          ...item,
          hora: new Date(item.timestamp).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          valorContratado: valorContratado,
          valorAdicional: valorContratado * (1 + percentualAdicional / 100),
        }
      ])
    );

    return todosOsHorarios.map(slot => dadosMap.get(slot.hora) || slot);
  }, [dados, valorContratado, percentualAdicional]);

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

  // Verificar se tem equipamentos disponíveis para o gráfico de demanda
  // SEMPRE mostra o gráfico se tiver equipamentos disponíveis (mesmo sem nenhum selecionado)
  // Isso permite que o usuário clique em "Configurar" para selecionar equipamentos
  const temEquipamentosDisponiveis = equipamentosData && equipamentosData.length > 0;

  // Verificar se tem algum equipamento selecionado
  const temEquipamentosSelecionados = configuracao.equipamentos.some(e => e.selecionado);

  // Verificar se tem M160 disponível para tensão e FP
  const temM160Disponivel = equipamentosM160.length > 0;

  // Analisar qualidade dos dados
  const qualidadeDados = useMemo(() => analisarQualidadeDados(dados), [dados]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Gráfico de Demanda - Mostra se tiver equipamentos disponíveis (mesmo que nenhum esteja selecionado) */}
      {temEquipamentosDisponiveis && (
      <Card>
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="h-5 w-5 text-yellow-500" />
              <CardTitle>Demanda</CardTitle>
              {getConfiabilidadeBadge(fonte, confiabilidade)}
            </div>
            <div className="flex items-center gap-2">
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
        </CardHeader>
        <CardContent className="p-2">
          {/* Alerta de Dados Desatualizados/Sem Dados - Discreto */}
          {qualidadeDados.status !== 'OK' && (
            <div className="mb-3 p-2 rounded-md bg-muted/40">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground/70" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {qualidadeDados.status === 'SEM_DADOS' && (
                      <>Nenhum dado disponível</>
                    )}
                    {qualidadeDados.status === 'DESATUALIZADO' && (
                      <>Dados desatualizados. {qualidadeDados.mensagem}</>
                    )}
                    {qualidadeDados.status === 'PARCIAL' && (
                      <>Cobertura parcial: {qualidadeDados.mensagem.split(': ')[1]}</>
                    )}
                    {' · '}
                    <span className="text-muted-foreground/60">
                      {qualidadeDados.status === 'SEM_DADOS' && 'Verifique serviço MQTT'}
                      {qualidadeDados.status === 'DESATUALIZADO' && 'Conexão MQTT interrompida ou equipamentos offline'}
                      {qualidadeDados.status === 'PARCIAL' && 'Falhas intermitentes na conexão'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Energia do Dia */}
          {energiaDia !== undefined && energiaDia !== 0 && (
            <div className="mb-2 bg-muted/50 rounded-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                Energia do dia: {energiaDia.toFixed(2)} kWh
              </span>
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
                  {temEquipamentosSelecionados
                    ? 'Nenhum dado disponível'
                    : 'Nenhum equipamento selecionado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {temEquipamentosSelecionados
                    ? 'Aguardando dados dos equipamentos selecionados'
                    : 'Clique no botão de configuração para selecionar equipamentos'}
                </p>
              </div>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={dadosFormatadosPotencia}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="hora" fontSize={12} />
              <YAxis
                fontSize={12}
                label={{
                  value: "kW",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
              />

              {/* Linha 1: Demanda Real (Potência) - Preto no light, branco no dark */}
              <Line
                type="monotone"
                dataKey="potencia"
                name="Demanda Real"
                stroke={corLinhaDemanda}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={true}
              />

              {/* Linha 2: Valor Contratado - Discreto */}
              <Line
                type="monotone"
                dataKey="valorContratado"
                name="Valor Contratado"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />

              {/* Linha 3: Valor Contratado + Adicional - Discreto */}
              <Line
                type="monotone"
                dataKey="valorAdicional"
                name={`Contratado + ${percentualAdicional}%`}
                stroke="#6b7280"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          )}

          {/* Detalhes adicionais */}
          {!isLoading && configuracao.mostrarDetalhes && detalhes && (
            <div className="mt-4 p-3 bg-muted rounded-lg text-xs">
              <p className="font-medium mb-1">Detalhes da Medição:</p>
              <div className="flex flex-wrap gap-3">
                {energiaDia !== undefined && energiaDia !== 0 && (
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    Energia do dia: {energiaDia.toFixed(2)} kWh
                  </span>
                )}
                {detalhes.formula && (
                  <span>Fórmula: {detalhes.formula}</span>
                )}
                {detalhes.equipamentosUsados !== undefined && (
                  <span>Equipamentos: {detalhes.equipamentosUsados}</span>
                )}
                {detalhes.equipamentosOffline !== undefined && detalhes.equipamentosOffline > 0 && (
                  <span className="text-yellow-600">Offline: {detalhes.equipamentosOffline}</span>
                )}
                {detalhes.perdaAplicada !== undefined && detalhes.perdaAplicada > 0 && (
                  <span>Perdas: {detalhes.perdaAplicada}%</span>
                )}
                {detalhes.energiaDetalhes && (
                  <span className="text-muted-foreground">({detalhes.energiaDetalhes})</span>
                )}
              </div>
            </div>
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
                <SelectTrigger id="m160-tensao" className="w-[250px]">
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
            <div className="flex items-center gap-4">
              <Label className="text-sm min-w-[80px]">Fases:</Label>
              <div className="flex items-center gap-4">
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
                <SelectTrigger id="m160-fp" className="w-[250px]">
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
            <div className="flex items-center gap-4">
              <Label className="text-sm min-w-[80px]">Fases:</Label>
              <div className="flex items-center gap-4">
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
                  domain={[0.75, 1.0]}
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

                {/* Linha de limite mínimo 0.92 */}
                <Line
                  type="monotone"
                  dataKey={() => 0.92}
                  name="Limite Mínimo (0.92)"
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
              Gráfico de Demanda - Expandido
              {getConfiabilidadeBadge(fonte, confiabilidade)}
            </DialogTitle>
          </DialogHeader>

          {/* Energia do Dia - Modal Expandido */}
          {energiaDia !== undefined && energiaDia !== 0 && (
            <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-base font-semibold text-green-600 dark:text-green-400">
                Energia do dia: {energiaDia.toFixed(2)} kWh
              </span>
            </div>
          )}

          <div className="w-full h-[70vh]">
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
                    {temEquipamentosSelecionados
                      ? 'Nenhum dado disponível'
                      : 'Nenhum equipamento selecionado'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {temEquipamentosSelecionados
                      ? 'Aguardando dados dos equipamentos selecionados'
                      : 'Feche este modal e clique no botão de configuração para selecionar equipamentos'}
                  </p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosFormatadosPotencia}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="hora" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    label={{
                      value: "kW",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="line"
                  />

                  {/* Brush para zoom e navegação - apenas no modal expandido */}
                  <Brush
                    dataKey="hora"
                    height={30}
                    stroke="hsl(var(--muted-foreground) / 0.3)"
                    fill="hsl(var(--muted))"
                    travellerWidth={10}
                  />

                  {/* Linha 1: Demanda Real (Potência) - Preto no light, branco no dark */}
                  <Line
                    type="monotone"
                    dataKey="potencia"
                    name="Demanda Real"
                    stroke={corLinhaDemanda}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={true}
                  />

                  {/* Linha 2: Valor Contratado - Discreto */}
                  <Line
                    type="monotone"
                    dataKey="valorContratado"
                    name="Valor Contratado"
                    stroke="#9ca3af"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />

                  {/* Linha 3: Valor Contratado + Adicional - Discreto */}
                  <Line
                    type="monotone"
                    dataKey="valorAdicional"
                    name={`Contratado + ${percentualAdicional}%`}
                    stroke="#6b7280"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* Detalhes adicionais */}
            {!isLoading && configuracao.mostrarDetalhes && detalhes && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-xs">
                <p className="font-medium mb-1">Detalhes da Medição:</p>
                <div className="flex flex-wrap gap-3">
                  {detalhes.formula && (
                    <span>Fórmula: {detalhes.formula}</span>
                  )}
                  {detalhes.equipamentosUsados !== undefined && (
                    <span>Equipamentos: {detalhes.equipamentosUsados}</span>
                  )}
                  {detalhes.equipamentosOffline !== undefined && detalhes.equipamentosOffline > 0 && (
                    <span className="text-yellow-600">Offline: {detalhes.equipamentosOffline}</span>
                  )}
                  {detalhes.perdaAplicada !== undefined && detalhes.perdaAplicada > 0 && (
                    <span>Perdas: {detalhes.perdaAplicada}%</span>
                  )}
                </div>
              </div>
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
                  <SelectTrigger id="m160-tensao-modal" className="w-[250px]">
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
              <div className="flex items-center gap-4">
                <Label className="text-sm min-w-[80px]">Fases:</Label>
                <div className="flex items-center gap-4">
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
                  <SelectTrigger id="m160-fp-modal" className="w-[250px]">
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
              <div className="flex items-center gap-4">
                <Label className="text-sm min-w-[80px]">Fases:</Label>
                <div className="flex items-center gap-4">
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
                    domain={[0.75, 1.0]}
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

                  {/* Linha de limite mínimo 0.92 */}
                  <Line
                    type="monotone"
                    dataKey={() => 0.92}
                    name="Limite Mínimo (0.92)"
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