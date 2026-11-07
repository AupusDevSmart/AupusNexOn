import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CamerasService } from '../services/cameras.service';
import type { CameraEvento, FiltroEventos, ListarEventosParams, Paginado } from '../types';
import { paramTipo } from '../utils/eventos';
import { INTERVALO_CAMERAS_MS, chavesCameras } from './chaves';

export interface FiltrosEventosCameras {
  unidadeId?: string;
  cameraId?: string | null;
  /** AAAA-MM-DD em America/Sao_Paulo. */
  dia?: string | null;
  filtro?: FiltroEventos;
  somenteNaoLidos?: boolean;
  incluirDescartados?: boolean;
  page?: number;
  limit?: number;
}

/** Converte os filtros da tela nos parâmetros da API (sem chaves vazias). */
export function paramsEventos(f: FiltrosEventosCameras): ListarEventosParams {
  const p: ListarEventosParams = { unidade_id: f.unidadeId?.trim() ?? '' };
  if (f.cameraId) p.camera_id = f.cameraId;
  if (f.dia) p.dia = f.dia;
  const tipo = paramTipo(f.filtro ?? 'todas');
  if (tipo) p.tipo = tipo;
  if (f.somenteNaoLidos) p.somente_nao_lidos = 1;
  if (f.incluirDescartados) p.incluir_descartados = 1;
  if (f.page) p.page = f.page;
  p.limit = f.limit ?? 50;
  return p;
}

/**
 * Eventos (mais recentes primeiro) com filtros da tela. Mantém a página anterior
 * enquanto a nova chega (troca de dia/chip sem piscar). Polling de 15 s.
 */
export function useEventosCameras(filtros: FiltrosEventosCameras, habilitado = true) {
  const params = paramsEventos(filtros);
  return useQuery<Paginado<CameraEvento>>({
    queryKey: chavesCameras.eventos(params),
    queryFn: () => CamerasService.eventos(params),
    enabled: !!params.unidade_id && habilitado,
    refetchInterval: INTERVALO_CAMERAS_MS,
    staleTime: INTERVALO_CAMERAS_MS,
    placeholderData: keepPreviousData,
  });
}
