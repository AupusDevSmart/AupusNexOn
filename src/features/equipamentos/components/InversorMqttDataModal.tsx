import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEquipamentoMqttData } from '@/hooks/useEquipamentoMqttData';
import { useGraficoDia, useGraficoMes, useGraficoAno } from '@/hooks/useInversorGraficos';
import { InversorGraficoDia } from './InversorGraficoDia';
import { InversorGraficoMes } from './InversorGraficoMes';
import { InversorGraficoAno } from './InversorGraficoAno';
import { Loader2, Zap, Thermometer, Activity, Shield, Clock, AlertTriangle, BarChart3, Calendar, RefreshCw, TrendingUp } from 'lucide-react';
import { formatEnergy, formatPowerGeneric, formatCurrent, formatVoltage, formatResistance, formatTime } from '@/utils/formatEnergy';

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
  // EARLY RETURN: Não renderizar nada se o modal não está aberto ou não há equipamento
  if (!open || !equipamentoId) {
    return null;
  }

  // Limpar espaços em branco do ID
  const cleanId = equipamentoId.trim();

  const { data, loading, error, lastUpdate, refetch } = useEquipamentoMqttData(cleanId);

  // Hooks para os 3 gráficos
  const graficoDia = useGraficoDia(cleanId);
  const graficoMes = useGraficoMes(cleanId);
  const graficoAno = useGraficoAno(cleanId);

  if (loading && !data) {
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

  // Mesmo sem dados MQTT, mostrar os gráficos históricos
  const hasMqttData = data && data.dado;
  const equipmentName = data?.equipamento?.nome || 'Inversor';

  if (!hasMqttData) {
    // Mostrar modal com gráficos mesmo sem dados MQTT
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {equipmentName} - Análise Histórica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Aviso sobre dados MQTT */}
            <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-950/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      Dados MQTT em tempo real não disponíveis
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                      {data?.message || 'O equipamento não está enviando dados via MQTT no momento.'}
                    </p>
                  </div>
                </div>
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
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const inversorData = data.dado.dados;
  const statusColor = inversorData.status?.work_state === 0 ? 'green' : 'yellow';

  // Verificar se os dados estão desatualizados
  const dataTimestamp = new Date(data.dado.timestamp_dados);
  const agora = new Date();
  const diferencaMinutos = (agora.getTime() - dataTimestamp.getTime()) / (1000 * 60);
  const isDataStale = diferencaMinutos > 5; // Dados com mais de 5 minutos são considerados desatualizados
  const isDataVeryStale = diferencaMinutos > 60; // Dados com mais de 1 hora são muito desatualizados

  // Formatar tempo decorrido
  const getTempoDecorrido = () => {
    if (diferencaMinutos < 1) return 'menos de 1 minuto';
    if (diferencaMinutos < 60) return `${Math.floor(diferencaMinutos)} minutos`;
    const horas = Math.floor(diferencaMinutos / 60);
    if (horas < 24) return `${horas} hora${horas > 1 ? 's' : ''}`;
    const dias = Math.floor(horas / 24);
    return `${dias} dia${dias > 1 ? 's' : ''}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              {data.equipamento.nome} - Dados em Tempo Real
            </div>
            <div className="flex items-center gap-3">
              {lastUpdate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
                  <Clock className="h-4 w-4" />
                  Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={refetch} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Atualizar</span>
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Aviso de Dados Desatualizados */}
          {isDataStale && (
            <Card className={`${isDataVeryStale ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30' : 'border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-950/30'}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${isDataVeryStale ? 'text-red-600' : 'text-yellow-600'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDataVeryStale ? 'text-red-900 dark:text-red-100' : 'text-yellow-900 dark:text-yellow-100'}`}>
                      {isDataVeryStale ? 'Dados MQTT muito desatualizados' : 'Dados MQTT desatualizados'}
                    </p>
                    <p className={`text-sm mt-1 ${isDataVeryStale ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                      O último dado foi recebido há {getTempoDecorrido()} ({dataTimestamp.toLocaleString('pt-BR')}).
                      O equipamento pode não estar enviando dados via MQTT no momento.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status e Indicadores Principais - Design Minimalista */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                  <Badge variant={inversorData.status?.work_state === 0 ? 'default' : 'secondary'}>
                    {inversorData.status?.work_state_text || 'Desconhecido'}
                  </Badge>
                  <div className="text-xs text-muted-foreground">Status</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-2">
                  <Thermometer className="h-6 w-6 text-muted-foreground" />
                  <div className="text-2xl font-semibold">
                    {formatNumber(inversorData.temperature?.internal)}°C
                  </div>
                  <div className="text-xs text-muted-foreground">Temperatura</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-2">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                  <div className="text-2xl font-semibold">
                    {formatPowerGeneric(inversorData.power?.active_total || 0, 'W')}
                  </div>
                  <div className="text-xs text-muted-foreground">Potência</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                  <div className="text-2xl font-semibold">
                    {formatNumber(inversorData.power?.power_factor)}
                  </div>
                  <div className="text-xs text-muted-foreground">Fator de Potência</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos de Geração - Dia, Mês e Ano */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Análise de Geração</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="dia" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dia">Dia</TabsTrigger>
                  <TabsTrigger value="mes">Mês</TabsTrigger>
                  <TabsTrigger value="ano">Ano</TabsTrigger>
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

          {/* Energia - Design Minimalista */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Energia e Produção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Geração Diária</div>
                  <div className="text-xl font-semibold">{formatEnergy(inversorData.energy?.daily_yield || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Geração Total</div>
                  <div className="text-xl font-semibold">{formatEnergy(inversorData.energy?.total_yield || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Tempo Total Operação</div>
                  <div className="text-xl font-semibold">{formatTime(inversorData.energy?.total_running_time || 0, 'h')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Tempo Operação Hoje</div>
                  <div className="text-xl font-semibold">{formatTime(inversorData.energy?.daily_running_time || 0, 'min')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Potência - Design Minimalista */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Potência e Frequência</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Ativa</div>
                  <div className="text-lg font-semibold">{formatPowerGeneric(inversorData.power?.active_total || 0, 'W')}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Reativa</div>
                  <div className="text-lg font-semibold">{formatPowerGeneric(inversorData.power?.reactive_total || 0, 'VAr')}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Aparente</div>
                  <div className="text-lg font-semibold">{formatPowerGeneric(inversorData.power?.apparent_total || 0, 'VA')}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">FP</div>
                  <div className="text-lg font-semibold">{formatNumber(inversorData.power?.power_factor)}</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Frequência</div>
                  <div className="text-lg font-semibold">{formatNumber(inversorData.power?.frequency)} Hz</div>
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
                    <span className="text-sm">Fase A-B:</span>
                    <span className="text-sm font-semibold">{formatVoltage(inversorData.voltage?.['phase_a-b'] || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Fase B-C:</span>
                    <span className="text-sm font-semibold">{formatVoltage(inversorData.voltage?.['phase_b-c'] || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Fase C-A:</span>
                    <span className="text-sm font-semibold">{formatVoltage(inversorData.voltage?.['phase_c-a'] || 0)}</span>
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
                    <span className="text-sm">Fase A:</span>
                    <span className="text-sm font-semibold">{formatCurrent(inversorData.current?.phase_a || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Fase B:</span>
                    <span className="text-sm font-semibold">{formatCurrent(inversorData.current?.phase_b || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Fase C:</span>
                    <span className="text-sm font-semibold">{formatCurrent(inversorData.current?.phase_c || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MPPTs - Design Minimalista */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">MPPT Trackers (Tensão DC)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {Array.from({ length: 12 }, (_, i) => {
                  const mpptKey = `mppt${i + 1}_voltage` as keyof typeof inversorData.dc;
                  const voltage = inversorData.dc?.[mpptKey];
                  return (
                    <div key={i} className="text-center p-2 border rounded">
                      <div className="text-xs text-muted-foreground">MPPT {i + 1}</div>
                      <div className="text-sm font-semibold mt-1">{formatVoltage(voltage as number || 0)}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Strings - Design Minimalista */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Corrente das Strings DC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
                {Array.from({ length: 24 }, (_, i) => {
                  const stringKey = `string${i + 1}_current` as keyof typeof inversorData.dc;
                  const current = inversorData.dc?.[stringKey];
                  return (
                    <div key={i} className="text-center p-1 border rounded text-xs">
                      <div className="text-muted-foreground" style={{fontSize: '10px'}}>S{i + 1}</div>
                      <div className="font-semibold">{formatCurrent(current as number || 0)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Potência Total DC</span>
                  <span className="text-xl font-semibold">{formatPowerGeneric(inversorData.dc?.total_power || 0, 'W')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proteção e Regulação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Proteção</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Resistência de Isolamento:</span>
                    <span className="text-sm font-semibold">{formatResistance((inversorData.protection?.insulation_resistance || 0) * 1_000_000)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">Tensão do Barramento DC:</span>
                    <span className="text-sm font-semibold">{formatVoltage(inversorData.protection?.bus_voltage || 0)}</span>
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
