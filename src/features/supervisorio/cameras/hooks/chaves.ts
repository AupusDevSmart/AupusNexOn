import type { ListarEventosParams } from '../types';

/** Chaves do react-query do módulo de câmeras (invalidar por prefixo `['cameras', …]`). */
export const chavesCameras = {
  tudo: ['cameras'] as const,
  lista: (unidadeId?: string) => ['cameras', 'lista', unidadeId?.trim()] as const,
  resumo: (unidadeId?: string) => ['cameras', 'resumo', unidadeId?.trim()] as const,
  eventos: (params: Partial<ListarEventosParams>) => ['cameras', 'eventos', params] as const,
  eventosDaUnidade: (unidadeId?: string) => ['cameras', 'eventos', { unidade_id: unidadeId?.trim() }] as const,
  config: (unidadeId?: string) => ['cameras', 'config', unidadeId?.trim()] as const,
  agentes: (unidadeId?: string) => ['cameras', 'agentes', unidadeId?.trim()] as const,
  pareamentos: ['cameras', 'pareamentos'] as const,
  descobertas: (agenteId?: string) => ['cameras', 'descobertas', agenteId?.trim()] as const,
  stream: (cameraId?: string) => ['cameras', 'stream', cameraId?.trim()] as const,
  tokenMidia: ['cameras', 'midia-token'] as const,
};

/** Polling padrão da aba: status, não lidos e eventos mudam a cada poucos segundos. */
export const INTERVALO_CAMERAS_MS = 15_000;
