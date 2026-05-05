import { useEffect, useState } from "react";
import { api } from "@/config/api";

export interface GatewayGraficoDiaPonto {
  timestamp: string;
  hora: string;
  phf_kw: number;
  phr_kw: number;
  num_leituras: number;
}

export interface GatewayGraficoDiaData {
  data: string;
  total_pontos: number;
  intervalo_minutos: number;
  dados: GatewayGraficoDiaPonto[];
}

export interface GatewayGraficoMesPonto {
  data: string;
  dia: number;
  phf_kw_avg: number;
  phr_kw_avg: number;
  num_registros: number;
}

export interface GatewayGraficoMesData {
  mes: string;
  total_dias: number;
  dados: GatewayGraficoMesPonto[];
}

export function useGatewayGraficoDia(
  equipamentoId: string | null,
  data?: string,
  intervalo?: string,
  inicio?: string,
  fim?: string,
) {
  const [grafico, setGrafico] = useState<GatewayGraficoDiaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!equipamentoId) {
      setGrafico(null);
      return;
    }

    const fetchGrafico = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (data) params.data = data;
        if (intervalo) params.intervalo = intervalo;
        if (inicio) params.inicio = inicio;
        if (fim) params.fim = fim;

        const response = await api.get(
          `/equipamentos-dados/${equipamentoId.trim()}/gateway/grafico-dia`,
          { params },
        );

        const payload = response.data?.data ?? response.data;
        setGrafico(payload);
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao carregar gráfico do dia");
        setGrafico(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGrafico();
  }, [equipamentoId, data, intervalo, inicio, fim]);

  return { data: grafico, loading, error };
}

export function useGatewayGraficoMes(equipamentoId: string | null, mes?: string) {
  const [grafico, setGrafico] = useState<GatewayGraficoMesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!equipamentoId) {
      setGrafico(null);
      return;
    }

    const fetchGrafico = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = mes ? { mes } : {};
        const response = await api.get(
          `/equipamentos-dados/${equipamentoId.trim()}/gateway/grafico-mes`,
          { params },
        );
        const payload = response.data?.data ?? response.data;
        setGrafico(payload);
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao carregar gráfico do mês");
        setGrafico(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGrafico();
  }, [equipamentoId, mes]);

  return { data: grafico, loading, error };
}
