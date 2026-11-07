import { useQuery } from '@tanstack/react-query';
import { CamerasService } from '../services/cameras.service';
import type { StreamCamera } from '../types';
import { chavesCameras } from './chaves';

/** O servidor considera a câmera "assistida" por 90 s; o cliente repete a cada 60 s. */
export const INTERVALO_STREAM_MS = 60_000;
/** Enquanto o agente ainda não publicou, pergunta mais rápido para pegar o início. */
const INTERVALO_AGUARDANDO_MS = 5_000;
const INTERVALO_OFFLINE_MS = 30_000;

/**
 * Pede o vídeo ao vivo (`GET /cameras/:id/stream`) ao montar e repete enquanto
 * `ativo`: 60 s publicando, 5 s aguardando, 30 s offline. `staleTime: 0` +
 * `gcTime: 0`: remontar pede de novo na hora (o agente só publica sob demanda).
 */
export function useStreamCamera(cameraId?: string | null, ativo = true) {
  return useQuery<StreamCamera>({
    queryKey: chavesCameras.stream(cameraId ?? undefined),
    queryFn: () => CamerasService.stream(cameraId!),
    enabled: !!cameraId?.trim() && ativo,
    refetchInterval: (query) => {
      const estado = query.state.data?.estado;
      if (estado === 'aguardando') return INTERVALO_AGUARDANDO_MS;
      if (estado === 'offline') return INTERVALO_OFFLINE_MS;
      return INTERVALO_STREAM_MS;
    },
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
}
