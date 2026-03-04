import { useState, useEffect } from 'react';
import { api } from '@/config/api';

interface GraficoDiaData {
  data: string;
  total_pontos: number;
  intervalo_minutos?: number;
  dados: Array<{
    timestamp: string;
    hora: string;
    potencia_kw: number;
    potencia_min?: number;
    potencia_max?: number;
    num_leituras: number;
    qualidade: string;
  }>;
}

interface GraficoMesData {
  mes: string;
  total_dias: number;
  energia_total_kwh: number;
  dados: Array<{
    data: string;
    dia: number;
    energia_kwh: number;
    potencia_media_kw: number;
    num_registros: number;
  }>;
}

interface GraficoAnoData {
  ano: number;
  total_meses: number;
  energia_total_kwh: number;
  dados: Array<{
    mes: string;
    mes_numero: number;
    mes_nome: string;
    energia_kwh: number;
    potencia_media_kw: number;
    num_registros: number;
  }>;
}

export function useGraficoDia(equipamentoId: string | null, data?: string, intervalo?: string) {
  const [graficoDia, setGraficoDia] = useState<GraficoDiaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!equipamentoId) {
      setGraficoDia(null);
      return;
    }

    const fetchGraficoDia = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (data) params.data = data;
        if (intervalo) params.intervalo = intervalo;

        const response = await api.get(`/equipamentos-dados/${equipamentoId}/grafico-dia`, { params });

        if (!response.data) {
          setError('Resposta vazia do servidor');
          setGraficoDia(null);
          return;
        }

        const graficoDados = response.data.hasOwnProperty('data') && response.data.hasOwnProperty('success')
          ? response.data.data
          : response.data;

        setGraficoDia(graficoDados);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar gráfico do dia');
        setGraficoDia(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGraficoDia();
  }, [equipamentoId, data, intervalo]);

  return { data: graficoDia, loading, error };
}

export function useGraficoMes(equipamentoId: string | null, mes?: string) {
  const [graficoMes, setGraficoMes] = useState<GraficoMesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!equipamentoId) {
      setGraficoMes(null);
      return;
    }

    const fetchGraficoMes = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = mes ? { mes } : {};
        const response = await api.get(`/equipamentos-dados/${equipamentoId}/grafico-mes`, { params });
        const graficoDados = response.data.data || response.data;
        setGraficoMes(graficoDados);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar gráfico do mês');
        setGraficoMes(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGraficoMes();
  }, [equipamentoId, mes]);

  return { data: graficoMes, loading, error };
}

export function useGraficoAno(equipamentoId: string | null, ano?: string) {
  const [graficoAno, setGraficoAno] = useState<GraficoAnoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!equipamentoId) {
      setGraficoAno(null);
      return;
    }

    const fetchGraficoAno = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = ano ? { ano } : {};
        const response = await api.get(`/equipamentos-dados/${equipamentoId}/grafico-ano`, { params });
        const graficoDados = response.data.data || response.data;
        setGraficoAno(graficoDados);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar gráfico do ano');
        setGraficoAno(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGraficoAno();
  }, [equipamentoId, ano]);

  return { data: graficoAno, loading, error };
}
