import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { esquecerEstadosDeTela, useEstadoLembrado, useFiltrosNaUrl } from './useEstadoLembrado';

// O Node 22+ expõe um localStorage global vazio que esconde o do happy-dom.
function armazenamento(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  } as Storage;
}
for (const nome of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(window, nome, { value: armazenamento(), configurable: true });
}

const inicial = { search: '', plantaId: 'all', page: 1 };

function comRota(url: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
}

function useFiltrosComUrl(chave: string) {
  const [filtros, setFiltros] = useFiltrosNaUrl(chave, inicial);
  return { filtros, setFiltros, search: useLocation().search };
}

describe('useFiltrosNaUrl', () => {
  beforeEach(() => window.localStorage.clear());

  it('lê da URL convertendo pelo tipo do padrão', () => {
    const { result } = renderHook(() => useFiltrosComUrl('t'), {
      wrapper: comRota('/x?plantaId=abc&page=3'),
    });
    expect(result.current.filtros).toEqual({ search: '', plantaId: 'abc', page: 3 });
  });

  it('escreve na URL só o que difere do padrão e lembra para a próxima visita', () => {
    const { result, unmount } = renderHook(() => useFiltrosComUrl('t'), {
      wrapper: comRota('/x'),
    });
    act(() => result.current.setFiltros((f) => ({ ...f, search: 'bomba', page: 2 })));
    expect(result.current.search).toBe('?search=bomba&page=2');
    unmount();

    const volta = renderHook(() => useFiltrosComUrl('t'), { wrapper: comRota('/x') });
    expect(volta.result.current.filtros).toEqual({ search: 'bomba', plantaId: 'all', page: 2 });
  });

  it('URL vence a memória', () => {
    window.localStorage.setItem('nexon:tela:t', JSON.stringify({ search: 'velho', page: 5 }));
    const { result } = renderHook(() => useFiltrosComUrl('t'), {
      wrapper: comRota('/x?plantaId=p1'),
    });
    expect(result.current.filtros).toEqual({ search: '', plantaId: 'p1', page: 1 });
  });

  it('logout esquece tudo', () => {
    const { result, unmount } = renderHook(() => useEstadoLembrado('aberta', null as string | null));
    act(() => result.current[1]('p9'));
    unmount();
    esquecerEstadosDeTela();
    const volta = renderHook(() => useEstadoLembrado('aberta', null as string | null));
    expect(volta.result.current[0]).toBeNull();
  });
});
