import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEquipamentoMqttData } from '@/hooks/useEquipamentoMqttData';
import { useEquipamentoPowerHistory } from '@/hooks/useEquipamentoPowerHistory';
import { useGraficoDia, useGraficoMes, useGraficoAno } from '@/hooks/useInversorGraficos';
import { InversorPowerChart } from './InversorPowerChart';
import { InversorGraficoDia } from './InversorGraficoDia';
import { InversorGraficoMes } from './InversorGraficoMes';
import { InversorGraficoAno } from './InversorGraficoAno';
import { Loader2, Zap, Thermometer, Activity, Shield, Clock, AlertTriangle, TrendingUp, BarChart3, Calendar } from 'lucide-react';

interface InversorMqttDataModalProps {
  equipamentoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper para formatar números com 2 casas decimais
const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '0.00';
  return value.toFixed(2);
};

export function InversorMqttDataModal({ equipamentoId, open, onOpenChange }: InversorMqttDataModalProps) {
  console.log('🔵 ========================================');
  console.log('🔵 INVERSOR MQTT DATA MODAL - RENDERIZANDO');
  console.log('🔵 ========================================');
  console.log('📋 Props recebidas:', { equipamentoId, open, onOpenChange: !!onOpenChange });

  // Limpar espaços em branco do ID
  const cleanId = equipamentoId?.trim() || null;

  const { data, loading, error, lastUpdate } = useEquipamentoMqttData(cleanId);
  const { data: powerHistory, loading: powerLoading } = useEquipamentoPowerHistory(cleanId);

  // Hooks para os 3 gráficos
  const graficoDia = useGraficoDia(cleanId);
  const graficoMes = useGraficoMes(cleanId);
  const graficoAno = useGraficoAno(cleanId);

  console.log('📊 Estado do hook:', {
    hasData: !!data,
    loading,
    error,
    lastUpdate,
    dataEquipamento: data?.equipamento?.nome,
    hasDado: !!data?.dado,
    powerHistoryPoints: powerHistory.length
  });

  if (loading && !data) {
    console.log('⏳ Estado: CARREGANDO (sem dados ainda)');

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-lg">Carregando dados do inversor...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error && !data) {
    console.log('❌ Estado: ERRO (sem dados)');
    console.log('❌ Mensagem de erro:', error);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Erro ao Carregar Dados
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 text-center">
            <p className="text-muted-foreground">{error}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!data || !data.dado) {
    console.log('⚠️ Estado: SEM DADOS MQTT');
    console.log('⚠️ Tem data?', !!data);
    console.log('⚠️ Tem data.dado?', !!data?.dado);
    console.log('⚠️ Mensagem:', data?.message);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {data?.equipamento?.nome || 'Inversor'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 text-center">
            <p className="text-muted-foreground">
              {data?.message || 'Nenhum dado MQTT disponível para este equipamento.'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Verifique se o equipamento está com MQTT habilitado e enviando dados.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  console.log('✅ Estado: DADOS DISPONÍVEIS - Renderizando modal completo');
  console.log('✅ Dados do inversor:', data.dado.dados);

  const inversorData = data.dado.dados;
  const statusColor = inversorData.status?.work_state === 0 ? 'green' : 'yellow';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              {data.equipamento.nome} - Dados em Tempo Real
            </div>
            {lastUpdate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
                <Clock className="h-4 w-4" />
                Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status e Indicadores Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-green-200 dark:border-green-900">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-2">
                  <Activity className={`h-8 w-8 text-${statusColor}-500`} />
                  <Badge variant="outline" className={`text-${statusColor}-600 border-${statusColor}-300`}>
                    {inversorData.status?.work_state_text || 'Desconhecido'}
                  </Badge>
                  <div className="text-sm text-muted-foreground">Status</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 dark:border-orange-900">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-2">
                  <Thermometer className="h-8 w-8 text-orange-500" />
                  <div className="text-3xl font-bold text-orange-600">
                    {formatNumber(inversorData.temperature?.internal)}°C
                  </div>
                  <div className="text-sm text-muted-foreground">Temperatura</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 dark:border-blue-900">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-2">
                  <Zap className="h-8 w-8 text-blue-500" />
                  <div className="text-3xl font-bold text-blue-600">
                    {formatNumber((inversorData.power?.active_total || 0) / 1000)}
                  </div>
                  <div className="text-sm text-muted-foreground">Potência (kW)</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 dark:border-purple-900">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="h-8 w-8 text-purple-500" />
                  <div className="text-3xl font-bold text-purple-600">
                    {formatNumber(inversorData.power?.power_factor)}
                  </div>
                  <div className="text-sm text-muted-foreground">Fator de Potência</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Potência - Últimas 24h */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Potência Ativa - Últimas 24 Horas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {powerLoading && powerHistory.length === 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
                </div>
              ) : (
                <InversorPowerChart data={powerHistory} height={300} />
              )}
            </CardContent>
          </Card>

          {/* Gráficos de Geração - Dia, Mês e Ano */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-yellow-500" />
                Análise de Geração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="dia" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dia" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Dia
                  </TabsTrigger>
                  <TabsTrigger value="mes" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Mês
                  </TabsTrigger>
                  <TabsTrigger value="ano" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Ano
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="dia" className="mt-6">
                  <InversorGraficoDia
                    data={graficoDia.data}
                    loading={graficoDia.loading}
                    height={350}
                  />
                </TabsContent>

                <TabsContent value="mes" className="mt-6">
                  <InversorGraficoMes
                    data={graficoMes.data}
                    loading={graficoMes.loading}
                    height={350}
                  />
                </TabsContent>

                <TabsContent value="ano" className="mt-6">
                  <InversorGraficoAno
                    data={graficoAno.data}
                    loading={graficoAno.loading}
                    height={350}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Energia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Energia e Produção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Geração Diária</div>
                  <div className="text-2xl font-bold text-yellow-600">{formatNumber(inversorData.energy?.daily_yield)} kWh</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Geração Total</div>
                  <div className="text-2xl font-bold text-green-600">{formatNumber(inversorData.energy?.total_yield)} kWh</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Tempo Total Operação</div>
                  <div className="text-2xl font-bold text-blue-600">{formatNumber(inversorData.energy?.total_running_time)} h</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Tempo Operação Hoje</div>
                  <div className="text-2xl font-bold text-purple-600">{formatNumber(inversorData.energy?.daily_running_time)} min</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Potência */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Potência e Frequência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Ativa</div>
                  <div className="text-xl font-bold text-blue-600">{formatNumber(inversorData.power?.active_total)} W</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Reativa</div>
                  <div className="text-xl font-bold text-purple-600">{formatNumber(inversorData.power?.reactive_total)} VAr</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Aparente</div>
                  <div className="text-xl font-bold text-green-600">{formatNumber(inversorData.power?.apparent_total)} VA</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">FP</div>
                  <div className="text-xl font-bold text-orange-600">{formatNumber(inversorData.power?.power_factor)}</div>
                </div>
                <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Frequência</div>
                  <div className="text-xl font-bold text-indigo-600">{formatNumber(inversorData.power?.frequency)} Hz</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tensão e Corrente AC */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tensão AC (Trifásico)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm font-medium">Fase A-B:</span>
                    <span className="text-lg font-bold text-blue-600">{formatNumber(inversorData.voltage?.['phase_a-b'])} V</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm font-medium">Fase B-C:</span>
                    <span className="text-lg font-bold text-green-600">{formatNumber(inversorData.voltage?.['phase_b-c'])} V</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm font-medium">Fase C-A:</span>
                    <span className="text-lg font-bold text-purple-600">{formatNumber(inversorData.voltage?.['phase_c-a'])} V</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Corrente AC (Trifásico)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm font-medium">Fase A:</span>
                    <span className="text-lg font-bold text-blue-600">{formatNumber(inversorData.current?.phase_a)} A</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm font-medium">Fase B:</span>
                    <span className="text-lg font-bold text-green-600">{formatNumber(inversorData.current?.phase_b)} A</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm font-medium">Fase C:</span>
                    <span className="text-lg font-bold text-purple-600">{formatNumber(inversorData.current?.phase_c)} A</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MPPTs - Mostrar apenas os primeiros 12 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                MPPT Trackers (Tensão DC)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {Array.from({ length: 12 }, (_, i) => {
                  const mpptKey = `mppt${i + 1}_voltage` as keyof typeof inversorData.dc;
                  const voltage = inversorData.dc?.[mpptKey];
                  return (
                    <div key={i} className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">MPPT {i + 1}</div>
                      <div className="text-lg font-bold text-yellow-600">{formatNumber(voltage as number)} V</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Strings - Mostrar grid compacto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Corrente das Strings DC
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {Array.from({ length: 24 }, (_, i) => {
                  const stringKey = `string${i + 1}_current` as keyof typeof inversorData.dc;
                  const current = inversorData.dc?.[stringKey];
                  return (
                    <div key={i} className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                      <div className="text-xs text-muted-foreground">S{i + 1}</div>
                      <div className="text-sm font-bold text-blue-600">{formatNumber(current as number)}A</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Potência Total DC</div>
                <div className="text-2xl font-bold text-green-600">{formatNumber(inversorData.dc?.total_power)} W</div>
              </div>
            </CardContent>
          </Card>

          {/* Proteção e Regulação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  Proteção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Resistência de Isolamento:</span>
                    <span className="font-bold text-green-600">{formatNumber(inversorData.protection?.insulation_resistance)} MΩ</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Tensão do Barramento DC:</span>
                    <span className="font-bold text-blue-600">{formatNumber(inversorData.protection?.bus_voltage)} V</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações do PID</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Estado de Trabalho:</span>
                    <Badge variant={inversorData.pid?.work_state === 0 ? 'default' : 'secondary'}>
                      {inversorData.pid?.work_state === 0 ? 'Normal' : `Estado ${inversorData.pid?.work_state || '-'}`}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Código de Alarme:</span>
                    <Badge variant={inversorData.pid?.alarm_code === 0 ? 'default' : 'destructive'}>
                      {inversorData.pid?.alarm_code === 0 ? 'Sem Alarmes' : `Alarme ${inversorData.pid?.alarm_code || '-'}`}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer com timestamp */}
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Dados recebidos via MQTT em {new Date(data.dado.timestamp_dados).toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Fonte: {data.dado.fonte} | Qualidade: {data.dado.qualidade} | Tópico: {data.equipamento.topico_mqtt}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
