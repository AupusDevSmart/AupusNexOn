import { useState, useCallback } from 'react';

export interface EnderecoViaCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

interface UseViaCEPReturn {
  endereco: EnderecoViaCEP | null;
  loading: boolean;
  error: string | null;
  buscarCEP: (cep: string) => Promise<EnderecoViaCEP | null>;
  limparEndereco: () => void;
}

export function useViaCEP(): UseViaCEPReturn {
  const [endereco, setEndereco] = useState<EnderecoViaCEP | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limparEndereco = useCallback(() => {
    setEndereco(null);
    setError(null);
  }, []);

  const formatarCEP = (cep: string): string => {
    // Remove tudo que não for número
    const numerosCEP = cep.replace(/\D/g, '');
    
    // Verifica se tem 8 dígitos
    if (numerosCEP.length !== 8) {
      throw new Error('CEP deve ter 8 dígitos');
    }
    
    return numerosCEP;
  };

  const validarCEP = (cep: string): boolean => {
    const numerosCEP = cep.replace(/\D/g, '');
    
    // Verifica se tem 8 dígitos
    if (numerosCEP.length !== 8) {
      return false;
    }
    
    // Verifica se não são todos números iguais (ex: 00000000, 11111111)
    if (/^(\d)\1{7}$/.test(numerosCEP)) {
      return false;
    }
    
    return true;
  };

  const buscarCEP = useCallback(async (cep: string): Promise<EnderecoViaCEP | null> => {
    try {
      setLoading(true);
      setError(null);
      setEndereco(null);

      // Validar CEP
      if (!validarCEP(cep)) {
        throw new Error('CEP inválido. Digite um CEP válido com 8 dígitos.');
      }

      const cepFormatado = formatarCEP(cep);
      
      // Buscar na API do ViaCEP
      const response = await fetch(`https://viacep.com.br/ws/${cepFormatado}/json/`);
      
      if (!response.ok) {
        throw new Error('Erro ao consultar CEP. Tente novamente.');
      }
      
      const data: EnderecoViaCEP = await response.json();
      
      // Verificar se o CEP foi encontrado
      if (data.erro) {
        throw new Error('CEP não encontrado. Verifique o CEP digitado.');
      }
      
      // Verificar se retornou dados válidos
      if (!data.logradouro && !data.bairro && !data.localidade) {
        throw new Error('CEP encontrado, mas sem dados de endereço disponíveis.');
      }
      
      setEndereco(data);
      return data;
      
    } catch (error) {
      // console.error('Erro ao buscar CEP:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar CEP';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    endereco,
    loading,
    error,
    buscarCEP,
    limparEndereco,
  };
}

// Hook simplificado para busca única de CEP
export function useBuscarCEP() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarCEP = useCallback(async (cep: string): Promise<EnderecoViaCEP | null> => {
    try {
      setLoading(true);
      setError(null);

      // Validar CEP
      const numerosCEP = cep.replace(/\D/g, '');
      
      if (numerosCEP.length !== 8) {
        throw new Error('CEP deve ter 8 dígitos');
      }
      
      if (/^(\d)\1{7}$/.test(numerosCEP)) {
        throw new Error('CEP inválido');
      }
      
      // Buscar na API
      const response = await fetch(`https://viacep.com.br/ws/${numerosCEP}/json/`);
      
      if (!response.ok) {
        throw new Error('Erro ao consultar CEP');
      }
      
      const data: EnderecoViaCEP = await response.json();
      
      if (data.erro) {
        throw new Error('CEP não encontrado');
      }
      
      return data;
      
    } catch (error) {
      // console.error('Erro ao buscar CEP:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { buscarCEP, loading, error };
}