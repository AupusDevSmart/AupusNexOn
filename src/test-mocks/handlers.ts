/**
 * MSW handlers — respostas mock pros endpoints que o frontend consome
 * durante os testes. Cada teste pode sobrescrever via `server.use(...)`
 * pra cenarios especificos (ex: forcar 400 num POST).
 *
 * Base URL = mesma do app real (VITE_API_URL). Como em teste nao temos env,
 * usamos wildcard pra qualquer host.
 */
import { HttpResponse, http } from 'msw';
import type {
  IotDeviceModelo,
  IotDeviceTipo,
} from '@/services/iot-catalog.services';

const TIPOS_MOCK: IotDeviceTipo[] = [
  {
    id: 't1',
    codigo: 'inversor_solar',
    nome: 'Inversor Solar',
    pontos: { ai: [], bi: [], bo: [] },
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
  },
  {
    id: 't2',
    codigo: 'medidor_energia',
    nome: 'Medidor de Energia',
    pontos: { ai: [], bi: [], bo: [] },
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
  },
];

const MODELOS_MOCK: IotDeviceModelo[] = [
  {
    id: 'm1',
    tipo_id: 't1',
    fabricante: 'Sungrow',
    modelo: 'SG250CX',
    protocolo: 'rtu',
    connection_note: null,
    mapeamento: { catalog_id: 'sungrow-sg250cx' },
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
  },
  {
    id: 'm2',
    tipo_id: 't1',
    fabricante: 'GoodWe',
    modelo: 'GW-MT',
    protocolo: 'rtu',
    connection_note: null,
    mapeamento: { catalog_id: 'goodwe-mt' },
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
  },
  {
    id: 'm3',
    tipo_id: 't2',
    fabricante: 'CHINT',
    modelo: 'PD666',
    protocolo: 'rtu',
    connection_note: null,
    mapeamento: { catalog_id: 'chint-pd666' },
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
  },
];

/**
 * Handlers default — endpoints retornam dados ricos pra exercitar UI.
 * Testes podem override pontualmente via server.use(...).
 */
export const handlers = [
  http.get('*/iot-catalog/tipos', () => HttpResponse.json(TIPOS_MOCK)),
  http.get('*/iot-catalog/modelos', () => HttpResponse.json(MODELOS_MOCK)),
];

export { MODELOS_MOCK, TIPOS_MOCK };
