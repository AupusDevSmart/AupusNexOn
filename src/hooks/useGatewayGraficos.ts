import { useEffect, useState } from "react";
import { api } from "@/config/api";

// Constante de divisao do medidor SSU acoplado ao A966 (kWh = leitura_bruta * KD).
// Espelha KD_A966_SSU em a966-modal.tsx.
const KD_A966_SSU = 0.3;

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
        const dados = (payload?.dados ?? []).map((p: GatewayGraficoDiaPonto) => ({
          ...p,
          phf_kw: p.phf_kw * KD_A966_SSU,
          phr_kw: p.phr_kw * KD_A966_SSU,
        }));
        setGrafico({ ...payload, dados });
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
        const dados = (payload?.dados ?? []).map((p: GatewayGraficoMesPonto) => ({
          ...p,
          phf_kw_avg: p.phf_kw_avg * KD_A966_SSU,
          phr_kw_avg: p.phr_kw_avg * KD_A966_SSU,
        }));
        setGrafico({ ...payload, dados });
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
