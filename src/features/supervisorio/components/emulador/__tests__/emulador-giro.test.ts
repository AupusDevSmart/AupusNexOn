import { describe, expect, it } from 'vitest';
import { grausDoGiro, posicaoDoGiro, validarGiro, velocidadeDoGiro } from '../emulador-giro';

describe('emulador — simular giro do encoder', () => {
  it('anda de 0 a 90 em 60 s (crescente), linear', () => {
    const p = { de: 0, ate: 90, segundos: 60, sentido: 'crescente' as const };
    expect(grausDoGiro(p)).toBe(90);
    expect(posicaoDoGiro(p, 0)).toEqual({ posicao: 0, fim: false });
    expect(posicaoDoGiro(p, 30_000)).toEqual({ posicao: 45, fim: false });
    expect(posicaoDoGiro(p, 60_000)).toEqual({ posicao: 90, fim: true });
    expect(posicaoDoGiro(p, 99_000)).toEqual({ posicao: 90, fim: true });
    expect(velocidadeDoGiro(p)).toBe(1.5);
  });

  it('passa pelo zero: 300 → 20 crescente anda 80°; decrescente anda 280°', () => {
    const c = { de: 300, ate: 20, segundos: 80, sentido: 'crescente' as const };
    expect(grausDoGiro(c)).toBe(80);
    expect(posicaoDoGiro(c, 70_000).posicao).toBe(10);
    const d = { ...c, sentido: 'decrescente' as const };
    expect(grausDoGiro(d)).toBe(280);
    expect(posicaoDoGiro(d, 10_000).posicao).toBe(265);
  });

  it('valida', () => {
    expect(validarGiro({ de: 0, ate: 400, segundos: 10, sentido: 'crescente' })).toMatch(/0 a 359/);
    expect(validarGiro({ de: 10, ate: 10, segundos: 10, sentido: 'crescente' })).toMatch(/nada a andar/);
    expect(validarGiro({ de: 0, ate: 30, segundos: 0, sentido: 'crescente' })).toMatch(/tempo/);
    expect(validarGiro({ de: 0, ate: 30, segundos: 60, sentido: 'crescente' })).toBeNull();
  });
});
