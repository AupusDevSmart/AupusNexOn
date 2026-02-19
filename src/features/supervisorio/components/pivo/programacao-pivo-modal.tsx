// src/features/supervisorio/components/pivo/programacao-pivo-modal.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  CloudRain,
  Settings,
  Droplets,
  RotateCw,
  Clock,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";

// Interface para dados de programação
export interface ProgramacaoPivo {
  // 1. Operadores e Acessos
  operadores: string[]; // IDs dos usuários

  // 2. Meteorologia
  meteo_temp_c: number; // Temperatura ambiente (°C)
  meteo_ur_pct: number; // Umidade relativa (%)
  chuva_cutoff_mm: number; // Limite de chuva para desligar (mm)
  chuva_janela_h: 1 | 6 | 24; // Janela de acumulação (horas)

  // 3. Programa de Irrigação
  programa_lamina_mm: number; // Lâmina (mm)
  programa_giro_graus: number; // Giro (graus)
  programa_sentido: "HORARIO" | "ANTIHORARIO"; // Sentido de deslocamento

  // Bloqueio de Ponta
  bloqueio_ponta: boolean; // Bloquear durante horário de ponta?
  ponta_inicio?: string; // HH:MM
  ponta_fim?: string; // HH:MM
}

// Mock de usuários disponíveis (você vai substituir pela sua API)
const USUARIOS_DISPONIVEIS = [
  { id: "1", nome: "João Silva", tipo: "operador" },
  { id: "2", nome: "Maria Santos", tipo: "operador" },
  { id: "3", nome: "Pedro Costa", tipo: "admin" },
  { id: "4", nome: "Ana Oliveira", tipo: "operador" },
];

interface ProgramacaoPivoModalProps {
  open: boolean;
  onClose: () => void;
  programacao?: ProgramacaoPivo;
  onSalvar: (programacao: ProgramacaoPivo) => void;
  nomeComponente: string;
  isAdmin?: boolean; // Se true, pode editar tudo; se false, só visualiza
}

