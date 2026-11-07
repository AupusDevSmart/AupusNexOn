import { useQuery } from '@tanstack/react-query';
import { CamerasService } from '../services/cameras.service';
import type { Agente, ConfigCameras } from '../types';
import { chavesCameras } from './chaves';

/** Configuração de armamento e comandos da unidade (sem polling: muda só por quem edita). */
export function useConfigCameras(unidadeId?: string, habilitado = true) {
  return useQuery<ConfigCameras>({
    queryKey: chavesCameras.config(unidadeId),
    queryFn: () => CamerasService.config(unidadeId!),
    enabled: !!unidadeId?.trim() && habilitado,
    staleTime: 60_000,
  });
}

/** Agentes da unidade (só `cadastroTecnico`); último contato muda, então 30 s. */
export function useAgentesCameras(unidadeId?: string, habilitado = true) {
  return useQuery<Agente[]>({
    queryKey: chavesCameras.agentes(unidadeId),
    queryFn: () => CamerasService.agentes(unidadeId!),
    enabled: !!unidadeId?.trim() && habilitado,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
}
