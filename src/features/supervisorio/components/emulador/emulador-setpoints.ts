/**
 * Emulador "acata" os comandos do inversor como o equipamento real (bancada da Fazenda Pontal).
 * Modelo de referência: Sungrow SG-CX (protocolo de comunicação V1.1.66), mas tudo sai do
 * catálogo (bo_map + setpoints), como no gerador de firmware:
 *
 *  - Cada setpoint é uma sequência de escritas: passos de valor FIXO (chave/modo) e o passo
 *    "$valor". O setpoint só VALE se todos os passos fixos estão com o valor no registrador —
 *    igual ao Sungrow: o limite (5008) só limita com a chave 5007 = 0xAA; o Q% (5037) só vale
 *    com o modo 5036 = 0xA2; o FP (5019) só com 5036 = 0xA1. Escrever o valor sem a chave = ignorado.
 *  - O modo de reativo é um registrador só (5036): o último modo escrito ganha (FP OU Q%).
 *  - Ligar/Desligar (bo_map ligar/desligar, valor fixo): Desligar zera P, Q e correntes.
 *  - Potência aparente máxima = Pn × s_max_fator (padrão 1,1 — SG110CX: 110 kW / 121 kVA).
 *    Prioridade da potência ativa: passou de Smax, o Q é cortado.
 *  - Leituras derivadas acompanham: FP, potência aparente, correntes e potência CC.
 *  - Registradores começam no estado de fábrica (limite desabilitado, reativo desligado,
 *    inversor ligado): o read-back da TON lê o que um Sungrow novo responderia.
 * Puro (sem window/serial).
 */
import type { CatalogModel } from './emulador-catalog';

export type SetpointId = 'sp_limite_pct' | 'sp_q_pct' | 'sp_fp';
export interface RegSetpoint {
  id: SetpointId;
  register: number;
  escala: number;
  words: 1 | 2;
  /** Passos de valor fixo (chave/modo) que precisam estar no registrador para o setpoint valer. */
  chaves: Array<{ register: number; value: number }>;
}

interface Passo { func?: number; register?: number; value?: unknown; values?: unknown[] }

const IDS: SetpointId[] = ['sp_limite_pct', 'sp_q_pct', 'sp_fp'];

/** Registrador onde a TON escreve o VALOR de cada setpoint (FC06 "$valor" ou FC16 "$valor_hi/lo") + as chaves. */
export function registradoresSetpoint(model: CatalogModel | null | undefined): RegSetpoint[] {
  const bo = (model?.bo_map ?? {}) as Record<string, Passo & { steps?: Passo[] }>;
  const sps = (Array.isArray(model?.setpoints) ? model?.setpoints : []) as Array<{ id?: string; escala?: number }>;
  const out: RegSetpoint[] = [];
  for (const id of IDS) {
    const m = bo[id];
    if (!m) continue;
    const passos: Passo[] = Array.isArray(m.steps) ? m.steps : [m];
    const escala = Number(sps.find((x) => x?.id === id)?.escala) || 1;
    for (let i = passos.length - 1; i >= 0; i--) {
      const st = passos[i];
      const f = st.func ?? 6;
      let words: 1 | 2 | 0 = 0;
      if (f === 6 && st.value === '$valor' && st.register != null) words = 1;
      if (f === 16 && Array.isArray(st.values) && st.values.join(',') === '$valor_hi,$valor_lo' && st.register != null) words = 2;
      if (!words) continue;
      const chaves = passos.slice(0, i)
        .filter((p) => (p.func ?? 6) === 6 && p.register != null && typeof p.value === 'number')
        .map((p) => ({ register: Number(p.register), value: Number(p.value) & 0xffff }));
      out.push({ id, register: Number(st.register), escala, words, chaves });
      break;
    }
  }
  return out;
}

/** Valor (com sinal) num registrador de setpoint; null = ninguém escreveu e não há padrão. */
export function lerEscrito(r: Pick<RegSetpoint, 'register' | 'words'>, escritos: Map<number, number>): number | null {
  if (!escritos.has(r.register)) return null;
  if (r.words === 2) {
    const hi = escritos.get(r.register) ?? 0, lo = escritos.get(r.register + 1) ?? 0;
    return (((hi & 0xffff) << 16) | (lo & 0xffff)) | 0;
  }
  const w = escritos.get(r.register)! & 0xffff;
  return w >= 0x8000 ? w - 0x10000 : w;
}

const ehSungrow = (m: CatalogModel | null | undefined) => /sungrow/i.test(String(m?.fabricante ?? ''));

