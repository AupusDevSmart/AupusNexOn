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
import { Input } from "@/components/ui/input";
import {
  Settings,
  TrendingUp,
  TrendingDown,
  Activity,
  Info,
  Save,
  RotateCcw,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import {
  CATEGORIA_FLUXO,
  resolverFluxoEquipamento,
  type FluxoEnergia,
  type FluxoManualSelecao,
} from "../utils/categoria-fluxo";
import { formatApiError } from "@/utils/api-error";

export interface EquipamentoConfig {
  id: string;
  nome: string;
  /** Codigo do tipo_equipamento (legado; mantido pra compat). */
  tipo: string;
  /** Nome da categoria (`tipo_equipamento_rel.categoria.nome`) — fonte de verdade do fluxo. */
  categoria: string;
  fluxoEnergia: FluxoEnergia;
  selecionado: boolean;
  multiplicador: number;
  online: boolean;
}

export interface ConfiguracaoDemanda {
  equipamentos: EquipamentoConfig[];
  /** Decisão do admin pros equipamentos cuja categoria eh AMBIGUA. */
  fluxoManual?: Record<string, FluxoManualSelecao>;
  mostrarDetalhes: boolean;
  intervaloAtualizacao: number;
  aplicarPerdas: boolean;
  fatorPerdas: number;
  demandaContratada?: number;
}

interface ConfiguracaoDemandaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuracao: ConfiguracaoDemanda;
  onSalvar: (config: ConfiguracaoDemanda) => void | Promise<void>;
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
  const [tabAtiva, setTabAtiva] = useState("equipamentos");

  // Mescla equipamentos disponíveis com seleção persistida na configuração.
  useEffect(() => {
    if (equipamentosDisponiveis?.length) {
      const mesclados = equipamentosDisponiveis.map((equip) => {
        const salvo = configuracao.equipamentos?.find((e) => e.id === equip.id);
        return { ...equip, selecionado: salvo?.selecionado ?? equip.selecionado };
      });
      setConfig({ ...configuracao, equipamentos: mesclados });
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

  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (config.equipamentos.filter((e) => e.selecionado).length === 0) {
      toast.error("Selecione pelo menos um equipamento para o agrupamento");
      return;
    }
    // Só confirma sucesso se o onSalvar (persistência na API) resolver. Antes o
    // toast de sucesso disparava sem await, escondendo erros 400 da API.
    setSalvando(true);
    try {
      await onSalvar(config);
      toast.success("Configuração salva com sucesso!");
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSalvando(false);
    }
  };

  const handleResetar = () => {
    setConfig({
      equipamentos: equipamentosDisponiveis,
      fluxoManual: {},
      mostrarDetalhes: true,
      intervaloAtualizacao: 60,
      aplicarPerdas: true,
      fatorPerdas: 3,
    });
  };

  // Resumo do agrupamento — conta cada equipamento selecionado pelo fluxo
  // efetivo (resolvido via categoria + fluxoManual). NEUTRO eh contado a parte
  // pra deixar claro que existem equipamentos selecionados mas que nao somam.
  const resumo = (() => {
    const selecionados = config.equipamentos.filter((e) => e.selecionado);
    const fluxoManual = config.fluxoManual ?? {};
    const contagem = { geracao: 0, consumo: 0, bidirecional: 0, neutro: 0 };
    for (const eq of selecionados) {
      const fluxo = resolverFluxoEquipamento(eq.categoria, eq.id, fluxoManual);
      if (fluxo === 'GERACAO') contagem.geracao++;
      else if (fluxo === 'CONSUMO') contagem.consumo++;
      else if (fluxo === 'BIDIRECIONAL') contagem.bidirecional++;
      else contagem.neutro++;
    }
    return { total: selecionados.length, ...contagem };
  })();

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
          <TabsList className="grid w-full grid-cols-2 gap-1 rounded-[2px] bg-transparent p-0">
            <TabsTrigger value="equipamentos" className="rounded-[2px] data-[state=active]:bg-accent">Equipamentos</TabsTrigger>
            <TabsTrigger value="avancado" className="rounded-[2px] data-[state=active]:bg-accent">Avançado</TabsTrigger>
          </TabsList>

          <TabsContent value="equipamentos" className="space-y-4">
            <div className="rounded-[2px] border p-3 flex flex-wrap gap-2">
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
              {resumo.neutro > 0 && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  {resumo.neutro} Não somam
                </Badge>
              )}
            </div>

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

              <ScrollArea className="h-[300px] rounded-[2px] border">
                <div className="p-4 space-y-2">
                  {config.equipamentos.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Nenhum equipamento disponível</p>
                      <p className="text-sm mt-2">Verifique se há equipamentos com MQTT habilitado na unidade</p>
                    </div>
                  ) : (
                    config.equipamentos.map((equipamento) => {
                      const fluxoPadrao = CATEGORIA_FLUXO[equipamento.categoria] ?? 'NEUTRO';
                      const ehAmbiguo = fluxoPadrao === 'AMBIGUO';
                      const escolhaManual = config.fluxoManual?.[equipamento.id];
                      return (
                        <div
                          key={equipamento.id}
                          className="flex items-center justify-between p-3 rounded-[2px] hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Checkbox
                              checked={equipamento.selecionado}
                              onCheckedChange={() => handleToggleEquipamento(equipamento.id)}
                              disabled={fluxoPadrao === 'NEUTRO'}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">{equipamento.nome}</span>
                                <Badge variant="outline" className="text-xs">{equipamento.categoria || equipamento.tipo || '?'}</Badge>
                                {!equipamento.online && (
                                  <Badge variant="destructive" className="text-xs">Offline</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-xs">
                                {fluxoPadrao === 'GERACAO' && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <TrendingUp className="h-3 w-3" /> Geração (automático)
                                  </span>
                                )}
                                {fluxoPadrao === 'CONSUMO' && (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <TrendingDown className="h-3 w-3" /> Consumo (automático)
                                  </span>
                                )}
                                {fluxoPadrao === 'BIDIRECIONAL' && (
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <Activity className="h-3 w-3" /> Bidirecional
                                  </span>
                                )}
                                {fluxoPadrao === 'NEUTRO' && (
                                  <span className="text-muted-foreground">Não entra no agregado</span>
                                )}
                                {ehAmbiguo && !escolhaManual && (
                                  <span className="text-amber-600">Fluxo não definido — não soma</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {ehAmbiguo && (
                              <Select
                                value={escolhaManual ?? 'IGNORAR'}
                                onValueChange={(v) => {
                                  setConfig(prev => ({
                                    ...prev,
                                    fluxoManual: { ...(prev.fluxoManual ?? {}), [equipamento.id]: v as FluxoManualSelecao },
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-[120px] rounded-[2px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="GERACAO">Geração</SelectItem>
                                  <SelectItem value="CONSUMO">Consumo</SelectItem>
                                  <SelectItem value="BIDIRECIONAL">Bidirecional</SelectItem>
                                  <SelectItem value="IGNORAR">Ignorar</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <span className="text-xs text-muted-foreground">{equipamento.multiplicador}x</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              <div className="rounded-[2px] bg-muted p-3 text-xs space-y-1">
                <p className="font-medium">Como o cálculo funciona:</p>
                <p>Categorias inequívocas (Inversor PV, Motor, etc.) têm fluxo automático.</p>
                <p>Power Meter e Medidor SSU dependem da instalação física — selecione manualmente acima.</p>
                <p>Não selecionados ou marcados como "Ignorar" não entram no agregado.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="avancado" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="demandaContratada">Demanda Contratada (kW)</Label>
                <Input
                  type="number"
                  id="demandaContratada"
                  min={0}
                  step={0.01}
                  value={config.demandaContratada || ''}
                  onChange={(e) =>
                    setConfig(prev => ({
                      ...prev,
                      demandaContratada: parseFloat(e.target.value) || 0
                    }))
                  }
                  placeholder="Ex: 2500"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valor da demanda contratada com a concessionária (usado como linha de referência no gráfico)
                </p>
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
                    <Input
                      type="number"
                      id="perdas"
                      min={0}
                      max={10}
                      step={0.5}
                      value={config.fatorPerdas}
                      onChange={(e) =>
                        setConfig(prev => ({
                          ...prev,
                          fatorPerdas: parseFloat(e.target.value) || 0
                        }))
                      }
                      className="w-24"
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
          <Button onClick={handleSalvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
