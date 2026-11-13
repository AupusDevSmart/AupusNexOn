/** Níveis de sensibilidade da detecção de movimento (NEXON-108): só três, sem número na tela. */
export const NIVEIS_SENSIBILIDADE = [
  { valor: 30, rotulo: 'Baixa' },
  { valor: 55, rotulo: 'Média' },
  { valor: 80, rotulo: 'Alta' },
] as const;

export type ValorSensibilidade = (typeof NIVEIS_SENSIBILIDADE)[number]['valor'];

/** Nível mais próximo de um valor 0–100 já gravado (câmeras antigas usavam qualquer número). */
export function nivelSensibilidade(valor: number | null | undefined): ValorSensibilidade {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 55;
  let melhor: ValorSensibilidade = NIVEIS_SENSIBILIDADE[0].valor;
  for (const n of NIVEIS_SENSIBILIDADE) {
    if (Math.abs(n.valor - valor) < Math.abs(melhor - valor)) melhor = n.valor;
  }
  return melhor;
}

/** "intelbras" → "Intelbras", "onvif" → "ONVIF". */
export function rotuloFabricante(fabricante: string | null | undefined): string | null {
  const f = fabricante?.trim();
  if (!f) return null;
  if (f.toLowerCase() === 'onvif') return 'ONVIF';
  return f.charAt(0).toUpperCase() + f.slice(1);
}
