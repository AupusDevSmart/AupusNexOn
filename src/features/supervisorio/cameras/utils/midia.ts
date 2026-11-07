/**
 * URLs de mídia (miniatura, snapshot, clipe): a API devolve caminhos como
 * `/api/v1/cameras/<id>/miniatura`, que precisam virar URL absoluta no host da API
 * e levar o token de mídia em `?token=` (o `<img>`/`<video>` não manda header).
 */

/** Origem (`https://host`) a partir da URL base da API (`https://host/api/v1`). */
export function origemDaApi(baseUrl: string | undefined): string {
  if (!baseUrl) return '';
  try {
    return new URL(baseUrl).origin;
  } catch {
    return '';
  }
}

/**
 * Monta a URL final da mídia. Caminho absoluto (`http…`) é mantido; relativo entra
 * na origem da API. Sem token devolve a URL sem `token=`.
 */
export function urlMidia(caminho: string | null | undefined, token: string | null | undefined, origem: string): string | null {
  if (!caminho) return null;
  const absoluta = /^https?:\/\//i.test(caminho) ? caminho : `${origem}${caminho.startsWith('/') ? '' : '/'}${caminho}`;
  if (!token) return absoluta;
  const sep = absoluta.includes('?') ? '&' : '?';
  return `${absoluta}${sep}token=${encodeURIComponent(token)}`;
}
