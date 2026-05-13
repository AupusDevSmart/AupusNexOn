import { useCallback, useEffect, useState } from "react";
import { api } from "@/config/api";

export type PeriodoTendencia = "1H" | "6H" | "24H" | "7D" | "custom";

export interface GatewayTendenciaPonto {
  timestamp: string;
  kW_consumo: number;
  kW_injecao: number;
  num_leituras: number;
}

export interface GatewayTendenciaData {
  periodo: PeriodoTendencia;
  intervalo_min: number;
  inicio: string;
  fim: string;
  total_pontos: number;
  dados: GatewayTendenciaPonto[];
}

export function useGatewayTendencia(
  equipamentoId: string | null,
  periodo: PeriodoTendencia,
  inicio?: string,
  fim?: string,
) {
  const [data, setData] = useState<GatewayTendenciaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTendencia = useCallback(async () => {
    if (!equipamentoId) {
      setData(null);
      return;
    }
    if (periodo === "custom" && (!inicio || !fim)) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { periodo };
      if (periodo === "custom") {
        params.inicio = inicio!;
        params.fim = fim!;
      }
      const response = await api.get(
        `/equipamentos-dados/${equipamentoId.trim()}/gateway/tendencia`,
        { params },
      );
      setData(response.data as GatewayTendenciaData);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar gráfico de tendência");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [equipamentoId, periodo, inicio, fim]);

  useEffect(() => {
    void fetchTendencia();
  }, [fetchTendencia]);

  return { data, loading, error, refetch: fetchTendencia };
}
