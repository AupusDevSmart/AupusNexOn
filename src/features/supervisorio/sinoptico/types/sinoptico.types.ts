// Tipos centrais da feature de Sinoptico (overview do diagrama unifilar).
// Toda a config nova vive no proprio diagrama (Diagrama.configuracoes e
// propriedades por equipamento), sem tocar no cadastro de equipamentos.

export type UnidadeStatusNivel = "NORMAL" | "ALARME" | "CRITICA";

/** Resultado do hook useUnidadeStatus (R1). */
export interface UnidadeStatus {
  nivel: UnidadeStatusNivel;
  /** Texto curto e discreto do fator dominante (ex.: "QGBT sem dados ha 6 min"). */
  motivo: string | null;
  alarmesAtivos: number;
  /** ISO. Sempre tratar fuso (UTC no backend -> local na exibicao). */
  ultimaAtualizacao: string | null;
}

/** Mapeamento de um slot de caixa de dados do diagrama (R8). */
export interface PontoDiagrama {
  /** Equipamento (mqtt_habilitado) que fornece o dado. Pode ser o proprio no ou outro. */
  equipamentoFonteId: string;
  /** Caminho dot-notation no payload MQTT (ex.: "power.active_total"). */
  campoJson: string;
}

/** Slots por categoria. Cada categoria usa um subconjunto destes. */
export interface CaixaDadosConfig {
  kW?: PontoDiagrama;
  V?: PontoDiagrama;
  A?: PontoDiagrama;
  Hz?: PontoDiagrama;
}

/**
 * Slots habilitados por categoria de no do diagrama (R8). A FONTE de cada slot
 * e selecionavel entre equipamentos com MQTT (Inversor PV / Power Meter / Gateway);
 * por isso nos de Transformador/Disjuntor (sem telemetria propria) tambem tem slots.
 * Power Meter usa kW/V/A (o M160 nao reporta Hz).
 */
export const SLOTS_POR_CATEGORIA: Record<string, Array<keyof CaixaDadosConfig>> = {
  INVERSOR: ["kW", "V", "A"],
  TRANSFORMADOR: ["kW", "V", "A"],
  DISJUNTOR: ["A"],
  POWER_METER: ["kW", "V", "A"],
};

/** Config de nivel de diagrama, persistida em Diagrama.configuracoes. */
export interface SinopticoConfig {
  /** PMs-fonte dos KPIs e do painel de grandezas (R2/R3). */
  grandezasPmIds: string[];
}

export const SINOPTICO_CONFIG_PADRAO: SinopticoConfig = {
  grandezasPmIds: [],
};
