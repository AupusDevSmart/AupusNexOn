import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";
import { useEquipamentoMqttData } from "@/hooks/useEquipamentoMqttData";
import {
  calcDerivados,
  extractPowerMeterPayload,
  fmtNumero,
} from "./helpers";

interface DadosTabProps {
  equipamentoId: string | null;
}

// Cores das fases (sobrias — combina com o restante do projeto).
const COR_FASE_A = "#3b82f6"; // azul
const COR_FASE_B = "#64748b"; // slate
const COR_FASE_C = "#ef4444"; // vermelho

function KpiCard({
  label,
  valor,
  unidade,
  sufixo,
}: {
  label: string;
  valor: string;
  unidade: string;
  sufixo?: string;
}) {
  return (
    <Card className="rounded-sm">
      <CardContent className="pt-4 pb-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums text-foreground">
            {valor}
          </span>
          <span className="text-sm text-muted-foreground">{unidade}</span>
          {sufixo && (
            <span className="text-xs text-muted-foreground ml-1">{sufixo}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FaseTabela({
  titulo,
  unidade,
  valores,
  casas = 1,
}: {
  titulo: string;
  unidade: string;
  valores: {
    a: number | null | undefined;
    b: number | null | undefined;
    c: number | null | undefined;
  };
  casas?: number;
}) {
  const linhas: Array<{ fase: "A" | "B" | "C"; cor: string; valor: number | null | undefined }> = [
    { fase: "A", cor: COR_FASE_A, valor: valores.a },
    { fase: "B", cor: COR_FASE_B, valor: valores.b },
    { fase: "C", cor: COR_FASE_C, valor: valores.c },
  ];

  return (
    <Card className="rounded-sm">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            {titulo}{" "}
            <span className="text-muted-foreground/70">({unidade})</span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wide">
              <th className="text-left font-normal px-4 py-2">Fase</th>
              <th className="text-right font-normal px-4 py-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.fase} className="border-t border-border/40">
                <td className="px-4 py-2 font-medium" style={{ color: l.cor }}>
                  {l.fase}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">
                  {fmtNumero(l.valor, casas)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function DadosTab({ equipamentoId }: DadosTabProps) {
  const { data: mqttResponse, lastUpdate, error } = useEquipamentoMqttData(
    equipamentoId ?? null,
  );

  const payload = useMemo(
    () => extractPowerMeterPayload(mqttResponse?.dado?.dados),
    [mqttResponse],
  );
  const derivados = useMemo(() => calcDerivados(payload), [payload]);

  if (error) {
    return (
      <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Linha 1: 4 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Energia Consumida Total"
          valor={fmtNumero(derivados.energia_consumida_mwh, 1)}
          unidade="MWh"
        />
        <KpiCard
          label="FP Trifásico"
          valor={fmtNumero(derivados.fp_trifasico, 2)}
          unidade=""
          sufixo={derivados.fp_natureza?.toUpperCase()}
        />
        <KpiCard
          label="Potência Ativa Total"
          valor={fmtNumero(derivados.potencia_ativa_total_kw, 1)}
          unidade="kW"
        />
        <KpiCard
          label="Potência Reativa Total"
          valor={fmtNumero(derivados.potencia_reativa_total_kvar, 1)}
          unidade="kvar"
        />
      </div>

      {/* Linha 2: 3 tabelas por fase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FaseTabela
          titulo="Tensão"
          unidade="V"
          valores={{ a: payload?.Va, b: payload?.Vb, c: payload?.Vc }}
        />
        <FaseTabela
          titulo="Corrente"
          unidade="A"
          valores={{ a: payload?.Ia, b: payload?.Ib, c: payload?.Ic }}
          casas={2}
        />
        <FaseTabela
          titulo="Fator de Potência"
          unidade="por fase"
          valores={{ a: payload?.FPa, b: payload?.FPb, c: payload?.FPc }}
          casas={3}
        />
      </div>

      {/* Footer pequeno: ultima leitura */}
      {lastUpdate && (
        <div className="text-[10px] text-muted-foreground text-right">
          Última leitura:{" "}
          {lastUpdate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </div>
      )}
    </div>
  );
}
