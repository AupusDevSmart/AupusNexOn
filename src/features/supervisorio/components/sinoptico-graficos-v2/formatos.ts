// Formatação pt-BR das grandezas dos gráficos do sinóptico (kW, kWh/MWh, V, FP).

export const MESES_PT_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Energia com unidade ("1,25 MWh" / "830,0 kWh") — cabeçalho "no período". */
export function formatarEnergia(kwh: number): string {
  const { valor, unidade } = partesEnergia(kwh);
  return `${valor} ${unidade}`;
}

/** Valor e unidade separados, para o tooltip com destaque. */
export function partesEnergia(kwh: number): { valor: string; unidade: 'kWh' | 'MWh' } {
  if (Math.abs(kwh) >= 1000) {
    return {
      valor: (kwh / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      unidade: 'MWh',
    };
  }
  return {
    valor: kwh.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    unidade: 'kWh',
  };
}

/** Rótulo do eixo de energia (sem casas em kWh, uma em MWh). */
export function energiaEixo(kwh: number): string {
  if (Math.abs(kwh) >= 1000) {
    return `${(kwh / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MWh`;
  }
  return `${kwh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kWh`;
}

/** Potência em kW com casas fixas ("1.234,56"), sem unidade. */
export function formatarKw(kw: number, casas = 2): string {
  return kw.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Rótulo do eixo de potência: inteiro a partir de 10 kW, uma casa abaixo disso. */
export function potenciaEixo(kw: number): string {
  return `${kw.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(kw) < 10 ? 1 : 0 })} kW`;
}

/** "220,3 V" */
export function formatarTensao(v: number): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} V`;
}

/** "0,92" (fator de potência não tem unidade). */
export function formatarFp(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Rótulo do eixo de FP: "-1", "-0,5", "0,92". */
export function fpEixo(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
