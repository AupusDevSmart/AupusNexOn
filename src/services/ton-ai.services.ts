// src/services/ton-ai.services.ts
// Service REST do mapeamento AI (Analog Input) -> ponto de equipamento + escala mV->%.
// Backend: aupus-nexon-api/src/modules/ton-ai (rotas filhas de /equipamentos/:tonId/ais).

import { api } from '@/config/api';

export const AI_NUMERO_MIN = 1;
// Teto SINTATICO. A contagem real vem da API (list retorna N linhas conforme o
// modelo — hoje 2: AN1/AN2).
export const AI_NUMERO_MAX = 4;
export const MV_100_DEFAULT = 3000;
export const MV_0_DEFAULT = 0;

export interface TonAiPontoRef {
  id: string;
  tipo: 'comando' | 'status' | 'medicao';
  nome: string;
  equipamento_id: string;
  equipamento_nome: string;
}

export interface TonAi {
  /** id vazio ("") indica placeholder — AI ainda nao foi criado em ton_ai. */
  id: string;
  ton_id: string;
  ai_numero: number;
  equipamento_ponto_id: string | null;
  /** mV que equivale a 0% (offset; 4-20mA usa o mV lido em 4mA). */
  mv_0: number;
  /** mV que equivale a 100% (fundo de escala). */
  mv_100: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  ponto: TonAiPontoRef | null;
}

export interface CreateTonAiInput {
  ai_numero: number;
  equipamento_ponto_id?: string | null;
  mv_0?: number;
  mv_100?: number;
  ativo?: boolean;
}

export type UpdateTonAiInput = Partial<CreateTonAiInput>;

class TonAiService {
  private base(tonId: string) {
    return `/equipamentos/${tonId.trim()}/ais`;
  }

  /** Lista os AIs do modelo (AI01..AI0N) — entradas com id="" sao placeholders. */
  async list(tonId: string): Promise<TonAi[]> {
    const resp = await api.get<TonAi[] | { data: TonAi[] }>(this.base(tonId));
    return unwrapArray(resp.data);
  }

  async create(tonId: string, input: CreateTonAiInput): Promise<TonAi> {
    const resp = await api.post<TonAi | { data: TonAi }>(this.base(tonId), input);
    return unwrapObject(resp.data);
  }

  async update(tonId: string, aiId: string, input: UpdateTonAiInput): Promise<TonAi> {
    const resp = await api.patch<TonAi | { data: TonAi }>(
      `${this.base(tonId)}/${aiId.trim()}`,
      input,
    );
    return unwrapObject(resp.data);
  }

  async remove(tonId: string, aiId: string): Promise<void> {
    await api.delete(`${this.base(tonId)}/${aiId.trim()}`);
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

export const tonAiApi = new TonAiService();
