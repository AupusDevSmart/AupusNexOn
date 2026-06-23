// src/services/equipamento-pontos.services.ts
// Service REST de pontos de automacao por equipamento.
// Backend: aupus-nexon-api/src/modules/equipamento-pontos (rotas filhas de /equipamentos/:id/pontos).

import { api } from '@/config/api';

export type PontoTipo = 'comando' | 'status' | 'medicao';

export interface EquipamentoPonto {
  id: string;
  equipamento_id: string;
  tipo: PontoTipo;
  nome: string;
  unidade: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEquipamentoPontoInput {
  tipo: PontoTipo;
  nome: string;
  unidade?: string | null;
  ordem?: number;
  ativo?: boolean;
}

class EquipamentoPontosService {
  private endpoint(equipamentoId: string) {
    return `/equipamentos/${equipamentoId.trim()}/pontos`;
  }

  /** Lista os pontos de um equipamento (ordenado por ordem asc). */
  async list(equipamentoId: string): Promise<EquipamentoPonto[]> {
    const resp = await api.get<EquipamentoPonto[] | { data: EquipamentoPonto[] }>(
      this.endpoint(equipamentoId),
    );
    return unwrapArray(resp.data);
  }

  /** Cria um ponto no equipamento (ex.: ponto tipo "status" para mapear em BI). */
  async create(
    equipamentoId: string,
    input: CreateEquipamentoPontoInput,
  ): Promise<EquipamentoPonto> {
    const resp = await api.post<EquipamentoPonto | { data: EquipamentoPonto }>(
      this.endpoint(equipamentoId),
      input,
    );
    return unwrapObject(resp.data);
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

export const equipamentoPontosApi = new EquipamentoPontosService();
