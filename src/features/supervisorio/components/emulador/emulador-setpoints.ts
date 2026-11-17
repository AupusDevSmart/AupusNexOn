/**
 * Emulador "obedece" os setpoints de inversor (controle pelo MED, bancada da Fazenda Pontal):
 *  - o que a TON escreve (FC06/FC16) fica nos holding registers → o read-back da TON lê o valor escrito;
 *  - limite de P (sp_limite_pct): a potência ativa servida vira min(P digitada, nominal × limite);
 *  - reativo (sp_q_pct): a potência reativa servida vira nominal × Q%.
 * Os registradores saem do bo_map do catálogo (último passo "$valor"), como no gerador de firmware.
 * Puro (sem window/serial).
 */
import type { CatalogModel } from './emulador-catalog';

export type SetpointId = 'sp_limite_pct' | 'sp_q_pct';
export interface RegSetpoint { id: SetpointId; register: number; escala: number; words: 1 | 2 }

interface Passo { func?: number; register?: number; value?: unknown; values?: unknown[] }

/** Registrador onde a TON escreve o VALOR de cada setpoint (FC06 "$valor" ou FC16 "$valor_hi/lo"). */
export function registradoresSetpoint(model: CatalogModel | null | undefined): RegSetpoint[] {
  const bo = (model?.bo_map ?? {}) as Record<string, Passo & { steps?: Passo[] }>;
  const sps = (Array.isArray(model?.setpoints) ? model?.setpoints : []) as Array<{ id?: string; escala?: number }>;
  const out: RegSetpoint[] = [];
  for (const id of ['sp_limite_pct', 'sp_q_pct'] as SetpointId[]) {
    const m = bo[id];
    if (!m) continue;
    const passos: Passo[] = Array.isArray(m.steps) ? m.steps : [m];
    const escala = Number(sps.find((x) => x?.id === id)?.escala) || 1;
    for (let i = passos.length - 1; i >= 0; i--) {
      const st = passos[i];
      const f = st.func ?? 6;
      if (f === 6 && st.value === '$valor' && st.register != null) { out.push({ id, register: Number(st.register), escala, words: 1 }); break; }
      if (f === 16 && Array.isArray(st.values) && st.values.join(',') === '$valor_hi,$valor_lo' && st.register != null) {
        out.push({ id, register: Number(st.register), escala, words: 2 }); break;
      }
    }
  }
  return out;
}

/** Valor escrito (com sinal) num registrador de setpoint; null = a TON ainda não escreveu. */
export function lerEscrito(r: RegSetpoint, escritos: Map<number, number>): number | null {
  if (!escritos.has(r.register)) return null;
  if (r.words === 2) {
    const hi = escritos.get(r.register) ?? 0, lo = escritos.get(r.register + 1) ?? 0;
    return (((hi & 0xffff) << 16) | (lo & 0xffff)) | 0;
  }
  const w = escritos.get(r.register)! & 0xffff;
  return w >= 0x8000 ? w - 0x10000 : w;
}

const PID_P = ['potencia_ativa', 'active_power', 'p_total', 'pt'];
const PID_Q = ['potencia_reativa', 'reactive_power', 'q_total', 'qt'];
const PID_PN = ['nominal_power', 'potencia_nominal', 'pn'];
const achar = (v: Record<string, unknown>, ids: string[]) => ids.find((k) => v[k] !== undefined && v[k] !== '');

/** Valores servidos depois dos setpoints escritos (P limitado, Q pedido) + o que mudou, para o log. */
export function valoresObedecendo(
  valores: Record<string, number | string>, escritos: Map<number, number>, model: CatalogModel | null | undefined,
): { valores: Record<string, number | string>; efeitos: string[] } {
  const regs = registradoresSetpoint(model);
  if (!regs.length || !escritos.size) return { valores, efeitos: [] };
  const out = { ...valores };
  const efeitos: string[] = [];
  const pidP = achar(valores, PID_P), pidQ = achar(valores, PID_Q), pidPn = achar(valores, PID_PN);
  const pDig = pidP ? Number(valores[pidP]) : NaN;
  const pn = pidPn ? Number(valores[pidPn]) : NaN;
  const base = Number.isFinite(pn) && pn > 0 ? pn : pDig;   // sem potência nominal: % da P digitada
  for (const r of regs) {
    const v = lerEscrito(r, escritos);
    if (v == null || !Number.isFinite(base)) continue;
    const pct = v / r.escala;
    if (r.id === 'sp_limite_pct' && pidP && Number.isFinite(pDig)) {
      const lim = (base * pct) / 100;
      const p = Math.min(pDig, lim);
      out[pidP] = Math.round(p * 1000) / 1000;
      efeitos.push(`limite ${pct}% → P ${out[pidP]}${p < pDig ? ' (limitada)' : ''}`);
    }
    if (r.id === 'sp_q_pct' && pidQ) {
      out[pidQ] = Math.round(((base * pct) / 100) * 1000) / 1000;
      efeitos.push(`Q ${pct}% → ${out[pidQ]}`);
    }
  }
  return { valores: out, efeitos };
}
