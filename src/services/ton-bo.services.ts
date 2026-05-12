// src/services/ton-bo.services.ts
// Service REST do mapeamento BO (Binary Output) -> ponto de equipamento.
// Backend: aupus-nexon-api/src/modules/ton-bo (rotas filhas de /equipamentos/:tonId/bos).

import { api } from '@/config/api';

export const BO_NUMERO_MIN = 1;
export const BO_NUMERO_MAX = 6;
export const PULSO_MS_DEFAULT = 500;
export const PULSO_MS_MIN = 50;
export const PULSO_MS_MAX = 60_000;

export interface TonBoPontoRef {
  id: string;
  tipo: 'comando' | 'status' | 'medicao';
  nome: string;
  equipamento_id: string;
  equipamento_nome: string;
}

export interface TonBo {
  /** id vazio ("") indica placeholder — BO ainda nao foi criado em iot_bo. */
  id: string;
  ton_id: string;
  bo_numero: number;
  equipamento_ponto_id: string | null;
  pulso_ms: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  ponto: TonBoPontoRef | null;
}

export interface CreateTonBoInput {
  bo_numero: number;
  equipamento_ponto_id?: string | null;
  pulso_ms?: number;
  ativo?: boolean;
}

export type UpdateTonBoInput = Partial<CreateTonBoInput>;

class TonBoService {
  private base(tonId: string) {
    return `/equipamentos/${tonId.trim()}/bos`;
  }

  /** Lista sempre 6 BOs (BO01..BO06) — entradas com id="" sao placeholders ainda nao persistidos. */
  async list(tonId: string): Promise<TonBo[]> {
    const resp = await api.get<TonBo[] | { data: TonBo[] }>(this.base(tonId));
    return unwrapArray(resp.data);
  }

  async create(tonId: string, input: CreateTonBoInput): Promise<TonBo> {
    const resp = await api.post<TonBo | { data: TonBo }>(this.base(tonId), input);
    return unwrapObject(resp.data);
  }

  async update(tonId: string, boId: string, input: UpdateTonBoInput): Promise<TonBo> {
    const resp = await api.patch<TonBo | { data: TonBo }>(
      `${this.base(tonId)}/${boId.trim()}`,
      input,
    );
    return unwrapObject(resp.data);
  }

  async remove(tonId: string, boId: string): Promise<void> {
    await api.delete(`${this.base(tonId)}/${boId.trim()}`);
  }
}

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const p = payload as { data?: unknown };
    if (Array.isArray(p.data)) return p.data as T[];
  }
  return [];
}

function unwrapObject<T>(payload: unknown): T {
  if (payload && typeof payload === 'object') {
    const p = payload as { data?: unknown };
    if (p.data && typeof p.data === 'object') return p.data as T;
  }
  return payload as T;
}

export const tonBoApi = new TonBoService();
