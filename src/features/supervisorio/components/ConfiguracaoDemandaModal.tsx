import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Info,
  Save,
  RotateCcw
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export interface EquipamentoConfig {
  id: string;
  nome: string;
  tipo: 'INVERSOR' | 'A966' | 'M160' | 'M300' | 'MOTOR' | 'CARGA';
  fluxoEnergia: 'GERACAO' | 'CONSUMO' | 'BIDIRECIONAL';
  selecionado: boolean;
  multiplicador: number; // Para ajustes de calibração
  online: boolean;
}

export interface ConfiguracaoDemanda {
  fonte: 'A966' | 'AGRUPAMENTO' | 'AUTO';
  equipamentos: EquipamentoConfig[];
  mostrarDetalhes: boolean;
  intervaloAtualizacao: number; // segundos
  aplicarPerdas: boolean;
  fatorPerdas: number; // percentual
}

interface ConfiguracaoDemandaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuracao: ConfiguracaoDemanda;
  onSalvar: (config: ConfiguracaoDemanda) => void;
  equipamentosDisponiveis: EquipamentoConfig[];
}

export function ConfiguracaoDemandaModal({
  open,
  onOpenChange,
  configuracao,
  onSalvar,
  equipamentosDisponiveis,
}: ConfiguracaoDemandaModalProps) {
  const [config, setConfig] = useState<ConfiguracaoDemanda>(configuracao);
  const [tabAtiva, setTabAtiva] = useState("fonte");

  // Debug log
  useEffect(() => {
    // console.log('🎯 Modal ConfiguracaoDemanda:');
    // console.log('  - open:', open);
    // console.log('  - equipamentosDisponiveis:', equipamentosDisponiveis);
    // console.log('  - equipamentosDisponiveis length:', equipamentosDisponiveis?.length);
    // console.log('  - configuracao.equipamentos:', configuracao.equipamentos);
    // console.log('  - config.equipamentos:', config.equipamentos);
  }, [open, equipamentosDisponiveis]);

  useEffect(() => {
    // Quando a configuração mudar, mesclar com equipamentos disponíveis
    if (equipamentosDisponiveis && equipamentosDisponiveis.length > 0) {
      const equipamentosComSelecao = equipamentosDisponiveis.map(equip => {
        // Verificar se este equipamento está na configuração salva
        const equipSalvo = configuracao.equipamentos?.find(e => e.id === equip.id);
        return {
          ...equip,
          selecionado: equipSalvo ? equipSalvo.selecionado : equip.selecionado
        };
      });

      setConfig({
        ...configuracao,
        equipamentos: equipamentosComSelecao
      });
    } else {
      setConfig(configuracao);
    }
  }, [configuracao, equipamentosDisponiveis]);

  const handleToggleEquipamento = (id: string) => {
    setConfig(prev => ({
      ...prev,
      equipamentos: prev.equipamentos.map(eq =>
        eq.id === id ? { ...eq, selecionado: !eq.selecionado } : eq
      )
    }));
  };

  const handleSalvar = () => {
    // Validações
    if (config.fonte === 'AGRUPAMENTO') {
      const selecionados = config.equipamentos.filter(e => e.selecionado);
      if (selecionados.length === 0) {
        toast.error("Selecione pelo menos um equipamento para o agrupamento");
        return;
      }
    }

    onSalvar(config);
    toast.success("Configuração salva com sucesso!");
    onOpenChange(false);
  };

  const handleResetar = () => {
    setConfig({
      fonte: 'AUTO',
      equipamentos: equipamentosDisponiveis,
      mostrarDetalhes: true,
      intervaloAtualizacao: 60,
      aplicarPerdas: true,
      fatorPerdas: 3, // 3% de perdas
    });
  };

  // Calcular resumo
  const calcularResumo = () => {
    const selecionados = config.equipamentos.filter(e => e.selecionado);
    const geracao = selecionados
      .filter(e => e.fluxoEnergia === 'GERACAO')
      .length;
    const consumo = selecionados
      .filter(e => e.fluxoEnergia === 'CONSUMO')
      .length;
    const bidirecional = selecionados
      .filter(e => e.fluxoEnergia === 'BIDIRECIONAL')
      .length;

    return { total: selecionados.length, geracao, consumo, bidirecional };
  };

  const resumo = calcularResumo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração da Demanda
          </DialogTitle>
          <DialogDescription>
            Configure a fonte de dados e os equipamentos para cálculo da demanda total
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fonte">Fonte de Dados</TabsTrigger>
            <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
            <TabsTrigger value="avancado">Avançado</TabsTrigger>
          </TabsList>

          <TabsContent value="fonte" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="fonte">Fonte Principal</Label>
                <Select
                  value={config.fonte}
                  onValueChange={(value: any) =>
                    setConfig(prev => ({ ...prev, fonte: value }))
                  }
                >
                  <SelectTrigger id="fonte">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Automático (Melhor Disponível)
                      </div>
                    </SelectItem>
                    <SelectItem value="A966">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-500" />
                        A966 - Medidor Principal
                      </div>
                    </SelectItem>
                    <SelectItem value="AGRUPAMENTO">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-blue-500" />
                        Agrupamento Personalizado
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">Como funciona:</p>
                    <ul className="mt-1 space-y-1 list-disc list-inside">
                      <li><strong>Automático:</strong> Usa A966 se disponível, senão agrupa inversores</li>
                      <li><strong>A966:</strong> Medição mais precisa no ponto de conexão com a rede</li>
                      <li><strong>Agrupamento:</strong> Soma personalizada de equipamentos selecionados</li>
                    </ul>
                  </div>
                </div>
              </div>

              {config.fonte === 'AGRUPAMENTO' && (
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-2">Resumo do Agrupamento:</p>
                  <div className="flex gap-4">
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      {resumo.geracao} Geração
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      {resumo.consumo} Consumo
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Activity className="h-3 w-3 text-blue-500" />
                      {resumo.bidirecional} Bidirecional
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="equipamentos" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Equipamentos Disponíveis</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        equipamentos: prev.equipamentos.map(e => ({ ...e, selecionado: true }))
                      }));
                    }}
                  >
                    Selecionar Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        equipamentos: prev.equipamentos.map(e => ({ ...e, selecionado: false }))
                      }));
                    }}
                  >
                    Limpar Seleção
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[300px] rounded-lg border">
                <div className="p-4 space-y-2">
                  {config.equipamentos.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Nenhum equipamento disponível</p>
                      <p className="text-sm mt-2">Verifique se há equipamentos com MQTT habilitado na unidade</p>
                    </div>
                  ) : (
                    config.equipamentos.map((equipamento) => (
                    <div
                      key={equipamento.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={equipamento.selecionado}
                          onCheckedChange={() => handleToggleEquipamento(equipamento.id)}
                          disabled={config.fonte !== 'AGRUPAMENTO'}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{equipamento.nome}</span>
                            <Badge variant="outline" className="text-xs">
                              {equipamento.tipo}
                            </Badge>
                            {!equipamento.online && (
                              <Badge variant="destructive" className="text-xs">
                                Offline
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {equipamento.fluxoEnergia === 'GERACAO' && (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <TrendingUp className="h-3 w-3" />
                                Geração
                              </span>
                            )}
                            {equipamento.fluxoEnergia === 'CONSUMO' && (
                              <span className="flex items-center gap-1 text-xs text-red-600">
                                <TrendingDown className="h-3 w-3" />
                                Consumo
                              </span>
                            )}
                            {equipamento.fluxoEnergia === 'BIDIRECIONAL' && (
                              <span className="flex items-center gap-1 text-xs text-blue-600">
                                <Activity className="h-3 w-3" />
                                Bidirecional
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Multiplicador: {equipamento.multiplicador}x
                      </div>
                    </div>
                  )))}
                </div>
              </ScrollArea>

              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium">Fórmula de Cálculo:</p>
                <code className="text-xs">
                  Demanda = Σ(Geração × Multiplicador) - Σ(Consumo × Multiplicador)
                </code>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="avancado" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="intervalo">Intervalo de Atualização</Label>
                <Select
                  value={config.intervaloAtualizacao.toString()}
                  onValueChange={(value) =>
                    setConfig(prev => ({ ...prev, intervaloAtualizacao: parseInt(value) }))
                  }
                >
                  <SelectTrigger id="intervalo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 segundos</SelectItem>
                    <SelectItem value="60">1 minuto</SelectItem>
                    <SelectItem value="300">5 minutos</SelectItem>
                    <SelectItem value="900">15 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={config.aplicarPerdas}
                    onCheckedChange={(checked) =>
                      setConfig(prev => ({ ...prev, aplicarPerdas: !!checked }))
                    }
                  />
                  <Label>Aplicar fator de perdas do sistema</Label>
                </div>
                {config.aplicarPerdas && (
                  <div className="ml-6">
                    <Label htmlFor="perdas">Percentual de Perdas (%)</Label>
                    <input
                      type="number"
                      id="perdas"
                      min="0"
                      max="10"
                      step="0.5"
                      value={config.fatorPerdas}
                      onChange={(e) =>
                        setConfig(prev => ({
                          ...prev,
                          fatorPerdas: parseFloat(e.target.value) || 0
                        }))
                      }
                      className="w-24 px-3 py-1 text-sm border rounded-md"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={config.mostrarDetalhes}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, mostrarDetalhes: !!checked }))
                  }
                />
                <Label>Mostrar detalhes no gráfico</Label>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">Sobre as perdas:</p>
                    <ul className="mt-1 space-y-1 list-disc list-inside">
                      <li>Perdas típicas em cabos: 1-2%</li>
                      <li>Perdas em transformadores: 1-2%</li>
                      <li>Consumo auxiliar: 0.5-1%</li>
                      <li>Total recomendado: 2.5-5%</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleResetar}
            className="mr-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
