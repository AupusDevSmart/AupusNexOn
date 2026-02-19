// src/features/supervisorio/components/pivo/pivo-modal.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Droplets,
  Power,
  PlayCircle,
  StopCircle,
  Gauge,
  Calendar,
  Clock,
  Timer,
  Compass,
  Target,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Waves,
  Zap,
  Activity,
  Lock,
  Unlock,
  Settings,
  Users,
  CloudRain,
  Thermometer,
  Wind,
  RotateCw,
} from "lucide-react";
import { useState, useEffect } from "react";
import { ProgramacaoPivoModal, ProgramacaoPivo } from "./programacao-pivo-modal";

export interface DadosPivo {
  // Seção 1 - Informações
  data: string;
  hora: string;
  tempoEstimado: number; // horas
  lamina: number; // mm
  direcao: number; // graus
  destino: number; // graus
  programa: string;

  // Seção 2 - Medidores
  tensao: number; // V
  pressao: number; // bar
  horimetro: number; // horas totais

  // Seção 3 - Status (valores booleanos diretos)
  pressaoOk: boolean;
  bombaLigada: boolean;
  aguaOk: boolean;
  canhaoLigado: boolean;
  sistemaLiberado: boolean;
  energiaOk: boolean;
  alinhamentoOk: boolean; // Alinhamento do pivô

  // Geral
  status: "NORMAL" | "ALARME" | "FALHA" | "DESLIGADO";
  operando: boolean;
}

interface PivoModalProps {
  open: boolean;
  onClose: () => void;
  dados: DadosPivo;
  nomeComponente: string;
  onLigar?: () => void;
  onDesligar?: () => void;
  onIniciarIrrigacao?: () => void;
  onPararIrrigacao?: () => void;
}

