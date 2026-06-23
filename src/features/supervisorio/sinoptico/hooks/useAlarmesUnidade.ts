import { useQuery } from "@tanstack/react-query";
import { LogsMqttService, type LogMqttResponse } from "@/services/logs-mqtt.services";

/**
 * Ultimos logs (alarmes) de uma unidade para o painel de alarmes ativos (R5).
 * Usa o endpoint de logs-mqtt com o filtro unidadeId.
 */
export function useAlarmesUnidade(unidadeId?: string, limit = 5) {
  return useQuery<LogMqttResponse[]>({
    queryKey: ["sinoptico-alarmes", unidadeId?.trim(), limit],
    queryFn: async () => {
      const res = await LogsMqttService.getAll({ unidadeId: unidadeId!.trim(), limit });
      return res?.data ?? [];
    },
    enabled: !!unidadeId,
    refetchInterval: 30_000,
  });
}
