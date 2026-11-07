import { describe, expect, it } from 'vitest';
import { origemDaApi, urlMidia } from './midia';

describe('origemDaApi', () => {
  it('tira o prefixo /api/v1', () => {
    expect(origemDaApi('https://aupus-nexon-api.aupusenergia.com.br/api/v1')).toBe('https://aupus-nexon-api.aupusenergia.com.br');
    expect(origemDaApi('http://localhost:3001/api/v1')).toBe('http://localhost:3001');
  });

  it('inválida ou vazia vira vazio', () => {
    expect(origemDaApi(undefined)).toBe('');
    expect(origemDaApi('nada')).toBe('');
  });
});

describe('urlMidia', () => {
  const origem = 'http://localhost:3001';

  it('caminho relativo + token', () => {
    expect(urlMidia('/api/v1/cameras/01j/miniatura', 'abc', origem)).toBe(
      'http://localhost:3001/api/v1/cameras/01j/miniatura?token=abc',
    );
  });

  it('mantém URL absoluta e usa & quando já há query', () => {
    expect(urlMidia('https://cdn/x.jpg?v=2', 'a b', origem)).toBe('https://cdn/x.jpg?v=2&token=a%20b');
  });

  it('sem caminho → null; sem token → sem token=', () => {
    expect(urlMidia(null, 'abc', origem)).toBeNull();
    expect(urlMidia('/api/v1/x', null, origem)).toBe('http://localhost:3001/api/v1/x');
  });
});
