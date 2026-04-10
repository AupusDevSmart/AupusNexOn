import { useState, useEffect, useCallback } from 'react';
import { RegrasLogsService } from '@/services/regras-logs.services';
import { RegraLog, RegrasLogsFilters } from '../types';

const initialFilters: RegrasLogsFilters = {
  search: '',
  equipamentoId: 'all',
  severidade: 'all',
  ativo: 'all',
  page: 1,
  limit: 10,
};

export function useRegrasLogs() {
  const [regras, setRegras] = useState<RegraLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RegrasLogsFilters>(initialFilters);

  const fetchRegras = useCallback(async (currentFilters = filters) => {
    try {
      setLoading(true);
      const response = await RegrasLogsService.getAll({
        page: currentFilters.page,
        limit: currentFilters.limit,
        search: currentFilters.search || undefined,
        equipamentoId: currentFilters.equipamentoId,
        severidade: currentFilters.severidade !== 'all' ? currentFilters.severidade : undefined,
        ativo: currentFilters.ativo,
      });
      const normalized = (response.data || []).map((r: any) => ({
        ...r,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      setRegras(normalized);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
      setRegras([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRegras();
  }, [fetchRegras]);

  const updateFilters = (newFilters: Partial<RegrasLogsFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: newFilters.page || 1 }));
  };

  return { regras, total, loading, filters, setFilters: updateFilters, refresh: () => fetchRegras(filters) };
}
