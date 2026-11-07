import { useQuery } from '@tanstack/react-query';
import { equipamentoPontosApi, type EquipamentoPonto } from '@/services/equipamento-pontos.services';
import { equipamentosApi } from '@/services/equipamentos.services';

export interface EquipamentoResumido {
  id: string;
  nome: string;
  tag?: string | null;
}

function comoLista<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  const o = r as { data?: unknown } | null;
  return o && Array.isArray(o.data) ? (o.data as T[]) : [];
}

/** Equipamentos da unidade para vincular câmera (CFTV) e pontos de refletor/sirene. */
export function useEquipamentosUnidade(unidadeId?: string, habilitado = true) {
  return useQuery<EquipamentoResumido[]>({
    queryKey: ['cameras', 'equipamentos', unidadeId?.trim()],
    queryFn: async () => {
      const r = await equipamentosApi.findAll({ unidade_id: unidadeId!.trim(), limit: 200 });
      return comoLista<{ id: string; nome: string; tag?: string | null }>(r)
        .map((e) => ({ id: e.id, nome: e.nome, tag: e.tag ?? null }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    enabled: !!unidadeId?.trim() && habilitado,
    staleTime: 5 * 60_000,
  });
}

/**
 * Pontos de um equipamento (`GET /equipamentos/:id/pontos`), só os de comando quando
 * houver algum; senão todos (o backend pode não classificar o ponto do relé).
 */
export function usePontosEquipamento(equipamentoId?: string | null) {
  return useQuery<EquipamentoPonto[]>({
    queryKey: ['cameras', 'pontos', equipamentoId?.trim()],
    queryFn: async () => {
      const todos = await equipamentoPontosApi.list(equipamentoId!);
      const comando = todos.filter((p) => p.tipo === 'comando');
      return comando.length > 0 ? comando : todos;
    },
    enabled: !!equipamentoId?.trim(),
    staleTime: 5 * 60_000,
    retry: 0,
  });
}
