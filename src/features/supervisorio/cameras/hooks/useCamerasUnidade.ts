import { useQuery } from '@tanstack/react-query';
import { CamerasService } from '../services/cameras.service';
import type { Camera } from '../types';
import { INTERVALO_CAMERAS_MS, chavesCameras } from './chaves';

/**
 * Câmeras da unidade (status, não lidos, miniatura), em ordem de `ordem` e nome.
 * O QueryClient global tem staleTime de 15 min e não refaz no foco: o polling
 * é explícito (15 s).
 */
export function useCamerasUnidade(unidadeId?: string, habilitado = true) {
  return useQuery<Camera[]>({
    queryKey: chavesCameras.lista(unidadeId),
    queryFn: async () => {
      const lista = await CamerasService.listar(unidadeId!);
      return [...lista].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    enabled: !!unidadeId?.trim() && habilitado,
    refetchInterval: INTERVALO_CAMERAS_MS,
    staleTime: INTERVALO_CAMERAS_MS,
  });
}
