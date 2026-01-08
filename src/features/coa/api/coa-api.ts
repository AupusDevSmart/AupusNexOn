import { api } from '@/config/api';

export interface DashboardData {
  timestamp: Date;
  resumoGeral: {
    totalGeracao: number;
    totalConsumo: number;
    balancoRede: number;
    totalUnidades: number;
    unidadesOnline: number;
    alertasAtivos: number;
    custoTotalHoje?: number; // ✅ NOVO: Custo total agregado do dia
  };
  plantas: PlantaResumo[];
  alertas: Alerta[];
}

export interface PlantaResumo {
  id: string;
  nome: string;
  cliente: string;
  unidades: UnidadeResumo[];
  totais: {
    geracao: number;
    consumo: number;
    unidadesAtivas: number;
  };
}

export interface UnidadeResumo {
  id: string;
  nome: string;
  tipo: string;
  status: 'ONLINE' | 'OFFLINE' | 'ALERTA';
  ultimaLeitura: Date | null;
  coordenadas?: {
    latitude: number;
    longitude: number;
  };
  cidade?: string;
  estado?: string;
  metricas: {
    potenciaAtual: number;
    energiaHoje: number;
    fatorPotencia: number;
    custoEnergiaHoje?: number; // ✅ NOVO: Custo de energia do dia desta unidade
  };
}

export interface Alerta {
  id: string;
  tipo: string;
  severidade: 'info' | 'warning' | 'critical';
  mensagem: string;
  unidadeId: string;
  unidadeNome: string;
  timestamp: Date;
}

export const coaApi = {
  /**
   * Busca dados do dashboard COA
   */
  getDashboard: async (clienteId?: string): Promise<DashboardData> => {
    const params = clienteId ? { params: { clienteId } } : {};
    const response = await api.get('/coa/dashboard', params);
    // A API retorna { success, data, meta }, então precisamos extrair o 'data'
    return response.data.data || response.data;
  },

  /**
   * Força atualização do cache no backend
   */
  refreshDashboard: async (clienteId?: string): Promise<DashboardData> => {
    const params = clienteId ? { params: { clienteId } } : {};
    const response = await api.get('/coa/dashboard/refresh', params);
    // A API retorna { success, data, meta }, então precisamos extrair o 'data'
    return response.data.data || response.data;
  },
};