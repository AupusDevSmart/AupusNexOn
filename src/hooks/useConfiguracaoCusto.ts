import { useState, useEffect, useCallback } from 'react';
import equipamentosDadosService from '@/services/equipamentos-dados.service';
import type { ConfiguracaoCustoDto } from '@/types/dtos/custos-energia-dto';

interface UseConfiguracaoCustoReturn {
  config: ConfiguracaoCustoDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  salvar: (data: Partial<ConfiguracaoCustoDto>) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useConfiguracaoCusto(
  equipamentoId: string | null,
  enabled = true,
): UseConfiguracaoCustoReturn {
  const [config, setConfig] = useState<ConfiguracaoCustoDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!equipamentoId || !enabled) {
      setConfig(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await equipamentosDadosService.getConfiguracaoCusto(equipamentoId);
      const data = response?.data ?? response;
      setConfig(data);
    } catch (err: any) {
      console.error('[useConfiguracaoCusto] Erro ao buscar config:', err);
      setError(err.message || 'Erro ao buscar configuracao');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [equipamentoId, enabled]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const salvar = useCallback(
    async (data: Partial<ConfiguracaoCustoDto>): Promise<boolean> => {
      if (!equipamentoId) return false;

      setSaving(true);
      setError(null);

      try {
        const response = await equipamentosDadosService.upsertConfiguracaoCusto(equipamentoId, data);
        const updated = response?.data ?? response;
        setConfig(updated);
        return true;
      } catch (err: any) {
        console.error('[useConfiguracaoCusto] Erro ao salvar config:', err);
        setError(err.message || 'Erro ao salvar configuracao');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [equipamentoId],
  );

  return { config, loading, saving, error, salvar, refetch: fetchConfig };
}
