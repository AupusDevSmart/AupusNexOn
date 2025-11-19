import { useState, useMemo } from 'react';
import type { M160Reading } from '@/components/equipment/M160/M160.types';
import M160Multimeter from '@/components/equipment/M160/M160Multimeter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateTimeInput } from '@/components/ui/datetime-input';
import { Gauge, WifiOff, Loader2, DollarSign, Activity, Calendar, RefreshCw } from 'lucide-react';
import { useEquipamentoMqttData } from '@/hooks/useEquipamentoMqttData';
import { useCustosEnergia } from '@/hooks/useCustosEnergia';
import type { PeriodoTipo } from '@/types/dtos/custos-energia-dto';
import { CardCusto, CardResumoTotal, IndicadorIrrigante } from './custos-energia';

interface M160ModalProps {
  isOpen: boolean;
  onClose: () => void;
  componenteData: any;
}

export function M160Modal({ isOpen, onClose, componenteData }: M160ModalProps) {
  // Estado da aba ativa
  const [activeTab, setActiveTab] = useState<'leitura' | 'custos'>('leitura');

  // Estado dos filtros de custos
  const [periodoCustos, setPeriodoCustos] = useState<PeriodoTipo>('dia');

  // Estados para período customizado
  const [timestampInicio, setTimestampInicio] = useState<string>(() => {
    const now = new Date();
    now.setDate(now.getDate() - 7);
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  });

  const [timestampFim, setTimestampFim] = useState<string>(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return now.toISOString();
  });

  // ============================================
  // INTEGRAÇÃO MQTT EM TEMPO REAL
  // ============================================
  const equipamentoId = (componenteData?.dados?.equipamento_id || componenteData?.id)?.trim();
  const { data: mqttResponse, loading, error, lastUpdate, refetch: refetchMqtt } = useEquipamentoMqttData(equipamentoId);

  const mqttData = useMemo(() => {
    if (!mqttResponse?.dado?.dados) return null;
    return {
      payload: mqttResponse.dado.dados,
      timestamp: new Date(mqttResponse.dado.timestamp_dados).getTime(),
    };
  }, [mqttResponse]);

  const isConnected = !!mqttData && !loading;

  // ============================================
  // DADOS DE CUSTOS
  // ============================================
  const {
    data: custosData,
    loading: custosLoading,
    error: custosError,
    refetch: refetchCustos,
  } = useCustosEnergia({
    equipamentoId,
    periodo: periodoCustos,
    timestamp_inicio: periodoCustos === 'custom' ? timestampInicio : undefined,
    timestamp_fim: periodoCustos === 'custom' ? timestampFim : undefined,
    enabled: activeTab === 'custos' && !!equipamentoId,
  });

  // Converter dados MQTT para formato M160Reading
  const dadosM160: M160Reading = useMemo(() => {
    if (!mqttData?.payload?.Dados) {
      return {
        voltage: { L1: 0, L2: 0, L3: 0, LN: 0 },
        current: { L1: 0, L2: 0, L3: 0, N: 0 },
        power: {
          active: 0,
          reactive: 0,
          apparent: 0,
          import: 0,
          export: 0,
        },
        frequency: 60.0,
        powerFactor: 0,
        thd: { voltage: 0, current: 0 },
        energy: {
          activeImport: 0,
          activeExport: 0,
          reactiveImport: 0,
          reactiveExport: 0,
        },
      };
    }

    const d = mqttData.payload.Dados;

    // Calcular potências totais
    const Pa = d.Pa || 0;
    const Pb = d.Pb || 0;
    const Pc = d.Pc || 0;
    const potenciaAtiva = Pa + Pb + Pc;

    return {
      voltage: {
        L1: d.Va || 0,
        L2: d.Vb || 0,
        L3: d.Vc || 0,
        LN: ((d.Va || 0) + (d.Vb || 0) + (d.Vc || 0)) / 3,
      },
      current: {
        L1: d.Ia || 0,
        L2: d.Ib || 0,
        L3: d.Ic || 0,
        N: 0,
      },
      power: {
        active: potenciaAtiva,
        reactive: d.qhfi || 0,
        apparent: Math.sqrt(Math.pow(potenciaAtiva, 2) + Math.pow(d.qhfi || 0, 2)),
        import: potenciaAtiva >= 0 ? potenciaAtiva : 0,
        export: potenciaAtiva < 0 ? Math.abs(potenciaAtiva) : 0,
      },
      frequency: 60.0,
      powerFactor: d.FPA || 0,
      powerFactorB: d.FPB || 0,
      powerFactorC: d.FPC || 0,
      thd: { voltage: 0, current: 0 },
      energy: {
        activeImport: d.phf || 0,
        activeExport: d.phr || 0,
        reactiveImport: d.qhfi || 0,
        reactiveExport: d.qhri || 0,
      },
    };
  }, [mqttData]);

  // Determinar se unidade é Grupo A (tem diferenciação de horários)
  const isGrupoA = custosData?.unidade?.grupo === 'A';
  const isIrrigante = custosData?.unidade?.irrigante === true;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-green-500" />
              {componenteData?.nome || 'M160'} - Multimedidor 4Q
            </div>
            {/* Indicador de Status de Conexão */}
            {isConnected ? (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/50">
                🟢 Tempo Real
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/50">
                {error ? <WifiOff className="h-3 w-3 mr-1" /> : <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {error ? 'Desconectado' : 'Conectando...'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs de Navegação */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leitura" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Leitura em Tempo Real
            </TabsTrigger>
            <TabsTrigger value="custos" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Custos de Energia
            </TabsTrigger>
          </TabsList>

          {/* ABA: Leitura em Tempo Real */}
          <TabsContent value="leitura" className="space-y-4">
            {/* Barra de Controles */}
            <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Dados em Tempo Real</span>
                {lastUpdate && (
                  <span className="text-xs text-muted-foreground">
                    • Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={refetchMqtt} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Atualizar</span>
              </Button>
            </div>

            {/* Mostrar erro se houver */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-md p-3">
                <p className="text-sm text-red-500">⚠️ Erro de conexão: {error}</p>
                <p className="text-xs text-red-400 mt-1">
                  Verifique se o backend está rodando em http://localhost:3000
                </p>
              </div>
            )}

            <div className="flex justify-center items-center py-6">
              <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
                <M160Multimeter
                  id="m160-modal"
                  name={componenteData?.nome || 'M160'}
                  readings={dadosM160}
                  status={isConnected ? 'online' : 'offline'}
                  displayMode="all"
                  scale={1.0}
                  navigation={{
                    enableManualNavigation: true,
                    showDisplayLabel: true,
                    showPositionIndicator: true,
                    allowAutoRotationToggle: false,
                  }}
                  onConfig={() => console.log('Configurar M160')}
                />

                <div className="mt-6 text-center">
                  <Badge variant="outline" className="text-xs">
                    Display Interativo com Navegação
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ABA: Custos de Energia */}
          <TabsContent value="custos" className="space-y-4">
            {/* Filtros */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Período:</span>
                </div>
                <Select value={periodoCustos} onValueChange={(v) => setPeriodoCustos(v as PeriodoTipo)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Dia Atual</SelectItem>
                    <SelectItem value="mes">Mês Atual</SelectItem>
                    <SelectItem value="custom">Período Customizado</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={refetchCustos} disabled={custosLoading}>
                  {custosLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
                </Button>
              </div>

              {/* DateTimePickers para período customizado */}
              {periodoCustos === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DateTimeInput
                    label="Data/Hora Início"
                    value={timestampInicio}
                    onChange={setTimestampInicio}
                    max={timestampFim}
                  />
                  <DateTimeInput
                    label="Data/Hora Fim"
                    value={timestampFim}
                    onChange={setTimestampFim}
                    min={timestampInicio}
                  />
                </div>
              )}
            </div>

            {/* Loading */}
            {custosLoading && (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Erro */}
            {custosError && !custosLoading && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-md p-4">
                <p className="text-sm text-red-500">⚠️ Erro ao carregar custos: {custosError}</p>
              </div>
            )}

            {/* Conteúdo de Custos */}
            {custosData && !custosLoading && (
              <div className="space-y-6">
                {/* Informações da Unidade */}
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{custosData.unidade.grupo} - {custosData.unidade.subgrupo}</Badge>
                  {isIrrigante && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/50">
                      Irrigante
                    </Badge>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{custosData.unidade.nome}</span>
                </div>

                {/* Grid de Cards de Custos - Layout adaptativo baseado no grupo */}
                {isGrupoA ? (
                  // GRUPO A: Grid 2x2 + Resumo + Irrigante (se aplicável)
                  <div className="grid gap-4">
                    {/* Linha 1: Ponta e Fora Ponta */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <CardCusto
                        tipo="PONTA"
                        energia_kwh={custosData.consumo.energia_ponta_kwh}
                        custo={custosData.custos.custo_ponta}
                        tarifa={
                          custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.tarifa_total || undefined
                        }
                        horario_inicio={
                          custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.horario_inicio || '18:00'
                        }
                        horario_fim={
                          custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.horario_fim || '21:00'
                        }
                      />
                      <CardCusto
                        tipo="FORA_PONTA"
                        energia_kwh={custosData.consumo.energia_fora_ponta_kwh}
                        custo={custosData.custos.custo_fora_ponta}
                        tarifa={
                          custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'FORA_PONTA')?.tarifa_total ||
                          undefined
                        }
                      />
                    </div>

                    {/* Linha 2: Reservado e Demanda */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <CardCusto
                        tipo="RESERVADO"
                        energia_kwh={custosData.consumo.energia_reservado_kwh}
                        custo={custosData.custos.custo_reservado}
                        tarifa={
                          custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'RESERVADO')?.tarifa_total ||
                          undefined
                        }
                        observacao="Na tarifa Verde: HR = FP"
                      />
                      <CardCusto
                        tipo="DEMANDA"
                        energia_kwh={custosData.consumo.demanda_contratada_kw || 0}
                        custo={custosData.custos.custo_demanda}
                        tarifa={
                          custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'DEMANDA')?.tarifa_total ||
                          undefined
                        }
                      />
                    </div>

                    {/* Irrigante (se aplicável) */}
                    {isIrrigante && custosData.irrigante && (
                      <IndicadorIrrigante irrigante={custosData.irrigante} />
                    )}

                    {/* Resumo Total */}
                    <CardResumoTotal
                      energia_total_kwh={custosData.consumo.energia_total_kwh}
                      custo_total={custosData.custos.custo_total}
                      custo_medio_kwh={custosData.custos.custo_medio_kwh}
                      demanda_maxima_kw={custosData.consumo.demanda_maxima_kw}
                      demanda_contratada_kw={custosData.consumo.demanda_contratada_kw}
                    />
                  </div>
                ) : (
                  // GRUPO B: Layout simplificado
                  <div className="grid gap-4">
                    <CardCusto
                      tipo="FORA_PONTA"
                      energia_kwh={
                        custosData.consumo.energia_total_kwh - custosData.consumo.energia_irrigante_kwh
                      }
                      custo={custosData.custos.custo_fora_ponta}
                      tarifa={
                        custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'FORA_PONTA')?.tarifa_total ||
                        undefined
                      }
                    />

                    {/* Irrigante (se aplicável) */}
                    {isIrrigante && custosData.irrigante && custosData.consumo.energia_irrigante_kwh > 0 && (
                      <>
                        <CardCusto
                          tipo="IRRIGANTE"
                          energia_kwh={custosData.consumo.energia_irrigante_kwh}
                          custo={custosData.custos.custo_irrigante}
                        />
                        <IndicadorIrrigante irrigante={custosData.irrigante} />
                      </>
                    )}

                    {/* Resumo Total */}
                    <CardResumoTotal
                      energia_total_kwh={custosData.consumo.energia_total_kwh}
                      custo_total={custosData.custos.custo_total}
                      custo_medio_kwh={custosData.custos.custo_medio_kwh}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Estado vazio */}
            {!custosData && !custosLoading && !custosError && (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um período para visualizar os custos</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default M160Modal;
