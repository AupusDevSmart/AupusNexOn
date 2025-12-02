/**
 * Formata números com separadores de milhares e decimais
 * @param value Valor numérico
 * @param decimals Número de casas decimais (padrão: 2)
 * @param locale Locale para formatação (padrão: 'pt-BR')
 * @returns String formatada
 */
export function formatNumber(value: number, decimals: number = 2, locale: string = 'pt-BR'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata números como porcentagem
 * @param value Valor numérico (0-100 ou 0-1 dependendo de isRatio)
 * @param decimals Número de casas decimais (padrão: 1)
 * @param isRatio Se true, trata o valor como ratio (0-1), se false como porcentagem (0-100)
 * @returns String formatada com símbolo de %
 */
export function formatPercent(value: number, decimals: number = 1, isRatio: boolean = false): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }

  const percentValue = isRatio ? value * 100 : value;
  return `${formatNumber(percentValue, decimals)}%`;
}

/**
 * Formata valores monetários
 * @param value Valor numérico
 * @param currency Código da moeda (padrão: 'BRL')
 * @param locale Locale para formatação (padrão: 'pt-BR')
 * @returns String formatada com símbolo da moeda
 */
export function formatCurrency(value: number, currency: string = 'BRL', locale: string = 'pt-BR'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(0);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(value);
}

/**
 * Formata números grandes com notação abreviada (K, M, B)
 * @param value Valor numérico
 * @param decimals Número de casas decimais (padrão: 1)
 * @returns String formatada com sufixo
 */
export function formatCompactNumber(value: number, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(decimals)}B`;
  }

  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(decimals)}M`;
  }

  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(decimals)}K`;
  }

  return `${sign}${absValue.toFixed(decimals)}`;
}

/**
 * Formata números com notação científica
 * @param value Valor numérico
 * @param decimals Número de casas decimais (padrão: 2)
 * @returns String formatada em notação científica
 */
export function formatScientific(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  return value.toExponential(decimals);
}

/**
 * Remove formatação e retorna número
 * @param value String formatada
 * @param locale Locale usado na formatação (padrão: 'pt-BR')
 * @returns Valor numérico
 */
export function parseNumber(value: string, locale: string = 'pt-BR'): number {
  if (!value) return 0;

  // Remove símbolos de moeda e espaços
  let cleanValue = value.replace(/[R$\s]/g, '');

  // Trata separadores baseado no locale
  if (locale === 'pt-BR') {
    // Remove pontos (separador de milhares) e substitui vírgula por ponto
    cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
  } else if (locale === 'en-US') {
    // Remove vírgulas (separador de milhares)
    cleanValue = cleanValue.replace(/,/g, '');
  }

  // Remove sufixos (K, M, B, %)
  cleanValue = cleanValue.replace(/[KMB%]/gi, '');

  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}