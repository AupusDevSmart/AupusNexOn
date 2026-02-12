// src/hooks/useCategorias.ts
import { useState, useEffect } from 'react';
import { categoriasEquipamentosApi, type CategoriaEquipamento } from '@/services/tipos-equipamentos.services';

// Desabilitar logs de debug em produção
const noop = () => {};
if (import.meta.env.PROD) {
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}


export interface UseCategoriasReturn {
  categorias: CategoriaEquipamento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar categorias de equipamentos
 * Retorna lista de categorias ordenadas alfabeticamente
 */
export const useCategorias = (): UseCategoriasReturn => {
  const [categorias, setCategorias] = useState<CategoriaEquipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategorias = async () => {
    try {
      setLoading(true);
      setError(null);
      // console.log('🔍 [useCategorias] Iniciando fetch de categorias...');
      const data = await categoriasEquipamentosApi.getAll();
      // console.log('✅ [useCategorias] Categorias recebidas:', data);

      if (!Array.isArray(data) || data.length === 0) {
        // console.warn('⚠️ [useCategorias] Nenhuma categoria retornada pela API');
        setError('Nenhuma categoria encontrada. Verifique se as categorias foram criadas no banco de dados.');
      }

      setCategorias(data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Erro ao carregar categorias';
      setError(errorMsg);
      console.error('❌ [useCategorias] Erro ao carregar categorias:', {
        error: err,
        response: err.response?.data,
        status: err.response?.status
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  return {
    categorias,
    loading,
    error,
    refetch: fetchCategorias,
  };
};
