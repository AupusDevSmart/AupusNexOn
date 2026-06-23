import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";
import { useDemandaAgregada, type PontoDemanda } from "@/hooks/useDemandaAgregada";
import { resolverFluxoEquipamento } from "@/features/supervisorio/utils/categoria-fluxo";
import { useConfiguracaoDemanda } from "./useConfiguracaoDemanda";

/** Ultimo ponto com potencia valida da serie do dia (= valor atual). */
function ultimoValor(dados: PontoDemanda[]): number | null {
  for (let i = dados.length - 1; i >= 0; i--) {
    const v = dados[i]?.potencia_kw;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function numOuNull(v: unknown): number | null {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Demanda/Fluxo do sinoptico (R4): separa Carga (consumo) e Geracao por fluxo,
 * reusando a config de demanda (useConfiguracaoDemanda) e o agregador
 * useDemandaAgregada. Carga e Geracao = ultimo ponto da serie do dia de cada grupo.
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

  const geracaoList = selected.filter(
    (e) => e.fluxoEnergia === "GERACAO" || e.fluxoEnergia === "BIDIRECIONAL",
  );
  const consumoList = selected.filter((e) => e.fluxoEnergia === "CONSUMO");

  const ger = useDemandaAgregada({ equipamentos: geracaoList, periodo: { tipo: "dia" } });
  const con = useDemandaAgregada({ equipamentos: consumoList, periodo: { tipo: "dia" } });

  const geracaoKw = ultimoValor(ger.dados);
  // Consumo entra com sinal -1 no agregador -> serie negativa; Carga = magnitude.
  const cargaBruto = ultimoValor(con.dados);
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
    loading: ger.isInitialLoading || con.isInitialLoading,
  };
}
