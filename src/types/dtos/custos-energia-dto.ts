/**
 * DTOs para API de Custos de Energia
 * Endpoint: /api/v1/equipamentos-dados/:id/custos-energia
 */

export type PeriodoTipo = 'dia' | 'mes' | 'custom';

export type TipoHorario = 'PONTA' | 'FORA_PONTA' | 'RESERVADO' | 'IRRIGANTE' | 'DEMANDA';

export interface PeriodoDto {
  tipo: PeriodoTipo;
  data_inicio: string;
  data_fim: string;
}

export interface UnidadeResumoDto {
  id: string;
  nome: string;
  grupo: string;
  subgrupo: string;
  irrigante: boolean;
}

export interface ConcessionariaResumoDto {
  id: string;
}

export interface TarifaAplicadaDto {
  tipo_horario: TipoHorario;
  tarifa_tusd?: number;
  tarifa_te?: number;
  tarifa_total: number | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  dias_aplicacao?: string;
  observacao?: string;
}

export interface ConsumoDto {
  energia_ponta_kwh: number;
  energia_fora_ponta_kwh: number;
  energia_reservado_kwh: number;
  energia_irrigante_kwh: number;
  energia_total_kwh: number;
  demanda_maxima_kw: number;
  demanda_contratada_kw?: number;
}

export interface CustosDto {
  custo_ponta: number;
  custo_fora_ponta: number;
  custo_reservado: number;
  custo_irrigante: number;
  custo_demanda: number;
  custo_total: number;
  custo_medio_kwh: number;
  custo_total_sem_tributos: number;
  fator_tributos: number;
  fator_perdas?: number;
}

export interface TributosDto {
  icms: number;
  pis: number;
  cofins: number;
  perdas: number;
  fator_multiplicador: number;
}

export interface IrriganteInfoDto {
  energia_periodo_kwh: number;
  economia_total: number;
  percentual_desconto: number;
  horario_inicio: string;
  horario_fim: string;
}

export interface CustosEnergiaResponseDto {
  periodo: PeriodoDto;
  unidade: UnidadeResumoDto;
  concessionaria: ConcessionariaResumoDto;
  tarifas_aplicadas: TarifaAplicadaDto[];
  tarifa_fonte: 'CONCESSIONARIA' | 'PERSONALIZADA';
  consumo: ConsumoDto;
  custos: CustosDto;
  tributos: TributosDto;
  irrigante?: IrriganteInfoDto;
}

export interface CustosEnergiaQueryParams {
  periodo?: PeriodoTipo;
  data?: string;
  timestamp_inicio?: string;
  timestamp_fim?: string;
}

export interface ConfiguracaoCustoDto {
  icms: number;
  pis: number;
  cofins: number;
  perdas: number;
  usa_tarifa_personalizada: boolean;
  tusd_p: number | null;
  te_p: number | null;
  tusd_fp: number | null;
  te_fp: number | null;
  tusd_d: number | null;
  te_d: number | null;
  tusd_b: number | null;
  te_b: number | null;
}
