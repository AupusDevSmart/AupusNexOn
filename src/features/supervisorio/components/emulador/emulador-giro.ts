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
  ate: number;       // 0..359; crescente aceita até 3600 (360 = uma volta inteira a partir do "de")
  segundos: number;  // > 0
  sentido: SentidoGiro;
}

/** Velocidade acima da qual a TON (leitura a cada 5 s, filtro de 30°) descarta o giro. */
export const VELOCIDADE_MAX_GRAUS_S = 5;

const norm = (g: number) => ((g % 360) + 360) % 360;

/** Teto do "Até" no sentido crescente: 10 voltas. */
export const ATE_MAX = 3600;

/** Graus a percorrer no sentido escolhido (0 = nada a andar). */
export function grausDoGiro(p: PlanoGiro): number {
  // Crescente com "Até" ≥ 360: conta as voltas (0 → 360 = uma volta inteira, passando pelo 0).
  if (p.sentido === 'crescente' && p.ate >= 360) return Math.max(0, Math.round(p.ate - p.de));
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
  if (!Number.isFinite(p.de) || p.de < 0 || p.de > 359) return '"De" vai de 0 a 359';
  const ateMax = p.sentido === 'crescente' ? ATE_MAX : 359;
  if (!Number.isFinite(p.ate) || p.ate < 0 || p.ate > ateMax) {
    return p.sentido === 'crescente' ? `"Até" vai de 0 a ${ATE_MAX} (360 = uma volta)` : '"Até" vai de 0 a 359 no sentido decrescente';
  }
  if (!(p.segundos > 0)) return 'Informe o tempo';
  if (grausDoGiro(p) === 0) return 'Início e fim iguais: nada a andar';
  return null;
}
