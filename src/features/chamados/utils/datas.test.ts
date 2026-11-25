import { describe, expect, it } from 'vitest';
import { deInputLocal, diaBR, duracaoDoChamado, formatarDuracao, inicioDoPeriodo, paraInputLocal, plural, rotuloMes } from './datas';

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

  it('início do período em dia local', () => {
    const hoje = new Date(2026, 10, 25, 15, 0);
    expect(inicioDoPeriodo('30d', hoje)).toBe('2026-10-27');
    expect(inicioDoPeriodo('90d', hoje)).toBe('2026-08-28');
    expect(inicioDoPeriodo('12m', hoje)).toBe('2025-12-01');
    expect(inicioDoPeriodo('', hoje)).toBeUndefined();
  });

  it('dia em BR e plural', () => {
    expect(diaBR('2026-11-03')).toBe('03/11/2026');
    expect(plural(1, 'aberto', 'abertos')).toBe('1 aberto');
    expect(plural(0, 'aberto', 'abertos')).toBe('0 abertos');
  });
});
