import { useQuery } from "@tanstack/react-query";
import { LogsMqttService, type LogMqttResponse } from "@/services/logs-mqtt.services";

/**
 * Alarmes da unidade para o painel de alarmes ativos (R5): os ATIVOS (sem reconhecimento)
 * + os RECONHECIDOS ainda não resolvidos — estes aparecem como "visto". O reconhecimento
 * vem do banco (reconhecido_em), então sobrevive ao recarregar a página. Resolvidos saem.
 */
export function useAlarmesUnidade(unidadeId?: string, limit = 5) {
  return useQuery<LogMqttResponse[]>({
    queryKey: ["sinoptico-alarmes", unidadeId?.trim(), limit],
    queryFn: async () => {
      const uid = unidadeId!.trim();
      const [ativos, vistos] = await Promise.all([
        LogsMqttService.getAll({ unidadeId: uid, limit, status: "ativo" }),
        LogsMqttService.getAll({ unidadeId: uid, limit, status: "reconhecido" }),
      ]);
      const lista: LogMqttResponse[] = [...(ativos?.data ?? []), ...(vistos?.data ?? [])];
      // Não reconhecidos primeiro; dentro de cada grupo, mais recente primeiro.
      lista.sort((a, b) =>
        Number(!!a.reconhecido_em) - Number(!!b.reconhecido_em) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return lista.slice(0, limit);
    },
    enabled: !!unidadeId,
    refetchInterval: 30_000,
  });
}