/** Comandos de valor fixo ligar/desligar do catálogo (bo_map). */
function comandosLigaDesliga(model: CatalogModel | null | undefined) {
  const bo = (model?.bo_map ?? {}) as Record<string, Passo>;
  const fixo = (k: string) => {
    const p = bo[k];
    return p && (p.func ?? 6) === 6 && p.register != null && typeof p.value === 'number'
      ? { register: Number(p.register), value: Number(p.value) & 0xffff } : null;
  };
  return { ligar: fixo('ligar'), desligar: fixo('desligar') };
}

/** Sungrow: chave desabilitada = 0x55 (limite de P e modo de reativo). */
const SUNGROW_DESLIGADO = 0x55;
/** Sungrow work state (5038): 0x0000 = Run, 0x8000 = Stop. */
const SUNGROW_RUN = 0x0000;
const SUNGROW_STOP = 0x8000;

/**
 * Holding registers no estado de fábrica: valor do setpoint = padrão do catálogo (limite 100 %,
 * Q 0 %, FP 1), chaves desabilitadas (Sungrow 0x55) e inversor ligado. Só preenche o que o
 * modelo tem; o que a TON escrever passa por cima.
 */
export function estadoFabrica(model: CatalogModel | null | undefined): Map<number, number> {
  const out = new Map<number, number>();
  const sps = (Array.isArray(model?.setpoints) ? model?.setpoints : []) as Array<{ id?: string; padrao?: number }>;
  const sg = ehSungrow(model);
  for (const r of registradoresSetpoint(model)) {
    const pad = Number(sps.find((s) => s?.id === r.id)?.padrao);
    const v = Math.round((Number.isFinite(pad) ? pad : r.id === 'sp_limite_pct' ? 100 : r.id === 'sp_fp' ? 1 : 0) * r.escala);
    if (r.words === 2) { out.set(r.register, (v >>> 16) & 0xffff); out.set(r.register + 1, v & 0xffff); } else out.set(r.register, v & 0xffff);
    if (sg) for (const c of r.chaves) if (!out.has(c.register)) out.set(c.register, SUNGROW_DESLIGADO);
  }
  const { ligar } = comandosLigaDesliga(model);
  if (ligar && !out.has(ligar.register)) out.set(ligar.register, ligar.value);
  return out;
}

const PID_P = ['potencia_ativa', 'active_power', 'p_total', 'pt'];
const PID_Q = ['potencia_reativa', 'reactive_power', 'q_total', 'qt'];
const PID_PN = ['nominal_power', 'potencia_nominal', 'pn'];
const PID_S = ['apparent_total', 'potencia_aparente', 's_total', 'st'];
const PID_FP = ['fp', 'power_factor', 'fator_potencia'];
const PID_I = ['ia', 'ib', 'ic'];
const PID_DC = ['dc_total_power'];
const achar = (v: Record<string, unknown>, ids: string[]) => ids.find((k) => v[k] !== undefined && v[k] !== '');
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const fmt = (x: number) => String(r3(x)).replace('.', ',');

export interface EstadoInversor {
  ligado: boolean;
  limite: { ativo: boolean; pct: number | null };
  reativo: { modo: 'desligado' | 'q_pct' | 'fp'; valor: number | null };
  P: number | null; Q: number | null; S: number | null; fp: number | null;
  qCortado: boolean;
}

/**
 * Valores servidos depois dos comandos da TON + o que mudou (para o log/tela).
 * `escritos` = o que a TON escreveu (por cima do estado de fábrica).
 */
