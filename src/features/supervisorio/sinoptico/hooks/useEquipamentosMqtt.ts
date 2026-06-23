import { useQuery } from "@tanstack/react-query";
import { equipamentosApi } from "@/services/equipamentos.services";
import { RegrasLogsService } from "@/services/regras-logs.services";

export interface EquipamentoMqtt {
  id: string;
  nome: string;
}

/**
 * Lista os equipamentos da unidade que recebem MQTT E ja tem campos no JSON
 * (ultimo payload). Exclui mqtt_habilitado sem dados (ex.: TON), que retornariam
 * combobox de campos vazio. Fonte das caixas de dados do diagrama (R8).
 */
export function useEquipamentosMqtt(unidadeId?: string) {
  return useQuery<EquipamentoMqtt[]>({
    queryKey: ["sinoptico-equip-mqtt", unidadeId?.trim()],
    queryFn: async () => {
      const resp = await equipamentosApi.findAll({
        unidade_id: unidadeId!.trim(),
        mqtt_habilitado: true,
        limit: 100,
      });
      const list =
        (resp as any)?.data?.data ?? (resp as any)?.data ?? (resp as any) ?? [];
      const equips: EquipamentoMqtt[] = (Array.isArray(list) ? list : []).map((e: any) => ({
        id: String(e.id).trim(),
        nome: e.nome,
      }));

      // Mantem so os que tem campos JSON disponiveis (= tem ultimo payload).
      const comCampos = await Promise.all(
        equips.map(async (e) => {
          try {
            const campos = await RegrasLogsService.getCampos(e.id);
            return campos.length > 0 ? e : null;
          } catch {
            return null;
          }
        }),
      );
      return comCampos.filter((e): e is EquipamentoMqtt => e !== null);
    },
    enabled: !!unidadeId,
    staleTime: 60_000,
  });
}
