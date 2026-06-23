import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";
import { CATEGORIA_FLUXO } from "@/features/supervisorio/utils/categoria-fluxo";
import type {
  ConfiguracaoDemanda,
  EquipamentoConfig,
} from "@/features/supervisorio/components/ConfiguracaoDemandaModal";

function numOuNull(v: unknown): number | null {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Carrega e salva a config de demanda no formato da ConfiguracaoDemandaModal,
 * reusada pelo painel Demanda/Fluxo (R4). Keys proprias para nao colidir com o
 * SinopticoGraficosV2 (que mapeia o config num shape diferente).
 */
export function useConfiguracaoDemanda(unidadeId?: string) {
  const qc = useQueryClient();
  const uid = unidadeId?.trim();

  const equipQuery = useQuery<EquipamentoConfig[]>({
    queryKey: ["sinoptico-cfgd-equip", uid],
    queryFn: async () => {
      const r = await api.get(`/unidades/${uid}/equipamentos`, {
        params: { mqtt_habilitado: true, limit: 100 },
      });
      const arr: any[] = r.data?.data ?? r.data ?? [];
      return arr.map((e) => {
        const categoria = e.tipo_equipamento_rel?.categoria?.nome ?? "";
        return {
          id: String(e.id).trim(),
          nome: e.nome,
          tipo: e.tipo_equipamento_rel?.codigo ?? e.tipo_equipamento ?? "",
          categoria,
          fluxoEnergia: CATEGORIA_FLUXO[categoria] ?? "NEUTRO",
          selecionado: false,
          multiplicador: 1,
          online: true,
        };
      });
    },
    enabled: !!uid,
    staleTime: 60_000,
  });

  const cfgQuery = useQuery({
    queryKey: ["sinoptico-cfgd-config", uid],
    queryFn: async () => {
      const r = await api.get(`/configuracao-demanda/unidade/${uid}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!uid,
    staleTime: 60_000,
  });

  const unidadeQuery = useQuery({
    queryKey: ["unidade-demanda", uid],
    queryFn: async () => {
      const r = await api.get(`/unidades/${uid}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!uid,
    staleTime: 60_000,
  });

  const apiCfg = (cfgQuery.data ?? {}) as Record<string, any>;
  const selectedIds: string[] = Array.isArray(apiCfg.equipamentos_ids)
    ? apiCfg.equipamentos_ids.map((s: string) => String(s).trim())
    : [];
  const equipamentosDisponiveis = (equipQuery.data ?? []).map((e) => ({
    ...e,
    selecionado: selectedIds.includes(e.id),
  }));
  const unidade = (unidadeQuery.data ?? {}) as Record<string, any>;
  const valorContratado = numOuNull(unidade.demandaGeracao ?? unidade.demanda_geracao) ?? 2500;

  const configuracao: ConfiguracaoDemanda = {
    equipamentos: equipamentosDisponiveis,
    fluxoManual: apiCfg.fluxo_manual ?? apiCfg.fluxoManual ?? {},
    mostrarDetalhes: apiCfg.mostrar_detalhes !== false,
    intervaloAtualizacao: numOuNull(apiCfg.intervalo_atualizacao) ?? 30,
    aplicarPerdas: apiCfg.aplicar_perdas !== false,
    fatorPerdas: numOuNull(apiCfg.fator_perdas) ?? 3,
    demandaContratada: numOuNull(apiCfg.valor_contratado) ?? valorContratado,
  };

  const salvar = async (novaConfig: ConfiguracaoDemanda) => {
    if (!uid) return;
    // Espelha o save do SinopticoGraficosV2 (sem fluxo_manual: forbidNonWhitelisted).
    const body = {
      fonte: "AGRUPAMENTO",
      equipamentos_ids: novaConfig.equipamentos.filter((e) => e.selecionado).map((e) => e.id.trim()),
      mostrar_detalhes: novaConfig.mostrarDetalhes,
      intervalo_atualizacao: novaConfig.intervaloAtualizacao,
      aplicar_perdas: novaConfig.aplicarPerdas,
      fator_perdas: novaConfig.fatorPerdas,
      valor_contratado: novaConfig.demandaContratada ?? valorContratado,
      percentual_adicional: 5,
    };
    await api.put(`/configuracao-demanda/unidade/${uid}`, body);
    if (novaConfig.demandaContratada != null) {
      await api.put(`/unidades/${uid}`, { demanda_geracao: novaConfig.demandaContratada });
    }
    // Refresca R4 + R6 (SinopticoGraficosV2 usa keys proprias).
    qc.invalidateQueries({ queryKey: ["sinoptico-cfgd-config", uid] });
    qc.invalidateQueries({ queryKey: ["configuracao-demanda", uid] });
    qc.invalidateQueries({ queryKey: ["equipamentos-agrupamento", uid] });
    qc.invalidateQueries({ queryKey: ["unidade-demanda", uid] });
  };

  return {
    configuracao,
    equipamentosDisponiveis,
    salvar,
    loading: equipQuery.isLoading || cfgQuery.isLoading,
  };
}
