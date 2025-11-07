import { api } from '@/config/api';

export interface InversorMqttData {
  timestamp: number;
  inverter_id: number;
  info: {
    device_type: string;
    nominal_power: number;
    output_type: number;
  };
  energy: {
    daily_yield: number;
    total_yield: number;
    total_running_time: number;
    Potencia_Aparente1: number;
    Potencia_Aparente2: number;
    daily_running_time: number;
  };
  temperature: {
    internal: number;
  };
  dc: {
    mppt1_voltage: number;
    mppt2_voltage: number;
    mppt3_voltage: number;
    mppt4_voltage: number;
    mppt5_voltage: number;
    mppt6_voltage: number;
    mppt7_voltage: number;
    mppt8_voltage: number;
    mppt9_voltage: number;
    mppt10_voltage: number;
    mppt11_voltage: number;
    mppt12_voltage: number;
    string1_current: number;
    string2_current: number;
    string3_current: number;
    string4_current: number;
    string5_current: number;
    string6_current: number;
    string7_current: number;
    string8_current: number;
    string9_current: number;
    string10_current: number;
    string11_current: number;
    string12_current: number;
    string13_current: number;
    string14_current: number;
    string15_current: number;
    string16_current: number;
    string17_current: number;
    string18_current: number;
    string19_current: number;
    string20_current: number;
    string21_current: number;
    string22_current: number;
    string23_current: number;
    string24_current: number;
    total_power: number;
  };
  voltage: {
    'phase_a-b': number;
    'phase_b-c': number;
    'phase_c-a': number;
  };
  current: {
    phase_a: number;
    phase_b: number;
    phase_c: number;
  };
  power: {
    active_total: number;
    reactive_total: number;
    apparent_total: number;
    power_factor: number;
    frequency: number;
  };
  status: {
    work_state: number;
    work_state_text: string;
  };
  protection: {
    insulation_resistance: number;
    bus_voltage: number;
  };
  regulation: {
    nominal_reactive_power: number;
  };
  pid: {
    work_state: number;
    alarm_code: number;
  };
}

export interface EquipamentoDadoLatest {
  equipamento: {
    id: string;
    nome: string;
    tipo: string;
    mqtt_habilitado?: boolean;
    topico_mqtt?: string;
  };
  dado: {
    id: string;
    dados: InversorMqttData;
    fonte: string;
    timestamp_dados: string;
    qualidade: string;
    created_at: string;
  } | null;
  message?: string;
}

export interface EquipamentoDadosHistory {
  data: Array<{
    id: string;
    dados: InversorMqttData;
    fonte: string;
    timestamp_dados: string;
    qualidade: string;
    created_at: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface EquipamentoDadosStats {
  total_records: number;
  oldest_record?: string;
  newest_record?: string;
}

class EquipamentosDadosService {
  async getLatest(equipamentoId: string): Promise<EquipamentoDadoLatest> {
    const response = await api.get(`/equipamentos/${equipamentoId}/dados/atual`);
    return response.data;
  }

  async getHistory(
    equipamentoId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
      fonte?: string;
      qualidade?: string;
    }
  ): Promise<EquipamentoDadosHistory> {
    // Mapear parâmetros do frontend para o backend
    const params: any = {};
    if (filters?.startDate) params.inicio = filters.startDate;
    if (filters?.endDate) params.fim = filters.endDate;
    if (filters?.limit) params.limite = filters.limit;
    if (filters?.page) params.pagina = filters.page;
    if (filters?.fonte) params.fonte = filters.fonte;
    if (filters?.qualidade) params.qualidade = filters.qualidade;

    const response = await api.get(`/equipamentos/${equipamentoId}/dados/historico`, {
      params,
    });
    return response.data;
  }

  async getStats(equipamentoId: string): Promise<EquipamentoDadosStats> {
    const response = await api.get(`/equipamentos/${equipamentoId}/dados/stats`);
    return response.data;
  }
}

export default new EquipamentosDadosService();
