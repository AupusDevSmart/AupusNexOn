import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCustosEnergia } from "@/hooks/useCustosEnergia";
import type { TipoHorario } from "@/types/dtos/custos-energia-dto";
import { useMemo, useState } from "react";

interface RelatorioTabProps {
  equipamentoId: string | null;
}

const TZ = "America/Sao_Paulo";

function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function firstDayMonthBRT(): string {
  return todayBRT().slice(0, 7) + "-01";
}

function fmtBRL(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtKwh(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function labelHorario(t: TipoHorario): string {
  return {
    PONTA: "Ponta",
    FORA_PONTA: "Fora Ponta",
    RESERVADO: "Reservado",
    IRRIGANTE: "Irrigante",
    DEMANDA: "Demanda",
  }[t];
}

export function RelatorioTab({ equipamentoId }: RelatorioTabProps) {
  const [inicio, setInicio] = useState<string>(firstDayMonthBRT);
  const [fim, setFim] = useState<string>(todayBRT);

  const params = useMemo(() => {
    if (!inicio || !fim) return null;
    return {
      timestamp_inicio: `${inicio}T00:00:00`,
      timestamp_fim: `${fim}T23:59:59`,
    };
  }, [inicio, fim]);

  const { data, loading, error } = useCustosEnergia({
    equipamentoId,
    periodo: "custom",
    timestamp_inicio: params?.timestamp_inicio,
    timestamp_fim: params?.timestamp_fim,
    enabled: !!params,
  });

  // Monta linhas da tabela: 1 linha por TarifaAplicada, + linha Total.
  const linhas = useMemo(() => {
    if (!data) return [];
    return data.tarifas_aplicadas.map((tarifa) => {
      const energia = (() => {
        switch (tarifa.tipo_horario) {
          case "PONTA":
            return data.consumo.energia_ponta_kwh;
          case "FORA_PONTA":
            return data.consumo.energia_fora_ponta_kwh;
          case "RESERVADO":
            return data.consumo.energia_reservado_kwh;
          case "IRRIGANTE":
            return data.consumo.energia_irrigante_kwh;
          default:
            return 0;
        }
      })();
      const custo = (() => {
        switch (tarifa.tipo_horario) {
          case "PONTA":
            return data.custos.custo_ponta;
          case "FORA_PONTA":
            return data.custos.custo_fora_ponta;
          case "RESERVADO":
            return data.custos.custo_reservado;
          case "IRRIGANTE":
            return data.custos.custo_irrigante;
          case "DEMANDA":
            return data.custos.custo_demanda;
        }
      })();
      return {
        tipo: tarifa.tipo_horario,
        label: labelHorario(tarifa.tipo_horario),
        energia,
        tarifa_total: tarifa.tarifa_total,
        custo,
      };
    });
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Período</label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="h-9 w-40"
            />
            <span className="text-muted-foreground text-sm">até</span>
            <Input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="h-9 w-40"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Calculando custos...
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Selecione um período pra ver o relatório.
        </div>
      ) : (
        <>
          {/* 3 cards no topo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="rounded-sm">
              <CardContent className="pt-4 pb-4">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Energia Total Consumida
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tabular-nums text-foreground">
                    {fmtKwh(data.consumo.energia_total_kwh)}
                  </span>
                  <span className="text-sm text-muted-foreground">kWh</span>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-sm">
              <CardContent className="pt-4 pb-4">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Custo Total Estimado
                </div>
                <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {fmtBRL(data.custos.custo_total)}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-sm">
              <CardContent className="pt-4 pb-4">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Custo Médio
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tabular-nums text-foreground">
                    {fmtBRL(data.custos.custo_medio_kwh)}
                  </span>
                  <span className="text-sm text-muted-foreground">/kWh</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela por periodo */}
          <Card className="rounded-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Detalhamento por Posto Tarifário
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-muted-foreground uppercase tracking-wide border-b border-border">
                      <th className="text-left font-normal px-4 py-2">Período</th>
                      <th className="text-right font-normal px-4 py-2">Energia Consumida</th>
                      <th className="text-right font-normal px-4 py-2">Tarifa Configurada</th>
                      <th className="text-right font-normal px-4 py-2">Custo Estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.tipo} className="border-b border-border/40">
                        <td className="px-4 py-2 text-foreground">{l.label}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {fmtKwh(l.energia)} kWh
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {l.tarifa_total !== null
                            ? `${fmtBRL(l.tarifa_total)}/kWh`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {fmtBRL(l.custo)}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="px-4 py-3 text-foreground">Total</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtKwh(data.consumo.energia_total_kwh)} kWh
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtBRL(data.custos.custo_total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Info da fonte tarifaria */}
          <div className="text-[10px] text-muted-foreground text-right">
            Fonte da tarifa:{" "}
            <span className="font-medium">
              {data.tarifa_fonte === "PERSONALIZADA"
                ? "Configuração personalizada"
                : "Concessionária"}
            </span>
            {data.irrigante && (
              <span className="ml-3">
                · Desconto irrigante:{" "}
                <span className="font-medium tabular-nums">
                  {fmtBRL(data.irrigante.economia_total)}
                </span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
