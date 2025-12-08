import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DadosGrafico } from "@/types/dtos/sinoptico-ativo";
import { Activity, Settings, TrendingUp, Zap, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";

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
  const [modalOpen, setModalOpen] = useState(false);

  // Buscar configuração da API
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
    staleTime: 30000 // Cache por 30 segundos
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
    staleTime: 60000, // Cache por 60 segundos
    gcTime: 300000, // Manter em cache por 5 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false
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
        equipamentos: equipamentosComSelecao
      });
    } else if (equipamentosData && equipamentosData.length > 0 && !configData) {
      // Se não tem config na API, usar equipamentos disponíveis
      setConfiguracao(prev => ({
        ...prev,
        equipamentos: equipamentosData
      }));
    }
  }, [configData, equipamentosData]);

  // Usar hook de dados de demanda
  const { dados, fonte, confiabilidade, detalhes, isLoading } = useDadosDemanda(configuracao, unidadeId);

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

      // Atualizar estado local imediatamente
      setConfiguracao(novaConfig);

      // Recarregar da API
      setTimeout(() => refetchConfig(), 500);

      // Fechar modal
      setModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
    }
  };

  // Preparar dados para o gráfico com useMemo para evitar re-cálculos desnecessários
  const dadosFormatadosPotencia = useMemo(() =>
    adicionarLinhasReferencia(dados || [], valorContratado, percentualAdicional),
    [dados, valorContratado, percentualAdicional]
  );

  const dadosFormatadosTensao = useMemo(() =>
    formatarDadosGrafico(dadosTensao || []),
    [dadosTensao]
  );

  return (
    <div className="w-full">
      {/* Gráfico de Demanda */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <CardTitle>Demanda</CardTitle>
              {getConfiabilidadeBadge(fonte, confiabilidade)}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Últimas 24h
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados do gráfico...</p>
            </div>
          ) : dadosFormatadosPotencia.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {detalhes?.formula || 'Nenhum dado disponível. Configure os equipamentos no botão de configuração.'}
              </p>
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

              {/* Brush para zoom e navegação */}
              <Brush
                dataKey="hora"
                height={30}
                stroke="#8884d8"
                fill="hsl(var(--muted))"
                travellerWidth={10}
              />

              {/* Linha 1: Demanda Real (Potência) */}
              <Line
                type="monotone"
                dataKey="potencia"
                name="Demanda Real"
                stroke="#eab308"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />

              {/* Linha 2: Valor Contratado */}
              <Line
                type="monotone"
                dataKey="valorContratado"
                name="Valor Contratado"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />

              {/* Linha 3: Valor Contratado + Adicional */}
              <Line
                type="monotone"
                dataKey="valorAdicional"
                name={`Contratado + ${percentualAdicional}%`}
                stroke="#3b82f6"
                strokeWidth={2}
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
        </CardContent>
      </Card>

      {/* Gráfico de Tensão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Tensão
            <Badge variant="outline" className="ml-auto">
              Últimas 24h
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dadosFormatadosTensao.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <Activity className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Dados de tensão não disponíveis
                </p>
                <p className="text-xs text-muted-foreground">
                  Configure equipamentos com leitura de tensão
                </p>
              </div>
            </div>
          ) : (
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
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
              />

              {/* Brush para zoom e navegação */}
              <Brush
                dataKey="hora"
                height={30}
                stroke="#3b82f6"
                fill="hsl(var(--muted))"
                travellerWidth={10}
              />

              <Line
                type="monotone"
                dataKey="tensao"
                name="Tensão (V)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Fator de Potência
            <Badge variant="outline" className="ml-auto">
              Últimas 24h
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-3">
              <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Dados de fator de potência não disponíveis
                </p>
                <p className="text-xs text-muted-foreground">
                  Configure equipamentos com leitura de fator de potência
                </p>
              </div>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dados}>
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
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
              />

              {/* Brush para zoom e navegação */}
              <Brush
                dataKey="hora"
                height={30}
                stroke="#8b5cf6"
                fill="hsl(var(--muted))"
                travellerWidth={10}
              />

              <Line
                type="monotone"
                dataKey="fatorPotencia"
                name="Fator de Potência"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />

              <Line
                type="monotone"
                dataKey={() => 0.92}
                name="Limite Mínimo (0.92)"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

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