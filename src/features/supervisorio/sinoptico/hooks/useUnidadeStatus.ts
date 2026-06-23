import { useQuery } from "@tanstack/react-query";
import { sinopticoService } from "../services/sinoptico.service";
import { derivarStatus } from "../utils/statusDerivation";
import type { UnidadeStatus } from "../types/sinoptico.types";

/**
 * Status operacional da unidade (R1): nivel + motivo discreto + ultima
 * atualizacao + alarmes ativos. Refaz a cada 30s para refletir staleness/alarmes.
 */
export function useUnidadeStatus(unidadeId?: string) {
  return useQuery<UnidadeStatus>({
    queryKey: ["sinoptico-status", unidadeId?.trim()],
    queryFn: async () => derivarStatus(await sinopticoService.getStatus(unidadeId!)),
    enabled: !!unidadeId,
    refetchInterval: 30_000,
  });
}
