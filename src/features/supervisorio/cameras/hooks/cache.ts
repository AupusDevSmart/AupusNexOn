import type { QueryClient } from '@tanstack/react-query';
import type { Camera, CameraEvento, Paginado, ResumoCameras } from '../types';
import { chavesCameras } from './chaves';

/**
 * Marca um evento como lido no cache (otimista): some o ponto vermelho na hora,
 * cai o contador do resumo e o `nao_lidos` da câmera. Só chamar para evento que
 * estava não lido; a invalidação depois confirma com a API.
 */
export function marcarLidoNoCache(
  qc: QueryClient,
  unidadeId: string,
  evento: Pick<CameraEvento, 'id' | 'camera_id'>,
  agoraIso: string = new Date().toISOString(),
) {
  qc.setQueriesData<Paginado<CameraEvento>>({ queryKey: ['cameras', 'eventos'] }, (antigo) => {
    if (!antigo?.data) return antigo;
    let mudou = false;
    const data = antigo.data.map((e) => {
      if (e.id !== evento.id || e.lido_em) return e;
      mudou = true;
      return { ...e, lido_em: agoraIso };
    });
    return mudou ? { ...antigo, data } : antigo;
  });

  qc.setQueryData<ResumoCameras>(chavesCameras.resumo(unidadeId), (r) => {
    if (!r) return r;
    const ultimo =
      r.ultimo_alerta && r.ultimo_alerta.id === evento.id && !r.ultimo_alerta.lido_em
        ? { ...r.ultimo_alerta, lido_em: agoraIso }
        : r.ultimo_alerta;
    return { ...r, nao_lidos: Math.max(0, r.nao_lidos - 1), ultimo_alerta: ultimo };
  });

  qc.setQueryData<Camera[]>(chavesCameras.lista(unidadeId), (lista) =>
    lista?.map((c) => (c.id === evento.camera_id ? { ...c, nao_lidos: Math.max(0, c.nao_lidos - 1) } : c)),
  );
}

/** Zera os não lidos da unidade no cache (otimista) após "Marcar todas como lidas". */
export function marcarTodosLidosNoCache(qc: QueryClient, unidadeId: string, agoraIso: string = new Date().toISOString()) {
  qc.setQueriesData<Paginado<CameraEvento>>({ queryKey: ['cameras', 'eventos'] }, (antigo) => {
    if (!antigo?.data) return antigo;
    return { ...antigo, data: antigo.data.map((e) => (e.lido_em ? e : { ...e, lido_em: agoraIso })) };
  });
  qc.setQueryData<ResumoCameras>(chavesCameras.resumo(unidadeId), (r) =>
    r
      ? {
          ...r,
          nao_lidos: 0,
          ultimo_alerta: r.ultimo_alerta && !r.ultimo_alerta.lido_em ? { ...r.ultimo_alerta, lido_em: agoraIso } : r.ultimo_alerta,
        }
      : r,
  );
  qc.setQueryData<Camera[]>(chavesCameras.lista(unidadeId), (lista) => lista?.map((c) => ({ ...c, nao_lidos: 0 })));
}
