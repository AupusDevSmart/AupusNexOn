import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

interface GraficoDiaData {
  data: string;
  total_pontos: number;
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

export function useGraficoDia(equipamentoId: string | null, data?: string) {
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
        const params = data ? { data } : {};
        const response = await axios.get(
          `${API_URL}/equipamentos-dados/${equipamentoId}/grafico-dia`,
          { params }
        );
        console.log('📊 [GRAFICO DIA] Response completa:', response.data);
        // API retorna { success, data, meta } - extrair apenas data
        setGraficoDia(response.data.data || response.data);
      } catch (err: any) {
        console.error('Erro ao buscar gráfico do dia:', err);
        setError(err.response?.data?.message || 'Erro ao carregar gráfico do dia');
        setGraficoDia(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGraficoDia();
  }, [equipamentoId, data]);

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
        const response = await axios.get(
          `${API_URL}/equipamentos-dados/${equipamentoId}/grafico-mes`,
          { params }
        );
        console.log('📊 [GRAFICO MES] Response completa:', response.data);
        // API retorna { success, data, meta } - extrair apenas data
        setGraficoMes(response.data.data || response.data);
      } catch (err: any) {
        console.error('Erro ao buscar gráfico do mês:', err);
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
        const response = await axios.get(
          `${API_URL}/equipamentos-dados/${equipamentoId}/grafico-ano`,
          { params }
        );
        console.log('📊 [GRAFICO ANO] Response completa:', response.data);
        // API retorna { success, data, meta } - extrair apenas data
        setGraficoAno(response.data.data || response.data);
      } catch (err: any) {
        console.error('Erro ao buscar gráfico do ano:', err);
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
