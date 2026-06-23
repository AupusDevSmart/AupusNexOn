import { useQuery } from "@tanstack/react-query";
import { equipamentosDadosService } from "@/services/equipamentos-dados.service";
import {
  agregarGrandezas,
  extrairLeituraPM,
  type GrandezasAgregadas,
} from "../utils/aggregations";
import { usePmsUnidade } from "./usePmsUnidade";
import { useSinopticoConfig } from "./useSinopticoConfig";

/**
 * Agrega as grandezas dos Power Meters da unidade (R2/R3).
 * Usa os PMs selecionados em configuracoes.grandezasPmIds; se vazio, todos os PMs.
 */
export function useGrandezasAgregadas(unidadeId?: string) {
  const pmsQuery = usePmsUnidade(unidadeId);
  const { grandezasPmIds } = useSinopticoConfig(unidadeId);

  const todos = (pmsQuery.data ?? []).map((p) => p.id);
  const pmIds = grandezasPmIds.length
    ? todos.filter((id) => grandezasPmIds.includes(id))
    : todos;

  const grandezasQuery = useQuery<GrandezasAgregadas>({
    queryKey: ["sinoptico-grandezas", pmIds],
    queryFn: async () => {
      const leituras = await Promise.all(
        pmIds.map((id) =>
          equipamentosDadosService
            .getLatest(id)
            .then((r) => r?.dado?.dados ?? null)
            .catch(() => null),
        ),
      );
      return agregarGrandezas(leituras.map((d) => extrairLeituraPM(d as Record<string, unknown>)));
    },
    enabled: pmIds.length > 0,
    refetchInterval: 30_000,
  });

  return {
    grandezas: grandezasQuery.data,
    qtdPms: pmIds.length,
    loading: pmsQuery.isLoading || grandezasQuery.isLoading,
  };
}
