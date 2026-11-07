import { useQuery } from '@tanstack/react-query';
import { env } from '@/config/env';
import { CamerasService } from '../services/cameras.service';
import { origemDaApi, urlMidia } from '../utils/midia';
import { chavesCameras } from './chaves';

/** O token vale 2 h; renovamos com folga, em ~1h50. */
const VALIDADE_CACHE_MS = 110 * 60_000;
/** Margem para não entregar token prestes a expirar. */
const MARGEM_MS = 60_000;

let cache: { token: string; validoAte: number } | null = null;
let emVoo: Promise<string> | null = null;

/**
 * Token de mídia com cache em memória do módulo (dedupe entre componentes e
 * sobrevive a remontagens). Força busca nova com `renovar`.
 */
export async function obterTokenMidia(renovar = false): Promise<string> {
  if (!renovar && cache && cache.validoAte - Date.now() > MARGEM_MS) return cache.token;
  if (!emVoo) {
    emVoo = CamerasService.tokenMidia()
      .then((r) => {
        const fim = Date.parse(r.valido_ate);
        const validoAte = Math.min(Number.isNaN(fim) ? Infinity : fim, Date.now() + VALIDADE_CACHE_MS);
        cache = { token: r.token, validoAte };
        return r.token;
      })
      .finally(() => {
        emVoo = null;
      });
  }
  return emVoo;
}

/** Só para teste. */
export function limparCacheTokenMidia() {
  cache = null;
  emVoo = null;
}

/**
 * Token de mídia para `<img>`/`<video>` (miniatura, snapshot, clipe). Devolve também
 * `url(caminho)` que já aplica origem da API + `?token=`.
 */
export function useTokenMidia(habilitado = true) {
  const q = useQuery<string>({
    queryKey: chavesCameras.tokenMidia,
    queryFn: () => obterTokenMidia(),
    enabled: habilitado,
    staleTime: VALIDADE_CACHE_MS,
    gcTime: VALIDADE_CACHE_MS,
    refetchInterval: VALIDADE_CACHE_MS,
    retry: 1,
  });
  const origem = origemDaApi(env.VITE_API_URL);
  const token = q.data ?? null;
  return {
    token,
    carregando: q.isPending,
    erro: q.isError,
    url: (caminho: string | null | undefined) => urlMidia(caminho, token, origem),
    renovar: () => obterTokenMidia(true).then(() => q.refetch()),
  };
}
