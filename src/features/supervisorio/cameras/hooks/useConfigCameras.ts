import { useQueries, useQuery } from '@tanstack/react-query';
import { CamerasService } from '../services/cameras.service';
import type { Agente, CameraDescoberta, ConfigCameras, PedidoPareamento } from '../types';
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

/** Aparelhos pedindo pareamento nesta rede; só consulta com o diálogo aberto, a cada 5 s. */
export function usePareamentosProximos(habilitado: boolean) {
  return useQuery<PedidoPareamento[]>({
    queryKey: chavesCameras.pareamentos,
    queryFn: () => CamerasService.pareamentosProximos(),
    enabled: habilitado,
    refetchInterval: 5_000,
    staleTime: 0,
  });
}

export interface DescobertaDoAgente {
  agente: Agente;
  descoberta: CameraDescoberta;
}

/** Câmeras achadas na rede pelos agentes informados (só os em contato), juntas. */
export function useDescobertasAgentes(agentes: Agente[]) {
  const consultas = useQueries({
    queries: agentes.map((a) => ({
      queryKey: chavesCameras.descobertas(a.id),
      queryFn: () => CamerasService.descobertas(a.id),
      refetchInterval: 60_000,
      staleTime: 30_000,
    })),
  });
  const itens: DescobertaDoAgente[] = consultas.flatMap((q, i) =>
    (q.data ?? []).map((descoberta) => ({ agente: agentes[i], descoberta })),
  );
  return { itens, carregando: consultas.some((q) => q.isPending) };
}
