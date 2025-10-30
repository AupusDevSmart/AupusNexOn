// src/hooks/useEstadosIBGE.ts

import { useState, useEffect } from 'react';

export interface Estado {
  id: number;
  sigla: string;
  nome: string;
  regiao: {
    id: number;
    sigla: string;
    nome: string;
  };
}

export interface Cidade {
  id: number;
  nome: string;
}

export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
}

/**
 * Hook to fetch Brazilian states from IBGE API
 */
export function useEstadosIBGE() {
  const [estados, setEstados] = useState<Estado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEstados = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome'
        );

        if (!response.ok) {
          throw new Error('Erro ao carregar estados');
        }

        const data = await response.json();
        setEstados(data);
      } catch (err: any) {
        console.error('Erro ao buscar estados:', err);
        setError(err.message || 'Erro ao carregar estados');
      } finally {
        setLoading(false);
      }
    };

    fetchEstados();
  }, []);

  return { estados, loading, error };
}

/**
 * Hook to fetch cities from a specific state from IBGE API
 */
export function useCidadesIBGE(estadoId: number | null) {
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!estadoId) {
      setCidades([]);
      setLoading(false);
      return;
    }

    const fetchCidades = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoId}/municipios?orderBy=nome`
        );

        if (!response.ok) {
          throw new Error('Erro ao carregar cidades');
        }

        const data = await response.json();
        setCidades(data);
      } catch (err: any) {
        console.error('Erro ao buscar cidades:', err);
        setError(err.message || 'Erro ao carregar cidades');
        setCidades([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCidades();
  }, [estadoId]);

  return { cidades, loading, error };
}

/**
 * Hook to fetch address data from ViaCEP API
 */
export function useViaCEP(cep: string, autoFetch: boolean = true) {
  const [data, setData] = useState<ViaCEPResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoFetch) return;

    // Validação defensiva: garantir que cep é uma string
    if (!cep || typeof cep !== 'string') {
      setData(null);
      setLoading(false);
      return;
    }

    const cleanCEP = cep.replace(/\D/g, '');

    if (cleanCEP.length !== 8) {
      setData(null);
      setLoading(false);
      return;
    }

    const fetchCEP = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);

        if (!response.ok) {
          throw new Error('Erro ao buscar CEP');
        }

        const responseData = await response.json();

        if (responseData.erro) {
          throw new Error('CEP não encontrado');
        }

        setData(responseData);
      } catch (err: any) {
        console.error('Erro ao buscar CEP:', err);
        setError(err.message || 'Erro ao buscar CEP');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchCEP();
    }, 500); // Debounce

    return () => clearTimeout(timeoutId);
  }, [cep, autoFetch]);

  return { data, loading, error };
}

/**
 * Format CEP string (12345678 -> 12345-678)
 */
export function formatarCEP(cep: string): string {
  if (!cep || typeof cep !== 'string') return '';
  const numbers = cep.replace(/\D/g, '');
  if (numbers.length !== 8) return cep;
  return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
}

/**
 * Validate CEP format
 */
export function validarCEP(cep: string): boolean {
  if (!cep || typeof cep !== 'string') return false;
  const numbers = cep.replace(/\D/g, '');
  return numbers.length === 8 && /^\d+$/.test(numbers);
}

/**
 * Remove CEP mask
 */
export function limparCEP(cep: string): string {
  if (!cep || typeof cep !== 'string') return '';
  return cep.replace(/\D/g, '');
}
