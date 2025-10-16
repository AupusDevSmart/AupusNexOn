import { useState, useEffect, useCallback } from 'react';
import { OrganizacaoDTO } from '@/types/dtos/organizacao-dto';

interface UseOrganizacoesReturn {
  organizacoes: OrganizacaoDTO[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useOrganizacoes(): UseOrganizacoesReturn {
  const [organizacoes, setOrganizacoes] = useState<OrganizacaoDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizacoes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Implementar chamada real para API de organizações
      // Por enquanto, vou simular algumas organizações baseadas no DTO
      const mockOrganizacoes: OrganizacaoDTO[] = [
        {
          id: '1',
          nome: 'Aupus Energy',
          email: 'contato@aupus.com.br',
          documento: '12.345.678/0001-90',
          status: 'Ativo',
          usuarios_count: 45
        },
        {
          id: '2', 
          nome: 'Solar Brasil',
          email: 'contato@solarbrasil.com.br',
          documento: '98.765.432/0001-10',
          status: 'Ativo',
          usuarios_count: 23
        },
        {
          id: '3',
          nome: 'Green Energy Corp',
          email: 'admin@greenenergy.com.br',
          documento: '11.222.333/0001-44',
          status: 'Ativo',
          usuarios_count: 67
        },
        {
          id: '4',
          nome: 'Energia Limpa Ltda',
          email: 'contato@energialimpa.com.br',
          documento: '55.666.777/0001-88',
          status: 'Inativo',
          usuarios_count: 12
        }
      ];
      
      setOrganizacoes(mockOrganizacoes);
      
    } catch (error) {
      // console.error('Erro ao buscar organizações:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizacoes();
  }, [fetchOrganizacoes]);

  return {
    organizacoes,
    loading,
    error,
    refetch: fetchOrganizacoes,
  };
}

// Hook simplificado para uma organização específica
export function useOrganizacao(id: string | null) {
  const { organizacoes, loading, error } = useOrganizacoes();
  
  const organizacao = organizacoes.find(org => org.id === id) || null;
  
  return {
    organizacao,
    loading,
    error,
  };
}