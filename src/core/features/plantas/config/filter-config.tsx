// src/features/plantas/config/filter-config.tsx
import { useProprietariosForPlantas } from '@/core/context/hooks';

/**
 * Proprietários disponíveis para a tela de plantas.
 *
 * O filtro por combobox de proprietário deixou de existir: a busca textual
 * já procura pelo nome do dono no backend. O que sobrou deste hook é resolver
 * o nome quando a página é aberta com ?proprietarioId= vindo de usuários.
 */
export const useProprietarios = () => {
  const result = useProprietariosForPlantas();

  return {
    proprietarios: result.proprietarios || [],
    loading: result.loading,
    error: result.error,
    refetch: result.refetch
  };
};
