import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '@/config/env';
import { useUserStore } from '@/store/useUserStore';
import { CamerasService } from '../services/cameras.service';
import { origemDaApi, urlMidia } from '../utils/midia';
import { chavesCameras } from './chaves';

/** O token vale 2 h; renovamos com folga, em ~1h50. */
const VALIDADE_CACHE_MS = 110 * 60_000;
/** Margem para não entregar token prestes a expirar. */
const MARGEM_MS = 60_000;

interface CacheToken {
  usuarioId: string;
  token: string;
  validoAte: number;
}

let cache: CacheToken | null = null;
let emVoo: { usuarioId: string; promessa: Promise<string> } | null = null;

/**
 * Token de mídia com cache em memória do módulo, POR USUÁRIO: o token vale para o
 * que aquele usuário pode ver, então nunca é reaproveitado para outro login.
 * Dedupe de chamadas simultâneas; `renovar` força busca nova.
 */
export async function obterTokenMidia(usuarioId: string, renovar = false): Promise<string> {
  if (!usuarioId) throw new Error('Sem usuário logado para pedir o token de mídia');
  if (!renovar && cache && cache.usuarioId === usuarioId && cache.validoAte - Date.now() > MARGEM_MS) {
    return cache.token;
  }
  if (!emVoo || emVoo.usuarioId !== usuarioId) {
    const promessa = CamerasService.tokenMidia()
      .then((r) => {
        const fim = Date.parse(r.valido_ate);
        const validoAte = Math.min(Number.isNaN(fim) ? Infinity : fim, Date.now() + VALIDADE_CACHE_MS);
        cache = { usuarioId, token: r.token, validoAte };
        return r.token;
      })
      .finally(() => {
        if (emVoo?.usuarioId === usuarioId) emVoo = null;
      });
    emVoo = { usuarioId, promessa };
  }
  return emVoo.promessa;
}

export function limparCacheTokenMidia() {
  cache = null;
  emVoo = null;
}

// Logout ou troca de usuário (mesmo com a aba de câmeras fechada): o token em
// memória morre junto com a sessão de quem o pediu.
useUserStore.subscribe((estado, anterior) => {
  if (estado.user?.id !== anterior.user?.id) limparCacheTokenMidia();
});

/**
 * Token de mídia para `<img>`/`<video>` (miniatura, snapshot, clipe). Devolve também
 * `url(caminho)`, que já aplica a origem da API e o `?token=` (só para a origem da API).
 * A queryKey leva o id do usuário; ao trocar de usuário, tudo de `['cameras', …]` sai do cache.
 */
export function useTokenMidia(habilitado = true) {
  const usuarioId = useUserStore((s) => s.user?.id ?? null);
  const queryClient = useQueryClient();
  const usuarioAnterior = useRef(usuarioId);

  useEffect(() => {
    if (usuarioAnterior.current === usuarioId) return;
    usuarioAnterior.current = usuarioId;
    limparCacheTokenMidia();
    queryClient.removeQueries({ queryKey: chavesCameras.tudo });
  }, [usuarioId, queryClient]);

  const q = useQuery<string>({
    queryKey: [...chavesCameras.tokenMidia, usuarioId],
    queryFn: () => obterTokenMidia(usuarioId!),
    enabled: habilitado && !!usuarioId,
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
    renovar: async () => {
      if (!usuarioId) return;
      await obterTokenMidia(usuarioId, true);
      await q.refetch();
    },
  };
}
