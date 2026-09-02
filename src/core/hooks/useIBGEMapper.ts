// src/hooks/useIBGEMapper.ts
import { useEstados, useCidades } from './useIBGE';
import { useCallback } from 'react';

/**
 * Hook para mapear nomes de estado/cidade para IDs do IBGE e vice-versa
 */
export function useIBGEMapper() {
  const { estados } = useEstados();

  /**
   * Busca o ID do estado pela sigla (ex: "GO" → "52")
   */
  const getEstadoIdBySigla = useCallback((sigla: string): string | null => {
    const estado = estados.find(e => e.sigla.toLowerCase() === sigla.toLowerCase());
    return estado ? estado.id.toString() : null;
  }, [estados]);

  /**
   * Busca a sigla do estado pelo ID (ex: "52" → "GO")
   */
  const getEstadoSiglaById = useCallback((id: string): string | null => {
    const estado = estados.find(e => e.id.toString() === id);
    return estado ? estado.sigla : null;
  }, [estados]);

  /**
   * Busca o nome do estado pelo ID (ex: "52" → "Goiás")
   */
  const getEstadoNomeById = useCallback((id: string): string | null => {
    const estado = estados.find(e => e.id.toString() === id);
    return estado ? estado.nome : null;
  }, [estados]);

  /**
   * Busca dados completos do estado pela sigla
   */
  const getEstadoBySigla = useCallback((sigla: string) => {
    return estados.find(e => e.sigla.toLowerCase() === sigla.toLowerCase()) || null;
  }, [estados]);

  return {
    estados,
    getEstadoIdBySigla,
    getEstadoSiglaById,
    getEstadoNomeById,
    getEstadoBySigla,
  };
}

/**
 * Hook para mapear cidade por nome (requer estadoId)
 */
export function useCidadeMapper(estadoId: number | null) {
  const { cidades } = useCidades(estadoId);

  /**
   * Busca o ID da cidade pelo nome (ex: "Goiânia" → "5208707")
   */
  const getCidadeIdByNome = useCallback((nome: string): string | null => {
    const cidade = cidades.find(c => c.nome.toLowerCase() === nome.toLowerCase());
    return cidade ? cidade.id.toString() : null;
  }, [cidades]);

  /**
   * Busca o nome da cidade pelo ID (ex: "5208707" → "Goiânia")
   */
  const getCidadeNomeById = useCallback((id: string): string | null => {
    const cidade = cidades.find(c => c.id.toString() === id);
    return cidade ? cidade.nome : null;
  }, [cidades]);

  return {
    cidades,
    getCidadeIdByNome,
    getCidadeNomeById,
  };
}
