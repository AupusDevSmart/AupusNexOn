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

  it('caminho relativo + token na origem da API', () => {
    expect(urlMidia('/api/v1/cameras/01j/miniatura', 'abc', origem)).toBe(
      'http://localhost:3001/api/v1/cameras/01j/miniatura?token=abc',
    );
    // Aceita a URL base completa da API como origem.
    expect(urlMidia('/api/v1/x', 'abc', 'http://localhost:3001/api/v1')).toBe('http://localhost:3001/api/v1/x?token=abc');
  });

  it('URL absoluta da própria API: mantém a query e usa &', () => {
    expect(urlMidia('http://localhost:3001/api/v1/x.jpg?v=2', 'a b', origem)).toBe(
      'http://localhost:3001/api/v1/x.jpg?v=2&token=a%20b',
    );
  });

  it('nunca manda o token para outra origem', () => {
    expect(urlMidia('https://cdn.exemplo.com/x.jpg?v=2', 'abc', origem)).toBe('https://cdn.exemplo.com/x.jpg?v=2');
    // Porta diferente é outra origem.
    expect(urlMidia('http://localhost:3002/api/v1/x', 'abc', origem)).toBe('http://localhost:3002/api/v1/x');
    // Esquema diferente também.
    expect(urlMidia('https://localhost:3001/api/v1/x', 'abc', origem)).toBe('https://localhost:3001/api/v1/x');
  });

  it('sem origem válida da API não anexa token nem inventa host', () => {
    expect(urlMidia('/api/v1/x', 'abc', '')).toBe('/api/v1/x');
    expect(urlMidia('https://cdn.exemplo.com/x.jpg', 'abc', '')).toBe('https://cdn.exemplo.com/x.jpg');
  });

  it('sem caminho → null; sem token → sem token=', () => {
    expect(urlMidia(null, 'abc', origem)).toBeNull();
    expect(urlMidia('/api/v1/x', null, origem)).toBe('http://localhost:3001/api/v1/x');
  });
});
