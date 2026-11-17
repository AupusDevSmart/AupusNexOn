import { describe, expect, it } from 'vitest';
import {
  atalhoDiaAtual,
  diasDoAtalho,
  paramsPeriodo,
  passaMeiaNoite,
  resumoPeriodo,
  rotuloPeriodo,
  segmentosHora,
  PERIODO_VAZIO,
} from './periodo';

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

  it('resumo em texto de gente', () => {
    expect(resumoPeriodo(PERIODO_VAZIO, HOJE)).toBe('Todo o período');
    expect(resumoPeriodo(p({ de: '2026-11-16' }), HOJE)).toBe('Ontem');
    expect(resumoPeriodo(p({ de: '2026-11-16', horaDe: '18:00', horaAte: '06:00' }), HOJE)).toBe('Ontem · Noite, 18h–6h');
    expect(resumoPeriodo(p({ de: '2026-11-10', ate: '2026-11-12', horaDe: '06:00', horaAte: '12:00' }), HOJE)).toBe(
      '10 a 12 de nov · Manhã, 6h–12h',
    );
    expect(resumoPeriodo(p({ de: '2026-10-28', ate: '2026-11-03' }), HOJE)).toBe('28 de out a 3 de nov');
    expect(resumoPeriodo(p({ de: '2025-12-30', ate: '2026-01-02' }), HOJE)).toBe('30 de dez de 2025 a 2 de jan');
    expect(resumoPeriodo(p({ de: '2026-11-13' }), HOJE)).toBe('Sex, 13 de nov');
    expect(resumoPeriodo(p({ horaDe: '18:00', horaAte: '06:00' }), HOJE)).toBe('Toda noite, 18h–6h');
    expect(resumoPeriodo(p({ de: HOJE, horaDe: '08:30', horaAte: '12:00' }), HOJE)).toBe('Hoje, das 8h30 ao meio-dia');
    expect(resumoPeriodo(p({ horaDe: '22:00', horaAte: '01:00' }), HOJE)).toBe('Todo dia, das 22h à 1h');
    expect(resumoPeriodo(p({ horaDe: '18:00' }), HOJE)).toBe('Todo dia, a partir das 18h');
    expect(resumoPeriodo(p({ horaAte: '00:00' }), HOJE)).toBe('Todo dia, até a meia-noite');
  });

  it('faixa que vira a noite', () => {
    expect(passaMeiaNoite(p({ horaDe: '18:00', horaAte: '06:00' }))).toBe(true);
    expect(passaMeiaNoite(p({ horaDe: '06:00', horaAte: '12:00' }))).toBe(false);
    expect(segmentosHora(p({ horaDe: '18:00', horaAte: '06:00' }))).toEqual([
      [0, 360],
      [1080, 1440],
    ]);
    expect(segmentosHora(p({ horaDe: '06:00', horaAte: '12:00' }))).toEqual([[360, 720]]);
    expect(segmentosHora(p({ horaDe: '18:00', horaAte: '00:00' }))).toEqual([[1080, 1440]]);
    expect(segmentosHora(PERIODO_VAZIO)).toEqual([]);
  });
});
