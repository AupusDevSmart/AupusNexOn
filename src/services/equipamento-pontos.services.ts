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
}

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const p = payload as { data?: unknown };
    if (Array.isArray(p.data)) return p.data as T[];
  }
  return [];
}

export const equipamentoPontosApi = new EquipamentoPontosService();
