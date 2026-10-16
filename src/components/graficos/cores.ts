// Cores semânticas dos gráficos do NexON, sempre por token do tema
// (`--chart-1..5` em `src/assets/globals.css`, claro e escuro). Nunca hex solto
// dentro de gráfico: o tema troca e o SVG não acompanha.
export const COR = {
  /** Energia gerada / geração FV (verde Aupus). */
  geracao: 'var(--chart-1)',
  /** Potência instantânea e grandezas elétricas principais (azul). */
  potencia: 'var(--chart-2)',
  /** Consumo e custos (âmbar). */
  consumo: 'var(--chart-3)',
  /** Tensão, fator de potência e séries secundárias (roxo). */
  tensao: 'var(--chart-4)',
  /** Corrente, reativo e quinta série (ciano). */
  corrente: 'var(--chart-5)',
  /** Linhas de apoio (mínima, máxima, média). */
  neutro: 'var(--chart-foreground-muted)',
  /** Grade e trilhos. */
  grade: 'var(--chart-grid)',
} as const;

/** Sequência para séries sem significado fixo (fases A/B/C, strings, MPPTs). */
export const SERIE = [
  'var(--chart-2)',
  'var(--chart-1)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

export const corSerie = (indice: number) => SERIE[indice % SERIE.length];
