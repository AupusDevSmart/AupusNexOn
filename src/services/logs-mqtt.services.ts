import { api } from '@/config/api';

export interface LogMqttResponse {
  id: string;
  regra_id: string;
  equipamento_id: string;
  valor_lido: number;
  mensagem: string;
  severidade: string;
  dados_snapshot: any;
  created_at: string;
  regra?: {
    id: string;
    nome: string;
    campo_json: string;
    operador: string;
    valor: number;
  };
  equipamento?: { id: string; nome: string };
}

export interface FindAllLogsMqttParams {
  page?: number;
  limit?: number;
  search?: string;
  equipamentoId?: string;
  unidadeId?: string;
  regraId?: string;
  severidade?: string;
  dataInicial?: string;
  dataFinal?: string;
  orderBy?: string;
  orderDirection?: string;
}

function unwrap(response: any) {
  if (response?.success !== undefined && response?.data) {
    return response.data;
  }
  return response;
}

class LogsMqttServiceClass {
  async getAll(params: FindAllLogsMqttParams = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== '' && val !== 'all') {
        searchParams.append(key, String(val));
      }
    });
    const { data } = await api.get(`/logs-mqtt?${searchParams}`);
    return unwrap(data);
  }

  async getById(id: string) {
    const { data } = await api.get(`/logs-mqtt/${id.trim()}`);
    return unwrap(data);
  }

  async remove(id: string) {
    await api.delete(`/logs-mqtt/${id.trim()}`);
  }

  /** Marca o alarme como reconhecido (visto). Usado no modelo "fica ativo até o
   * operador ver" (ex.: trip do relé) — limpa o vermelho no COA. */
  async reconhecer(id: string) {
    const { data } = await api.post(`/logs-mqtt/${id.trim()}/reconhecer`);
    return unwrap(data);
  }
}

export const LogsMqttService = new LogsMqttServiceClass();
