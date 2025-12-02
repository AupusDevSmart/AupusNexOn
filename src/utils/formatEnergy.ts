/**
 * Formata valores de energia automaticamente para kWh, MWh ou GWh
 * @param value Valor em kWh
 * @param decimals Número de casas decimais (padrão: 2)
 * @returns String formatada com a unidade apropriada
 */
export function formatEnergy(value: number, decimals: number = 2): string {
  if (value === 0) return '0 kWh';

  const absValue = Math.abs(value);

  // GWh (1 bilhão de Wh = 1 milhão de kWh)
  if (absValue >= 1_000_000) {
    const gwh = value / 1_000_000;
    return `${gwh.toFixed(decimals)} GWh`;
  }

  // MWh (1 milhão de Wh = 1 mil kWh)
  if (absValue >= 1_000) {
    const mwh = value / 1_000;
    return `${mwh.toFixed(decimals)} MWh`;
  }

  // kWh (1 mil Wh)
  return `${value.toFixed(decimals)} kWh`;
}

/**
 * Formata valores de potência automaticamente para kW, MW ou GW
 * @param value Valor em kW
 * @param decimals Número de casas decimais (padrão: 2)
 * @returns String formatada com a unidade apropriada
 */
export function formatPower(value: number, decimals: number = 2): string {
  if (value === 0) return '0 kW';

  const absValue = Math.abs(value);

  // GW (1 bilhão de W = 1 milhão de kW)
  if (absValue >= 1_000_000) {
    const gw = value / 1_000_000;
    return `${gw.toFixed(decimals)} GW`;
  }

  // MW (1 milhão de W = 1 mil kW)
  if (absValue >= 1_000) {
    const mw = value / 1_000;
    return `${mw.toFixed(decimals)} MW`;
  }

  // kW (1 mil W)
  return `${value.toFixed(decimals)} kW`;
}

/**
 * Obtem apenas o valor numérico formatado (sem a unidade)
 */
export function getEnergyValue(value: number, decimals: number = 2): { value: string; unit: string } {
  if (value === 0) return { value: '0', unit: 'kWh' };

  const absValue = Math.abs(value);

  if (absValue >= 1_000_000) {
    return { value: (value / 1_000_000).toFixed(decimals), unit: 'GWh' };
  }

  if (absValue >= 1_000) {
    return { value: (value / 1_000).toFixed(decimals), unit: 'MWh' };
  }

  return { value: value.toFixed(decimals), unit: 'kWh' };
}

/**
 * Obtem apenas o valor numérico formatado de potência (sem a unidade)
 */
export function getPowerValue(value: number, decimals: number = 2): { value: string; unit: string } {
  if (value === 0) return { value: '0', unit: 'kW' };

  const absValue = Math.abs(value);

  if (absValue >= 1_000_000) {
    return { value: (value / 1_000_000).toFixed(decimals), unit: 'GW' };
  }

  if (absValue >= 1_000) {
    return { value: (value / 1_000).toFixed(decimals), unit: 'MW' };
  }

  return { value: value.toFixed(decimals), unit: 'kW' };
}

/**
 * Formata valores de corrente automaticamente para A, kA ou MA
 */
export function formatCurrent(value: number, decimals: number = 2): string {
  if (value === 0) return '0 A';

  const absValue = Math.abs(value);

  // MA (1 milhão de ampères)
  if (absValue >= 1_000_000) {
    const ma = value / 1_000_000;
    return `${ma.toFixed(decimals)} MA`;
  }

  // kA (1 mil ampères)
  if (absValue >= 1_000) {
    const ka = value / 1_000;
    return `${ka.toFixed(decimals)} kA`;
  }

  // A
  return `${value.toFixed(decimals)} A`;
}

/**
 * Formata valores de tensão automaticamente para V, kV ou MV
 */
export function formatVoltage(value: number, decimals: number = 2): string {
  if (value === 0) return '0 V';

  const absValue = Math.abs(value);

  // MV (1 milhão de volts)
  if (absValue >= 1_000_000) {
    const mv = value / 1_000_000;
    return `${mv.toFixed(decimals)} MV`;
  }

  // kV (1 mil volts)
  if (absValue >= 1_000) {
    const kv = value / 1_000;
    return `${kv.toFixed(decimals)} kV`;
  }

  // V
  return `${value.toFixed(decimals)} V`;
}

/**
 * Formata valores de resistência automaticamente para Ω, kΩ, MΩ ou GΩ
 */
export function formatResistance(value: number, decimals: number = 2): string {
  if (value === 0) return '0 Ω';

  const absValue = Math.abs(value);

  // GΩ (1 bilhão de ohms)
  if (absValue >= 1_000_000_000) {
    const gohm = value / 1_000_000_000;
    return `${gohm.toFixed(decimals)} GΩ`;
  }

  // MΩ (1 milhão de ohms)
  if (absValue >= 1_000_000) {
    const mohm = value / 1_000_000;
    return `${mohm.toFixed(decimals)} MΩ`;
  }

  // kΩ (1 mil ohms)
  if (absValue >= 1_000) {
    const kohm = value / 1_000;
    return `${kohm.toFixed(decimals)} kΩ`;
  }

  // Ω
  return `${value.toFixed(decimals)} Ω`;
}

/**
 * Formata valores de tempo automaticamente para min, h ou dias
 */
export function formatTime(value: number, unit: 'min' | 'h' = 'h'): string {
  if (value === 0) return `0 ${unit}`;

  // Se a entrada for em minutos
  if (unit === 'min') {
    if (value >= 1440) {
      const days = value / 1440;
      return `${days.toFixed(1)} dias`;
    }
    if (value >= 60) {
      const hours = value / 60;
      return `${hours.toFixed(1)} h`;
    }
    return `${value.toFixed(0)} min`;
  }

  // Se a entrada for em horas
  if (value >= 8760) {
    const years = value / 8760;
    return `${years.toFixed(1)} anos`;
  }
  if (value >= 24) {
    const days = value / 24;
    return `${days.toFixed(1)} dias`;
  }
  return `${value.toFixed(1)} h`;
}

/**
 * Formata valores genéricos de potência (W, VA, VAr) para W, kW, MW, GW
 */
export function formatPowerGeneric(value: number, unit: 'W' | 'VA' | 'VAr' = 'W', decimals: number = 2): string {
  if (value === 0) return `0 ${unit}`;

  const absValue = Math.abs(value);

  // GW (1 bilhão)
  if (absValue >= 1_000_000_000) {
    const gw = value / 1_000_000_000;
    return `${gw.toFixed(decimals)} G${unit}`;
  }

  // MW (1 milhão)
  if (absValue >= 1_000_000) {
    const mw = value / 1_000_000;
    return `${mw.toFixed(decimals)} M${unit}`;
  }

  // kW (1 mil)
  if (absValue >= 1_000) {
    const kw = value / 1_000;
    return `${kw.toFixed(decimals)} k${unit}`;
  }

  // W
  return `${value.toFixed(decimals)} ${unit}`;
}