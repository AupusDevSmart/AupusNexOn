import { describe, expect, it } from 'vitest';
import { divergenciaPct, linhasFonteDoPonto, linhasSelo, seloDaFonte, textoTonNuvem } from './fonte';

describe('fonte da geração (NEXON-37)', () => {
  it('selo a partir da fonte do COA', () => {
    expect(seloDaFonte('ton')).toBe('Fonte: TON');
    expect(seloDaFonte('nuvem')).toBe('Fonte: nuvem');
    expect(seloDaFonte('manual')).toBe('Fonte: manual');
    expect(seloDaFonte('ton', true)).toBe('Fontes divergem — usando TON');
    expect(seloDaFonte(null)).toBeNull();
    expect(seloDaFonte(undefined)).toBeNull();
  });

  it('divergência = |ton − nuvem| / maior', () => {
    expect(divergenciaPct(100, 95)).toBeCloseTo(5);
    expect(divergenciaPct(0, 0)).toBeNull();
    expect(divergenciaPct(null, 10)).toBeNull();
  });

  it('TON × nuvem só com as duas', () => {
    expect(textoTonNuvem(6100.2, 6080)).toBe('TON 6.100 kWh · nuvem 6.080 kWh');
    expect(textoTonNuvem(6100, null)).toBeNull();
  });

  it('linhas do tooltip da barra', () => {
    expect(linhasFonteDoPonto({})).toEqual([]);
    expect(linhasFonteDoPonto({ fonte: 'nuvem', kwh_ton: null, kwh_nuvem: 40 })).toEqual([{ label: 'Fonte', value: 'nuvem' }]);
    expect(linhasFonteDoPonto({ fonte: 'ton', kwh_ton: 50, kwh_nuvem: 40, divergem: true })).toEqual([
      { label: 'Fonte', value: 'TON (divergem)' },
      { label: 'Medições', value: 'TON 50 kWh · nuvem 40 kWh' },
    ]);
  });

  it('linhas do selo com fonte fixada e dias divergentes', () => {
    const l = linhasSelo({
      config: 'nuvem', escolhida: 'nuvem', divergem: true, selo: 'x', tem_nuvem: true, kwh_ton: 100, kwh_nuvem: 80,
      dias: [
        { data: '2026-10-19', kwh: 50, kwh_ton: 50, kwh_nuvem: 40, kwh_manual: null, fonte: 'nuvem', motivo: 'divergem', divergencia_pct: 20 },
        { data: '2026-10-20', kwh: 40, kwh_ton: 50, kwh_nuvem: 40, kwh_manual: null, fonte: 'nuvem', motivo: 'fixada', divergencia_pct: 20 },
      ],
    });
    expect(l.map((x) => x.label)).toEqual(['Configuração', 'TON', 'Nuvem', 'Diferença', 'Dias com divergência']);
    expect(l[0].value).toBe('Fixada em Nuvem do fabricante');
    expect(l[3].value).toBe('20,0%');
  });
});