export function simularInversor(
  valores: Record<string, number | string>, escritos: Map<number, number>, model: CatalogModel | null | undefined,
): { valores: Record<string, number | string>; efeitos: string[]; estado: EstadoInversor } {
  const regs = registradoresSetpoint(model);
  const reg = new Map([...estadoFabrica(model), ...escritos]);
  const out: Record<string, number | string> = { ...valores };
  const efeitos: string[] = [];
  const num = (k?: string) => (k ? Number(valores[k]) : NaN);

  const pidP = achar(valores, PID_P), pidQ = achar(valores, PID_Q), pidPn = achar(valores, PID_PN);
  const pidS = achar(valores, PID_S), pidFp = achar(valores, PID_FP);
  const pDig = num(pidP), qDig = Number.isFinite(num(pidQ)) ? num(pidQ) : 0, pn = num(pidPn);
  // Unidades do tipo inversor (DEVICE_POINTS): nominal_power em kW; P em W, Q em VAr, S em VA.
  // Sem potência nominal: % da P digitada.
  const base = Number.isFinite(pn) && pn > 0 ? pn * 1000 : pDig;
  const fatorS = Number((model as any)?.s_max_fator) > 0 ? Number((model as any).s_max_fator) : 1.1;
  const sMax = Number.isFinite(base) ? base * fatorS : NaN;

  const valeSp = (id: SetpointId) => {
    const r = regs.find((x) => x.id === id);
    if (!r) return null;
    const ok = r.chaves.every((c) => (reg.get(c.register) ?? -1) === c.value);
    const v = lerEscrito(r, reg);
    return { ok, pct: v == null ? null : v / r.escala, escrito: escritos.has(r.register) };
  };

  const { desligar } = comandosLigaDesliga(model);   // religar = TON escreve "ligar" no mesmo registrador
  const ligado = !(desligar && reg.get(desligar.register) === desligar.value);
  const lim = valeSp('sp_limite_pct'), q = valeSp('sp_q_pct'), f = valeSp('sp_fp');
  const estado: EstadoInversor = {
    ligado,
    limite: { ativo: !!lim?.ok, pct: lim?.pct ?? null },
    reativo: { modo: q?.ok ? 'q_pct' : f?.ok ? 'fp' : 'desligado', valor: q?.ok ? q.pct : f?.ok ? f.pct : null },
    P: null, Q: null, S: null, fp: null, qCortado: false,
  };

  if (!pidP || !Number.isFinite(pDig)) return { valores: out, efeitos, estado };

  let P = pDig, Q = qDig;
  if (!ligado) {
    P = 0; Q = 0;
    efeitos.push('PARADO (comando Desligar)');
  } else {
    if (lim?.ok && lim.pct != null && Number.isFinite(base)) {
      const teto = (base * lim.pct) / 100;
      P = Math.min(pDig, teto);
      efeitos.push(`limite ${fmt(lim.pct)}% → P ${fmt(P)}${P < pDig ? ' (limitada)' : ''}`);
    } else if (lim?.escrito && !lim.ok) {
      efeitos.push(`limite escrito (${fmt(lim.pct ?? 0)}%) mas a chave de limitação está desabilitada → ignorado`);
    }
    if (q?.ok && q.pct != null && Number.isFinite(base)) {
      Q = (base * q.pct) / 100;
      efeitos.push(`modo Q% ${fmt(q.pct)}% → Q ${fmt(Q)}`);
    } else if (f?.ok && f.pct != null) {
      const a = Math.min(1, Math.abs(f.pct));
      Q = a >= 1 || a <= 0 ? 0 : Math.sign(f.pct) * P * Math.tan(Math.acos(a));
      efeitos.push(`modo FP ${fmt(f.pct)} → Q ${fmt(Q)}`);
    } else {
      if (q?.escrito || f?.escrito) efeitos.push('reativo escrito mas o modo de reativo não está nesse setpoint → ignorado');
    }
    if (Number.isFinite(sMax) && Math.hypot(P, Q) > sMax + 1e-9) {
      const qMax = Math.sqrt(Math.max(0, sMax * sMax - P * P));
      Q = Math.sign(Q) * qMax;
      estado.qCortado = true;
      efeitos.push(`Q cortado para ${fmt(Q)} (potência aparente máx. ${fmt(sMax)})`);
    }
  }

  // Nada mudou (sem comando ou comando sem efeito): serve exatamente o que foi digitado.
  if (ligado && P === pDig && Q === qDig) {
    const S0 = Math.hypot(P, Q);
    estado.P = r3(P); estado.Q = r3(Q); estado.S = r3(S0); estado.fp = r3(S0 > 0 ? (Q < 0 ? -1 : 1) * (P / S0) : 1);
    return { valores: out, efeitos, estado };
  }

  const S = Math.hypot(P, Q);
  const sDig = Math.hypot(pDig, qDig);
  out[pidP] = r3(P);
  if (pidQ) out[pidQ] = r3(Q);
  // Sem pidQ no mapa o Q ainda conta no FP/S/corrente (o Sungrow tem Q em 5033).
  if (pidS) out[pidS] = Number.isFinite(num(pidS)) && sDig > 0 ? r3(num(pidS) * (S / sDig)) : r3(S);
  const fp = S > 0 ? (Q < 0 ? -1 : 1) * (P / S) : 1;
  if (pidFp) out[pidFp] = r3(fp);
  for (const k of PID_I) if (Number.isFinite(num(k)) && sDig > 0) out[k] = r3(num(k) * (S / sDig));
  for (const k of PID_DC) if (Number.isFinite(num(k)) && pDig > 0) out[k] = r3(num(k) * (P / pDig));
  if (ehSungrow(model) && valores.work_state !== undefined) out.work_state = ligado ? SUNGROW_RUN : SUNGROW_STOP;

  estado.P = r3(P); estado.Q = r3(Q); estado.S = r3(S); estado.fp = r3(fp);
  return { valores: out, efeitos, estado };
}

/** Compat: nome antigo. */
export const valoresObedecendo = (
  valores: Record<string, number | string>, escritos: Map<number, number>, model: CatalogModel | null | undefined,
) => {
  const r = simularInversor(valores, escritos, model);
  return { valores: r.valores, efeitos: r.efeitos };
};