export function ProgramacaoPivoModal({
  open,
  onClose,
  programacao,
  onSalvar,
  nomeComponente,
  isAdmin = true,
}: ProgramacaoPivoModalProps) {
  // Estado inicial do formulário
  const [formData, setFormData] = useState<ProgramacaoPivo>(
    programacao || {
      operadores: [],
      meteo_temp_c: 25,
      meteo_ur_pct: 60,
      chuva_cutoff_mm: 5,
      chuva_janela_h: 24,
      programa_lamina_mm: 10,
      programa_giro_graus: 360,
      programa_sentido: "HORARIO",
      bloqueio_ponta: false,
      ponta_inicio: "18:00",
      ponta_fim: "21:00",
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Atualizar formData quando programacao mudar (carregado do localStorage)
  useEffect(() => {
    if (programacao) {
      setFormData(programacao);
    }
  }, [programacao]);

  // Validações
  const validar = (): boolean => {
    const novosErros: Record<string, string> = {};

    // Operadores
    if (formData.operadores.length < 1) {
      novosErros.operadores = "Selecione pelo menos 1 operador";
    }
    if (formData.operadores.length > 4) {
      novosErros.operadores = "Máximo de 4 operadores";
    }

    // Temperatura
    if (formData.meteo_temp_c < -10 || formData.meteo_temp_c > 60) {
      novosErros.meteo_temp_c = "Temperatura deve estar entre -10°C e 60°C";
    }

    // Umidade
    if (formData.meteo_ur_pct < 0 || formData.meteo_ur_pct > 100) {
      novosErros.meteo_ur_pct = "Umidade deve estar entre 0% e 100%";
    }

    // Lâmina
    if (formData.programa_lamina_mm <= 0 || formData.programa_lamina_mm > 50) {
      novosErros.programa_lamina_mm = "Lâmina deve estar entre 0.5mm e 50mm";
    }

    // Giro
    if (formData.programa_giro_graus < 1 || formData.programa_giro_graus > 360) {
      novosErros.programa_giro_graus = "Giro deve estar entre 1° e 360°";
    }

    // Bloqueio de ponta
    if (formData.bloqueio_ponta) {
      if (!formData.ponta_inicio || !formData.ponta_fim) {
        novosErros.ponta = "Defina os horários de ponta";
      } else if (formData.ponta_inicio === formData.ponta_fim) {
        novosErros.ponta = "Horários de início e fim não podem ser iguais";
      }
    }

    setErrors(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleSalvar = () => {
    if (validar()) {
      onSalvar(formData);
      onClose();
    }
  };

  // Preparar opções para o MultiSelect
  const operadoresOptions = USUARIOS_DISPONIVEIS.map((usuario) => ({
    label: `${usuario.nome} (${usuario.tipo})`,
    value: usuario.id,
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <span>Programação do Pivô</span>
              <span className="text-sm font-normal text-muted-foreground">
                {nomeComponente}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Alerta se não for admin */}
        {!isAdmin && (
          <Alert>
            <AlertDescription>
              Você está visualizando as configurações. Apenas administradores podem editar.
            </AlertDescription>
          </Alert>
        )}

        {/* Conteúdo */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUNA 1 - Operadores e Bloqueio de Ponta */}
          <div className="space-y-6">
            {/* SEÇÃO 1 - Operadores e Acessos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-primary" />
                  Operadores e Acessos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="operadores" className="text-sm mb-2 block">
                    Operadores Autorizados (min: 1 / max: 4)
                  </Label>
                  <MultiSelect
                    options={operadoresOptions}
                    selected={formData.operadores}
                    onChange={(selected) => setFormData({ ...formData, operadores: selected })}
                    placeholder="Selecione os operadores..."
                    maxCount={4}
                    disabled={!isAdmin}
                  />
                  {errors.operadores && (
                    <p className="text-xs text-red-500 mt-2">{errors.operadores}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {formData.operadores.length} / 4 selecionados
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO 4 - Bloqueio de Ponta */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-5 w-5 text-primary" />
                  Bloqueio de Ponta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Switch para ativar/desativar */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 dark:bg-white/5 border-2 border-border dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted dark:bg-white/10">
                      <Clock className="h-5 w-5 text-muted-foreground dark:text-white/70" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground dark:text-white">Ativar Bloqueio</p>
                      <p className="text-xs text-muted-foreground dark:text-white/60">
                        Horário de ponta
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.bloqueio_ponta}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, bloqueio_ponta: checked })
                    }
                    disabled={!isAdmin}
                  />
                </div>

                {/* Horários (só aparecem se bloqueio ativado) */}
                {formData.bloqueio_ponta && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="ponta-inicio" className="text-sm">
                        Início do Horário de Ponta
                      </Label>
                      <Input
                        id="ponta-inicio"
                        type="time"
                        value={formData.ponta_inicio}
                        onChange={(e) =>
                          setFormData({ ...formData, ponta_inicio: e.target.value })
                        }
                        disabled={!isAdmin}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="ponta-fim" className="text-sm">
                        Fim do Horário de Ponta
                      </Label>
                      <Input
                        id="ponta-fim"
                        type="time"
                        value={formData.ponta_fim}
                        onChange={(e) =>
                          setFormData({ ...formData, ponta_fim: e.target.value })
                        }
                        disabled={!isAdmin}
                        className="mt-1"
                      />
                    </div>

                    {errors.ponta && (
                      <p className="text-xs text-red-500">{errors.ponta}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* COLUNA 2 - Programa de Irrigação */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Droplets className="h-5 w-5 text-primary" />
                  Programa de Irrigação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Lâmina */}
                <div>
                  <Label htmlFor="lamina" className="text-sm">
                    Lâmina (mm)
                  </Label>
                  <Input
                    id="lamina"
                    type="number"
                    value={formData.programa_lamina_mm}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        programa_lamina_mm: parseFloat(e.target.value),
                      })
                    }
                    disabled={!isAdmin}
                    min={0.5}
                    max={50}
                    step={0.1}
                    className="mt-1"
                  />
                  {errors.programa_lamina_mm && (
                    <p className="text-xs text-red-500 mt-1">{errors.programa_lamina_mm}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Válido: 0.5 a 50mm</p>
                </div>

                {/* Giro */}
                <div>
                  <Label htmlFor="giro" className="text-sm">
                    Giro (graus)
                  </Label>
                  <Input
                    id="giro"
                    type="number"
                    value={formData.programa_giro_graus}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        programa_giro_graus: parseFloat(e.target.value),
                      })
                    }
                    disabled={!isAdmin}
                    min={1}
                    max={360}
                    step={1}
                    className="mt-1"
                  />
                  {errors.programa_giro_graus && (
                    <p className="text-xs text-red-500 mt-1">{errors.programa_giro_graus}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Válido: 1° a 360°</p>
                </div>

                {/* Sentido */}
                <div>
                  <Label htmlFor="sentido" className="text-sm">
                    Deslocamento
                  </Label>
                  <Select
                    value={formData.programa_sentido}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        programa_sentido: value as "HORARIO" | "ANTIHORARIO",
                      })
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HORARIO">
                        <div className="flex items-center gap-2">
                          <RotateCw className="h-4 w-4" />
                          <span>Horário</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="ANTIHORARIO">
                        <div className="flex items-center gap-2">
                          <RotateCw className="h-4 w-4 scale-x-[-1]" />
                          <span>Anti-horário</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* COLUNA 3 - Meteorologia */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CloudRain className="h-5 w-5 text-primary" />
                  Meteorologia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Temperatura */}
                <div>
                  <Label htmlFor="temp" className="text-sm">
                    Temperatura Ambiente (°C)
                  </Label>
                  <Input
                    id="temp"
                    type="number"
                    value={formData.meteo_temp_c}
                    onChange={(e) =>
                      setFormData({ ...formData, meteo_temp_c: parseFloat(e.target.value) })
                    }
                    disabled={!isAdmin}
                    min={-10}
                    max={60}
                    step={0.1}
                    className="mt-1"
                  />
                  {errors.meteo_temp_c && (
                    <p className="text-xs text-red-500 mt-1">{errors.meteo_temp_c}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Válido: -10°C a 60°C</p>
                </div>

                {/* Umidade */}
                <div>
                  <Label htmlFor="umidade" className="text-sm">
                    Umidade Relativa (%)
                  </Label>
                  <Input
                    id="umidade"
                    type="number"
                    value={formData.meteo_ur_pct}
                    onChange={(e) =>
                      setFormData({ ...formData, meteo_ur_pct: parseFloat(e.target.value) })
                    }
                    disabled={!isAdmin}
                    min={0}
                    max={100}
                    step={1}
                    className="mt-1"
                  />
                  {errors.meteo_ur_pct && (
                    <p className="text-xs text-red-500 mt-1">{errors.meteo_ur_pct}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Válido: 0% a 100%</p>
                </div>

                <Separator />

                {/* Limite de chuva */}
                <div>
                  <Label htmlFor="chuva" className="text-sm">
                    Desligar por Chuva (mm)
                  </Label>
                  <Input
                    id="chuva"
                    type="number"
                    value={formData.chuva_cutoff_mm}
                    onChange={(e) =>
                      setFormData({ ...formData, chuva_cutoff_mm: parseFloat(e.target.value) })
                    }
                    disabled={!isAdmin}
                    min={0}
                    step={0.1}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Pivô desligará se chuva acumulada ≥ este valor
                  </p>
                </div>

                {/* Janela de acumulação */}
                <div>
                  <Label htmlFor="janela" className="text-sm">
                    Janela de Acumulação
                  </Label>
                  <Select
                    value={formData.chuva_janela_h.toString()}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        chuva_janela_h: parseInt(value) as 1 | 6 | 24,
                      })
                    }
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hora</SelectItem>
                      <SelectItem value="6">6 horas</SelectItem>
                      <SelectItem value="24">24 horas</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Período para acumular precipitação
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {isAdmin && (
            <Button onClick={handleSalvar}>
              <Settings className="h-4 w-4 mr-2" />
              Salvar Programação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
