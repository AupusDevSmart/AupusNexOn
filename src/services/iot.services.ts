// src/services/iot.services.ts
// Cliente HTTP dos endpoints `/api/v1/iot/projetos/*` (backend aupus-nexon-api).
// Segue o pattern dos demais services do projeto: usa a instancia centralizada
// `api` (axios com interceptors de auth) em vez de `fetch` direto.

import { api } from '@/config/api';

// ============================================================================
// TIPOS DA API
// ============================================================================

/** Componente generico do diagrama IoT (shape ditado pelo editor SVG). */
export interface IoTDiagramaComponent {
  id: string | number;
  type: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

/** Conexao entre dois componentes do diagrama IoT. */
export interface IoTDiagramaConnection {
  id: string | number;
  from: string | number;
  to: string | number;
  [key: string]: unknown;
}

/** Estrutura JSON persistida em iot_projetos.diagrama. */
export interface IoTDiagrama {
  components: IoTDiagramaComponent[];
  connections: IoTDiagramaConnection[];
  nextId?: number;
  pan?: { x: number; y: number };
  zoom?: number;
}

/** Linha bruta da tabela iot_projetos retornada pelo backend. */
export interface IoTProjeto {
  id: string;
  unidade_id: string;
  nome: string;
  diagrama: IoTDiagrama;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  data: IoTProjeto[];
}

interface SingleResponse {
  data: IoTProjeto;
}

interface SingleNullableResponse {
  data: IoTProjeto | null;
}

interface SuccessResponse {
  success: true;
}

// ============================================================================
// SERVICE
// ============================================================================

export class IoTApiService {
  private readonly baseEndpoint = '/iot/projetos';

  /** Lista projetos IoT da unidade especificada. */
  async listByUnidade(unidadeId: string): Promise<IoTProjeto[]> {
    const response = await api.get<ListResponse>(this.baseEndpoint, {
      params: { unidade_id: unidadeId },
    });
    return response.data.data;
  }

  /** Busca um projeto IoT pelo ID (retorna null se nao existir). */
  async getById(id: string): Promise<IoTProjeto | null> {
    const response = await api.get<SingleNullableResponse>(
      `${this.baseEndpoint}/${id}`,
    );
    return response.data.data;
  }

  /** Cria um novo projeto IoT vinculado a uma unidade. */
  async create(unidadeId: string, nome: string): Promise<IoTProjeto> {
    const response = await api.post<SingleResponse>(this.baseEndpoint, {
      unidade_id: unidadeId,
      nome,
    });
    return response.data.data;
  }

  /** Atualiza nome ou diagrama (ou ambos) de um projeto IoT. */
  async update(
    id: string,
    data: { nome?: string; diagrama?: IoTDiagrama },
  ): Promise<IoTProjeto> {
    const response = await api.put<SingleResponse>(
      `${this.baseEndpoint}/${id}`,
      data,
    );
    return response.data.data;
  }

  /** Soft-delete de um projeto IoT. */
  async delete(id: string): Promise<void> {
    await api.delete<SuccessResponse>(`${this.baseEndpoint}/${id}`);
  }
}

export const iotApiService = new IoTApiService();
