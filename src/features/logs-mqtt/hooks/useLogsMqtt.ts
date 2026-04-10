import { useState, useEffect, useCallback } from 'react';
import { LogsMqttService } from '@/services/logs-mqtt.services';
import { LogMqtt, LogsMqttFilters } from '../types';

const initialFilters: LogsMqttFilters = {
  search: '',
  equipamentoId: 'all',
  severidade: 'all',
  dataInicial: '',
  dataFinal: '',
  page: 1,
  limit: 10,
};

export function useLogsMqtt() {
  const [logs, setLogs] = useState<LogMqtt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LogsMqttFilters>(initialFilters);

  const fetchLogs = useCallback(async (currentFilters = filters) => {
    try {
      setLoading(true);
      const response = await LogsMqttService.getAll({
        page: currentFilters.page,
        limit: currentFilters.limit,
        search: currentFilters.search || undefined,
        equipamentoId: currentFilters.equipamentoId,
        severidade: currentFilters.severidade !== 'all' ? currentFilters.severidade : undefined,
        dataInicial: currentFilters.dataInicial || undefined,
        dataFinal: currentFilters.dataFinal || undefined,
      });
      const normalized = (response.data || []).map((l: any) => ({
        ...l,
        createdAt: l.created_at,
        updatedAt: l.created_at,
      }));
      setLogs(normalized);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const updateFilters = (newFilters: Partial<LogsMqttFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: newFilters.page || 1 }));
  };

  return { logs, total, loading, filters, setFilters: updateFilters, refresh: () => fetchLogs(filters) };
}
