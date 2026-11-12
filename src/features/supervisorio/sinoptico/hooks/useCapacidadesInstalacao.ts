import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";
import { tempoRelativo } from "../utils/tempo";

/**
 * Capacidades da instalação (NEXON-110): o que existe nela de verdade — Geração, Carga
 * (medição de entrada), Rede, Grandezas elétricas. A regra é da API
 * (`GET /unidades/:id/capacidades`); a tela só lê. "Existe" = há fonte de dados configurada,
 * não um símbolo no unifilar. Existe mas sem leitura recente → `comunicando: false` (a tela
 * mostra o estado, não esconde).
 */
export interface Capacidade {
  existe: boolean;
  fonte: "ton" | "nuvem" | "manual" | null;
  comunicando: boolean | null;
  ultima_leitura: string | null;
}

export type CapacidadeChave =
  | "geracao"
  | "medicao_entrada"
  | "carga"
  | "rede"
  | "grandezas_eletricas"
  | "demanda_contratada";

export type CapacidadesInstalacao = Record<CapacidadeChave, Capacidade>;

export function useCapacidadesInstalacao(unidadeId: string | null | undefined) {
  const id = (unidadeId ?? "").trim();
  const q = useQuery({
    queryKey: ["unidade-capacidades", id],
    queryFn: async () => {
      const r = await api.get(`/unidades/${id}/capacidades`);
      return (r.data?.data ?? r.data) as CapacidadesInstalacao;
    },
    enabled: !!id,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const cap = q.data && typeof q.data === "object" && "geracao" in q.data ? q.data : undefined;
  return {
    capacidades: cap,
    /** Primeira carga ainda sem resposta: a tela mostra skeleton, não cards que somem depois. */
    carregando: q.isLoading,
    /**
     * Existe? Sem resposta da API (erro, API antiga) volta `true`: melhor mostrar como
     * antes do que esconder o que existe.
     */
    existe: (k: CapacidadeChave) => (cap ? !!cap[k]?.existe : true),
    /** Existe e está sem leitura recente. */
    semComunicacao: (k: CapacidadeChave) => !!cap && !!cap[k]?.existe && cap[k]?.comunicando === false,
    get: (k: CapacidadeChave): Capacidade | undefined => cap?.[k],
  };
}

/** "sem comunicação · última leitura há 3 h" (ou "sem comunicação · sem leitura"). */
export function textoSemComunicacao(c: Capacidade | undefined): string {
  const quando = tempoRelativo(c?.ultima_leitura);
  return `sem comunicação · ${quando ? `última leitura ${quando}` : "sem leitura"}`;
}
