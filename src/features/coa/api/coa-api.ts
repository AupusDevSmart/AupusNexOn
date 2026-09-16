import { api } from '@/config/api';

export interface DashboardData {
  timestamp: Date;
  resumoGeral: {
    totalGeracao: number;
    totalConsumo: number;
    balancoRede: number;
    totalUnidades: number;
    unidadesOnline: number;
    unidadesMonitoradas?: number; // ONLINE + monitoradas pela nuvem (card "Instalações Monitoradas")
    alertasAtivos: number;
    totalGeradores?: number;
    totalCargas?: number;
    custoTotalHoje?: number; // ✅ NOVO: Custo total agregado do dia
    cargaTotal?: number;     // carga = geração + líquido dos medidores (card Potência de Carga)
    totalReativo?: number;   // Σ Q (kVAr) dos PMs — card Reativo
    totalAparente?: number;  // S = √(P² + Q²) (kVA) — subtítulo do card Reativo
    totalNaoComissionados?: number; // pontos monitorados ainda sem comissionamento (gate suave)
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
  trip?: boolean; // TRIP real (SOE não reconhecido) — vermelho no COA (distinto de OFFLINE/sem info)
  nuvem?: boolean; // sem TON ao vivo, mas com geração de nuvem recente — cor própria (não é offline)
  tonViva?: boolean; // TON dá sinal de vida no broker (liveness). OFFLINE+tonViva = device/Modbus (laranja), não internet (cinza)
  fonteDados?: 'ton' | 'nuvem'; // origem de potência/energia (nuvem = fallback do portal do fabricante, sem TON ao vivo)
  nuvemAtualizadoEm?: string | null; // horário local (SP) do snapshot de nuvem usado no fallback
  naoComissionados?: string[]; // pontos monitorados desta unidade ainda sem comissionamento (dado não validado)
  equipamentosOffline?: string[]; // nomes de equipamentos sem comunicação (pior-caso do status)
  ultimaLeitura: Date | null;
  coordenadas?: {
    latitude: number;
    longitude: number;
  };
  cidade?: string;
  estado?: string;
  plantaNome?: string; // ✅ NOVO: Nome da planta que contém esta unidade
  potenciaInstalada: number; // ✅ NOVO: Potência instalada/cadastrada da unidade (kW)
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

export type PeriodoGeracao = 'dia' | 'mes' | 'ano' | 'total';
export interface PontoGeracao {
  rotulo: string;
  kwh: number | null;
  acumulado?: number | null;
}
export interface SerieGeracao {
  periodo: PeriodoGeracao;
  referencia: string | null;
  total_kwh: number;
  pontos: PontoGeracao[];
}

export const coaApi = {
  /** Série de geração (dia/mês/ano/total) para o gráfico de histórico da usina. */
  getGeracao: async (unidadeId: string, periodo: PeriodoGeracao, data?: string): Promise<SerieGeracao> => {
    const response = await api.get(`/coa/unidades/${unidadeId.trim()}/geracao`, {
      params: { periodo, ...(data ? { data } : {}) },
    });
    return response.data as SerieGeracao;
  },
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