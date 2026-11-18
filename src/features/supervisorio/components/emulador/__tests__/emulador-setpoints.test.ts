import { describe, expect, it } from 'vitest';
import { estadoFabrica, lerEscrito, registradoresSetpoint, simularInversor } from '../emulador-setpoints';

// Sungrow SG110CX (catálogo): chave/modo + valor; % x10, FP x1000
const SUNGROW: any = {
  fabricante: 'Sungrow',
  setpoints: [
    { id: 'sp_limite_pct', escala: 10, padrao: 100 },
    { id: 'sp_fp', escala: 1000, padrao: 1 },
    { id: 'sp_q_pct', escala: 10, padrao: 0 },
  ],
  bo_map: {
    ligar: { func: 6, value: 207, register: 5005 },
    desligar: { func: 6, value: 206, register: 5005 },
    sp_limite_pct: { steps: [{ func: 6, value: 170, register: 5006 }, { func: 6, value: '$valor', register: 5007 }] },
    sp_fp: { steps: [{ func: 6, value: 161, register: 5035 }, { func: 6, value: '$valor', register: 5018 }] },
    sp_q_pct: { steps: [{ func: 6, value: 162, register: 5035 }, { func: 6, value: '$valor', register: 5036 }] },
  },
};
// WEG SIW400G: Q em S32 por FC16
const WEG: any = {
  setpoints: [{ id: 'sp_q_pct', escala: 10 }],
  bo_map: { sp_q_pct: { steps: [{ func: 6, value: 0, register: 40298 }, { func: 16, values: ['$valor_hi', '$valor_lo'], register: 40302 }] } },
};
const u16 = (v: number) => v & 0xffff;
const V = { potencia_ativa: 90000, potencia_reativa: 0, nominal_power: 110, apparent_total: 90000, fp: 1, ia: 100, ib: 100, ic: 100, work_state: 0 };

