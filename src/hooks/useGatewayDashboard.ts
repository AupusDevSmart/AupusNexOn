import { useCallback, useEffect, useState } from "react";
import { api } from "@/config/api";

export interface GatewaySnapshot {
  timestamp_dados: string;
  kW_consumo: number;
  kW_injecao: number;
  kvar_ind: number;
  kvar_cap: number;
  kvar_resultante: number;
  kVA: number;
  FP: number;
  FP_natureza: "ind" | "cap";
  fluxo_liquido_kw: number;
}

export interface GatewayResumoDia {
  data: string;
  consumo_kwh: number;
  injecao_kwh: number;
  q_ind_kvarh: number;
  q_cap_kvarh: number;
  pico_consumo: { kw: number; timestamp: string } | null;
  pico_injecao: { kw: number; timestamp: string } | null;
}

export interface GatewayResumoMes {
  mes: string; // YYYY-MM
  pico_consumo: { kw: number; timestamp: string } | null;
  pico_injecao: { kw: number; timestamp: string } | null;
}

export interface GatewayUltimaLeitura {
  timestamp: string;
  kW_consumo: number;
  kW_injecao: number;
  kvar_resultante: number;
  kVA: number;
  FP: number;
  FP_natureza: "ind" | "cap";
}

export interface GatewayComunicacao {
  leituras_recebidas_hoje: number;
  leituras_esperadas: number;
  percentual: number;
  pacotes_perdidos: number;
  ultimo_pulso: string | null;
}

export interface GatewayDashboardData {
  equipamento: { id: string; nome: string; tag: string | null; tipo: string | null };
  unidade: { id: string; demanda_carga: number | null; demanda_geracao: number | null } | null;
  snapshot: GatewaySnapshot | null;
  resumo_dia: GatewayResumoDia;
  resumo_mes: GatewayResumoMes;
  ultimas_leituras: GatewayUltimaLeitura[];
  comunicacao: GatewayComunicacao;
}

export function useGatewayDashboard(equipamentoId: string | null, n = 5) {
  const [data, setData] = useState<GatewayDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!equipamentoId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(
        `/equipamentos-dados/${equipamentoId.trim()}/gateway/dashboard`,
        { params: { n } },
      );
      setData(response.data as GatewayDashboardData);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar dados do gateway");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [equipamentoId, n]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard };
}
