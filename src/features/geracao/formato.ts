export const nf = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/**
 * Número digitado em pt-BR ou com ponto decimal: "1.512,5" e "1512,5" = 1512,5; "0.85" = 0,85.
 * Ponto só é milhar quando há vírgula ou quando separa grupos de exatamente 3 dígitos ("1.512").
 */
export const numBr = (s: string): number | null => {
  let t = s.trim().replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