describe('emulador acata os comandos como o inversor', () => {
  it('acha o registrador do valor e as chaves de habilitação', () => {
    expect(registradoresSetpoint(SUNGROW)).toEqual([
      { id: 'sp_limite_pct', register: 5007, escala: 10, words: 1, chaves: [{ register: 5006, value: 170 }] },
      { id: 'sp_q_pct', register: 5036, escala: 10, words: 1, chaves: [{ register: 5035, value: 162 }] },
      { id: 'sp_fp', register: 5018, escala: 1000, words: 1, chaves: [{ register: 5035, value: 161 }] },
    ]);
    expect(registradoresSetpoint(WEG)).toEqual([{ id: 'sp_q_pct', register: 40302, escala: 10, words: 2, chaves: [{ register: 40298, value: 0 }] }]);
  });

  it('lê com sinal (1 e 2 palavras)', () => {
    expect(lerEscrito({ register: 5036, words: 1 }, new Map([[5036, 0xff88]]))).toBe(-120);
    expect(lerEscrito({ register: 40302, words: 2 }, new Map([[40302, 0xffff], [40303, 0xff88]]))).toBe(-120);
  });

  it('estado de fábrica: limite 100 % desabilitado, reativo desligado, ligado', () => {
    const f = estadoFabrica(SUNGROW);
    expect(f.get(5006)).toBe(0x55);
    expect(f.get(5007)).toBe(1000);
    expect(f.get(5035)).toBe(0x55);
    expect(f.get(5036)).toBe(0);
    expect(f.get(5018)).toBe(1000);
    expect(f.get(5005)).toBe(207);
  });

  it('sem comando: serve exatamente o digitado', () => {
    const r = simularInversor(V, new Map(), SUNGROW);
    expect(r.valores).toEqual(V);
    expect(r.efeitos).toEqual([]);
    expect(r.estado.limite.ativo).toBe(false);
  });

  it('limite SEM a chave 0xAA é ignorado (como o Sungrow)', () => {
    const r = simularInversor(V, new Map([[5007, 450]]), SUNGROW);
    expect(r.valores.potencia_ativa).toBe(90000);
    expect(r.efeitos[0]).toMatch(/chave de limitação está desabilitada/);
  });

  it('chave + limite: P = nominal x limite; S, FP e correntes acompanham', () => {
    const r = simularInversor(V, new Map([[5006, 170], [5007, 450]]), SUNGROW);
    expect(r.valores.potencia_ativa).toBe(49500);    // 110 kW x 45 % (em W)
    expect(r.valores.apparent_total).toBe(49500);
    expect(r.valores.ia).toBe(55);                   // 100 x 49,5/90
    expect(r.efeitos[0]).toMatch(/limite 45% → P 49500 \(limitada\)/);
  });

  it('limite acima da P disponível não aumenta a P (irradiância)', () => {
    const r = simularInversor(V, new Map([[5006, 170], [5007, 1000]]), SUNGROW);
    expect(r.valores.potencia_ativa).toBe(90000);
  });

  it('modo Q% (0xA2): Q = nominal x Q%, FP negativo com Q negativo', () => {
    const r = simularInversor(V, new Map([[5035, 162], [5036, u16(-300)]]), SUNGROW);
    expect(r.valores.potencia_reativa).toBe(-33000); // 110 kW x -30 % (em VAr)
    expect(r.valores.fp).toBeCloseTo(-90 / Math.hypot(90, 33), 3);
    expect(r.estado.reativo).toEqual({ modo: 'q_pct', valor: -30 });
  });

  it('Q% escrito sem o modo é ignorado', () => {
    const r = simularInversor(V, new Map([[5036, 300]]), SUNGROW);
    expect(r.valores.potencia_reativa).toBe(0);
    expect(r.efeitos[0]).toMatch(/modo de reativo não está nesse setpoint/);
  });

  it('modo FP (0xA1): Q = P·tan(acos FP); o último modo escrito ganha', () => {
    const r = simularInversor(V, new Map([[5035, 161], [5018, 950], [5036, 300]]), SUNGROW);
    expect(r.estado.reativo.modo).toBe('fp');
    expect(r.valores.potencia_reativa).toBeCloseTo(90000 * Math.tan(Math.acos(0.95)), 0);
    expect(r.valores.fp).toBeCloseTo(0.95, 3);
  });

  it('passou da potência aparente máxima (1,1 Pn): Q é cortado, P mantida', () => {
    const r = simularInversor({ ...V, potencia_ativa: 110000 }, new Map([[5035, 162], [5036, 1000]]), SUNGROW);
    expect(r.valores.potencia_ativa).toBe(110000);
    expect(r.valores.potencia_reativa).toBeCloseTo(Math.sqrt(121000 ** 2 - 110000 ** 2), 0);
    expect(r.estado.qCortado).toBe(true);
  });

  it('Desligar zera P, Q e correntes e muda o work state; Ligar volta', () => {
    const r = simularInversor(V, new Map([[5005, 206]]), SUNGROW);
    expect(r.valores.potencia_ativa).toBe(0);
    expect(r.valores.ia).toBe(0);
    expect(r.valores.work_state).toBe(0x8000);
    expect(r.estado.ligado).toBe(false);
    expect(simularInversor(V, new Map([[5005, 207]]), SUNGROW).valores.potencia_ativa).toBe(90000);
  });

  it('WEG (FC16 2 palavras, sem chave de fábrica): vale só depois de escrever o modo', () => {
    const v = { potencia_ativa: 30000, potencia_reativa: 0, nominal_power: 60 };
    expect(simularInversor(v, new Map([[40302, 0], [40303, 200]]), WEG).valores.potencia_reativa).toBe(0);
    expect(simularInversor(v, new Map([[40298, 0], [40302, 0], [40303, 200]]), WEG).valores.potencia_reativa).toBe(12000);
  });
});
