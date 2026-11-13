import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useAbaSinoptico, type AbaSinoptico } from './useAbaSinoptico';

function comRota(url: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
}

const ADMIN = { abaInicial: 'unifilar' as AbaSinoptico, podeVerIot: true, podeVerUnifilar: true, podeVerAlarmes: true };
const OPERADOR = { abaInicial: 'visao' as AbaSinoptico, podeVerIot: false, podeVerUnifilar: false, podeVerAlarmes: true };

function useAba(opcoes: typeof ADMIN) {
  return { ...useAbaSinoptico(opcoes), search: useLocation().search, nav: useNavigationType() };
}

describe('useAbaSinoptico', () => {
  it('F5 na aba Câmeras volta na aba Câmeras', () => {
    const { result } = renderHook(() => useAba(ADMIN), { wrapper: comRota('/s/u1?aba=cameras&camera=c1&evento=e1') });
    expect(result.current.aba).toBe('cameras');
    expect(result.current.search).toBe('?aba=cameras&camera=c1&evento=e1');
    expect(result.current.buscaDaAba).toBe('?aba=cameras');
  });

  it('sem aba ou aba desconhecida abre na aba inicial do papel', () => {
    expect(renderHook(() => useAba(ADMIN), { wrapper: comRota('/s/u1') }).result.current.aba).toBe('unifilar');
    expect(renderHook(() => useAba(OPERADOR), { wrapper: comRota('/s/u1?aba=xpto') }).result.current.aba).toBe('visao');
  });

  it('trocar de aba cria entrada no histórico e limpa o estado da aba anterior', () => {
    const { result } = renderHook(() => useAba(ADMIN), { wrapper: comRota('/s/u1?aba=cameras&camera=c1') });
    act(() => result.current.definirAba('alarmes'));
    expect(result.current.aba).toBe('alarmes');
    expect(result.current.search).toBe('?aba=alarmes');
    expect(result.current.nav).toBe('PUSH');
    // Voltar para a aba inicial tira o parâmetro.
    act(() => result.current.definirAba('unifilar'));
    expect(result.current.search).toBe('');
  });

  it('link com aba sem permissão volta sem nova entrada no histórico', () => {
    const { result } = renderHook(() => useAba(OPERADOR), { wrapper: comRota('/s/u1?aba=iot') });
    expect(result.current.aba).toBe('visao');
    expect(result.current.search).toBe('');
    expect(result.current.nav).toBe('REPLACE');

    const unifilar = renderHook(() => useAba(OPERADOR), { wrapper: comRota('/s/u1?aba=unifilar') });
    expect(unifilar.result.current.aba).toBe('visao');
  });
});
