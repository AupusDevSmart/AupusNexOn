import { useState, useEffect, useCallback } from 'react';
import { OrganizacaoDTO } from '@/types/dtos/organizacao-dto';
import { api } from '@/config/api';

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

      // ✅ CORRIGIDO: Chamada real para API de organizações
      const response = await api.get('/organizacoes');
      const data = response.data?.data || response.data || [];

      if (!Array.isArray(data)) {
        console.warn('⚠️ [useOrganizacoes] Resposta da API não é um array:', data);
        setError('Nenhuma organização encontrada');
        setOrganizacoes([]);
        return;
      }

      if (data.length === 0) {
        console.warn('⚠️ [useOrganizacoes] Nenhuma organização cadastrada no sistema');
        setError('Nenhuma organização cadastrada');
      }

      setOrganizacoes(data);

    } catch (error) {
      console.error('❌ [useOrganizacoes] Erro ao buscar organizações:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar organizações');
      setOrganizacoes([]);
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