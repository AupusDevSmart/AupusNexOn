// src/hooks/useIBGE.ts
import { useState, useEffect, useCallback } from 'react';

export interface Estado {
  id: number;
  sigla: string;
  nome: string;
}

export interface Cidade {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
        nome: string;
      };
    };
  };
}

interface UseIBGEReturn {
  estados: Estado[];
  cidades: Cidade[];
  loadingEstados: boolean;
  loadingCidades: boolean;
  errorEstados: string | null;
  errorCidades: string | null;
  buscarCidades: (estadoId: number) => Promise<void>;
}

export function useIBGE(): UseIBGEReturn {
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [errorEstados, setErrorEstados] = useState<string | null>(null);
  const [errorCidades, setErrorCidades] = useState<string | null>(null);

  // Buscar estados do IBGE
  const buscarEstados = useCallback(async () => {
    try {
      setLoadingEstados(true);
      setErrorEstados(null);
      
      const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados');
      
      if (!response.ok) {
        throw new Error('Erro ao buscar estados');
      }
      
      const data: Estado[] = await response.json();
      
      // Ordenar estados por nome
      const estadosOrdenados = data.sort((a, b) => a.nome.localeCompare(b.nome));
      
      setEstados(estadosOrdenados);
    } catch (error) {
      // console.error('Erro ao buscar estados:', error);
      setErrorEstados(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoadingEstados(false);
    }
  }, []);

  // Buscar cidades por estado
  const buscarCidades = useCallback(async (estadoId: number) => {
    try {
      setLoadingCidades(true);
      setErrorCidades(null);
      setCidades([]); // Limpar cidades anteriores
      
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoId}/municipios`
      );
      
      if (!response.ok) {
        throw new Error('Erro ao buscar cidades');
      }
      
      const data: Cidade[] = await response.json();
      
      // Ordenar cidades por nome
      const cidadesOrdenadas = data.sort((a, b) => a.nome.localeCompare(b.nome));
      
      setCidades(cidadesOrdenadas);
    } catch (error) {
      // console.error('Erro ao buscar cidades:', error);
      setErrorCidades(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoadingCidades(false);
    }
  }, []);

  // Carregar estados ao montar o componente
  useEffect(() => {
    buscarEstados();
  }, [buscarEstados]);

  return {
    estados,
    cidades,
    loadingEstados,
    loadingCidades,
    errorEstados,
    errorCidades,
    buscarCidades,
  };
}

// Hook para buscar apenas estados (mais leve)
export function useEstados() {
  const [estados, setEstados] = useState<Estado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarEstados = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados');
      
      if (!response.ok) {
        throw new Error('Erro ao buscar estados');
      }
      
      const data: Estado[] = await response.json();
      const estadosOrdenados = data.sort((a, b) => a.nome.localeCompare(b.nome));
      
      setEstados(estadosOrdenados);
    } catch (error) {
      // console.error('Erro ao buscar estados:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscarEstados();
  }, [buscarEstados]);

  return { estados, loading, error };
}

// Hook para buscar cidades por estado
export function useCidades(estadoId: number | null) {
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarCidades = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${id}/municipios`
      );
      
      if (!response.ok) {
        throw new Error('Erro ao buscar cidades');
      }
      
      const data: Cidade[] = await response.json();
      const cidadesOrdenadas = data.sort((a, b) => a.nome.localeCompare(b.nome));
      
      setCidades(cidadesOrdenadas);
    } catch (error) {
      // console.error('Erro ao buscar cidades:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (estadoId) {
      buscarCidades(estadoId);
    } else {
      setCidades([]);
    }
  }, [estadoId, buscarCidades]);

  return { cidades, loading, error };
}