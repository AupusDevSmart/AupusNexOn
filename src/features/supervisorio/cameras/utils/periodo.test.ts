import { describe, expect, it } from 'vitest';
import { atalhoDiaAtual, diasDoAtalho, paramsPeriodo, rotuloPeriodo, PERIODO_VAZIO } from './periodo';

const HOJE = '2026-11-17';
const p = (x: Partial<typeof PERIODO_VAZIO>) => ({ ...PERIODO_VAZIO, ...x });

describe('período dos eventos', () => {
  it('atalhos viram datas', () => {
    expect(diasDoAtalho('hoje', HOJE)).toEqual({ de: HOJE, ate: null });
    expect(diasDoAtalho('ontem', HOJE)).toEqual({ de: '2026-11-16', ate: null });
    expect(diasDoAtalho('7dias', HOJE)).toEqual({ de: '2026-11-11', ate: HOJE });
  });

  it('reconhece o atalho a partir das datas', () => {
    expect(atalhoDiaAtual(p({ de: '2026-11-11', ate: HOJE }), HOJE)).toBe('7dias');
    expect(atalhoDiaAtual(p({ de: '2026-11-10', ate: '2026-11-12' }), HOJE)).toBeNull();
  });

  it('rótulo curto do botão', () => {
    expect(rotuloPeriodo(PERIODO_VAZIO, HOJE)).toBe('Período');
    expect(rotuloPeriodo(p({ de: '2026-11-16' }), HOJE)).toBe('Ontem');
    expect(rotuloPeriodo(p({ de: '2026-11-10', ate: '2026-11-12' }), HOJE)).toBe('10/11 – 12/11');
    expect(rotuloPeriodo(p({ de: HOJE, horaDe: '18:00', horaAte: '06:00' }), HOJE)).toBe('Hoje · Noite');
    expect(rotuloPeriodo(p({ horaDe: '08:30', horaAte: '12:00' }), HOJE)).toBe('8h30–12h');
  });

  it('parâmetros da API sem chaves vazias', () => {
    expect(paramsPeriodo(PERIODO_VAZIO)).toEqual({});
    expect(paramsPeriodo(p({ de: HOJE, ate: HOJE, horaDe: '18:00' }))).toEqual({ de: HOJE, hora_de: '18:00' });
    expect(paramsPeriodo(p({ de: '2026-11-10', ate: '2026-11-12', horaDe: '06:00', horaAte: '12:00' }))).toEqual({
      de: '2026-11-10',
      ate: '2026-11-12',
      hora_de: '06:00',
      hora_ate: '12:00',
    });
  });
});
