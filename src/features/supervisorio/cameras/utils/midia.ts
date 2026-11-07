/**
 * URLs de mídia (miniatura, snapshot, clipe): a API devolve caminhos como
 * `/api/v1/cameras/<id>/miniatura`, que precisam virar URL absoluta no host da API
 * e levar o token de mídia em `?token=` (o `<img>`/`<video>` não manda header).
 *
 * Segurança: o token só vai para a MESMA origem da API. Qualquer outra origem
 * (CDN, host de terceiros, caminho que a API mandou errado) recebe a URL sem token.
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
 * Monta a URL final da mídia. Caminho relativo entra na origem da API; absoluto é
 * mantido. `token=` só é anexado quando a URL resolvida tem a mesma origem da API;
 * sem origem válida não dá para conferir, então o caminho volta como veio, sem token.
 */
export function urlMidia(
  caminho: string | null | undefined,
  token: string | null | undefined,
  origem: string,
): string | null {
  if (!caminho) return null;
  const origemApi = origemDaApi(origem);
  let resolvida: URL;
  try {
    resolvida = new URL(caminho, origemApi || undefined);
  } catch {
    return caminho;
  }
  const mesmaOrigem = origemApi !== '' && resolvida.origin === origemApi;
  const texto = resolvida.toString();
  if (!token || !mesmaOrigem) return texto;
  const sep = resolvida.search ? '&' : '?';
  return `${texto}${sep}token=${encodeURIComponent(token)}`;
}
