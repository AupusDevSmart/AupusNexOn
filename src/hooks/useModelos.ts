// src/hooks/useModelos.ts
import { useState, useEffect, useMemo } from 'react';
import { tiposEquipamentosApi, type TipoEquipamento } from '@/services/tipos-equipamentos.services';

export interface UseModelosParams {
  categoriaId?: string;
  search?: string;
  autoFetch?: boolean; // Se false, não busca automaticamente
}

export interface UseModelosReturn {
  modelos: TipoEquipamento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar modelos (tipos de equipamentos) filtrados por categoria
 * Suporta busca por texto (código, nome, fabricante)
 *
 * @param categoriaId - ID da categoria para filtrar modelos
 * @param search - Texto de busca (opcional)
 * @param autoFetch - Se true, busca automaticamente ao montar (padrão: true)
 */
export const useModelos = (params?: UseModelosParams): UseModelosReturn => {
  const { categoriaId, search, autoFetch = true } = params || {};

  const [modelos, setModelos] = useState<TipoEquipamento[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchModelos = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await tiposEquipamentosApi.getAll({
        categoria_id: categoriaId,
        search,
      });

      setModelos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar modelos');
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchModelos();
    }
  }, [categoriaId, search, autoFetch]);

  return {
    modelos,
    loading,
    error,
    refetch: fetchModelos,
  };
};

/**
 * Hook auxiliar para buscar modelos agrupados por categoria
 * Útil para exibir em selects com optgroup
 */
export const useModelosAgrupados = () => {
  const { modelos, loading, error, refetch } = useModelos({ autoFetch: true });

  const modelosAgrupados = useMemo(() => {
    const grupos = new Map<string, TipoEquipamento[]>();

    modelos.forEach((modelo) => {
      const categoriaNome = modelo.categoria?.nome || 'Sem Categoria';

      if (!grupos.has(categoriaNome)) {
        grupos.set(categoriaNome, []);
      }

      grupos.get(categoriaNome)!.push(modelo);
    });

    // Converter Map para array de objetos
    return Array.from(grupos.entries()).map(([categoria, items]) => ({
      categoria,
      modelos: items.sort((a, b) => a.nome.localeCompare(b.nome)),
    })).sort((a, b) => a.categoria.localeCompare(b.categoria));
  }, [modelos]);

  return {
    modelosAgrupados,
    modelos,
    loading,
    error,
    refetch,
  };
};
