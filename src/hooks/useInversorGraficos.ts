import { useState, useEffect } from 'react';
import { api } from '@/config/api'; // Using authenticated API instance

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
    console.log('📊 [useGraficoDia] Hook called with:', { equipamentoId, data });

    if (!equipamentoId) {
      console.log('📊 [useGraficoDia] No equipamentoId provided, skipping fetch');
      setGraficoDia(null);
      return;
    }

    const fetchGraficoDia = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = data ? { data } : {};
        const url = `/equipamentos-dados/${equipamentoId}/grafico-dia`;
        console.log('📊 [GRAFICO DIA] Buscando dados de:', url);
        console.log('📊 [GRAFICO DIA] Params:', params);

        const response = await api.get(url, {
          params
        });

        console.log('📊 [GRAFICO DIA] Response status:', response.status);
        console.log('📊 [GRAFICO DIA] Response headers:', response.headers);
        console.log('📊 [GRAFICO DIA] Response data type:', typeof response.data);
        console.log('📊 [GRAFICO DIA] Response completa:', response.data);

        // Verificar se recebemos dados válidos
        if (!response.data) {
          console.error('❌ [GRAFICO DIA] Resposta vazia do servidor');
          setError('Resposta vazia do servidor');
          setGraficoDia(null);
          return;
        }

        // API pode retornar dados em diferentes formatos
        let graficoDados = response.data;

        // Se a resposta tem a estrutura { success, data, meta }
        if (response.data.hasOwnProperty('data')) {
          graficoDados = response.data.data;
        }

        console.log('📊 [GRAFICO DIA] Dados extraídos:', graficoDados);
        console.log('📊 [GRAFICO DIA] Tipo dos dados:', typeof graficoDados);
        console.log('📊 [GRAFICO DIA] Tem dados.dados?', graficoDados?.dados);

        setGraficoDia(graficoDados);
      } catch (err: any) {
        console.error('❌ [GRAFICO DIA] Erro ao buscar:', err);
        console.error('❌ [GRAFICO DIA] Response:', err.response);
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
        const url = `/equipamentos-dados/${equipamentoId}/grafico-mes`;
        console.log('📊 [GRAFICO MES] Buscando dados de:', url);
        console.log('📊 [GRAFICO MES] Params:', params);

        const response = await api.get(url, { params });

        console.log('📊 [GRAFICO MES] Response status:', response.status);
        console.log('📊 [GRAFICO MES] Response completa:', response.data);

        // API retorna { success, data, meta } - extrair apenas data
        const graficoDados = response.data.data || response.data;
        console.log('📊 [GRAFICO MES] Dados extraídos:', graficoDados);
        setGraficoMes(graficoDados);
      } catch (err: any) {
        console.error('❌ [GRAFICO MES] Erro ao buscar:', err);
        console.error('❌ [GRAFICO MES] Response:', err.response);
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
        const url = `/equipamentos-dados/${equipamentoId}/grafico-ano`;
        console.log('📊 [GRAFICO ANO] Buscando dados de:', url);
        console.log('📊 [GRAFICO ANO] Params:', params);

        const response = await api.get(url, { params });

        console.log('📊 [GRAFICO ANO] Response status:', response.status);
        console.log('📊 [GRAFICO ANO] Response completa:', response.data);

        // API retorna { success, data, meta } - extrair apenas data
        const graficoDados = response.data.data || response.data;
        console.log('📊 [GRAFICO ANO] Dados extraídos:', graficoDados);
        setGraficoAno(graficoDados);
      } catch (err: any) {
        console.error('❌ [GRAFICO ANO] Erro ao buscar:', err);
        console.error('❌ [GRAFICO ANO] Response:', err.response);
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
