import { describe, expect, it } from 'vitest';
import { lerEscrito, registradoresSetpoint, valoresObedecendo } from '../emulador-setpoints';

// Sungrow SG110CX (catálogo): habilita + valor; % x10
const SUNGROW: any = {
  setpoints: [{ id: 'sp_limite_pct', escala: 10 }, { id: 'sp_q_pct', escala: 10 }],
  bo_map: {
    sp_limite_pct: { steps: [{ func: 6, value: 170, register: 5006 }, { func: 6, value: '$valor', register: 5007 }] },
    sp_q_pct: { steps: [{ func: 6, value: 162, register: 5035 }, { func: 6, value: '$valor', register: 5036 }] },
  },
};
// WEG SIW400G: Q em S32 por FC16
const WEG: any = {
  setpoints: [{ id: 'sp_q_pct', escala: 10 }],
  bo_map: { sp_q_pct: { steps: [{ func: 6, value: 0, register: 40298 }, { func: 16, values: ['$valor_hi', '$valor_lo'], register: 40302 }] } },
};

describe('emulador obedece os setpoints do inversor', () => {
  it('acha o registrador do valor (último passo "$valor")', () => {
    expect(registradoresSetpoint(SUNGROW)).toEqual([
      { id: 'sp_limite_pct', register: 5007, escala: 10, words: 1 },
      { id: 'sp_q_pct', register: 5036, escala: 10, words: 1 },
    ]);
    expect(registradoresSetpoint(WEG)).toEqual([{ id: 'sp_q_pct', register: 40302, escala: 10, words: 2 }]);
  });

  it('lê com sinal (1 e 2 palavras)', () => {
    expect(lerEscrito({ id: 'sp_q_pct', register: 5036, escala: 10, words: 1 }, new Map([[5036, 0xff88]]))).toBe(-120);
    expect(lerEscrito({ id: 'sp_q_pct', register: 40302, escala: 10, words: 2 }, new Map([[40302, 0xffff], [40303, 0xff88]]))).toBe(-120);
  });

  it('P limitada pela nominal x limite; Q = nominal x Q%', () => {
    const v = { potencia_ativa: 90, potencia_reativa: 0, nominal_power: 110 };
    const r = valoresObedecendo(v, new Map([[5007, 450], [5036, 0xff88]]), SUNGROW);
    expect(r.valores.potencia_ativa).toBe(49.5);     // 110 x 45 %
    expect(r.valores.potencia_reativa).toBe(-13.2);  // 110 x -12 %
    expect(r.efeitos[0]).toMatch(/limite 45% → P 49.5 \(limitada\)/);
  });

  it('limite acima da P disponível não aumenta a P (irradiância)', () => {
    const r = valoresObedecendo({ potencia_ativa: 30, nominal_power: 110 }, new Map([[5007, 1000]]), SUNGROW);
    expect(r.valores.potencia_ativa).toBe(30);
  });

  it('sem escrita: nada muda', () => {
    const v = { potencia_ativa: 30 };
    expect(valoresObedecendo(v, new Map(), SUNGROW)).toEqual({ valores: v, efeitos: [] });
  });
});
