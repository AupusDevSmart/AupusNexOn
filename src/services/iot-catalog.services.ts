// IoT Catalog: CRUD client (tipos + modelos) consumindo /api/v1/iot-catalog/*
import { api } from '@/config/api';

// ============================================================================
// TIPOS
// ============================================================================

export interface IotDeviceTipo {
  id: string;
  codigo: string;
  nome: string;
  pontos: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IotDeviceModelo {
  id: string;
  tipo_id: string;
  fabricante: string;
  modelo: string;
  protocolo: string;
  connection_note: string | null;
  mapeamento: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateIotDeviceTipoPayload {
  codigo: string;
  nome: string;
  pontos?: Record<string, unknown>;
}

export type UpdateIotDeviceTipoPayload = Partial<CreateIotDeviceTipoPayload>;

export interface CreateIotDeviceModeloPayload {
  /** codigo do tipo (FK por codigo, nao id) */
  tipo: string;
  fabricante: string;
  modelo: string;
  protocolo: string;
  connection_note?: string;
  catalog_id?: string;
  mapeamento?: Record<string, unknown>;
}

export type UpdateIotDeviceModeloPayload = Partial<CreateIotDeviceModeloPayload>;

// ============================================================================
// API CLIENT
// ============================================================================

export const iotCatalogApi = {
  // --- Tipos ---
  listTipos: () => api.get<IotDeviceTipo[]>('/iot-catalog/tipos').then((r) => r.data),
  findTipo: (id: string) =>
    api.get<IotDeviceTipo>(`/iot-catalog/tipos/${id}`).then((r) => r.data),
  createTipo: (payload: CreateIotDeviceTipoPayload) =>
    api.post<IotDeviceTipo>('/iot-catalog/tipos', payload).then((r) => r.data),
  updateTipo: (id: string, payload: UpdateIotDeviceTipoPayload) =>
    api.patch<IotDeviceTipo>(`/iot-catalog/tipos/${id}`, payload).then((r) => r.data),
  removeTipo: (id: string) =>
    api.delete<void>(`/iot-catalog/tipos/${id}`).then((r) => r.data),

  // --- Modelos ---
  listModelos: (tipoCodigo?: string) =>
    api
      .get<IotDeviceModelo[]>('/iot-catalog/modelos', {
        params: tipoCodigo ? { tipo: tipoCodigo } : undefined,
      })
      .then((r) => r.data),
  findModelo: (id: string) =>
    api.get<IotDeviceModelo>(`/iot-catalog/modelos/${id}`).then((r) => r.data),
  createModelo: (payload: CreateIotDeviceModeloPayload) =>
    api.post<IotDeviceModelo>('/iot-catalog/modelos', payload).then((r) => r.data),
  updateModelo: (id: string, payload: UpdateIotDeviceModeloPayload) =>
    api.patch<IotDeviceModelo>(`/iot-catalog/modelos/${id}`, payload).then((r) => r.data),
  removeModelo: (id: string) =>
    api.delete<void>(`/iot-catalog/modelos/${id}`).then((r) => r.data),
  duplicateModelo: (id: string) =>
    api.post<IotDeviceModelo>(`/iot-catalog/modelos/${id}/duplicate`).then((r) => r.data),
};
