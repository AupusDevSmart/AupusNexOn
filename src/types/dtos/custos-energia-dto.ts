/**
 * DTOs para API de Custos de Energia
 * Endpoint: /api/v1/equipamentos-dados/:id/custos-energia
 */

export type PeriodoTipo = 'dia' | 'mes' | 'custom'; // ✅ NOVO: período customizado

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
  consumo: ConsumoDto;
  custos: CustosDto;
  irrigante?: IrriganteInfoDto;
}

export interface CustosEnergiaQueryParams {
  periodo?: PeriodoTipo;
  data?: string; // formato ISO 8601 (YYYY-MM-DD) - usado com periodo=dia ou periodo=mes
  timestamp_inicio?: string; // formato ISO 8601 completo - usado com periodo=custom
  timestamp_fim?: string; // formato ISO 8601 completo - usado com periodo=custom
}
