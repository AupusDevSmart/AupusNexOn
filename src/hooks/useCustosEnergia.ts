import { useState, useEffect, useCallback } from 'react';
import equipamentosDadosService from '@/services/equipamentos-dados.service';
import type {
  CustosEnergiaResponseDto,
  PeriodoTipo,
} from '@/types/dtos/custos-energia-dto';

interface UseCustosEnergiaParams {
  equipamentoId: string | null;
  periodo?: PeriodoTipo;
  data?: string; // ISO 8601 format (YYYY-MM-DD) - usado com periodo=dia ou periodo=mes
  timestamp_inicio?: string; // ISO 8601 completo - usado com periodo=custom
  timestamp_fim?: string; // ISO 8601 completo - usado com periodo=custom
  enabled?: boolean; // Se false, não faz a busca automática
}

interface UseCustosEnergiaReturn {
  data: CustosEnergiaResponseDto | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar dados de custos de energia de um equipamento M160
 *
 * ✅ ATUALIZADO: Suporta 3 modos de filtro
 *
 * @example
 * // Modo 1: Dia específico
 * ```tsx
 * const { data, loading, error, refetch } = useCustosEnergia({
 *   equipamentoId: 'cmhnk06ka009l2fbkd1o2tyua',
 *   periodo: 'dia',
 *   data: '2025-11-07',
 * });
 * ```
 *
 * @example
 * // Modo 2: Mês específico
 * ```tsx
 * const { data, loading, error, refetch } = useCustosEnergia({
 *   equipamentoId: 'cmhnk06ka009l2fbkd1o2tyua',
 *   periodo: 'mes',
 *   data: '2025-11',
 * });
 * ```
 *
 * @example
 * // Modo 3: Período customizado
 * ```tsx
 * const { data, loading, error, refetch } = useCustosEnergia({
 *   equipamentoId: 'cmhnk06ka009l2fbkd1o2tyua',
 *   periodo: 'custom',
 *   timestamp_inicio: '2025-11-01T00:00:00Z',
 *   timestamp_fim: '2025-11-15T23:59:59Z',
 * });
 * ```
 */
export function useCustosEnergia({
  equipamentoId,
  periodo,
  data,
  timestamp_inicio,
  timestamp_fim,
  enabled = true,
}: UseCustosEnergiaParams): UseCustosEnergiaReturn {
  const [custos, setCustos] = useState<CustosEnergiaResponseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustos = useCallback(async () => {
    if (!equipamentoId || !enabled) {
      setCustos(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(
        `💰 [useCustosEnergia] Buscando custos para equipamento ${equipamentoId}`,
        { periodo, data, timestamp_inicio, timestamp_fim }
      );

      const response = await equipamentosDadosService.getCustosEnergia(equipamentoId, {
        periodo,
        data,
        timestamp_inicio,
        timestamp_fim,
      });

      console.log('✅ [useCustosEnergia] Resposta recebida:', response);

      // Service retorna response.data ja desempacotado pelo interceptor
      let custosData: CustosEnergiaResponseDto;

      if (response?.periodo && response?.custos) {
        custosData = response;
      } else if (response?.data?.periodo && response?.data?.custos) {
        custosData = response.data;
      } else {
        console.error('[useCustosEnergia] Formato inesperado:', response);
        throw new Error('Formato de resposta invalido');
      }

      console.log('✅ [useCustosEnergia] Dados de custos processados:', custosData);
      setCustos(custosData);
    } catch (err: any) {
      console.error('❌ [useCustosEnergia] Erro ao buscar custos:', err);
      setError(err.message || 'Erro ao buscar dados de custos');
      setCustos(null);
    } finally {
      setLoading(false);
    }
  }, [equipamentoId, periodo, data, timestamp_inicio, timestamp_fim, enabled]);

  useEffect(() => {
    fetchCustos();
  }, [fetchCustos]);

  return {
    data: custos,
    loading,
    error,
    refetch: fetchCustos,
  };
}

/**
 * Hook simplificado para buscar custos do dia atual
 */
export function useCustosEnergiaDia(equipamentoId: string | null, enabled = true) {
  return useCustosEnergia({
    equipamentoId,
    periodo: 'dia',
    enabled,
  });
}

/**
 * Hook simplificado para buscar custos do mês atual
 */
export function useCustosEnergiaMes(equipamentoId: string | null, enabled = true) {
  return useCustosEnergia({
    equipamentoId,
    periodo: 'mes',
    enabled,
  });
}
