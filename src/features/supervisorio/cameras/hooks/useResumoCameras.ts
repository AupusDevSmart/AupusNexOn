import { useQuery } from '@tanstack/react-query';
import { CamerasService } from '../services/cameras.service';
import type { ResumoCameras } from '../types';
import { INTERVALO_CAMERAS_MS, chavesCameras } from './chaves';

/** Resumo da unidade: armamento, online/offline, não lidos, último alerta, noite. 15 s. */
export function useResumoCameras(unidadeId?: string, habilitado = true) {
  return useQuery<ResumoCameras>({
    queryKey: chavesCameras.resumo(unidadeId),
    queryFn: () => CamerasService.resumo(unidadeId!),
    enabled: !!unidadeId?.trim() && habilitado,
    refetchInterval: INTERVALO_CAMERAS_MS,
    staleTime: INTERVALO_CAMERAS_MS,
  });
}
