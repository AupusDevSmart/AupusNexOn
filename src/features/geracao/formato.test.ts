import { describe, expect, it } from 'vitest';
import { numBr } from './formato';

describe('numBr (config da usina)', () => {
  it.each([
    ['1512', 1512], ['1.512', 1512], ['1.512,5', 1512.5], ['1512,5', 1512.5],
    ['1512.5', 1512.5], ['0.85', 0.85], ['0,85', 0.85], ['', null],
  ])('%s → %s', (txt, esperado) => {
    expect(numBr(txt)).toBe(esperado);
  });
  it('lixo vira NaN (bloqueia salvar)', () => expect(numBr('abc')).toBeNaN());
});
