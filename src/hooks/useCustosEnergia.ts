import { useState, useEffect, useCallback } from 'react';
import equipamentosDadosService from '@/services/equipamentos-dados.service';
import type {
  CustosEnergiaResponseDto,
  PeriodoTipo,
} from '@/types/dtos/custos-energia-dto';

interface UseCustosEnergiaParams {
  equipamentoId: string | null;
  periodo: PeriodoTipo;
  data?: string; // ISO 8601 format (YYYY-MM-DD)
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
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useCustosEnergia({
 *   equipamentoId: 'cmhnk06ka009l2fbkd1o2tyua',
 *   periodo: 'dia',
 *   data: '2025-11-07',
 * });
 * ```
 */
export function useCustosEnergia({
  equipamentoId,
  periodo,
  data,
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
        { periodo, data }
      );

      const response = await equipamentosDadosService.getCustosEnergia(equipamentoId, {
        periodo,
        data,
      });

      console.log('✅ [useCustosEnergia] Resposta recebida:', response);

      // A resposta pode vir com wrapper { success: true, data: {...} }
      // ou diretamente como o objeto de dados
      let custosData: CustosEnergiaResponseDto;

      if (response.success && response.data) {
        // Resposta com wrapper global
        custosData = response.data;
      } else if (response.periodo && response.custos) {
        // Resposta direta (já é o objeto de custos)
        custosData = response;
      } else {
        console.error('❌ [useCustosEnergia] Formato de resposta inesperado:', response);
        throw new Error('Formato de resposta inválido');
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
  }, [equipamentoId, periodo, data, enabled]);

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
