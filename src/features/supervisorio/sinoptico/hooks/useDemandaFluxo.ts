import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";
import equipamentosDadosService from "@/services/equipamentos-dados.service";
import { resolverFluxoEquipamento } from "@/features/supervisorio/utils/categoria-fluxo";
import { useConfiguracaoDemanda } from "./useConfiguracaoDemanda";

function numOuNull(v: unknown): number | null {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrai a potência (kW) do último payload MQTT de um equipamento. Espelha a
 * prioridade do backend (equipamentos-dados.service::getGraficoDiaMultiplosInversores)
 * pra dar EXATAMENTE o mesmo número que o unifilar mostra em cada nó.
 */
function extrairPotenciaKw(dados: Record<string, any> | null | undefined): number | null {
  if (!dados) return null;
  const n = (v: unknown): number | null => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  if (dados.potencia_kw != null) return n(dados.potencia_kw);
  if (dados.power?.active_total != null) { const v = n(dados.power.active_total); return v == null ? null : v / 1000; }
  if (dados.dc?.total_power != null) { const v = n(dados.dc.total_power); return v == null ? null : v / 1000; }
  if (dados.power?.active != null) { const v = n(dados.power.active); return v == null ? null : v / 1000; }
  if (dados.power_avg != null) return n(dados.power_avg);
  if (dados.potencia_ativa_kw != null) return n(dados.potencia_ativa_kw);
  if (dados.Pt != null) { const v = n(dados.Pt); return v == null ? null : v / 1000; }
  if (dados.Dados) {
    const d = dados.Dados;
    return ((n(d.Pa) ?? 0) + (n(d.Pb) ?? 0) + (n(d.Pc) ?? 0)) / 1000;
  }
  return null;
}

/**
 * Demanda/Fluxo do sinoptico (R4): separa Carga (consumo) e Geracao por fluxo,
 * reusando a config de demanda (useConfiguracaoDemanda). Carga e Geracao = SOMA
 * da ÚLTIMA leitura de cada equipamento do grupo (mesma fonte do unifilar).
 *
 * ANTES usava o último ponto da série de demanda agregada (buckets de 5min com
 * média). Como as leituras Modbus têm valores espúrios baixos misturados aos bons,
 * a média do bucket deflacionava o valor (mostrava ~metade da geração real). A soma
 * da última leitura por equipamento bate com o que cada nó do unifilar exibe.
 */
export function useDemandaFluxo(unidadeId?: string) {
  const { configuracao } = useConfiguracaoDemanda(unidadeId);

  const unidadeQuery = useQuery({
    queryKey: ["unidade-demanda", unidadeId?.trim()],
    queryFn: async () => {
      const r = await api.get(`/unidades/${unidadeId!.trim()}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!unidadeId,
    staleTime: 60_000,
  });

  // Se nada selecionado na config, considera todos (espelha o SinopticoGraficosV2).
  const algumSelecionado = configuracao.equipamentos.some((e) => e.selecionado);
  const base = algumSelecionado
    ? configuracao.equipamentos.filter((e) => e.selecionado)
    : configuracao.equipamentos;
  const fluxoManual = configuracao.fluxoManual ?? {};
  const selected = base.map((e) => ({
    ...e,
    fluxoEnergia: resolverFluxoEquipamento(e.categoria, e.id, fluxoManual),
  }));

  const gerIds = selected
    .filter((e) => e.fluxoEnergia === "GERACAO" || e.fluxoEnergia === "BIDIRECIONAL")
    .map((e) => e.id.trim());
  const conIds = selected
    .filter((e) => e.fluxoEnergia === "CONSUMO")
    .map((e) => e.id.trim());
  const allIds = useMemo(
    () => Array.from(new Set([...gerIds, ...conIds])),
    [gerIds.join(","), conIds.join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Última leitura de cada equipamento -> mapa id -> kW. Poll a cada 20s.
  const latestQuery = useQuery({
    queryKey: ["demanda-latest-sum", allIds],
    queryFn: async () => {
      const pares = await Promise.all(
        allIds.map(async (id) => {
          try {
            const r: any = await equipamentosDadosService.getLatest(id);
            const dados = r?.dado?.dados ?? r?.data?.dado?.dados ?? null;
            return [id, extrairPotenciaKw(dados)] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      return Object.fromEntries(pares) as Record<string, number | null>;
    },
    enabled: allIds.length > 0,
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const potMap = latestQuery.data ?? {};
  const somaGrupo = (ids: string[]): number | null => {
    const vals = ids
      .map((id) => potMap[id])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };

  const geracaoKw = somaGrupo(gerIds);
  const cargaBruto = somaGrupo(conIds);
  const cargaKw = cargaBruto != null ? Math.abs(cargaBruto) : null;
  const saldoKw = geracaoKw != null && cargaKw != null ? geracaoKw - cargaKw : null;

  const unidade = (unidadeQuery.data ?? {}) as Record<string, any>;
  const demandaGeracao = numOuNull(unidade.demandaGeracao ?? unidade.demanda_geracao);
  const demandaCarga = numOuNull(unidade.demandaCarga ?? unidade.demanda_carga);

  return {
    cargaKw,
    geracaoKw,
    saldoKw,
    demandaCarga,
    demandaGeracao,
    loading: latestQuery.isInitialLoading,
  };
}
