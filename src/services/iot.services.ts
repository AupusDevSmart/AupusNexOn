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

// FASE 6: projeção dos vínculos modbus_bo (comando de relé) do projeto, na MESMA forma
// que o gerador consome em props.io_config.bo. O gerador é hidratado a partir daqui.
export type VinculoBoEntry = {
  coil?: number; func?: number; register?: number;
  addr?: number; count?: number; value?: number;
  hold?: boolean; rearm_ms?: number; ponto_id?: string;
};
export type VinculosBoPorEquip = Record<string, Record<string, VinculoBoEntry>>;
interface VinculosBoResponse {
  data: VinculosBoPorEquip;
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

  /**
   * FASE 6 — projeção iot_vinculos(modbus_bo) → io_config.bo dos relés do projeto.
   * O gerador de firmware hidrata props.io_config.bo a partir daqui (fonte unificada),
   * sem alterar o gerador. Byte-idêntico ao props validado no harness tools/fw-regress.
   */
  async projetarVinculosBo(projetoId: string): Promise<VinculosBoPorEquip> {
    const response = await api.get<VinculosBoResponse>(
      `${this.baseEndpoint}/${projetoId}/vinculos-bo`,
    );
    return response.data.data ?? {};
  }

  /**
   * FASE 6 (inversão da escrita) — grava o comando de relé (modbus_bo) DIRETO no vínculo,
   * como fonte da verdade. `boMap` = io_config.bo do relé ({ [sinal]: { coil, func, ...,
   * ponto_id } }). O resync não reconstrói mais o modbus_bo, então esta escrita é
   * autoritativa; o props.io_config.bo continua salvo como fallback.
   */
  async escreverVinculosBo(
    relayEquipId: string,
    boMap: Record<string, VinculoBoEntry>,
  ): Promise<number> {
    const response = await api.put<{ data: { escritos: number } }>(
      `/iot/equipamentos/${relayEquipId}/vinculos-bo`,
      { bo: boMap },
    );
    return response.data.data?.escritos ?? 0;
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

  /** Resolve o Power Meter (IoT) associado a um disjuntor do unifilar (ou null). */
  async powerMeterByDisjuntor(
    disjuntorEquipId: string,
  ): Promise<{ equipamento_id: string; nome: string | null } | null> {
    const response = await api.get<{
      data: { equipamento_id: string; nome: string | null } | null;
    }>(`/iot/power-meter-by-disjuntor/${encodeURIComponent(disjuntorEquipId.trim())}`);
    return response.data.data;
  }
}

export const iotApiService = new IoTApiService();
