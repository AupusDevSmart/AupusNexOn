import { useState, useEffect, useCallback } from 'react';
import { equipamentosDadosService } from '../services/equipamentos-dados.service';

/**
 * Tipos de dados para os gráficos de múltiplos inversores
 */
export interface GraficoDiaMultiplosData {
  data: string;
  total_pontos: number;
  total_inversores: number;
  inversores: Array<{
    id: string;
    nome: string;
  }>;
  dados: Array<{
    timestamp: string;
    hora: string;
    potencia_kw: number;
    potencia_min: number;
    potencia_max: number;
    potencia_media: number;
    num_inversores: number;
    num_leituras: number;
    qualidade: string;
  }>;
}

export interface GraficoMesMultiplosData {
  mes: string;
  total_dias: number;
  total_inversores: number;
  energia_total_kwh: number;
  inversores: Array<{
    id: string;
    nome: string;
  }>;
  dados: Array<{
    data: string;
    dia: number;
    energia_kwh: number;
    potencia_media_kw: number;
    potencia_max_kw: number;
    num_inversores: number;
    num_registros: number;
  }>;
}

export interface GraficoAnoMultiplosData {
  ano: number;
  total_meses: number;
  total_inversores: number;
  energia_total_kwh: number;
  inversores: Array<{
    id: string;
    nome: string;
  }>;
  dados: Array<{
    mes: string;
    mes_numero: number;
    mes_nome: string;
    energia_kwh: number;
    potencia_media_kw: number;
    potencia_max_kw: number;
    num_inversores: number;
    num_registros: number;
  }>;
}

/**
 * Hook para buscar dados agregados do dia de múltiplos inversores
 */
export function useGraficoDiaMultiplosInversores(
  equipamentosIds: string[],
  data?: string
) {
  const [dados, setDados] = useState<GraficoDiaMultiplosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    if (!equipamentosIds || equipamentosIds.length === 0) {
      setDados(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await equipamentosDadosService.getGraficoDiaMultiplosInversores(
        equipamentosIds,
        data
      );
      setDados(response);
    } catch (err) {
      console.error('Erro ao buscar dados do gráfico diário (múltiplos):', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, [equipamentosIds, data]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  return { dados, loading, error, refetch: fetchDados };
}

/**
 * Hook para buscar dados agregados do mês de múltiplos inversores
 */
export function useGraficoMesMultiplosInversores(
  equipamentosIds: string[],
  mes?: string
) {
  const [dados, setDados] = useState<GraficoMesMultiplosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    if (!equipamentosIds || equipamentosIds.length === 0) {
      setDados(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await equipamentosDadosService.getGraficoMesMultiplosInversores(
        equipamentosIds,
        mes
      );
      setDados(response);
    } catch (err) {
      console.error('Erro ao buscar dados do gráfico mensal (múltiplos):', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, [equipamentosIds, mes]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  return { dados, loading, error, refetch: fetchDados };
}

/**
 * Hook para buscar dados agregados do ano de múltiplos inversores
 */
export function useGraficoAnoMultiplosInversores(
  equipamentosIds: string[],
  ano?: string
) {
  const [dados, setDados] = useState<GraficoAnoMultiplosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    if (!equipamentosIds || equipamentosIds.length === 0) {
      setDados(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await equipamentosDadosService.getGraficoAnoMultiplosInversores(
        equipamentosIds,
        ano
      );
      setDados(response);
    } catch (err) {
      console.error('Erro ao buscar dados do gráfico anual (múltiplos):', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, [equipamentosIds, ano]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  return { dados, loading, error, refetch: fetchDados };
}