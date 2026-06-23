import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";

/** Categoria (nome) dos medidores no banco. Ver memoria do levantamento de prod. */
const PM_CATEGORIA = "Power Meter";

export interface PmInfo {
  id: string;
  nome: string;
}

/** Lista os Power Meters (com MQTT) da unidade. Query compartilhada (React Query dedupe). */
export function usePmsUnidade(unidadeId?: string) {
  return useQuery<PmInfo[]>({
    queryKey: ["sinoptico-pms", unidadeId?.trim()],
    queryFn: async () => {
      const r = await api.get(`/unidades/${unidadeId!.trim()}/equipamentos`, {
        params: { mqtt_habilitado: true, limit: 100 },
      });
      const arr: any[] = r.data?.data ?? r.data ?? [];
      return arr
        .filter((e) => (e.tipo_equipamento_rel?.categoria?.nome ?? "") === PM_CATEGORIA)
        .map((e) => ({ id: String(e.id).trim(), nome: e.nome }));
    },
    enabled: !!unidadeId,
    staleTime: 60_000,
  });
}
