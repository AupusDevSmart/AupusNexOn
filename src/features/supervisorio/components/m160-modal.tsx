import { useState, useMemo } from 'react';
import type { M160Reading } from '@/components/equipment/M160/M160.types';
import M160Multimeter from '@/components/equipment/M160/M160Multimeter';
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
import { Gauge, WifiOff, Loader2, DollarSign, Activity, Calendar, RefreshCw, Zap } from 'lucide-react';
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

  // ============================================
  // DETECÇÃO DE DADOS DESATUALIZADOS
  // ============================================
  const dataStatus = useMemo(() => {
    if (!lastUpdate) return { isConnected: false, isStale: false, minutesAgo: 0, hoursAgo: 0, timeText: '' };

    const now = Date.now();
    const dataAge = now - lastUpdate.getTime();
    const minutesAgo = Math.floor(dataAge / 60000);
    const hoursAgo = Math.floor(minutesAgo / 60);

    // Considera desatualizado se > 5 minutos
    const isStale = minutesAgo > 5;
    const isConnected = !isStale && !loading;

    // Formatar texto do tempo: mostrar em horas se >= 60 minutos
    let timeText = '';
    if (minutesAgo < 60) {
      timeText = `${minutesAgo}min atrás`;
    } else if (hoursAgo === 1) {
      timeText = `1h atrás`;
    } else if (hoursAgo < 24) {
      const remainingMinutes = minutesAgo % 60;
      timeText = remainingMinutes > 0 ? `${hoursAgo}h${remainingMinutes}min atrás` : `${hoursAgo}h atrás`;
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      timeText = daysAgo === 1 ? `1 dia atrás` : `${daysAgo} dias atrás`;
    }

    return { isConnected, isStale, minutesAgo, hoursAgo, timeText };
  }, [lastUpdate, loading]);

  const isConnected = dataStatus.isConnected;

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

    // ✅ CORREÇÃO CRÍTICA: M160 fornece Pt (ativa), Qt (reativa) e St (aparente) diretamente!
    // Não precisa calcular - usar os valores totais que já vêm no JSON
    const Pa = d.Pa || 0;
    const Pb = d.Pb || 0;
    const Pc = d.Pc || 0;

    // Potências TOTAIS do M160 (já agregadas)
    const potenciaAtivaW = d.Pt || 0;        // Pt = Potência ativa total (W)
    const potenciaReativaVAr = d.Qt || 0;    // Qt = Potência reativa total (VAr)
    const potenciaAparenteVA = d.St || 0;    // St = Potência aparente total (VA)

    // Converter para kW, kvar, kva
    const potenciaAtivaKw = potenciaAtivaW / 1000;
    const potenciaReativaKvar = potenciaReativaVAr / 1000;
    const potenciaAparenteKva = potenciaAparenteVA / 1000;

    // ✅ Calcular Fator de Potência Total (Pt/St)
    const fatorPotenciaTotal = potenciaAparenteVA > 0 ? potenciaAtivaW / potenciaAparenteVA : 0;

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
        active: potenciaAtivaKw, // kW (Pt convertido)
        reactive: potenciaReativaKvar, // kvar (Qt convertido)
        apparent: potenciaAparenteKva, // kva (St convertido)
        import: potenciaAtivaKw >= 0 ? potenciaAtivaKw : 0, // kW (consumo)
        export: potenciaAtivaKw < 0 ? Math.abs(potenciaAtivaKw) : 0, // kW (geração)
        L1: Pa, // Potência fase A (W)
        L2: Pb, // Potência fase B (W)
        L3: Pc, // Potência fase C (W)
      },
      frequency: d.freq || 60.0, // ✅ CORRIGIDO: Usar frequência real do payload
      powerFactor: d.FPA || 0,
      powerFactorB: d.FPB || 0,
      powerFactorC: d.FPC || 0,
      powerFactorTotal: fatorPotenciaTotal, // ✅ FP Total = Pt/St
      thd: {
        voltage: 0, // THD não disponível no M160
        current: 0  // THD não disponível no M160
      },
      energy: {
        activeImport: d.phf || mqttData.payload.energia_kwh || 0, // ✅ PHF ou energia_kwh
        activeExport: d.phr || 0, // ✅ Energia ativa exportada
        reactiveImport: d.qhfi || 0, // ✅ Energia reativa indutiva
        reactiveExport: d.qhfr || 0, // ✅ Energia reativa capacitiva
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
            {/* Indicador de Status de Conexão com Detecção de Dados Desatualizados */}
            {dataStatus.isStale ? (
              <Badge variant="destructive" className="text-[10px] px-2 py-0">
                ⚠️ Desatualizado ({dataStatus.timeText})
              </Badge>
            ) : isConnected ? (
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
                    • Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
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

            {/* Alerta de Dados Desatualizados */}
            {dataStatus.isStale && !error && (
              <div className="p-3 border border-amber-500/50 rounded-md bg-amber-500/10">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                  ⚠️ Dados desatualizados há {dataStatus.timeText.replace(' atrás', '')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Última atualização: {lastUpdate?.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Os dados em tempo real estão sendo mostrados da última leitura. Verifique a conexão MQTT.
                </p>
              </div>
            )}

            {/* Mostrar erro se houver */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-md p-3">
                <p className="text-sm text-red-500">⚠️ Erro de conexão: {error}</p>
                <p className="text-xs text-red-400 mt-1">
                  Verifique se o backend está rodando em http://localhost:3000
                </p>
              </div>
            )}

            {/* Grid de Cards com Dados - Minimalista */}
            <div className={`grid gap-3 ${dataStatus.isStale ? 'opacity-60' : ''}`}>
              {/* Card: Tensões e Correntes Trifásicas */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Grandezas Elétricas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tensões */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Tensões (V)</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 border rounded-md">
                        <div className="text-lg font-semibold">{dadosM160.voltage.L1.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Fase A</div>
                      </div>
                      <div className="text-center p-2 border rounded-md">
                        <div className="text-lg font-semibold">{dadosM160.voltage.L2.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Fase B</div>
                      </div>
                      <div className="text-center p-2 border rounded-md">
                        <div className="text-lg font-semibold">{dadosM160.voltage.L3.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Fase C</div>
                      </div>
                    </div>
                  </div>

                  {/* Correntes */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Correntes (A)</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 border rounded-md">
                        <div className="text-lg font-semibold">{dadosM160.current.L1.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Fase A</div>
                      </div>
                      <div className="text-center p-2 border rounded-md">
                        <div className="text-lg font-semibold">{dadosM160.current.L2.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Fase B</div>
                      </div>
                      <div className="text-center p-2 border rounded-md">
                        <div className="text-lg font-semibold">{dadosM160.current.L3.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Fase C</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card: Potências */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    Potências
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
                      <div className="text-xs text-muted-foreground">Frequência</div>
                      <div className="text-xl font-semibold">{dadosM160.frequency.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Hz</div>
                    </div>
                  </div>

                  {/* Potências por Fase */}
                  <div className="pt-3 border-t space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Potência Ativa por Fase (W)</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-muted/50 rounded-md">
                        <div className="text-base font-semibold">{dadosM160.power.L1?.toFixed(0) || 0}</div>
                        <div className="text-xs text-muted-foreground">Fase A</div>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded-md">
                        <div className="text-base font-semibold">{dadosM160.power.L2?.toFixed(0) || 0}</div>
                        <div className="text-xs text-muted-foreground">Fase B</div>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded-md">
                        <div className="text-base font-semibold">{dadosM160.power.L3?.toFixed(0) || 0}</div>
                        <div className="text-xs text-muted-foreground">Fase C</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card: Fatores de Potência */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Fator de Potência
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center space-y-2">
                      <div className="text-2xl font-semibold">{dadosM160.powerFactor.toFixed(3)}</div>
                      <div className="text-xs text-muted-foreground">Fase A</div>
                      <Badge variant={dadosM160.powerFactor < 0.92 ? 'destructive' : 'outline'} className="text-xs">
                        {dadosM160.powerFactor < 0.92 ? 'Baixo' : 'OK'}
                      </Badge>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl font-semibold">{dadosM160.powerFactorB?.toFixed(3) || '0.000'}</div>
                      <div className="text-xs text-muted-foreground">Fase B</div>
                      <Badge
                        variant={(dadosM160.powerFactorB || 0) < 0.92 ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {(dadosM160.powerFactorB || 0) < 0.92 ? 'Baixo' : 'OK'}
                      </Badge>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl font-semibold">{dadosM160.powerFactorC?.toFixed(3) || '0.000'}</div>
                      <div className="text-xs text-muted-foreground">Fase C</div>
                      <Badge
                        variant={(dadosM160.powerFactorC || 0) < 0.92 ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {(dadosM160.powerFactorC || 0) < 0.92 ? 'Baixo' : 'OK'}
                      </Badge>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl font-semibold">{dadosM160.powerFactorTotal?.toFixed(3) || '0.000'}</div>
                      <div className="text-xs text-muted-foreground">Total (Pt/St)</div>
                      <Badge
                        variant={(dadosM160.powerFactorTotal || 0) < 0.92 ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {(dadosM160.powerFactorTotal || 0) < 0.92 ? 'Baixo' : 'OK'}
                      </Badge>
                    </div>
                  </div>

                  {/* Alerta de FP Baixo - Minimalista */}
                  {(dadosM160.powerFactor < 0.92 ||
                    (dadosM160.powerFactorB || 0) < 0.92 ||
                    (dadosM160.powerFactorC || 0) < 0.92 ||
                    (dadosM160.powerFactorTotal || 0) < 0.92) && (
                    <div className="mt-3 p-2 border border-destructive/50 rounded-md bg-destructive/5">
                      <p className="text-xs font-medium">⚠️ FP abaixo de 0.92</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Risco de multa. Considere correção com capacitores.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card: Energia Acumulada */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Energia Acumulada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Importada</div>
                      <div className="text-xl font-semibold">{dadosM160.energy.activeImport.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">kWh</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Exportada</div>
                      <div className="text-xl font-semibold">{dadosM160.energy.activeExport.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">kWh</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Reativa Ind.</div>
                      <div className="text-xl font-semibold">{dadosM160.energy.reactiveImport.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">kvarh</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Reativa Cap.</div>
                      <div className="text-xl font-semibold">{dadosM160.energy.reactiveExport.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">kvarh</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
