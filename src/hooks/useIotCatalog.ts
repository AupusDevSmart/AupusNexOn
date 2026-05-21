import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateIotDeviceModeloPayload,
  CreateIotDeviceTipoPayload,
  IotDeviceModelo,
  IotDeviceTipo,
  UpdateIotDeviceModeloPayload,
  UpdateIotDeviceTipoPayload,
  iotCatalogApi,
} from '@/services/iot-catalog.services';

const QK = {
  tipos: ['iot-catalog', 'tipos'] as const,
  tipo: (id: string) => ['iot-catalog', 'tipos', id] as const,
  modelos: (tipoCodigo?: string) =>
    ['iot-catalog', 'modelos', tipoCodigo ?? 'all'] as const,
  modelo: (id: string) => ['iot-catalog', 'modelos', 'detail', id] as const,
};

// ============================================================================
// Tipos
// ============================================================================

export function useIotDeviceTipos() {
  return useQuery<IotDeviceTipo[]>({
    queryKey: QK.tipos,
    queryFn: iotCatalogApi.listTipos,
  });
}

export function useCreateIotDeviceTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateIotDeviceTipoPayload) => iotCatalogApi.createTipo(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iot-catalog'] }),
  });
}

export function useUpdateIotDeviceTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIotDeviceTipoPayload }) =>
      iotCatalogApi.updateTipo(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iot-catalog'] }),
  });
}

export function useRemoveIotDeviceTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => iotCatalogApi.removeTipo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iot-catalog'] }),
  });
}

// ============================================================================
// Modelos
// ============================================================================

export function useIotDeviceModelos(tipoCodigo?: string) {
  return useQuery<IotDeviceModelo[]>({
    queryKey: QK.modelos(tipoCodigo),
    queryFn: () => iotCatalogApi.listModelos(tipoCodigo),
  });
}

export function useCreateIotDeviceModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateIotDeviceModeloPayload) =>
      iotCatalogApi.createModelo(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iot-catalog'] }),
  });
}

export function useUpdateIotDeviceModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateIotDeviceModeloPayload;
    }) => iotCatalogApi.updateModelo(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iot-catalog'] }),
  });
}

export function useRemoveIotDeviceModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => iotCatalogApi.removeModelo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iot-catalog'] }),
  });
}

export function useDuplicateIotDeviceModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => iotCatalogApi.duplicateModelo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iot-catalog'] }),
  });
}
