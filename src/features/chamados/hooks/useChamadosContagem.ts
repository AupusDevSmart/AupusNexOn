import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ChamadosService } from '../services';

export const CHAVE_CONTAGEM = ['chamados', 'contagem'] as const;

/** Chamados não fechados no escopo do usuário (número do menu). Atualiza a cada minuto. */
export function useChamadosContagem(habilitado = true) {
  return useQuery({
    queryKey: CHAVE_CONTAGEM,
    queryFn: () => ChamadosService.contagem(),
    enabled: habilitado,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
}

/** Depois de abrir, encaminhar ou fechar: o número do menu acompanha na hora. */
export function useAtualizarContagem() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: CHAVE_CONTAGEM }), [qc]);
}
