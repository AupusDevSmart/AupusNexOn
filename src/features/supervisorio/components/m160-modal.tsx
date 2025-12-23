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
  // Estado da aba ativa - CUSTOS como padrão
  const [activeTab, setActiveTab] = useState<'leitura' | 'custos'>('custos');

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
        frequency: 0,
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

    // Calcular potências totais (Pa, Pb, Pc em Watts)
    const Pa = d.Pa || 0;
    const Pb = d.Pb || 0;
    const Pc = d.Pc || 0;
    const potenciaAtivaW = Pa + Pb + Pc; // Total em Watts
    const potenciaAtivaKw = potenciaAtivaW / 1000; // Converter para kW

    // ✅ NOVO: Usar potencia_kw do payload principal se disponível (mais preciso)
    const potenciaReal = mqttData.payload.potencia_kw ?? potenciaAtivaKw;

    // Calcular potência aparente usando fator de potência médio
    const fpMedio = ((d.FPA || 0) + (d.FPB || 0) + (d.FPC || 0)) / 3;
    const potenciaAparente = fpMedio !== 0 ? potenciaReal / fpMedio : 0;

    // Calcular potência reativa usando teorema de Pitágoras (S² = P² + Q²)
    const potenciaReativa = Math.sqrt(Math.max(0, Math.pow(potenciaAparente, 2) - Math.pow(potenciaReal, 2)));

    return {
      voltage: {
        L1: d.Va || 0,
        L2: d.Vb || 0,
        L3: d.Vc || 0,
        LN: ((d.Va || 0) + (d.Vb || 0) + (d.Vc || 0)) / 3, // Média das fases
      },
      current: {
        L1: d.Ia || 0,
        L2: d.Ib || 0,
        L3: d.Ic || 0,
        N: 0, // Corrente de neutro não disponível no M160
      },
      power: {
        active: potenciaReal, // kW
        reactive: potenciaReativa, // kVAr (calculado)
        apparent: potenciaAparente, // kVA (calculado)
        import: potenciaReal >= 0 ? potenciaReal : 0, // kW (consumo)
        export: potenciaReal < 0 ? Math.abs(potenciaReal) : 0, // kW (geração)
        L1: Pa, // Potência fase A (W)
        L2: Pb, // Potência fase B (W)
        L3: Pc, // Potência fase C (W)
      },
      frequency: d.freq || 60.0, // ✅ CORRIGIDO: Usar frequência real do payload
      powerFactor: d.FPA || 0,
      powerFactorB: d.FPB || 0,
      powerFactorC: d.FPC || 0,
      thd: {
        voltage: 0, // THD não disponível no M160
        current: 0  // THD não disponível no M160
      },
      energy: {
        activeImport: d.phf || mqttData.payload.energia_kwh || 0, // ✅ CORRIGIDO: PHF ou energia_kwh
        activeExport: 0, // Não disponível no M160
        reactiveImport: 0, // Não disponível no M160
        reactiveExport: 0, // Não disponível no M160
      },
    };
  }, [mqttData]);

  // Determinar se unidade é Grupo A (tem diferenciação de horários)
  const isGrupoA = custosData?.unidade?.grupo === 'A';
  const isIrrigante = custosData?.unidade?.irrigante === true;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 justify-between text-base">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              {componenteData?.nome || 'M160'} - Multimedidor 4Q
            </div>
            {/* Indicador de Status de Conexão */}
            {isConnected ? (
              <Badge variant="outline" className="text-[10px] px-2 py-0">
                🟢 Tempo Real
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-2 py-0">
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
          <TabsContent value="custos" className="space-y-3">
            {/* Filtros Compactos */}
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Período:</span>
                </div>
                <Select value={periodoCustos} onValueChange={(v) => setPeriodoCustos(v as PeriodoTipo)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={5}>
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
              <div className="space-y-3">
                {/* Informações da Unidade Compactas */}
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {custosData.unidade.grupo} - {custosData.unidade.subgrupo}
                  </Badge>
                  {isIrrigante && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Irrigante
                    </Badge>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{custosData.unidade.nome}</span>
                  <span className="text-muted-foreground">•</span>
                  {/* Badge indicando que demanda nunca está incluída */}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    Demanda não incluída no custo
                  </Badge>
                </div>

                {/* Grid de Cards de Custos - Layout COMPACTO */}
                {isGrupoA ? (
                  // GRUPO A: Grid 3 colunas + Resumo + Irrigante
                  <div className="grid gap-2">
                    {/* Linha 1: Ponta, Fora Ponta, Reservado */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                      <CardCusto
                        tipo="RESERVADO"
                        energia_kwh={custosData.consumo.energia_reservado_kwh}
                        custo={custosData.custos.custo_reservado}
                        tarifa={
                          custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'RESERVADO')?.tarifa_total ||
                          undefined
                        }
                        observacao="Verde: HR = FP"
                      />
                    </div>

                    {/* Linha 2: Demanda, Irrigante, Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <CardCusto
                        tipo="DEMANDA"
                        energia_kwh={custosData.consumo.demanda_contratada_kw || 0}
                        custo={custosData.custos.custo_demanda}
                        tarifa={
                          custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'DEMANDA')?.tarifa_total ||
                          undefined
                        }
                      />

                      {/* Irrigante ou placeholder */}
                      {isIrrigante && custosData.irrigante ? (
                        <IndicadorIrrigante irrigante={custosData.irrigante} />
                      ) : (
                        <div />
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
                  </div>
                ) : (
                  // GRUPO B: Grid compacto em 3 colunas
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                    {isIrrigante && custosData.irrigante && custosData.consumo.energia_irrigante_kwh > 0 ? (
                      <>
                        <CardCusto
                          tipo="IRRIGANTE"
                          energia_kwh={custosData.consumo.energia_irrigante_kwh}
                          custo={custosData.custos.custo_irrigante}
                        />
                        <IndicadorIrrigante irrigante={custosData.irrigante} />
                      </>
                    ) : (
                      <>
                        <div />
                        <CardResumoTotal
                          energia_total_kwh={custosData.consumo.energia_total_kwh}
                          custo_total={custosData.custos.custo_total}
                          custo_medio_kwh={custosData.custos.custo_medio_kwh}
                        />
                      </>
                    )}

                    {/* Resumo Total (quando tem irrigante) */}
                    {isIrrigante && custosData.irrigante && custosData.consumo.energia_irrigante_kwh > 0 && (
                      <CardResumoTotal
                        energia_total_kwh={custosData.consumo.energia_total_kwh}
                        custo_total={custosData.custos.custo_total}
                        custo_medio_kwh={custosData.custos.custo_medio_kwh}
                        className="md:col-span-3"
                      />
                    )}
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
