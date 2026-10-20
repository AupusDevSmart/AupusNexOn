import { useCallback, useEffect, useState } from 'react';
import { useFiltrosNaUrl } from '@/hooks/useEstadoLembrado';
import { RegraNotificacaoLinha, RegrasNotificacaoService } from '@/services/regras-notificacao.services';

const initialFilters = {
  search: '',
  evento: 'all',
  canal: 'all',
  ativo: 'all',
  page: 1,
  limit: 20,
};

export type FiltrosRegras = typeof initialFilters;

export function useRegrasNotificacao() {
  const [regras, setRegras] = useState<RegraNotificacaoLinha[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useFiltrosNaUrl('configuracoes:notificacoes', initialFilters);

  const fetchRegras = useCallback(async () => {
    try {
      setLoading(true);
      const response = await RegrasNotificacaoService.getAll({
        ...filters,
        search: filters.search || undefined,
      });
      setRegras((response.data || []).map((r) => ({ ...r, createdAt: r.created_at, updatedAt: r.updated_at })));
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      console.error('Erro ao carregar regras de notificação:', error);
      setRegras([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRegras();
  }, [fetchRegras]);

  const updateFilters = (novos: Partial<FiltrosRegras>) => {
    setFilters((prev) => ({ ...prev, ...novos, page: novos.page || 1 }));
  };

  return { regras, total, loading, filters, setFilters: updateFilters, refresh: fetchRegras };
}
