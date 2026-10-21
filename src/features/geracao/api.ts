import { api } from '@/config/api';

/**
 * Análise de geração (NEXON-16): GET/PUT /geracao-analise/unidades/:id[/config].
 * Contrato completo em aupus-nexon-api/docs/GERACAO-ANALISE.md.
 */

export type PeriodoAnalise = 'dia' | 'semana' | 'mes' | 'ano' | 'total';
export type FonteIrradiancia = 'satelite' | 'solarimetro' | 'nenhuma';
/** Fonte do kWh gerado (NEXON-37): TON (inversores), nuvem do fabricante ou lançamento manual/BDO. */
export type FonteGeracao = 'ton' | 'nuvem' | 'manual' | 'mista';
/** O que a configuração pede: automático (regra da API) ou uma fonte fixada por admin. */
export type FonteGeracaoConfig = 'automatico' | 'ton' | 'nuvem';
export type MotivoFonte =
  | 'manual' | 'fixada' | 'fixada_sem_dado' | 'so_ton' | 'so_nuvem' | 'sem_dados'
  | 'nuvem_zerada' | 'concordam' | 'ton_incompleta' | 'em_andamento' | 'divergem';

/** Um dia na escolha da fonte (Dia: 1 item; Semana/Mês: 1 por dia; Ano/Total: omitido). */
export interface DiaFonteGeracao {
  data: string;
  kwh: number | null;
  kwh_ton: number | null;
  kwh_nuvem: number | null;
  kwh_manual: number | null;
  fonte: Exclude<FonteGeracao, 'mista'> | null;
  motivo: MotivoFonte;
  divergencia_pct: number | null;
}

/** Resumo da fonte no período (contrato NEXON-37). Opcional: a API antiga não manda. */
export interface ResumoFonteGeracao {
  config: FonteGeracaoConfig;
  escolhida: FonteGeracao | null;
  divergem: boolean;
  selo: string;
  tem_nuvem: boolean;
  kwh_ton: number | null;
  kwh_nuvem: number | null;
  dias?: DiaFonteGeracao[];
}

export interface PontoAnalise {
  rotulo: string;
  data: string;
  inicio?: string;
  real_kw?: number | null;
  esperado_kw?: number | null;
  real_kwh: number | null;
  esperado_kwh: number | null;
  sem_dados: boolean;
  futuro: boolean;
  /** NEXON-37 (opcionais): fonte do ponto e as duas medições, quando existem. */
  fonte?: FonteGeracao | null;
  kwh_ton?: number | null;
  kwh_nuvem?: number | null;
  divergem?: boolean;
}

export interface CategoriaPerda {
  chave: 'indisponibilidade' | 'limitacao_projeto' | 'limitacao_externa' | 'outras';
  rotulo: string;
  kwh: number;
  pct: number;
  valor_rs: number | null;
  informativo: boolean;
}

export interface AnaliseGeracao {
  unidade_id: string;
  unidade_nome: string;
  periodo: PeriodoAnalise;
  referencia: string;
  inicio: string;
  fim: string;
  anterior: string;
  proximo: string | null;
  hoje: string;
  config: {
    fonte: FonteIrradiancia;
    kwp_dc: number | null;
    potencia_ac_kw: number | null;
    exibir_rs: boolean;
    tarifa_rs_kwh: number | null;
    fonte_geracao?: FonteGeracaoConfig;
  };
  fonte_geracao?: ResumoFonteGeracao;
  tem_inversor: boolean;
  tem_dados: boolean;
  agora: { potencia_kw: number | null; gerando: boolean } | null;
  pontos: PontoAnalise[];
  resumo: {
    energia_kwh: number;
    kwh_kwp: number | null;
    esperado_kwh: number | null;
    pct_esperado: number | null;
    valor_rs: number | null;
    dias_com_dados: number;
    dias_no_periodo: number;
  } | null;
  perdas: { esperado_kwh: number; real_kwh: number; categorias: CategoriaPerda[] } | null;
  fechamento: {
    mes: string;
    disponivel: boolean;
    motivo: string | null;
    acumulado_kwh: number;
    estimativa_kwh: number | null;
    faixa_kwh: number | null;
    valor_rs: number | null;
    dias_decorridos: number;
    dias_do_mes: number;
    usa_historico: boolean;
  } | null;
  previsao_amanha: { data: string; energia_kwh: number; valor_rs: number | null; fonte: FonteIrradiancia } | null;
}

export interface ConfigUsina {
  fonte: FonteIrradiancia;
  solarimetro_equipamento_id: string | null;
  solarimetro_medicao: 'GHI' | 'POA' | null;
  kwp_dc: number | null;
  potencia_ac_kw: number | null;
  inclinacao_graus: number | null;
  azimute_graus: number | null;
  fator_desempenho: number;
  exibir_rs: boolean;
  tarifa_concessionaria_id: string | null;
  /** NEXON-37: só admin muda (`pode_fixar_fonte`). Ausente = API sem o campo. */
  fonte_geracao?: FonteGeracaoConfig;
  atualizado_em?: string | null;
  atualizado_por?: string | null;
}

export interface ConfigUsinaResposta {
  unidade_id: string;
  unidade_nome: string;
  pode_editar: boolean;
  /** NEXON-37: true só para admin/super_admin. Ausente = API antiga. */
  pode_fixar_fonte?: boolean;
  config: ConfigUsina;
  sugestoes: { kwp_dc: number | null; potencia_ac_kw: number | null; inclinacao_graus: number; azimute_graus: number };
  faixas: Record<'kwp_dc' | 'potencia_ac_kw' | 'inclinacao_graus' | 'azimute_graus' | 'fator_desempenho', [number, number]>;
  solarimetros: Array<{ id: string; nome: string }>;
  inversores: Array<{ id: string; nome: string; potencia_kw: number | null }>;
  concessionarias: Array<{ id: string; nome: string }>;
  tarifa_preview_rs_kwh: number | null;
}

export const geracaoApi = {
  analise: async (unidadeId: string, periodo: PeriodoAnalise, data?: string): Promise<AnaliseGeracao> => {
    const { data: r } = await api.get(`/geracao-analise/unidades/${encodeURIComponent(unidadeId.trim())}`, {
      params: { periodo, data },
    });
    return r as AnaliseGeracao;
  },
  config: async (unidadeId: string): Promise<ConfigUsinaResposta> => {
    const { data: r } = await api.get(`/geracao-analise/unidades/${encodeURIComponent(unidadeId.trim())}/config`);
    return r as ConfigUsinaResposta;
  },
  salvarConfig: async (unidadeId: string, config: Partial<ConfigUsina>): Promise<ConfigUsinaResposta> => {
    const { data: r } = await api.put(`/geracao-analise/unidades/${encodeURIComponent(unidadeId.trim())}/config`, config);
    return r as ConfigUsinaResposta;
  },
};

export const ROTULO_FONTE: Record<FonteIrradiancia, string> = {
  satelite: 'satélite',
  solarimetro: 'solarímetro',
  nenhuma: 'nenhuma',
};
