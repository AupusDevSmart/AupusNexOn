import type { EquipamentoConfig } from "../components/ConfiguracaoDemandaModal";

/** Comunicação/gateway nunca entram na escolha (NEXON-19): TON, A966. */
const CATEGORIAS_FORA_DA_CONFIG = new Set(["TON", "Gateway"]);

/**
 * Só equipamentos do diagrama unifilar aparecem na configuração (NEXON-19).
 * Quem já estava selecionado continua visível (com selo "Fora do diagrama")
 * para o admin poder desmarcar — esconder deixaria somando sem ninguém ver.
 */
export function equipamentoNaConfig(
  eq: Pick<EquipamentoConfig, "categoria" | "tipo" | "noDiagrama">,
  jaSelecionado: boolean,
): boolean {
  if (jaSelecionado) return true;
  if (CATEGORIAS_FORA_DA_CONFIG.has(eq.categoria) || CATEGORIAS_FORA_DA_CONFIG.has(eq.tipo)) return false;
  return eq.noDiagrama !== false;
}
