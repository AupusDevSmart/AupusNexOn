import { useState, useEffect, useRef, useCallback } from 'react';
import { coaApi, type DashboardData } from '../api/coa-api';
import { useToast } from '@/hooks/use-toast';

interface UseCoaDashboardOptions {
  clienteId?: string;
  pollingInterval?: number; // em segundos, padrão 30
  enablePolling?: boolean;
}

interface UseCoaDashboardReturn {
  data: DashboardData | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdate: Date | null;
  isStale: boolean;
  refresh: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

/**
 * Hook para consumir dados do dashboard COA com polling inteligente
 *
 * Features:
 * - Polling automático quando a aba está ativa
 * - Pausa polling quando aba inativa (economia de recursos)
 * - Indicador de dados desatualizados (stale)
 * - Refresh manual disponível
 * - Cache no frontend por 30 segundos
 */
export function useCoaDashboard(
  options: UseCoaDashboardOptions = {}
): UseCoaDashboardReturn {
  const {
    clienteId,
    pollingInterval = 30, // 30 segundos padrão
    enablePolling = true,
  } = options;

  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTime = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Cache frontend de 30 segundos para evitar requisições desnecessárias
  const CACHE_TIME = 30000; // 30 segundos
  const STALE_TIME = 60000; // 1 minuto para considerar dados desatualizados

  /**
   * Busca dados do dashboard
   */
  const fetchDashboard = useCallback(async (forceRefresh = false) => {
    // Evita requisições muito frequentes (cache frontend)
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime.current < CACHE_TIME) {
      console.log('[COA] Usando cache do frontend, pulando requisição');
      return;
    }

    try {
      setError(null);

      // Só mostra loading na primeira vez
      if (!data) {
        setIsLoading(true);
      }

      console.log('[COA] Buscando dados do dashboard...');
      const response = await coaApi.getDashboard(clienteId);

      console.log('[COA] Resposta da API recebida:', response);
      console.log('[COA] Tipo da resposta:', typeof response);
      console.log('[COA] Keys da resposta:', Object.keys(response || {}));

      if (!isMountedRef.current) {
        console.log('[COA] Componente desmontado, ignorando resposta');
        return;
      }

      console.log('[COA] Atualizando estado com dados...');
      setData(response);
      setLastUpdate(new Date());
      setIsStale(false);
      lastFetchTime.current = now;

      console.log('[COA] Dados atualizados:', {
        totalUnidades: response?.resumoGeral?.totalUnidades,
        unidadesOnline: response?.resumoGeral?.unidadesOnline,
        timestamp: response?.timestamp,
      });
    } catch (err) {
      if (!isMountedRef.current) return;

      console.error('[COA] ERRO ao buscar dados:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar dados do COA';
      setError(new Error(errorMessage));

      // Só mostra toast se não tiver dados (evita spam de erros)
      if (!data) {
        toast({
          title: 'Erro ao carregar dashboard',
          description: errorMessage,
          variant: 'destructive',
        });
      }

      console.error('[COA] Erro ao buscar dados:', err);
    } finally {
      if (isMountedRef.current) {
        console.log('[COA] Finalizando requisição - setIsLoading(false)');
        setIsLoading(false);
      } else {
        console.log('[COA] Componente desmontado no finally, não atualizando isLoading');
      }
    }
  }, [clienteId, data, toast]);

  /**
   * Força refresh com limpeza de cache do backend
   */
  const forceRefresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[COA] Forçando refresh do cache...');
      const response = await coaApi.refreshDashboard(clienteId);

      if (!isMountedRef.current) return;

      setData(response);
      setLastUpdate(new Date());
      setIsStale(false);
      lastFetchTime.current = Date.now();

      toast({
        title: 'Dashboard atualizado',
        description: 'Dados atualizados com sucesso',
      });
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar dashboard';
      setError(new Error(errorMessage));

      toast({
        title: 'Erro ao atualizar',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clienteId, toast]);

  /**
   * Configura polling inteligente
   */
  useEffect(() => {
    if (!enablePolling) return;

    const startPolling = () => {
      // Limpa interval anterior se existir
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Inicia novo polling
      intervalRef.current = setInterval(() => {
        fetchDashboard();
      }, pollingInterval * 1000);

      console.log(`[COA] Polling iniciado (${pollingInterval}s)`);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[COA] Polling pausado');
      }
    };

    // Handler para visibilidade da aba
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Busca dados imediatamente ao voltar para aba
        fetchDashboard();
        startPolling();
      }
    };

    // Handler para foco da janela
    const handleFocus = () => {
      // Atualiza se dados estiverem muito antigos
      const now = Date.now();
      if (now - lastFetchTime.current > STALE_TIME) {
        fetchDashboard();
      }
    };

    // Busca inicial
    fetchDashboard();

    // Inicia polling se aba estiver visível
    if (!document.hidden) {
      startPolling();
    }

    // Adiciona listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pollingInterval, enablePolling, fetchDashboard]);

  /**
   * Controla mounted state
   */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Verifica se dados estão desatualizados
   */
  useEffect(() => {
    if (!lastUpdate) return;

    const checkStale = () => {
      const now = Date.now();
      const lastUpdateTime = lastUpdate.getTime();

      if (now - lastUpdateTime > STALE_TIME) {
        setIsStale(true);
      }
    };

    const staleInterval = setInterval(checkStale, 10000); // Verifica a cada 10s

    return () => clearInterval(staleInterval);
  }, [lastUpdate]);

  return {
    data,
    isLoading,
    error,
    lastUpdate,
    isStale,
    refresh: () => fetchDashboard(true),
    forceRefresh,
  };
}