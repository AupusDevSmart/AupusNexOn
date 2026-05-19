/**
 * Helpers de calculo e formatacao pro PowerMeterModal.
 *
 * Payload real (do M160, confirmado em DEV):
 *   Va,Vb,Vc (V); Ia,Ib,Ic (A); FPa,FPb,FPc (com sinal);
 *   Pt (W), Qt (var), St (VA);
 *   phf (kWh acumulado),
 *   consumo_phf, consumo_phr (kWh delta por bucket),
 *   consumo_qhf, consumo_qhr (kvarh delta por bucket);
 *   timestamp (string "dd/MM/yyyy HH:mm:ss").
 */

export interface PowerMeterPayload {
  Va?: number; Vb?: number; Vc?: number;
  Ia?: number; Ib?: number; Ic?: number;
  FPa?: number; FPb?: number; FPc?: number;
  Pt?: number; Qt?: number; St?: number;
  phf?: number;
  consumo_phf?: number; consumo_phr?: number;
  consumo_qhf?: number; consumo_qhr?: number;
  timestamp?: string;
}

export interface PowerMeterDerivados {
  /** Energia ativa consumida acumulada (MWh) — phf/1000. */
  energia_consumida_mwh: number | null;
  /** Potencia ativa total (kW) — Pt/1000. */
  potencia_ativa_total_kw: number | null;
  /** Potencia reativa total (kvar) — Qt/1000 (mantem sinal). */
  potencia_reativa_total_kvar: number | null;
  /** Potencia aparente total (kVA) — St/1000. */
  potencia_aparente_total_kva: number | null;
  /** FP trifasico — |Pt|/St. null se St == 0. */
  fp_trifasico: number | null;
  /**
   * Natureza do FP — sinal de Qt define:
   * - positivo: carga indutiva (Q > 0)
   * - negativo: carga capacitiva (Q < 0)
   */
  fp_natureza: 'ind' | 'cap' | null;
}

/** Extrai payload tolerante a shape nested em 'data' ou flat. */
export function extractPowerMeterPayload(rawDados: unknown): PowerMeterPayload | null {
  if (!rawDados || typeof rawDados !== 'object') return null;
  const root = rawDados as Record<string, any>;
  const flat: Record<string, any> = root.data && typeof root.data === 'object' ? root.data : root;
  const num = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
    return undefined;
  };
  return {
    Va: num(flat.Va), Vb: num(flat.Vb), Vc: num(flat.Vc),
    Ia: num(flat.Ia), Ib: num(flat.Ib), Ic: num(flat.Ic),
    FPa: num(flat.FPa), FPb: num(flat.FPb), FPc: num(flat.FPc),
    Pt: num(flat.Pt), Qt: num(flat.Qt), St: num(flat.St),
    phf: num(flat.phf),
    consumo_phf: num(flat.consumo_phf), consumo_phr: num(flat.consumo_phr),
    consumo_qhf: num(flat.consumo_qhf), consumo_qhr: num(flat.consumo_qhr),
    timestamp: typeof flat.timestamp === 'string' ? flat.timestamp : undefined,
  };
}

/** Aplica formulas e retorna os valores derivados pros KPIs. */
export function calcDerivados(p: PowerMeterPayload | null): PowerMeterDerivados {
  if (!p) {
    return {
      energia_consumida_mwh: null,
      potencia_ativa_total_kw: null,
      potencia_reativa_total_kvar: null,
      potencia_aparente_total_kva: null,
      fp_trifasico: null,
      fp_natureza: null,
    };
  }

  const energia_consumida_mwh = typeof p.phf === 'number' ? p.phf / 1000 : null;
  const potencia_ativa_total_kw = typeof p.Pt === 'number' ? p.Pt / 1000 : null;
  const potencia_reativa_total_kvar = typeof p.Qt === 'number' ? p.Qt / 1000 : null;
  const potencia_aparente_total_kva = typeof p.St === 'number' ? p.St / 1000 : null;

  let fp_trifasico: number | null = null;
  if (typeof p.Pt === 'number' && typeof p.St === 'number') {
    if (p.Pt === 0 && p.St === 0) {
      // Medidor em standby/idle (sem carga): convencao FP = 1.000.
      // Evita "—" quando os tres totais (Pt, Qt, St) chegam zerados.
      fp_trifasico = 1.0;
    } else if (p.St !== 0) {
      fp_trifasico = Math.abs(p.Pt) / p.St;
      if (fp_trifasico > 1) fp_trifasico = 1; // clamp por arredondamento
    }
  }

  let fp_natureza: 'ind' | 'cap' | null = null;
  if (typeof p.Qt === 'number') {
    fp_natureza = p.Qt >= 0 ? 'ind' : 'cap';
  }

  return {
    energia_consumida_mwh,
    potencia_ativa_total_kw,
    potencia_reativa_total_kvar,
    potencia_aparente_total_kva,
    fp_trifasico,
    fp_natureza,
  };
}

/** Formata numero pra exibicao. Retorna '—' se null/undefined/NaN. */
export function fmtNumero(
  v: number | null | undefined,
  casas = 1,
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Detecta se o equipamento eh um Power Meter baseado em categoria/tipo. */
export function isPowerMeter(comp: {
  categoria?: string | null;
  tipo?: string | null;
  tag?: string | null;
  nome?: string | null;
  dados?: { tipo_equipamento?: string; tipoEquipamento?: { codigo?: string } } | null;
}): boolean {
  const categoria = comp.categoria ?? '';
  if (categoria.includes('Power Meter') || categoria === 'medidor_energia') return true;

  const tipoCodigo =
    comp.dados?.tipoEquipamento?.codigo ?? comp.dados?.tipo_equipamento ?? comp.tipo ?? '';
  if (/METER_|MEDIDOR_|M160|PD666|M300|LANDIS/i.test(tipoCodigo)) return true;

  const tag = (comp.tag ?? '').toUpperCase();
  const nome = (comp.nome ?? '').toUpperCase();
  if (/M160|PD666|M300|MEDIDOR/.test(tag) || /M160|PD666|M300|MEDIDOR/.test(nome)) return true;

  return false;
}
