/**
 * Emulador — "Simular giro" do encoder: a posição anda de `de` até `ate` em `segundos`,
 * no sentido escolhido (crescente = horário no pivô calibrado assim; decrescente = anti),
 * passando pelo 0 quando precisa (ex.: 300 → 20 crescente anda 80°).
 *
 * A TON lê o encoder a cada 5 s e DESCARTA saltos maiores que 30° entre duas leituras
 * (leitura ruim no RS485). Acima de ~5°/s o giro simulado vira "saltos" e não conta.
 */
export type SentidoGiro = 'crescente' | 'decrescente';

export interface PlanoGiro {
  de: number;        // 0..359
  ate: number;       // 0..359
  segundos: number;  // > 0
  sentido: SentidoGiro;
}

/** Velocidade acima da qual a TON (leitura a cada 5 s, filtro de 30°) descarta o giro. */
export const VELOCIDADE_MAX_GRAUS_S = 5;

const norm = (g: number) => ((g % 360) + 360) % 360;

/** Graus a percorrer no sentido escolhido (0 = nada a andar). */
export function grausDoGiro(p: PlanoGiro): number {
  const d = p.sentido === 'crescente' ? norm(p.ate - p.de) : norm(p.de - p.ate);
  return Math.round(d);
}

export function velocidadeDoGiro(p: PlanoGiro): number {
  return p.segundos > 0 ? grausDoGiro(p) / p.segundos : Infinity;
}

/** Posição (inteira, 0..359) depois de `ms` do início; `fim` = chegou. */
export function posicaoDoGiro(p: PlanoGiro, ms: number): { posicao: number; fim: boolean } {
  const total = grausDoGiro(p);
  const frac = p.segundos > 0 ? Math.min(1, Math.max(0, ms / (p.segundos * 1000))) : 1;
  const andou = total * frac;
  const g = p.sentido === 'crescente' ? p.de + andou : p.de - andou;
  return { posicao: Math.round(norm(g)) % 360, fim: frac >= 1 };
}

/** Plano válido? Devolve o motivo quando não. */
export function validarGiro(p: PlanoGiro): string | null {
  for (const v of [p.de, p.ate]) if (!Number.isFinite(v) || v < 0 || v > 359) return 'Posições de 0 a 359';
  if (!(p.segundos > 0)) return 'Informe o tempo';
  if (grausDoGiro(p) === 0) return 'Início e fim iguais: nada a andar';
  return null;
}
