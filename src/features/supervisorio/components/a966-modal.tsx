import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { useEquipamentoMqttData } from "@/hooks/useEquipamentoMqttData";
import {
  useGatewayGraficoDia,
  useGatewayGraficoMes,
} from "@/hooks/useGatewayGraficos";
import { Activity, Gauge, Hash, Radio, Wifi, WifiOff, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface A966ModalProps {
  open: boolean;
  onClose: () => void;
  componenteData?: any;
  nomeComponente?: string;
}

interface GatewayPayload {
  cdo?: string | number;
  sts?: number;
  phf?: number;
  phr?: number;
  qhfi?: number;
  qhfc?: number;
  qhri?: number;
  qhrc?: number;
  frame?: string;
}

// Constante de divisao do medidor SSU acoplado ao A966 — energia em kWh = leitura_bruta * KD_A966_SSU.
// Quando houver mais de uma unidade com Kd diferente, mover pra equipamentos.dados_tecnicos (campo='kd').
const KD_A966_SSU = 0.3;

function extractA966Payload(rawDados: unknown): GatewayPayload | null {
  if (!rawDados || typeof rawDados !== "object") return null;
  const root = rawDados as Record<string, any>;
  const flat: Record<string, any> = root.data && typeof root.data === "object" ? root.data : root;

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
  const scale = (v: unknown): number | undefined => {
    const n = num(v);
    return n === undefined ? undefined : n * KD_A966_SSU;
  };

  return {
    cdo: typeof flat.cdo === "string" || typeof flat.cdo === "number" ? flat.cdo : undefined,
    sts: num(flat.sts),
    phf: scale(flat.phf),
    phr: scale(flat.phr),
    qhfi: scale(flat.qhfi),
    qhfc: scale(flat.qhfc),
    qhri: scale(flat.qhri),
    qhrc: scale(flat.qhrc),
    frame: typeof flat.frame === "string" ? flat.frame : undefined,
  };
}

const TZ = "America/Sao_Paulo";

function formatTempoRelativo(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  return `há ${dias}d`;
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000;

function statusLabel(sts?: number): { label: string; tone: string } {
  switch (sts) {
    case 0:
      return { label: "Normal", tone: "bg-muted text-foreground border-border" };
    case 1:
      return { label: "Atenção", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/40" };
    case 2:
      return { label: "Falha", tone: "bg-destructive/10 text-destructive border-destructive/40" };
    default:
      return { label: `Código ${sts ?? "—"}`, tone: "bg-muted text-muted-foreground border-border" };
  }
}

function formatBRT(date: Date) {
  return date.toLocaleString("pt-BR", { timeZone: TZ });
}

function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function currentMonthBRT(): string {
  return todayBRT().slice(0, 7);
}

function defaultCustomRange() {
  const today = todayBRT();
  const [y, m, d] = today.split("-").map(Number);
  const inicio = new Date(Date.UTC(y, m - 1, d - 7, 0, 0, 0, 0)).toISOString();
  const fim = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).toISOString();
  return { inicio, fim };
}

export function A966Modal({
  open,
  onClose,
  componenteData,
  nomeComponente,
}: A966ModalProps) {
  const equipamentoId = (componenteData?.dados?.equipamento_id || componenteData?.id)?.trim();
  const nome = nomeComponente || componenteData?.nome || "Gateway IoT";

  const { data: mqttResponse, lastUpdate, error } = useEquipamentoMqttData(
    open ? equipamentoId ?? null : null,
  );

  const payload = useMemo<GatewayPayload | null>(
    () => extractA966Payload(mqttResponse?.dado?.dados),
    [mqttResponse],
  );

  const isStale = useMemo(() => {
    if (!lastUpdate) return true;
    return Date.now() - lastUpdate.getTime() > STALE_THRESHOLD_MS;
  }, [lastUpdate]);

  const tempoRelativo = useMemo(
    () => (lastUpdate ? formatTempoRelativo(lastUpdate) : null),
    [lastUpdate],
  );

  const status = statusLabel(payload?.sts);

  const [activeTab, setActiveTab] = useState<"dia" | "mes" | "custom">("dia");
  const [diaSelecionado, setDiaSelecionado] = useState<string>(() => todayBRT());
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => currentMonthBRT());
  const [customRange, setCustomRange] = useState(() => defaultCustomRange());

  useEffect(() => {
    if (!open) {
      setActiveTab("dia");
    }
  }, [open]);

  const { data: graficoDia, loading: loadingDia } = useGatewayGraficoDia(
    open && activeTab === "dia" ? equipamentoId ?? null : null,
    diaSelecionado,
    "15",
  );

  const { data: graficoMes, loading: loadingMes } = useGatewayGraficoMes(
    open && activeTab === "mes" ? equipamentoId ?? null : null,
    mesSelecionado,
  );

  const { data: graficoCustom, loading: loadingCustom } = useGatewayGraficoDia(
    open && activeTab === "custom" ? equipamentoId ?? null : null,
    undefined,
    "15",
    customRange.inicio,
    customRange.fim,
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{nome}</span>
              <span className="text-muted-foreground text-sm">Gateway</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={status.tone}>
                {status.label}
              </Badge>
              {tempoRelativo ? (
                <Badge
                  variant="outline"
                  className={
                    isStale
                      ? "text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10"
                      : "text-muted-foreground border-border"
                  }
                >
                  {isStale ? (
                    <WifiOff className="h-3 w-3 mr-1" />
                  ) : (
                    <Wifi className="h-3 w-3 mr-1" />
                  )}
                  Atualizado {tempoRelativo}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground border-border">
                  <WifiOff className="h-3 w-3 mr-1" /> Sem dado
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="rounded-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Zap className="h-3.5 w-3.5" /> Potência
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <ValorCard label="phf — Direta" valor={payload?.phf} unidade="kWh" />
              <ValorCard label="phr — Reversa" valor={payload?.phr} unidade="kWh" />
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> Energia Reativa
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <ValorCard label="qhfi" valor={payload?.qhfi} unidade="kVArh" />
              <ValorCard label="qhfc" valor={payload?.qhfc} unidade="kVArh" />
              <ValorCard label="qhri" valor={payload?.qhri} unidade="kVArh" />
              <ValorCard label="qhrc" valor={payload?.qhrc} unidade="kVArh" />
            </CardContent>
          </Card>

          <Card className="md:col-span-2 rounded-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Hash className="h-3.5 w-3.5" /> Identificação e Frame
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="rounded-sm border border-border bg-muted/30 p-2.5">
                <div className="text-xs text-muted-foreground">cdo</div>
                <div className="text-base font-medium">{payload?.cdo ?? "—"}</div>
              </div>
              <div className="rounded-sm border border-border bg-muted/30 p-2.5">
                <div className="text-xs text-muted-foreground">Última leitura</div>
                <div className="text-sm">
                  {lastUpdate ? formatBRT(lastUpdate) : "—"}
                </div>
              </div>
              <div className="rounded-sm border border-border bg-muted/30 p-2.5">
                <div className="text-xs text-muted-foreground">sts</div>
                <div className="text-base font-medium">{payload?.sts ?? "—"}</div>
              </div>
              <div className="rounded-sm border border-border bg-muted/30 p-2.5 md:col-span-3">
                <div className="text-xs text-muted-foreground mb-1">frame</div>
                <code className="block font-mono text-xs break-all whitespace-pre-wrap text-foreground">
                  {payload?.frame ?? "—"}
                </code>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-2 rounded-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" /> Energia (phf / phr)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <TabsList>
                  <TabsTrigger value="dia">Dia</TabsTrigger>
                  <TabsTrigger value="mes">Mês</TabsTrigger>
                  <TabsTrigger value="custom">Personalizado</TabsTrigger>
                </TabsList>

                <div className="flex flex-wrap items-center gap-2">
                  {activeTab === "dia" && (
                    <input
                      type="date"
                      value={diaSelecionado}
                      onChange={(e) => setDiaSelecionado(e.target.value)}
                      className="h-9 rounded-sm border border-input bg-background px-3 text-sm"
                    />
                  )}
                  {activeTab === "mes" && (
                    <input
                      type="month"
                      value={mesSelecionado}
                      onChange={(e) => setMesSelecionado(e.target.value)}
                      className="h-9 rounded-sm border border-input bg-background px-3 text-sm"
                    />
                  )}
                  {activeTab === "custom" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <DateTimeInput
                        value={customRange.inicio}
                        onChange={(v) => setCustomRange((r) => ({ ...r, inicio: v }))}
                      />
                      <span className="text-muted-foreground text-sm">até</span>
                      <DateTimeInput
                        value={customRange.fim}
                        onChange={(v) => setCustomRange((r) => ({ ...r, fim: v }))}
                      />
                    </div>
                  )}
                </div>
              </div>

              <TabsContent value="dia">
                <GraficoEnergia
                  loading={loadingDia}
                  pontos={(graficoDia?.dados ?? []).map((p) => ({
                    x: p.timestamp,
                    label: new Date(p.timestamp).toLocaleTimeString("pt-BR", {
                      timeZone: TZ,
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    phf: p.phf_kw,
                    phr: p.phr_kw,
                  }))}
                />
              </TabsContent>

              <TabsContent value="mes">
                <GraficoEnergia
                  loading={loadingMes}
                  pontos={(graficoMes?.dados ?? []).map((p) => ({
                    x: p.data,
                    label: String(p.dia).padStart(2, "0"),
                    phf: p.phf_kw_avg,
                    phr: p.phr_kw_avg,
                  }))}
                />
              </TabsContent>

              <TabsContent value="custom">
                <GraficoEnergia
                  loading={loadingCustom}
                  pontos={(graficoCustom?.dados ?? []).map((p) => ({
                    x: p.timestamp,
                    label: new Date(p.timestamp).toLocaleString("pt-BR", {
                      timeZone: TZ,
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    phf: p.phf_kw,
                    phr: p.phr_kw,
                  }))}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

function ValorCard({
  label,
  valor,
  unidade,
}: {
  label: string;
  valor?: number;
  unidade: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-muted/30 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-medium tabular-nums">
        {typeof valor === "number" ? valor.toFixed(2) : "—"}
      </div>
      <div className="text-xs text-muted-foreground">{unidade}</div>
    </div>
  );
}

function GraficoEnergia({
  loading,
  pontos,
}: {
  loading: boolean;
  pontos: Array<{ x: string | Date; label: string; phf: number; phr: number }>;
}) {
  if (loading) {
    return (
      <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!pontos.length) {
    return (
      <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
        Sem dados no período
      </div>
    );
  }

  // Cores hex fixas — Recharts nao resolve `hsl(var(--xxx))` em todas as
  // posicoes (tick.fill, Legend wrapperStyle), entao texto sumia no dark.
  // Slate-400 (#94a3b8) tem contraste bom em ambos os temas.
  const AXIS_COLOR = "#94a3b8";
  const GRID_COLOR = "#94a3b833";
  const PHF_COLOR = "#64748b"; // slate-500 — cinza-azulado dessaturado
  const PHR_COLOR = "#a16207"; // yellow-700 — ocre dessaturado
  const tickStyle = { fill: AXIS_COLOR, fontSize: 12 };
  const labelStyle = { fill: AXIS_COLOR };

  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 12, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="label" stroke={AXIS_COLOR} tick={tickStyle} />
          <YAxis
            stroke={AXIS_COLOR}
            tick={tickStyle}
            tickFormatter={(v) => Number(v).toFixed(2)}
            domain={[0, "auto"]}
            padding={{ top: 12, bottom: 12 }}
            label={{ value: "kWh", angle: -90, position: "insideLeft", style: labelStyle }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
              color: "hsl(var(--popover-foreground))",
            }}
            labelStyle={{ color: "hsl(var(--popover-foreground))" }}
            formatter={(value: any, name: string) => [
              `${Number(value).toFixed(3)} kWh`,
              name,
            ]}
          />
          <Legend wrapperStyle={{ color: AXIS_COLOR }} />
          <Line
            type="linear"
            dataKey="phf"
            name="Direta (phf)"
            stroke={PHF_COLOR}
            dot={{ r: 4, fill: PHF_COLOR, stroke: PHF_COLOR }}
            activeDot={{ r: 6 }}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="phr"
            name="Reversa (phr)"
            stroke={PHR_COLOR}
            dot={{ r: 4, fill: PHR_COLOR, stroke: PHR_COLOR }}
            activeDot={{ r: 6 }}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
