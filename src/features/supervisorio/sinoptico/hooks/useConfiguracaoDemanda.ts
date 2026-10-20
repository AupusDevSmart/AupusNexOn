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

/** `noDiagrama` da API (GET /unidades/:id/equipamentos); sem o campo, cai no diagrama_id. */
export function estaNoDiagrama(e: { noDiagrama?: unknown; diagramaId?: unknown; diagrama_id?: unknown }): boolean | undefined {
  if (typeof e.noDiagrama === "boolean") return e.noDiagrama;
  if ("diagramaId" in e || "diagrama_id" in e) return !!(e.diagramaId ?? e.diagrama_id);
  return undefined;
}

/** Demandas contratadas da unidade (geração e carga), na key que card e gráfico já usam. */
export function useDemandasUnidade(unidadeId?: string) {
  const uid = unidadeId?.trim();
  const { data } = useQuery({
    queryKey: ["unidade-demanda", uid],
    queryFn: async () => {
      const r = await api.get(`/unidades/${uid}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!uid,
    staleTime: 60_000,
  });
  const unidade = (data ?? {}) as Record<string, any>;
  return {
    demandaGeracao: numOuNull(unidade.demandaGeracao ?? unidade.demanda_geracao),
    demandaCarga: numOuNull(unidade.demandaCarga ?? unidade.demanda_carga),
  };
}

/**
 * Corpo do PUT /configuracao-demanda/unidade/:id. A API grava as demandas na
 * unidade e registra a mudança na trilha (NEXON-19). Sem `fluxo_manual`: o DTO
 * roda com forbidNonWhitelisted.
 */
export function corpoConfiguracaoDemanda(cfg: ConfiguracaoDemanda, percentualAdicional: number) {
  return {
    fonte: "AGRUPAMENTO",
    equipamentos_ids: cfg.equipamentos.filter((e) => e.selecionado).map((e) => e.id.trim()),
    mostrar_detalhes: cfg.mostrarDetalhes,
    intervalo_atualizacao: cfg.intervaloAtualizacao,
    aplicar_perdas: cfg.aplicarPerdas,
    fator_perdas: cfg.fatorPerdas,
    ...(cfg.demandaGeracao != null ? { valor_contratado: cfg.demandaGeracao } : {}),
    percentual_adicional: percentualAdicional,
    demanda_geracao: cfg.demandaGeracao ?? null,
    demanda_carga: cfg.demandaCarga ?? null,
  };
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
          noDiagrama: estaNoDiagrama(e),
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

  const { demandaGeracao, demandaCarga } = useDemandasUnidade(uid);

  const apiCfg = (cfgQuery.data ?? {}) as Record<string, any>;
  const selectedIds: string[] = Array.isArray(apiCfg.equipamentos_ids)
    ? apiCfg.equipamentos_ids.map((s: string) => String(s).trim())
    : [];
  const equipamentosDisponiveis = (equipQuery.data ?? []).map((e) => ({
    ...e,
    selecionado: selectedIds.includes(e.id),
  }));

  const configuracao: ConfiguracaoDemanda = {
    equipamentos: equipamentosDisponiveis,
    fluxoManual: apiCfg.fluxo_manual ?? apiCfg.fluxoManual ?? {},
    mostrarDetalhes: apiCfg.mostrar_detalhes !== false,
    intervaloAtualizacao: numOuNull(apiCfg.intervalo_atualizacao) ?? 30,
    aplicarPerdas: apiCfg.aplicar_perdas !== false,
    fatorPerdas: numOuNull(apiCfg.fator_perdas) ?? 3,
    demandaGeracao,
    demandaCarga,
  };

  const salvar = async (novaConfig: ConfiguracaoDemanda) => {
    if (!uid) return;
    await api.put(`/configuracao-demanda/unidade/${uid}`, corpoConfiguracaoDemanda(novaConfig, 5));
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
