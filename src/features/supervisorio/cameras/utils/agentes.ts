import type { Agente } from '../types';

/** Sem contato por mais que isto, o agente conta como parado. */
export const LIMITE_PARADO_MS = 3 * 60_000;

/** O agente mandou sinal de vida há menos de `LIMITE_PARADO_MS`. */
export function agenteEmContato(a: Pick<Agente, 'ultimo_contato_em'>, agora = Date.now()): boolean {
  if (!a.ultimo_contato_em) return false;
  const t = Date.parse(a.ultimo_contato_em);
  return !Number.isNaN(t) && agora - t < LIMITE_PARADO_MS;
}

const API_PRODUCAO = 'https://aupus-nexon-api.aupusenergia.com.br/api/v1';

/** URL da API que o agente deve usar: a mesma que este web usa (ou a de produção). */
export function urlApiParaAgente(): string {
  const env = (import.meta.env?.VITE_API_URL as string | undefined)?.trim();
  return env ? env.replace(/\/+$/, '') : API_PRODUCAO;
}

/** Conteúdo do `.env` do agente, pronto para colar. */
export function textoEnvAgente(apiUrl = urlApiParaAgente()): string {
  return [
    `NEXON_API_URL=${apiUrl}`,
    'NEXON_AGENTE_TOKEN=cole-aqui-o-token-do-agente',
    'NEXON_ANALISE=yolo',
    'LOG_LEVEL=INFO',
  ].join('\n');
}

export const COMANDOS_AGENTE = ['docker compose up -d --build', 'docker compose logs -f'].join('\n');