// Componente Relógio (Gauge)
function GaugeDisplay({ value, max, label, unit, icon: Icon }: {
  value: number;
  max: number;
  label: string;
  unit: string;
  icon: React.ElementType;
}) {
  const percentage = (value / max) * 100;
  const rotation = (percentage / 100) * 180 - 90; // -90 a +90 graus

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-32 h-32">
        {/* Arco de fundo */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted-foreground/20"
            strokeDasharray="126 252"
            strokeLinecap="round"
          />
          {/* Arco de progresso */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-primary transition-all duration-500"
            strokeDasharray={`${(percentage / 100) * 126} 252`}
            strokeLinecap="round"
          />
        </svg>

        {/* Ícone central */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="h-6 w-6 mb-1 text-muted-foreground" />
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2 text-center">{label}</p>
    </div>
  );
}

// Componente Visualizador de Posição do Pivô
function PosicaoPivo({ direcaoAtual, direcaoReferencia, horimetro }: { direcaoAtual: number; direcaoReferencia: number; horimetro: number }) {
  const [filtro, setFiltro] = useState<'dia' | 'semana' | 'mes' | 'personalizado'>('dia');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  return (
    <div className="flex flex-col items-center justify-center p-6">
      {/* Label superior */}
      <div className="mb-4 text-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Posição do Pivô
        </p>
      </div>

      {/* SVG do visualizador */}
      <div className="relative">
        <svg width="240" height="240" viewBox="0 0 240 240" className="drop-shadow-lg [&_circle.bg-circle]:fill-white dark:[&_circle.bg-circle]:fill-black [&_circle.bg-circle]:stroke-gray-300 dark:[&_circle.bg-circle]:stroke-gray-700 [&_line.marker]:stroke-gray-600 dark:[&_line.marker]:stroke-gray-400 [&_text.angle]:fill-gray-900 dark:[&_text.angle]:fill-gray-100 [&_line.marker-sec]:stroke-gray-400 dark:[&_line.marker-sec]:stroke-gray-500 [&_text.angle-sec]:fill-gray-500 dark:[&_text.angle-sec]:fill-gray-400 [&_line.pointer]:stroke-black dark:[&_line.pointer]:stroke-white [&_circle.pointer]:fill-black dark:[&_circle.pointer]:fill-white [&_path.pointer]:fill-black dark:[&_path.pointer]:fill-white [&_circle.border]:stroke-gray-300 dark:[&_circle.border]:stroke-gray-600">
          {/* Círculo de fundo */}
          <circle
            cx="120"
            cy="120"
            r="100"
            strokeWidth="2"
            className="bg-circle"
          />

          {/* Marcações de ângulos principais (0°, 90°, 180°, 270°) */}
          {[0, 90, 180, 270].map((angle) => {
            const rad = ((angle - 90) * Math.PI) / 180;
            const x1 = 120 + 85 * Math.cos(rad);
            const y1 = 120 + 85 * Math.sin(rad);
            const x2 = 120 + 100 * Math.cos(rad);
            const y2 = 120 + 100 * Math.sin(rad);
            const xText = 120 + 115 * Math.cos(rad);
            const yText = 120 + 115 * Math.sin(rad);

            return (
              <g key={angle}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth="3"
                  opacity="0.8"
                  strokeLinecap="round"
                  className="marker"
                />
                <text
                  x={xText}
                  y={yText}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-sm font-bold angle"
                >
                  {angle}°
                </text>
              </g>
            );
          })}

          {/* Marcações secundárias (a cada 30°) */}
          {[30, 60, 120, 150, 210, 240, 300, 330].map((angle) => {
            const rad = ((angle - 90) * Math.PI) / 180;
            const x1 = 120 + 90 * Math.cos(rad);
            const y1 = 120 + 90 * Math.sin(rad);
            const x2 = 120 + 100 * Math.cos(rad);
            const y2 = 120 + 100 * Math.sin(rad);
            const xText = 120 + 115 * Math.cos(rad);
            const yText = 120 + 115 * Math.sin(rad);

            return (
              <g key={angle}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth="2"
                  opacity="0.5"
                  strokeLinecap="round"
                  className="marker-sec"
                />
                <text
                  x={xText}
                  y={yText}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs angle-sec"
                >
                  {angle}°
                </text>
              </g>
            );
          })}

          {/* Linha de Referência (onde o pivô partiu) - Verde */}
          <g transform={`rotate(${direcaoReferencia - 90} 120 120)`}>
            <line
              x1="120"
              y1="120"
              x2="120"
              y2="30"
              stroke="#10b981"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.9"
            />
            <circle cx="120" cy="30" r="6" fill="#10b981" />
          </g>

          {/* Linha de Posição Atual - Preto/Branco conforme tema */}
          <g transform={`rotate(${direcaoAtual - 90} 120 120)`}>
            <line
              x1="120"
              y1="120"
              x2="120"
              y2="30"
              strokeWidth="5"
              strokeLinecap="round"
              className="pointer"
            />
            <circle cx="120" cy="30" r="7" className="pointer" />
            {/* Seta na ponta */}
            <path
              d="M 120 30 L 112 42 L 120 38 L 128 42 Z"
              className="pointer"
            />
          </g>

          {/* Centro do pivô */}
          <circle cx="120" cy="120" r="10" fill="#666" />
          <circle cx="120" cy="120" r="6" fill="#fff" stroke="#333" strokeWidth="1" />
          <circle cx="120" cy="120" r="3" fill="#10b981" className="animate-pulse" />

          {/* Borda externa */}
          <circle
            cx="120"
            cy="120"
            r="105"
            fill="none"
            strokeWidth="2"
            className="border"
          />
        </svg>
      </div>

      {/* Legenda */}
      <div className="mt-4 space-y-2 w-full">
        <div className="flex items-center justify-between px-4 py-2 rounded-md bg-muted/50 dark:bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-foreground">Referência</span>
          </div>
          <span className="text-xs font-mono font-semibold text-foreground">{direcaoReferencia}°</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2 rounded-md bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs font-medium text-foreground">Posição Atual</span>
          </div>
          <span className="text-xs font-mono font-semibold text-primary">{direcaoAtual}°</span>
        </div>
      </div>

      {/* Horímetro com Filtros */}
      <div className="mt-4 w-full">
        <div className="bg-card rounded-lg border overflow-hidden">
          {/* Filtros de Período */}
          <div className="p-3 bg-muted/30 border-b">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={filtro === 'dia' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltro('dia')}
                className="text-xs h-8"
              >
                Dia
              </Button>
              <Button
                variant={filtro === 'semana' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltro('semana')}
                className="text-xs h-8"
              >
                Semana
              </Button>
              <Button
                variant={filtro === 'mes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltro('mes')}
                className="text-xs h-8"
              >
                Mês
              </Button>
              <Button
                variant={filtro === 'personalizado' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltro('personalizado')}
                className="text-xs h-8"
              >
                Personalizado
              </Button>
            </div>

            {/* Campos de data personalizada */}
            {filtro === 'personalizado' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label htmlFor="data-inicio" className="text-xs text-muted-foreground mb-1 block">Início</Label>
                  <Input
                    id="data-inicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="data-fim" className="text-xs text-muted-foreground mb-1 block">Fim</Label>
                  <Input
                    id="data-fim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Valor do Horímetro */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Horímetro Total</span>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold font-mono tabular-nums text-foreground">{horimetro.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">horas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente Item de Status (com ícone)
function StatusItem({
  label,
  active,
  icon: Icon,
  showFalha = false, // Se true, mostra "FALHA" ao invés de "OFF"
}: {
  label: string;
  active: boolean;
  icon: React.ElementType;
  showFalha?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/30 dark:bg-muted/20 hover:bg-muted/50 dark:hover:bg-muted/30 transition-all duration-200 border border-transparent hover:border-primary/20">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md ${active ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-red-500/10 dark:bg-red-500/20'}`}>
          <Icon className={`h-4 w-4 ${active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {active ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" />
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">OK</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              {showFalha ? "FALHA" : "OFF"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function PivoModal({
  open,
  onClose,
  dados,
  nomeComponente,
  onLigar,
  onDesligar,
  onIniciarIrrigacao,
  onPararIrrigacao,
}: PivoModalProps) {
  const [programacaoOpen, setProgramacaoOpen] = useState(false);
  const [programacao, setProgramacao] = useState<ProgramacaoPivo | undefined>(undefined);

  // Carregar programação do localStorage quando o modal abrir
  useEffect(() => {
    if (open) {
      const storageKey = `programacao_pivo_${nomeComponente}`;
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setProgramacao(parsed);
        } catch (error) {
          console.error("Erro ao carregar programação do localStorage:", error);
        }
      }
    }
  }, [open, nomeComponente]);

  const handleSalvarProgramacao = (novaProgramacao: ProgramacaoPivo) => {
    // Salvar no estado
    setProgramacao(novaProgramacao);

    // Salvar no localStorage
    const storageKey = `programacao_pivo_${nomeComponente}`;
    localStorage.setItem(storageKey, JSON.stringify(novaProgramacao));

    console.log("Programação salva no localStorage:", novaProgramacao);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      NORMAL: (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          Em Operação
        </Badge>
      ),
      ALARME: (
        <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
          Alerta
        </Badge>
      ),
      FALHA: (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          Falha
        </Badge>
      ),
      DESLIGADO: (
        <Badge variant="secondary">
          Desligado
        </Badge>
      ),
    };
    return badges[status as keyof typeof badges] || badges.DESLIGADO;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Droplets className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <span>{nomeComponente}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Pivô Central de Irrigação
                </span>
              </div>
            </DialogTitle>
            {getStatusBadge(dados.status)}
          </div>
        </DialogHeader>

        {/* Botões de Controle */}
        <div className="px-6 py-4 bg-background border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant={dados.status === "DESLIGADO" && !dados.operando ? "default" : "outline"}
              size="lg"
              onClick={onLigar}
              disabled={dados.status !== "DESLIGADO"}
              className="w-full"
            >
              <Power className="h-4 w-4 mr-2" />
              <Droplets className="h-4 w-4 mr-1" />
              Ligar com Água
            </Button>

            <Button
              variant={dados.status === "DESLIGADO" && !dados.operando ? "default" : "outline"}
              size="lg"
              onClick={onIniciarIrrigacao}
              disabled={dados.status !== "DESLIGADO"}
              className="w-full"
            >
              <Power className="h-4 w-4 mr-2" />
              Ligar sem Água
            </Button>

            <Button
              variant={dados.status !== "DESLIGADO" ? "destructive" : "outline"}
              size="lg"
              onClick={onDesligar}
              disabled={dados.status === "DESLIGADO"}
              className="w-full"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Desligar
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => setProgramacaoOpen(true)}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Programação
            </Button>
          </div>
        </div>

        {/* Alerta de Horário de Ponta */}
        {programacao?.bloqueio_ponta && (
          <div className="px-6 py-3 bg-muted/30 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Zap className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Bloqueio de Horário de Ponta Ativo
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {programacao.ponta_inicio} - {programacao.ponta_fim}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  O sistema não ligará e será desligado automaticamente durante este período
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo Principal - 3 Seções */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SEÇÃO 1 - Informações */}
            <Card className="border-2">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Informações da Programação
                </h3>

                <div className="space-y-4">
                  {/* Operadores */}
                  {programacao && programacao.operadores.length > 0 && (
                    <>
                      <div className="py-2 px-3 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Operadores Autorizados</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {programacao.operadores.slice(0, 3).map((_, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              Operador {idx + 1}
                            </Badge>
                          ))}
                          {programacao.operadores.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{programacao.operadores.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Meteorologia */}
                  {programacao && (
                    <>
                      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Thermometer className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Temperatura</span>
                        </div>
                        <span className="text-sm font-mono">{programacao.meteo_temp_c}°C</span>
                      </div>

                      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Umidade Relativa</span>
                        </div>
                        <span className="text-sm font-mono">{programacao.meteo_ur_pct}%</span>
                      </div>

                      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                          <CloudRain className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Limite de Chuva</span>
                        </div>
                        <span className="text-sm font-mono">{programacao.chuva_cutoff_mm} mm ({programacao.chuva_janela_h}h)</span>
                      </div>

                      <Separator />

                      {/* Programa de Irrigação */}
                      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Waves className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Lâmina</span>
                        </div>
                        <span className="text-sm font-mono">{programacao.programa_lamina_mm} mm</span>
                      </div>

                      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                          <RotateCw className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Giro</span>
                        </div>
                        <span className="text-sm font-mono">{programacao.programa_giro_graus}°</span>
                      </div>

                      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Compass className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Sentido</span>
                        </div>
                        <span className="text-sm font-mono capitalize">
                          {programacao.programa_sentido === "HORARIO" ? "Horário" : "Anti-horário"}
                        </span>
                      </div>

                      {/* Bloqueio de Ponta */}
                      {programacao.bloqueio_ponta && (
                        <>
                          <Separator />
                          <div className="p-3 rounded-lg bg-muted/50 border">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                Bloqueio de Ponta Ativo
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {programacao.ponta_inicio} às {programacao.ponta_fim}
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Mensagem se não houver programação */}
                  {!programacao && (
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <Settings className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma programação configurada
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Clique em "Programação" para configurar
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO 2 - Medidores */}
            <Card className="border-2">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  Medidores
                </h3>

                {/* Relógios - Tensão e Pressão */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <GaugeDisplay
                    value={dados.tensao}
                    max={380}
                    label="Tensão"
                    unit="V"
                    icon={Gauge}
                  />
                  <GaugeDisplay
                    value={dados.pressao}
                    max={10}
                    label="Pressão"
                    unit="bar"
                    icon={Droplets}
                  />
                </div>

                {/* Posição do Pivô */}
                <PosicaoPivo
                  direcaoAtual={dados.direcao}
                  direcaoReferencia={dados.destino}
                  horimetro={dados.horimetro}
                />
              </CardContent>
            </Card>

            {/* SEÇÃO 3 - Status Atuais */}
            <Card className="border-2">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Status do Sistema
                </h3>

                <div className="space-y-3">
                  {/* Status do Pivô */}
                  <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${
                        dados.status === "NORMAL" ? 'bg-green-500/10 dark:bg-green-500/20' :
                        dados.status === "ALARME" ? 'bg-yellow-500/10 dark:bg-yellow-500/20' :
                        dados.status === "FALHA" ? 'bg-red-500/10 dark:bg-red-500/20' :
                        'bg-gray-500/10 dark:bg-gray-500/20'
                      }`}>
                        <Activity className={`h-4 w-4 ${
                          dados.status === "NORMAL" ? 'text-green-600 dark:text-green-400' :
                          dados.status === "ALARME" ? 'text-yellow-600 dark:text-yellow-400' :
                          dados.status === "FALHA" ? 'text-red-600 dark:text-red-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`} />
                      </div>
                      <span className="text-sm font-medium">Status do Pivô</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(dados.status)}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Energia */}
                  <StatusItem
                    label="Energia Elétrica"
                    active={dados.energiaOk}
                    icon={Zap}
                    showFalha={true}
                  />

                  {/* Pressão */}
                  <StatusItem
                    label="Pressão Hidráulica"
                    active={dados.pressaoOk}
                    icon={Gauge}
                  />

                  {/* Água */}
                  <StatusItem
                    label="Abastecimento de Água"
                    active={dados.aguaOk}
                    icon={Droplets}
                  />

                  <Separator className="my-4" />

                  {/* Bomba */}
                  <StatusItem
                    label="Bomba de Irrigação"
                    active={dados.bombaLigada}
                    icon={Power}
                  />

                  {/* Canhão */}
                  <StatusItem
                    label="Canhão Aspersor"
                    active={dados.canhaoLigado}
                    icon={Waves}
                  />

                  <Separator className="my-4" />

                  {/* Sistema Liberado */}
                  <StatusItem
                    label="Sistema Liberado"
                    active={dados.sistemaLiberado}
                    icon={dados.sistemaLiberado ? Unlock : Lock}
                  />

                  <Separator className="my-4" />

                  {/* Alinhamento do Pivô */}
                  <StatusItem
                    label="Alinhamento"
                    active={dados.alinhamentoOk}
                    icon={Compass}
                    showFalha={true}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de Programação */}
        <ProgramacaoPivoModal
          open={programacaoOpen}
          onClose={() => setProgramacaoOpen(false)}
          programacao={programacao}
          onSalvar={handleSalvarProgramacao}
          nomeComponente={nomeComponente}
          isAdmin={true} // Você pode pegar isso do useUserStore
        />
      </DialogContent>
    </Dialog>
  );
}
