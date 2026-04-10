import { api } from '@/config/api';

export interface RegraLogResponse {
  id: string;
  equipamento_id: string;
  nome: string;
  campo_json: string;
  operador: string;
  valor: number;
  mensagem: string;
  severidade: string;
  cooldown_minutos: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  equipamento?: { id: string; nome: string };
}

export interface CreateRegraLogDto {
  equipamento_id: string;
  nome: string;
  campo_json: string;
  operador: string;
  valor: number;
  mensagem: string;
  severidade?: string;
  cooldown_minutos?: number;
}

export interface UpdateRegraLogDto extends Partial<CreateRegraLogDto> {
  ativo?: boolean;
}

export interface CampoMqtt {
  path: string;
  tipo: string;
  ultimoValor: number;
}

export interface FindAllRegrasParams {
  page?: number;
  limit?: number;
  search?: string;
  equipamentoId?: string;
  severidade?: string;
  ativo?: string;
  orderBy?: string;
  orderDirection?: string;
}

function unwrap(response: any) {
  if (response?.success !== undefined && response?.data) {
    return response.data;
  }
  return response;
}

class RegrasLogsServiceClass {
  async getAll(params: FindAllRegrasParams = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== '' && val !== 'all') {
        searchParams.append(key, String(val));
      }
    });
    const { data } = await api.get(`/regras-logs-mqtt?${searchParams}`);
    return unwrap(data);
  }

  async getById(id: string) {
    const { data } = await api.get(`/regras-logs-mqtt/${id.trim()}`);
    return unwrap(data);
  }

  async create(dto: CreateRegraLogDto) {
    const { data } = await api.post('/regras-logs-mqtt', dto);
    return unwrap(data);
  }

  async update(id: string, dto: UpdateRegraLogDto) {
    const { data } = await api.put(`/regras-logs-mqtt/${id.trim()}`, dto);
    return unwrap(data);
  }

  async remove(id: string) {
    await api.delete(`/regras-logs-mqtt/${id.trim()}`);
  }

  async getCampos(equipamentoId: string): Promise<CampoMqtt[]> {
    const { data } = await api.get(`/regras-logs-mqtt/campos/${equipamentoId.trim()}`);
    const result = unwrap(data);
    return Array.isArray(result) ? result : [];
  }
}

export const RegrasLogsService = new RegrasLogsServiceClass();
