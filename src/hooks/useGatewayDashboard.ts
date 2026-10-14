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

/** Parcial de 1 em 1 min da TON-V2 (só exibição; energia/demanda vêm dos blocos). */
export interface GatewayMinuto {
  timestamp: string;
  kW_consumo: number;
  kW_injecao: number;
  kvar_ind: number;
  kvar_cap: number;
  // TON-V2 (minuto do medidor): quadrante/posto do último segundo do minuto, FP do minuto
  nsu?: number | null;
  seg?: number | null;
  q?: number | null;
  posto?: number | null;
  FP?: number | null;
  FP_natureza?: "ind" | "cap" | null;
}

/** Intervalo do medidor em andamento (TON-V2): acumulado até agora + quanto falta. */
export interface GatewayIntervalo {
  nsu: number;
  kwh_consumo: number;
  kwh_injecao: number;
  minutos: number;
  fecha_em_s: number | null;
}

export interface GatewayDashboardData {
  minuto_a_minuto?: { agora: GatewayMinuto | null; serie: GatewayMinuto[]; intervalo?: GatewayIntervalo | null };
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

  const fetchDashboard = useCallback(async (silencioso = false) => {
    if (!equipamentoId) {
      setData(null);
      return;
    }
    if (!silencioso) setLoading(true);
    setError(null);
    try {
      const response = await api.get(
        `/equipamentos-dados/${equipamentoId.trim()}/gateway/dashboard`,
        { params: { n } },
      );
      setData(response.data as GatewayDashboardData);
    } catch (err: any) {
      if (silencioso) return; // falha na atualização de fundo: mantém o que já está na tela
      setError(err.response?.data?.message || "Erro ao carregar dados do gateway");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [equipamentoId, n]);

  useEffect(() => {
    void fetchDashboard();
    // A TON-V2 publica a cada 1 min: atualiza em segundo plano enquanto o modal está aberto.
    if (!equipamentoId) return;
    const t = setInterval(() => void fetchDashboard(true), 60_000);
    return () => clearInterval(t);
  }, [fetchDashboard, equipamentoId]);

  return { data, loading, error, refetch: () => fetchDashboard() };
}
