// src/types/financeiro.ts
export interface Conta {
  id: number;
  vencimento: string;
  descricao: string;
  total: number;
  situacao: 'pendente' | 'atrasado' | 'pago';
}

export interface SummaryData {
  vencidos: number;
  vencemHoje: number;
  aVencer: number;
  pagos: number;
  total: number;
}

export interface FluxoCaixaData {
  month: string;
  entradas: number;
  saidas: number;
  resultado: number;
  modulo: string;
}

export interface FluxoCaixaDetailed {
  modulo: string;
  saldoInicial: number;
  jan: number;
  fev: number;
  mar: number;
  abr: number;
  mai: number;
  jun: number;
  jul: number;
  ago: number;
  set: number;
  out: number;
  nov: number;
  dez: number;
  tipo: 'saldo-inicial' | 'entrada' | 'saida' | 'resultado' | 'saldo-final';
}

export interface ModuloOption {
  value: string;
  label: string;
}

export interface FluxoCaixaFilters {
  year: string;
  month: string;
  module: string;
}

export interface SummaryData {
  totalEntradas: number;
  totalSaidas: number;
  resultado: number;
}

export type ChartType = 'line' | 'bar';

export type SummaryVariant = 'danger' | 'success' | 'info' | 'default';

// src/types/centros-custo.ts
export interface CentroCusto {
  id: number;
  codigo: string;
  nome: string;
  tipo: 'administrativo' | 'operacional' | 'comercial' | 'projeto';
  status: 'ativo' | 'inativo';
  centroPai: number | null;
  responsavel: string;
  email: string;
  orcamentoMensal: number;
  gastoAcumulado: number;
  descricao: string;
  dataCreacao: string;
  ultimaAtualizacao: string;
}

export interface CentroCustoFormData {
  codigo: string;
  nome: string;
  tipo: CentroCusto['tipo'];
  status: CentroCusto['status'];
  centroPai: number | null;
  responsavel: string;
  email: string;
  orcamentoMensal: number;
  descricao: string;
}

export interface SummaryData {
  ativos: number;
  inativos: number;
  orcamentoTotal: number;
  gastoTotal: number;
  tipos: Record<string, number>;
}