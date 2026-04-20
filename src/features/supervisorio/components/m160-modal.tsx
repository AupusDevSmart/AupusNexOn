import { useState, useMemo } from 'react';
import type { M160Reading } from '@/components/equipment/M160/M160.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Gauge, WifiOff, Loader2, DollarSign, Activity, Calendar, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { useEquipamentoMqttData } from '@/hooks/useEquipamentoMqttData';
import { useCustosEnergia } from '@/hooks/useCustosEnergia';
import { useConfiguracaoCusto } from '@/hooks/useConfiguracaoCusto';
import type { PeriodoTipo } from '@/types/dtos/custos-energia-dto';
import { CardCusto, CardResumoTotal, IndicadorIrrigante, CardTributos, EditorTarifas } from './custos-energia';

interface M160ModalProps {
  isOpen: boolean;
  onClose: () => void;
  componenteData: any;
}

export function M160Modal({ isOpen, onClose, componenteData }: M160ModalProps) {
  const [activeTab, setActiveTab] = useState<'leitura' | 'custos'>('custos');
  const [periodoCustos, setPeriodoCustos] = useState<PeriodoTipo>('dia');

  const [timestampInicio, setTimestampInicio] = useState<string>(() => {
    const now = new Date();
    const brasilDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const [y, m, d] = brasilDateStr.split('-').map(Number);
    const seteDiasAtras = new Date(Date.UTC(y, m - 1, d - 7, 0, 0, 0, 0));
    return seteDiasAtras.toISOString();
  });

  const [timestampFim, setTimestampFim] = useState<string>(() => {
    const now = new Date();
    const brasilDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const [y, m, d] = brasilDateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).toISOString();
  });

  // ============================================
  // MQTT
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

  // ============================================
  // DATA STATUS
  // ============================================
  const dataStatus = useMemo(() => {
    if (!lastUpdate) return { isConnected: false, isStale: false, minutesAgo: 0, hoursAgo: 0, timeText: '' };

    const now = Date.now();
    const dataAge = now - lastUpdate.getTime();
    const minutesAgo = Math.floor(dataAge / 60000);
    const hoursAgo = Math.floor(minutesAgo / 60);

    const isStale = minutesAgo > 5;
    const isConnected = !isStale && !loading;

    let timeText = '';
    if (minutesAgo < 60) {
      timeText = `${minutesAgo}min atras`;
    } else if (hoursAgo < 24) {
      const remainingMinutes = minutesAgo % 60;
      timeText = remainingMinutes > 0 ? `${hoursAgo}h${remainingMinutes}min atras` : `${hoursAgo}h atras`;
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      timeText = daysAgo === 1 ? `1 dia atras` : `${daysAgo} dias atras`;
    }

    return { isConnected, isStale, minutesAgo, hoursAgo, timeText };
  }, [lastUpdate, loading]);

  const isConnected = dataStatus.isConnected;

  // ============================================
  // CUSTOS
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

  // ============================================
  // CONFIGURACAO DE CUSTO (tributos + tarifas)
  // ============================================
  const {
    config: configCusto,
    saving: configSaving,
    salvar: salvarConfig,
  } = useConfiguracaoCusto(equipamentoId, activeTab === 'custos');

  const handleSaveTributos = async (tributos: { icms: number; pis: number; cofins: number; perdas: number }) => {
    const ok = await salvarConfig(tributos);
    if (ok) refetchCustos();
    return ok;
  };

  const handleSaveTarifas = async (data: Record<string, any>) => {
    const ok = await salvarConfig(data);
    if (ok) refetchCustos();
    return ok;
  };

  // ============================================
  // M160 DATA CONVERSION
  // ============================================
  const dadosM160: M160Reading = useMemo(() => {
    if (!mqttData?.payload) {
      return {
        voltage: { L1: 0, L2: 0, L3: 0, LN: 0 },
        current: { L1: 0, L2: 0, L3: 0, N: 0 },
        power: { active: 0, reactive: 0, apparent: 0, import: 0, export: 0 },
        frequency: 0,
        powerFactor: 0,
        thd: { voltage: 0, current: 0 },
        energy: { activeImport: 0, activeExport: 0, reactiveImport: 0, reactiveExport: 0 },
      };
    }

    const d = mqttData.payload as unknown as Record<string, number | undefined>;
    const Pa = d.Pa || 0;
    const Pb = d.Pb || 0;
    const Pc = d.Pc || 0;
    const potenciaAtivaW = d.Pt || 0;
    const potenciaReativaVAr = d.Qt || 0;
    const potenciaAparenteVA = d.St || 0;
    const potenciaAtivaKw = potenciaAtivaW / 1000;
    const potenciaReativaKvar = potenciaReativaVAr / 1000;
    const potenciaAparenteKva = potenciaAparenteVA / 1000;
    const fatorPotenciaTotal = potenciaAparenteVA > 0 ? potenciaAtivaW / potenciaAparenteVA : 1;

    return {
      voltage: {
        L1: d.Va || 0,
        L2: d.Vb || 0,
        L3: d.Vc || 0,
        LN: ((d.Va || 0) + (d.Vb || 0) + (d.Vc || 0)) / 3,
      },
      current: { L1: d.Ia || 0, L2: d.Ib || 0, L3: d.Ic || 0, N: 0 },
      power: {
        active: potenciaAtivaKw,
        reactive: potenciaReativaKvar,
        apparent: potenciaAparenteKva,
        import: potenciaAtivaKw >= 0 ? potenciaAtivaKw : 0,
        export: potenciaAtivaKw < 0 ? Math.abs(potenciaAtivaKw) : 0,
        L1: Pa,
        L2: Pb,
        L3: Pc,
      },
      frequency: d.freq || 60.0,
      powerFactor: d.FPa || d.FPA || 0,
      powerFactorB: d.FPb || d.FPB || 0,
      powerFactorC: d.FPc || d.FPC || 0,
      powerFactorTotal: fatorPotenciaTotal,
      thd: { voltage: 0, current: 0 },
      energy: {
        activeImport: d.phf || d.energia_kwh || 0,
        activeExport: d.phr || 0,
        reactiveImport: d.qhfi || d.consumo_qhf || 0,
        reactiveExport: d.qhfr || d.consumo_qhr || 0,
      },
    };
  }, [mqttData]);

  const isGrupoA = custosData?.unidade?.grupo === 'A';
  const isIrrigante = custosData?.unidade?.irrigante === true;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[100vh] overflow-y-auto p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 justify-between text-base">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              {componenteData?.nome || 'M160'} - Multimedidor 4Q
            </div>
            {dataStatus.isStale ? (
              <Badge variant="destructive" className="text-[10px] px-2 py-0 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Desatualizado ({dataStatus.timeText})
              </Badge>
            ) : isConnected ? (
              <Badge variant="outline" className="text-[10px] px-2 py-0 flex items-center gap-1">
                <Activity className="h-3 w-3 text-green-500" />
                Tempo Real
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-2 py-0">
                {error ? <WifiOff className="h-3 w-3 mr-1" /> : <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {error ? 'Desconectado' : 'Conectando...'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

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

          {/* ========== ABA: LEITURA EM TEMPO REAL ========== */}
          <TabsContent value="leitura" className="space-y-4">
            {/* Barra de Controles */}
            <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Dados em Tempo Real</span>
                {lastUpdate && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado as {lastUpdate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </span>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={refetchMqtt} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2">Atualizar</span>
              </Button>
            </div>

            {/* Alerta Desatualizado */}
            {dataStatus.isStale && !error && (
              <div className="p-3 border border-amber-500/50 rounded-md bg-amber-500/10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                      Dados desatualizados ha {dataStatus.timeText.replace(' atras', '')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ultima atualizacao: {lastUpdate?.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Os dados em tempo real estao sendo mostrados da ultima leitura. Verifique a conexao MQTT.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-500">Erro de conexao: {error}</p>
                    <p className="text-xs text-red-400 mt-1">
                      Verifique se o backend esta rodando em http://localhost:3000
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grid de Cards */}
            <div className={`grid gap-3 ${dataStatus.isStale ? 'opacity-60' : ''}`}>
              {/* Tensoes e Correntes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Grandezas Eletricas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Tensoes (V)</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['L1', 'L2', 'L3'] as const).map((fase, i) => (
                        <div key={fase} className="text-center p-2 border rounded-md">
                          <div className="text-lg font-semibold">{dadosM160.voltage[fase].toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">Fase {['A', 'B', 'C'][i]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Correntes (A)</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['L1', 'L2', 'L3'] as const).map((fase, i) => (
                        <div key={fase} className="text-center p-2 border rounded-md">
                          <div className="text-lg font-semibold">{dadosM160.current[fase].toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">Fase {['A', 'B', 'C'][i]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Potencias */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    Potencias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Ativa</div>
                      <div className="text-xl font-semibold">{dadosM160.power.active.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">kW</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Reativa</div>
                      <div className="text-xl font-semibold">{dadosM160.power.reactive.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">kvar</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Aparente</div>
                      <div className="text-xl font-semibold">{dadosM160.power.apparent.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">kva</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Frequencia</div>
                      <div className="text-xl font-semibold">{dadosM160.frequency.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Hz</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Potencia Ativa por Fase (W)</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['L1', 'L2', 'L3'] as const).map((fase, i) => (
                        <div key={fase} className="text-center p-2 bg-muted/50 rounded-md">
                          <div className="text-base font-semibold">{dadosM160.power[fase]?.toFixed(0) || 0}</div>
                          <div className="text-xs text-muted-foreground">Fase {['A', 'B', 'C'][i]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fator de Potencia */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Fator de Potencia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Fase A', value: dadosM160.powerFactor },
                      { label: 'Fase B', value: dadosM160.powerFactorB || 0 },
                      { label: 'Fase C', value: dadosM160.powerFactorC || 0 },
                      { label: 'Total (Pt/St)', value: dadosM160.powerFactorTotal || 0 },
                    ].map((item) => (
                      <div key={item.label} className="text-center space-y-2">
                        <div className="text-2xl font-semibold">{item.value.toFixed(3)}</div>
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                        <Badge
                          variant={Math.abs(item.value) < 0.92 ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {Math.abs(item.value) < 0.92 ? 'Baixo' : 'OK'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {(Math.abs(dadosM160.powerFactor) < 0.92 ||
                    Math.abs(dadosM160.powerFactorB || 0) < 0.92 ||
                    Math.abs(dadosM160.powerFactorC || 0) < 0.92 ||
                    Math.abs(dadosM160.powerFactorTotal || 0) < 0.92) && (
                    <div className="mt-3 p-2 border border-destructive/50 rounded-md bg-destructive/5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-destructive">Fator de potencia abaixo de 0.92</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Risco de cobranca adicional pela concessionaria. Considere correcao com banco de capacitores.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Energia Acumulada */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Energia Acumulada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Importada', value: dadosM160.energy.activeImport, unit: 'kWh' },
                      { label: 'Exportada', value: dadosM160.energy.activeExport, unit: 'kWh' },
                      { label: 'Reativa Ind.', value: dadosM160.energy.reactiveImport, unit: 'kvarh' },
                      { label: 'Reativa Cap.', value: dadosM160.energy.reactiveExport, unit: 'kvarh' },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                        <div className="text-xl font-semibold">{item.value.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{item.unit}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========== ABA: CUSTOS DE ENERGIA ========== */}
          <TabsContent value="custos" className="space-y-2">
            {/* Filtros */}
            <div className="space-y-2 p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Periodo:</span>
                </div>
                <Select value={periodoCustos} onValueChange={(v) => setPeriodoCustos(v as PeriodoTipo)}>
                  <SelectTrigger className="w-[160px] h-7 text-xs">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={5}>
                    <SelectItem value="dia">Dia Atual</SelectItem>
                    <SelectItem value="mes">Mes Atual</SelectItem>
                    <SelectItem value="custom">Periodo Customizado</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={refetchCustos} disabled={custosLoading}>
                  {custosLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Atualizar'}
                </Button>
              </div>

              {periodoCustos === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <DateTimeInput
                    label="Data/Hora Inicio"
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
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Erro */}
            {custosError && !custosLoading && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-500">Erro ao carregar custos: {custosError}</p>
                </div>
              </div>
            )}

            {/* Conteudo de Custos */}
            {custosData && !custosLoading && (
              <div className="space-y-2">
                {/* Info da Unidade */}
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {custosData.unidade.grupo} - {custosData.unidade.subgrupo}
                  </Badge>
                  {isIrrigante && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">Irrigante</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {custosData.tarifa_fonte === 'PERSONALIZADA' ? 'Personalizada' : 'Concessionaria'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{custosData.unidade.nome}</span>
                </div>

                {/* Cards de Custo por Horario */}
                {isGrupoA ? (
                  <div className="grid gap-2">
                    {/* Ponta, Fora Ponta, Reservado */}
                    <div className="grid grid-cols-3 gap-2">
                      <CardCusto
                        tipo="PONTA"
                        energia_kwh={custosData.consumo.energia_ponta_kwh}
                        custo={custosData.custos.custo_ponta}
                        tarifa={custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.tarifa_total || undefined}
                        horario_inicio={custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.horario_inicio || '18:00'}
                        horario_fim={custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.horario_fim || '21:00'}
                      />
                      <CardCusto
                        tipo="FORA_PONTA"
                        energia_kwh={custosData.consumo.energia_fora_ponta_kwh}
                        custo={custosData.custos.custo_fora_ponta}
                        tarifa={custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'FORA_PONTA')?.tarifa_total || undefined}
                      />
                      <CardCusto
                        tipo="RESERVADO"
                        energia_kwh={custosData.consumo.energia_reservado_kwh}
                        custo={custosData.custos.custo_reservado}
                        tarifa={custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'RESERVADO')?.tarifa_total || undefined}
                        observacao="Verde: HR = FP"
                      />
                    </div>

                    {/* Irrigante (se aplicavel) */}
                    {isIrrigante && custosData.irrigante && (
                      <div className="grid grid-cols-2 gap-2">
                        <CardCusto
                          tipo="IRRIGANTE"
                          energia_kwh={custosData.consumo.energia_irrigante_kwh}
                          custo={custosData.custos.custo_irrigante}
                        />
                        <IndicadorIrrigante irrigante={custosData.irrigante} />
                      </div>
                    )}
                  </div>
                ) : (
                  // GRUPO B
                  <div className="grid gap-2">
                    <div className={`grid gap-2 ${isIrrigante && custosData.irrigante && custosData.consumo.energia_irrigante_kwh > 0 ? 'grid-cols-3' : 'grid-cols-1'}`}>
                      <CardCusto
                        tipo="FORA_PONTA"
                        energia_kwh={custosData.consumo.energia_total_kwh - custosData.consumo.energia_irrigante_kwh}
                        custo={custosData.custos.custo_fora_ponta}
                        tarifa={custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'FORA_PONTA')?.tarifa_total || undefined}
                      />
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
                    </div>
                  </div>
                )}

                {/* Tributos + Tarifas + Resumo: 3 colunas */}
                <div className="grid grid-cols-3 gap-2">
                  <CardTributos
                    tributos={{
                      icms: custosData.tributos?.icms || 0,
                      pis: custosData.tributos?.pis || 0,
                      cofins: custosData.tributos?.cofins || 0,
                      perdas: custosData.tributos?.perdas || 0,
                    }}
                    fatorMultiplicador={custosData.tributos?.fator_multiplicador || 1}
                    onSave={handleSaveTributos}
                    saving={configSaving}
                  />
                  <EditorTarifas
                    config={configCusto}
                    tarifasConcessionaria={custosData.tarifas_aplicadas}
                    grupo={custosData.unidade.grupo}
                    tarifaFonte={custosData.tarifa_fonte || 'CONCESSIONARIA'}
                    onSave={handleSaveTarifas}
                    saving={configSaving}
                  />
                  <CardResumoTotal
                    energia_total_kwh={custosData.consumo.energia_total_kwh}
                    custo_total={custosData.custos.custo_total}
                    custo_medio_kwh={custosData.custos.custo_medio_kwh}
                    custo_total_sem_tributos={custosData.custos.custo_total_sem_tributos}
                    fator_tributos={custosData.custos.fator_tributos}
                    demanda_maxima_kw={custosData.consumo.demanda_maxima_kw}
                    demanda_contratada_kw={custosData.consumo.demanda_contratada_kw}
                    perdas_percentual={custosData.tributos?.perdas || 0}
                    fator_perdas={custosData.custos.fator_perdas}
                  />
                </div>
              </div>
            )}

            {/* Estado vazio */}
            {!custosData && !custosLoading && !custosError && (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Selecione um periodo para visualizar os custos</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default M160Modal;
