import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from '@/store/useUserStore';
import { CamerasService } from '../services/cameras.service';
import { limparCacheTokenMidia, obterTokenMidia } from './useTokenMidia';

vi.mock('../services/cameras.service', () => ({
  CamerasService: { tokenMidia: vi.fn() },
}));

// Store sem `persist` (o ambiente de teste não tem localStorage): só o que o hook lê e observa.
vi.mock('@/store/useUserStore', async () => {
  const { create } = await import('zustand');
  return { useUserStore: create<{ user: { id: string } | null }>(() => ({ user: null })) };
});

const tokenMidia = vi.mocked(CamerasService.tokenMidia);
let n = 0;
const resposta = () => {
  n += 1;
  return Promise.resolve({ token: `tok-${n}`, valido_ate: new Date(Date.now() + 2 * 3600_000).toISOString() });
};

describe('obterTokenMidia', () => {
  beforeEach(() => {
    limparCacheTokenMidia();
    tokenMidia.mockReset();
    tokenMidia.mockImplementation(resposta);
    n = 0;
    useUserStore.setState({ user: null });
  });

  it('reusa o token do mesmo usuário e dedupe chamadas simultâneas', async () => {
    const [a, b] = await Promise.all([obterTokenMidia('u1'), obterTokenMidia('u1')]);
    expect(a).toBe('tok-1');
    expect(b).toBe('tok-1');
    expect(await obterTokenMidia('u1')).toBe('tok-1');
    expect(tokenMidia).toHaveBeenCalledTimes(1);
  });

  it('outro usuário nunca recebe o token em cache', async () => {
    expect(await obterTokenMidia('u1')).toBe('tok-1');
    expect(await obterTokenMidia('u2')).toBe('tok-2');
    expect(tokenMidia).toHaveBeenCalledTimes(2);
  });

  it('renovar força busca nova', async () => {
    expect(await obterTokenMidia('u1')).toBe('tok-1');
    expect(await obterTokenMidia('u1', true)).toBe('tok-2');
  });

  it('exige usuário logado', async () => {
    await expect(obterTokenMidia('')).rejects.toThrow();
    expect(tokenMidia).not.toHaveBeenCalled();
  });

  it('logout ou troca de usuário no store limpa o cache', async () => {
    useUserStore.setState({ user: { id: 'u1' } });
    expect(await obterTokenMidia('u1')).toBe('tok-1');
    useUserStore.setState({ user: null });
    expect(await obterTokenMidia('u1')).toBe('tok-2');
    useUserStore.setState({ user: { id: 'u2' } });
    expect(await obterTokenMidia('u2')).toBe('tok-3');
    expect(tokenMidia).toHaveBeenCalledTimes(3);
  });
});
