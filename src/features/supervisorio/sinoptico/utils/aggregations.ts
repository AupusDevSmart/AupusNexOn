// Agregacao das grandezas eletricas dos Power Meters (R2/R3).
// Campos reais do M160 (flat): Pt (kW), Qt, St, Va/Vb/Vc (L-N), Ia/Ib/Ic.
// FP total nao existe no payload -> calculado como Pt/St. Sem L-L e sem frequencia.

export interface LeituraPM {
  Pt?: number;
  Qt?: number;
  St?: number;
  Va?: number;
  Vb?: number;
  Vc?: number;
  Ia?: number;
  Ib?: number;
  Ic?: number;
}

export interface GrandezasAgregadas {
  potenciaKw: number | null; // soma de Pt
  tensaoMediaLN: number | null; // media de AN/BN/CN
  correnteMedia: number | null; // media de IA/IB/IC
  fatorPotencia: number | null; // sum(Pt)/sum(St)
  tensoes: { AN: number | null; BN: number | null; CN: number | null };
  correntes: { IA: number | null; IB: number | null; IC: number | null };
  desequilibrioTensao: number | null; // %
  desequilibrioCorrente: number | null; // %
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Extrai os campos do payload (M160 flat) numa LeituraPM. */
export function extrairLeituraPM(dados: Record<string, unknown> | null | undefined): LeituraPM {
  const d = dados ?? {};
  return {
    Pt: num(d.Pt),
    Qt: num(d.Qt),
    St: num(d.St),
    Va: num(d.Va),
    Vb: num(d.Vb),
    Vc: num(d.Vc),
    Ia: num(d.Ia),
    Ib: num(d.Ib),
    Ic: num(d.Ic),
  };
}

function media(vals: Array<number | null | undefined>): number | null {
  const ok = vals.filter((v): v is number => v != null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
}

function soma(vals: Array<number | null | undefined>): number | null {
  const ok = vals.filter((v): v is number => v != null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) : null;
}

/** Desequilibrio percentual: (max - min) / media. */
function desequilibrio(a: number | null, b: number | null, c: number | null): number | null {
  const ok = [a, b, c].filter((v): v is number => v != null);
  if (ok.length < 2) return null;
  const avg = ok.reduce((x, y) => x + y, 0) / ok.length;
  if (avg <= 0) return null;
  return ((Math.max(...ok) - Math.min(...ok)) / avg) * 100;
}

export function agregarGrandezas(leituras: LeituraPM[]): GrandezasAgregadas {
  const AN = media(leituras.map((l) => l.Va));
  const BN = media(leituras.map((l) => l.Vb));
  const CN = media(leituras.map((l) => l.Vc));
  const IA = media(leituras.map((l) => l.Ia));
  const IB = media(leituras.map((l) => l.Ib));
  const IC = media(leituras.map((l) => l.Ic));
  const somaPt = soma(leituras.map((l) => l.Pt));
  const somaSt = soma(leituras.map((l) => l.St));

  return {
    potenciaKw: somaPt,
    tensaoMediaLN: media([AN, BN, CN]),
    correnteMedia: media([IA, IB, IC]),
    fatorPotencia: somaPt != null && somaSt != null && somaSt > 0 ? Math.abs(somaPt / somaSt) : null,
    tensoes: { AN, BN, CN },
    correntes: { IA, IB, IC },
    desequilibrioTensao: desequilibrio(AN, BN, CN),
    desequilibrioCorrente: desequilibrio(IA, IB, IC),
  };
}
