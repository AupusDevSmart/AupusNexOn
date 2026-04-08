/**
 * Utilitarios para formatacao de dados de custos de energia
 */

import type { TipoHorario } from '@/types/dtos/custos-energia-dto';

/**
 * Formata valor monetario em Real (R$) com 2 casas decimais
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/**
 * Formata energia em kWh com 2 casas decimais
 */
export function formatarEnergia(kwh: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kwh);
}

/**
 * Formata demanda em kW
 */
export function formatarDemanda(kw: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kw);
}

/**
 * Formata tarifa em R$/kWh (mantém 4 casas para precisao)
 */
export function formatarTarifa(tarifa: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(tarifa);
}

/**
 * Formata percentual
 */
export function formatarPercentual(valor: number): string {
  return `${valor}%`;
}

/**
 * Formata aliquota decimal como percentual (0.18 -> "18,00%")
 */
export function formatarAliquota(valor: number): string {
  return `${(valor * 100).toFixed(2).replace('.', ',')}%`;
}

/**
 * Retorna cor para tipo de horario
 */
export function getCorTipoHorario(tipo: TipoHorario): string {
  const cores: Record<TipoHorario, string> = {
    PONTA: 'text-red-500',
    FORA_PONTA: 'text-blue-500',
    RESERVADO: 'text-purple-500',
    IRRIGANTE: 'text-green-500',
    DEMANDA: 'text-orange-500',
  };
  return cores[tipo] || 'text-gray-500';
}

/**
 * Retorna cor de fundo para tipo de horario (minimalista)
 */
export function getBgCorTipoHorario(tipo: TipoHorario): string {
  return '';
}

/**
 * Retorna icone para tipo de horario
 */
export function getIconeTipoHorario(tipo: TipoHorario): string {
  const icones: Record<TipoHorario, string> = {
    PONTA: '',
    FORA_PONTA: '',
    RESERVADO: '',
    IRRIGANTE: '',
    DEMANDA: '',
  };
  return icones[tipo] || '';
}

/**
 * Retorna label amigavel para tipo de horario
 */
export function getLabelTipoHorario(tipo: TipoHorario): string {
  const labels: Record<TipoHorario, string> = {
    PONTA: 'Ponta',
    FORA_PONTA: 'Fora Ponta',
    RESERVADO: 'Reservado',
    IRRIGANTE: 'Irrigante',
    DEMANDA: 'Demanda',
  };
  return labels[tipo] || tipo;
}

/**
 * Retorna descricao para tipo de horario
 */
export function getDescricaoTipoHorario(tipo: TipoHorario): string {
  const descricoes: Record<TipoHorario, string> = {
    PONTA: '18h-21h (Todos os dias)',
    FORA_PONTA: '06h-18h / 21h-21:30',
    RESERVADO: '21:30-06:00 (HR = FP Verde)',
    IRRIGANTE: '21:30-06:00 (80% desc. TE)',
    DEMANDA: 'Demanda contratada',
  };
  return descricoes[tipo] || '';
}
