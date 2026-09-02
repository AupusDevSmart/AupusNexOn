/**
 * Resolve URL de arquivos servidos em /uploads/ pelo backend.
 * `path` pode ser URL absoluta (retornada como esta) ou path relativo tipo "/uploads/equipamentos/foto.jpg".
 * `apiBaseUrl` eh o baseURL do axios do consumer (ex: "http://localhost:3000/api/v1"). Passe
 *   `httpClient.defaults.baseURL` — evita dependencia de `import.meta.env` no pacote shared-pages.
 * Segue o mesmo pattern do getAvatarUrl do AupusNexOn.
 */
export function getUploadUrl(
  path: string | null | undefined,
  apiBaseUrl: string | undefined,
): string | null {
  if (!path) return null;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (!apiBaseUrl) return path;

  const baseUrl = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}/api/v1${cleanPath}`;
}
