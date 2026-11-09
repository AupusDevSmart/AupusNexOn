import { api } from '@/config/api';
import type {
  Agente,
  Camera,
  CameraEvento,
  CameraPayload,
  ConfigCameras,
  ConfigCamerasPayload,
  DispositivoAcionavel,
  ListarEventosParams,
  Paginado,
  ResumoCameras,
  StreamCamera,
  TokenMidia,
} from '../types';

/** O interceptor do axios já desembrulha `{ success, data }`; isto cobre o caso de vir cru. */
function unwrap<T = unknown>(r: unknown): T {
  const o = r as { success?: unknown; data?: unknown } | null;
  if (o && o.success !== undefined && o.data !== undefined) return o.data as T;
  return r as T;
}

/** Lista que pode vir paginada (`{ data, pagination }`) ou como array puro. */
function lista<T>(r: unknown): T[] {
  const d = unwrap<unknown>(r);
  if (Array.isArray(d)) return d as T[];
  const o = d as { data?: unknown } | null;
  if (o && Array.isArray(o.data)) return o.data as T[];
  return [];
}

function paginado<T>(r: unknown, limit: number): Paginado<T> {
  const d = unwrap<unknown>(r);
  if (Array.isArray(d)) {
    return { data: d as T[], pagination: { page: 1, limit, total: d.length, totalPages: 1 } };
  }
  const o = (d ?? {}) as Partial<Paginado<T>>;
  const data = Array.isArray(o.data) ? o.data : [];
  return {
    data,
    pagination: o.pagination ?? { page: 1, limit, total: data.length, totalPages: 1 },
  };
}

/**
 * Rotas de usuário do módulo de câmeras (contrato `docs/cameras/API-CAMERAS.md`).
 * Rotas do agente ficam fora: só o `nexon-camera-agent` as usa.
 */
export const CamerasService = {
  async listar(unidadeId: string): Promise<Camera[]> {
    const { data } = await api.get('/cameras', { params: { unidade_id: unidadeId.trim(), limit: 100 } });
    return lista<Camera>(data);
  },

  async detalhe(id: string): Promise<Camera> {
    const { data } = await api.get(`/cameras/${id.trim()}`);
    return unwrap<Camera>(data);
  },

  async criar(payload: CameraPayload & { unidade_id: string }): Promise<Camera> {
    const { data } = await api.post('/cameras', payload);
    return unwrap<Camera>(data);
  },

  async editar(id: string, payload: Partial<CameraPayload>): Promise<Camera> {
    const { data } = await api.patch(`/cameras/${id.trim()}`, payload);
    return unwrap<Camera>(data);
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`/cameras/${id.trim()}`);
  },

  /** Pede o vídeo ao vivo; marca a câmera como assistida por 90 s. Repetir a cada 60 s. */
  async stream(id: string): Promise<StreamCamera> {
    const { data } = await api.get(`/cameras/${id.trim()}/stream`);
    return unwrap<StreamCamera>(data);
  },

  async foto(id: string): Promise<{ comando_id: string }> {
    const { data } = await api.post(`/cameras/${id.trim()}/foto`);
    return unwrap<{ comando_id: string }>(data);
  },

  async resumo(unidadeId: string): Promise<ResumoCameras> {
    const { data } = await api.get(`/cameras/unidades/${unidadeId.trim()}/resumo`);
    return unwrap<ResumoCameras>(data);
  },

  async config(unidadeId: string): Promise<ConfigCameras> {
    const { data } = await api.get(`/cameras/unidades/${unidadeId.trim()}/config`);
    return unwrap<ConfigCameras>(data);
  },

  async salvarConfig(unidadeId: string, payload: ConfigCamerasPayload): Promise<ConfigCameras> {
    const { data } = await api.put(`/cameras/unidades/${unidadeId.trim()}/config`, payload);
    return unwrap<ConfigCameras>(data);
  },

  /** Armamento manual: sobrepõe a agenda até `ate` (ou até desarmar). Devolve o resumo. */
  async armar(unidadeId: string, body: { armado: boolean; ate?: string }): Promise<ResumoCameras> {
    const { data } = await api.post(`/cameras/unidades/${unidadeId.trim()}/armar`, body);
    return unwrap<ResumoCameras>(data);
  },

  async acionar(unidadeId: string, dispositivo: DispositivoAcionavel): Promise<unknown> {
    const { data } = await api.post(`/cameras/unidades/${unidadeId.trim()}/acionar`, { dispositivo });
    return unwrap(data);
  },

  async eventos(params: ListarEventosParams): Promise<Paginado<CameraEvento>> {
    const limit = params.limit ?? 50;
    const { data } = await api.get('/cameras/eventos', { params: { ...params, limit } });
    return paginado<CameraEvento>(data, limit);
  },

  async evento(id: string): Promise<CameraEvento> {
    const { data } = await api.get(`/cameras/eventos/${id.trim()}`);
    return unwrap<CameraEvento>(data);
  },

  async marcarLido(id: string): Promise<CameraEvento | void> {
    const { data } = await api.post(`/cameras/eventos/${id.trim()}/lido`);
    return unwrap<CameraEvento | void>(data);
  },

  async marcarTodosLidos(body: { unidade_id: string; camera_id?: string }): Promise<void> {
    await api.post('/cameras/eventos/lidos', body);
  },

  async agentes(unidadeId: string): Promise<Agente[]> {
    const { data } = await api.get('/cameras/agentes', { params: { unidade_id: unidadeId.trim() } });
    return lista<Agente>(data);
  },

  /** O token do agente só aparece nesta resposta. */
  async criarAgente(body: { unidade_id: string; nome: string }): Promise<{ agente: Agente; token: string }> {
    const { data } = await api.post('/cameras/agentes', body);
    return unwrap<{ agente: Agente; token: string }>(data);
  },

  /** Token novo: o antigo deixa de valer na hora. */
  async novoTokenAgente(id: string): Promise<{ token: string; agente?: Agente }> {
    const { data } = await api.post(`/cameras/agentes/${id.trim()}/token`);
    return unwrap<{ token: string; agente?: Agente }>(data);
  },

  async removerAgente(id: string): Promise<void> {
    await api.delete(`/cameras/agentes/${id.trim()}`);
  },

  /** Token de mídia (2 h) para `<img>`/`<video>` sem header. */
  async tokenMidia(): Promise<TokenMidia> {
    const { data } = await api.get('/cameras/midia/token');
    return unwrap<TokenMidia>(data);
  },
};
