/**
 * Formata valores de energia com unidades apropriadas (kWh, MWh, GWh)
 *
 * @param kwh - Valor em kWh
 * @param decimals - Número de casas decimais (padrão: 1)
 * @returns String formatada com unidade apropriada
 *
 * @example
 * formatEnergy(150) // "150 kWh"
 * formatEnergy(1500) // "1,5 MWh"
 * formatEnergy(1500000) // "1,5 GWh"
 */
export function formatEnergy(kwh: number, decimals: number = 1): string {
  if (kwh === 0) return '0 kWh';

  const absValue = Math.abs(kwh);

  // GWh (Gigawatt-hora) - acima de 1.000.000 kWh
  if (absValue >= 1_000_000) {
    const gwh = kwh / 1_000_000;
    return `${gwh.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} GWh`;
  }

  // MWh (Megawatt-hora) - acima de 1.000 kWh
  if (absValue >= 1_000) {
    const mwh = kwh / 1_000;
    return `${mwh.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} MWh`;
  }

  // kWh (Quilowatt-hora)
  return `${kwh.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} kWh`;
}

/**
 * Formata valores de potência com unidades apropriadas (kW, MW, GW)
 *
 * @param kw - Valor em kW
 * @param decimals - Número de casas decimais (padrão: 1)
 * @returns String formatada com unidade apropriada
 *
 * @example
 * formatPower(150) // "150 kW"
 * formatPower(1500) // "1,5 MW"
 * formatPower(1500000) // "1,5 GW"
 */
export function formatPower(kw: number, decimals: number = 1): string {
  if (kw === 0) return '0 kW';

  const absValue = Math.abs(kw);

  // GW (Gigawatt) - acima de 1.000.000 kW
  if (absValue >= 1_000_000) {
    const gw = kw / 1_000_000;
    return `${gw.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} GW`;
  }

  // MW (Megawatt) - acima de 1.000 kW
  if (absValue >= 1_000) {
    const mw = kw / 1_000;
    return `${mw.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} MW`;
  }

  // kW (Quilowatt)
  return `${kw.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} kW`;
}

/**
 * Formata um número com separadores de milhar
 *
 * @param value - Valor numérico
 * @param decimals - Número de casas decimais (padrão: 0)
 * @returns String formatada
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
