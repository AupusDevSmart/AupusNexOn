// src/services/ton-bi.services.ts
// Service REST do mapeamento BI (Boolean Input) -> ponto de equipamento + leitura de estado.
// Backend: aupus-nexon-api/src/modules/ton-bi (rotas filhas de /equipamentos/:tonId/bis).

import { api } from '@/config/api';

export const BI_NUMERO_MIN = 1;
export const BI_NUMERO_MAX = 6;

export interface TonBiPontoRef {
  id: string;
  tipo: 'comando' | 'status' | 'medicao';
  nome: string;
  equipamento_id: string;
  equipamento_nome: string;
}

export interface TonBi {
  /** id vazio ("") indica placeholder — BI ainda nao foi criado em ton_bi. */
  id: string;
  ton_id: string;
  bi_numero: number;
  equipamento_ponto_id: string | null;
  /** Contato NF: estado lido eh invertido (0<->1) antes de exibir. */
  invertido: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  ponto: TonBiPontoRef | null;
}

/** Estado atual de um BI ativo (mapeamento + valor lido do hardware). */
export interface TonBiEstado {
  bi_numero: number;
  /** Estado exibido (0/1) ja com inversao aplicada. null = sem leitura ainda. */
  valor: number | null;
  /** Estado cru do hardware (0/1), antes da inversao. */
  valor_raw: number | null;
  invertido: boolean;
  ativo: boolean;
  /** Nome do ponto mapeado (null se nao mapeado). */
  nome: string | null;
  equipamento_ponto_id: string | null;
  /** Quando o estado foi lido pela ultima vez. */
  updated_at: string | null;
}

export interface CreateTonBiInput {
  bi_numero: number;
  equipamento_ponto_id?: string | null;
  invertido?: boolean;
  ativo?: boolean;
}

export type UpdateTonBiInput = Partial<CreateTonBiInput>;

class TonBiService {
  private base(tonId: string) {
    return `/equipamentos/${tonId.trim()}/bis`;
  }

  /** Lista sempre 6 BIs (BI01..BI06) — entradas com id="" sao placeholders ainda nao persistidos. */
  async list(tonId: string): Promise<TonBi[]> {
    const resp = await api.get<TonBi[] | { data: TonBi[] }>(this.base(tonId));
    return unwrapArray(resp.data);
  }

  /** Estado atual (liga/desliga) dos BIs ativos, ja com inversao resolvida. */
  async estado(tonId: string): Promise<TonBiEstado[]> {
    const resp = await api.get<TonBiEstado[] | { data: TonBiEstado[] }>(
      `${this.base(tonId)}/estado`,
    );
    return unwrapArray(resp.data);
  }

  async create(tonId: string, input: CreateTonBiInput): Promise<TonBi> {
    const resp = await api.post<TonBi | { data: TonBi }>(this.base(tonId), input);
    return unwrapObject(resp.data);
  }

  async update(tonId: string, biId: string, input: UpdateTonBiInput): Promise<TonBi> {
    const resp = await api.patch<TonBi | { data: TonBi }>(
      `${this.base(tonId)}/${biId.trim()}`,
      input,
    );
    return unwrapObject(resp.data);
  }

  async remove(tonId: string, biId: string): Promise<void> {
    await api.delete(`${this.base(tonId)}/${biId.trim()}`);
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

export const tonBiApi = new TonBiService();
