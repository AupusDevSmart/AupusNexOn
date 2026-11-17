/** Opções de segundos do clipe do evento (o aparelho aceita 0–30 antes e 3–60 depois). */
export const OPCOES_ANTES = [0, 5, 10, 15, 20, 30] as const;
export const OPCOES_DEPOIS = [5, 10, 15, 20, 30, 45, 60] as const;
export const CLIPE_ANTES_PADRAO = 10;
export const CLIPE_DEPOIS_PADRAO = 15;

/** Valor salvo fora das opções (ex.: 12 s de cadastros antigos) → a opção mais próxima. */
export function opcaoMaisProxima(valor: number | null | undefined, opcoes: readonly number[], padrao: number): number {
  if (valor == null || !Number.isFinite(valor)) return padrao;
  return opcoes.reduce((melhor, o) => (Math.abs(o - valor) < Math.abs(melhor - valor) ? o : melhor), opcoes[0]);
}
