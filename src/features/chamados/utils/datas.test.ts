import { describe, expect, it } from 'vitest';
import { deInputLocal, duracaoDoChamado, formatarDuracao, paraInputLocal, rotuloMes } from './datas';

describe('datas dos chamados (NEXON-144)', () => {
  it('formata duração em min, h e dias', () => {
    expect(formatarDuracao(null)).toBe('—');
    expect(formatarDuracao(0.5)).toBe('30 min');
    expect(formatarDuracao(3.25)).toBe('3,3 h');
    expect(formatarDuracao(28)).toBe('1 d 4 h');
    expect(formatarDuracao(48)).toBe('2 d');
  });

  it('duração usa ocorrência e encerramento', () => {
    const c = { ocorrencia_em: '2026-11-20T10:00:00Z', aberto_em: '2026-11-20T11:00:00Z', created_at: '2026-11-20T12:00:00Z', fechado_em: '2026-11-20T14:30:00Z' };
    expect(duracaoDoChamado(c)).toBe(4.5);
  });

  it('ida e volta do datetime-local', () => {
    const iso = '2026-11-20T13:45:00.000Z';
    expect(deInputLocal(paraInputLocal(iso))).toBe(iso);
    expect(deInputLocal('')).toBeNull();
  });

  it('rótulo do mês', () => {
    expect(rotuloMes('2026-11')).toBe('nov/26');
  });
});
