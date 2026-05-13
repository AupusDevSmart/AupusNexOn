import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  GatewayResumoDia,
  GatewaySnapshot,
} from "@/hooks/useGatewayDashboard";

interface ResumoDiaCardProps {
  resumo: GatewayResumoDia;
  snapshot: GatewaySnapshot | null;
}

const TZ = "America/Sao_Paulo";

function formatHoraBRT(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Item({
  label,
  valor,
  unidade,
  sub,
}: {
  label: string;
  valor: number | null | undefined;
  unidade: string;
  sub?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">
        {label} <span className="text-muted-foreground/70">({unidade})</span>
      </div>
      <div className="text-base font-semibold tabular-nums text-foreground">
        {typeof valor === "number" && Number.isFinite(valor) ? valor.toFixed(1) : "—"}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function ResumoDiaCard({ resumo, snapshot }: ResumoDiaCardProps) {
  return (
    <Card className="rounded-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Resumo do Dia (até o momento)
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Item label="Consumo" valor={resumo.consumo_kwh} unidade="kWh" />
        <Item label="Injeção" valor={resumo.injecao_kwh} unidade="kWh" />
        <Item label="Q Indutivo" valor={resumo.q_ind_kvarh} unidade="kvarh" />
        <Item label="Q Capacitivo" valor={resumo.q_cap_kvarh} unidade="kvarh" />

        <Item label="kVA Atual" valor={snapshot?.kVA} unidade="kVA" />
        <Item
          label="FP Atual"
          valor={snapshot?.FP}
          unidade={snapshot?.FP_natureza ?? "—"}
        />
        <Item
          label="Pico Consumo"
          valor={resumo.pico_consumo?.kw}
          unidade="kW"
          sub={resumo.pico_consumo ? `às ${formatHoraBRT(resumo.pico_consumo.timestamp)}` : undefined}
        />
        <Item
          label="Pico Injeção"
          valor={resumo.pico_injecao?.kw}
          unidade="kW"
          sub={resumo.pico_injecao ? `às ${formatHoraBRT(resumo.pico_injecao.timestamp)}` : undefined}
        />
      </CardContent>
    </Card>
  );
}
