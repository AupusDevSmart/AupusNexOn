import { useQuery } from '@tanstack/react-query';
import { CamerasService } from '../services/cameras.service';
import type { TrechoHistorico } from '../types';
import { mensagemErro } from '../utils/erros';
import { TRECHO_S } from '../utils/historico';
import { chavesCameras } from './chaves';

/** Enquanto o aparelho corta e envia o trecho, pergunta a cada 2 s. */
export const INTERVALO_TRECHO_MS = 2_000;

export type FaseTrecho = 'ocioso' | 'buscando' | 'pronto' | 'offline' | 'sem_gravacao' | 'expirado' | 'erro';

export interface EstadoTrechoHistorico {
  fase: FaseTrecho;
  /** Caminho do MP4 (já com `?token=` da API) quando pronto. */
  url: string | null;
  mensagem: string | null;
  tentarDeNovo: () => void;
}

/** Erro do aparelho que quer dizer "não tenho esse horário" (texto livre do agente). */
export function ehSemGravacao(erro: string | null | undefined): boolean {
  return !!erro && /sem[ _]grava|n[ãa]o (h[áa]|tem|existe) grava|fora d[ao] grava|no recording|not recorded/i.test(erro);
}

function codigoErro(e: unknown): { status?: number; code?: string } {
  const r = (e as { response?: { status?: number; data?: { code?: unknown; error?: { code?: unknown } } } } | null)?.response;
  const code = r?.data?.code ?? r?.data?.error?.code;
  return { status: r?.status, code: typeof code === 'string' ? code : undefined };
}

/** Fase da tela a partir do pedido (POST) e da última resposta do GET. */
export function faseDoTrecho(
  pedido: { pendente: boolean; erro: unknown },
  trecho: TrechoHistorico | undefined,
): { fase: FaseTrecho; url: string | null; mensagem: string | null } {
  if (pedido.erro) {
    const { status, code } = codigoErro(pedido.erro);
    if (status === 409 || code === 'CAMERA_SEM_AGENTE') return { fase: 'offline', url: null, mensagem: mensagemErro(pedido.erro, 'Aparelho offline') };
    return { fase: 'erro', url: null, mensagem: mensagemErro(pedido.erro, 'Não foi possível pedir o trecho ao aparelho') };
  }
  if (pedido.pendente || !trecho || trecho.estado === 'pendente') return { fase: 'buscando', url: null, mensagem: null };
  if (trecho.estado === 'pronto' && trecho.url) return { fase: 'pronto', url: trecho.url, mensagem: null };
  if (trecho.estado === 'expirado') return { fase: 'expirado', url: null, mensagem: 'O aparelho não respondeu a tempo' };
  if (ehSemGravacao(trecho.erro)) return { fase: 'sem_gravacao', url: null, mensagem: null };
  return { fase: 'erro', url: null, mensagem: trecho.erro || 'O aparelho não conseguiu enviar o trecho' };
}

/**
 * Pede ao aparelho o trecho de 60 s que começa em `inicio` (ISO) e acompanha até ficar
 * pronto. O POST fica em cache por câmera+início (voltar a um trecho já buscado não pede
 * de novo); o GET repete a cada 2 s enquanto pendente. `inicio` null = nada a buscar.
 */
export function useTrechoHistorico(cameraId: string | null | undefined, inicio: string | null): EstadoTrechoHistorico {
  const habilitado = !!cameraId?.trim() && !!inicio;
  const pedido = useQuery({
    queryKey: chavesCameras.pedidoTrecho(cameraId, inicio),
    queryFn: () => CamerasService.pedirTrecho(cameraId!, { inicio: inicio!, duracao_s: TRECHO_S }),
    enabled: habilitado,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const comandoId = habilitado ? pedido.data?.comando_id ?? null : null;
  const trecho = useQuery<TrechoHistorico>({
    queryKey: chavesCameras.trecho(comandoId),
    queryFn: () => CamerasService.trecho(comandoId!),
    enabled: !!comandoId,
    refetchInterval: (q) => (!q.state.data || q.state.data.estado === 'pendente' ? INTERVALO_TRECHO_MS : false),
    staleTime: 0,
    gcTime: 10 * 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  if (!habilitado) return { fase: 'ocioso', url: null, mensagem: null, tentarDeNovo: () => undefined };
  const r = faseDoTrecho({ pendente: pedido.isPending, erro: pedido.error ?? (trecho.isError && !trecho.data ? trecho.error : null) }, trecho.data);
  return { ...r, tentarDeNovo: () => void pedido.refetch() };
}
