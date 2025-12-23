/**
 * Utilitários para formatação de dados de custos de energia
 */

import type { TipoHorario } from '@/types/dtos/custos-energia-dto';

/**
 * Formata valor monetário em Real (R$)
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(valor);
}

/**
 * Formata energia em kWh
 */
export function formatarEnergia(kwh: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(kwh);
}

/**
 * Formata demanda em kW
 */
export function formatarDemanda(kw: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(kw);
}

/**
 * Formata tarifa em R$/kWh
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
 * Retorna cor para tipo de horário
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
 * Retorna cor de fundo para tipo de horário (minimalista)
 */
export function getBgCorTipoHorario(tipo: TipoHorario): string {
  // Retorna apenas borda padrão sem cores
  return '';
}

/**
 * Retorna ícone (emoji) para tipo de horário
 */
export function getIconeTipoHorario(tipo: TipoHorario): string {
  const icones: Record<TipoHorario, string> = {
    PONTA: '🔴',
    FORA_PONTA: '🔵',
    RESERVADO: '🟣',
    IRRIGANTE: '🟢',
    DEMANDA: '🟠',
  };
  return icones[tipo] || '⚪';
}

/**
 * Retorna label amigável para tipo de horário
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
 * Retorna descrição para tipo de horário
 */
export function getDescricaoTipoHorario(tipo: TipoHorario): string {
  const descricoes: Record<TipoHorario, string> = {
    PONTA: '17h-20h (Seg-Sex)',
    FORA_PONTA: 'Demais horários',
    RESERVADO: 'HR = FP na tarifa Verde',
    IRRIGANTE: '21:30-06:00 (80% desc. TE)',
    DEMANDA: 'Demanda contratada',
  };
  return descricoes[tipo] || '';
}
