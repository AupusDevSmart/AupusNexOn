import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CamerasService } from '../services/cameras.service';
import { INTERVALO_TRECHO_MS, ehSemGravacao, faseDoTrecho, useTrechoHistorico } from './useTrechoHistorico';

vi.mock('../services/cameras.service', () => ({
  CamerasService: { pedirTrecho: vi.fn(), trecho: vi.fn() },
}));

const pedir = vi.mocked(CamerasService.pedirTrecho);
const consultar = vi.mocked(CamerasService.trecho);
const INICIO = '2026-11-16T13:00:00.000Z';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const base = { comando_id: 'k1', inicio: INICIO, duracao_s: 60 };

describe('faseDoTrecho', () => {
  it('409 do POST = aparelho offline; outro erro = erro', () => {
    expect(faseDoTrecho({ pendente: false, erro: { response: { status: 409, data: { message: 'O aparelho desta câmera está offline' } } } }, undefined).fase).toBe('offline');
    expect(faseDoTrecho({ pendente: false, erro: { response: { status: 429, data: { message: 'Já há 3 trechos' } } } }, undefined)).toMatchObject({
      fase: 'erro',
      mensagem: 'Já há 3 trechos',
    });
  });

  it('estados do GET', () => {
    const p = { pendente: false, erro: null };
    expect(faseDoTrecho(p, { ...base, estado: 'pendente' }).fase).toBe('buscando');
    expect(faseDoTrecho(p, { ...base, estado: 'pronto', url: '/x.mp4?token=t' })).toMatchObject({ fase: 'pronto', url: '/x.mp4?token=t' });
    expect(faseDoTrecho(p, { ...base, estado: 'expirado' }).fase).toBe('expirado');
    expect(faseDoTrecho(p, { ...base, estado: 'erro', erro: 'sem gravação neste horário' }).fase).toBe('sem_gravacao');
    expect(faseDoTrecho(p, { ...base, estado: 'erro', erro: 'disco cheio' })).toMatchObject({ fase: 'erro', mensagem: 'disco cheio' });
  });

  it('reconhece erro de "sem gravação" do aparelho', () => {
    expect(ehSemGravacao('sem_gravacao')).toBe(true);
    expect(ehSemGravacao('Não há gravação nesse horário')).toBe(true);
    expect(ehSemGravacao('ffmpeg falhou')).toBe(false);
  });
});

describe('useTrechoHistorico', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    pedir.mockReset();
    consultar.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('sem início não pede nada', () => {
    const { result } = renderHook(() => useTrechoHistorico('c1', null), { wrapper: wrapper() });
    expect(result.current.fase).toBe('ocioso');
    expect(pedir).not.toHaveBeenCalled();
  });

  it('pede 60 s, consulta a cada 2 s enquanto pendente e para quando fica pronto', async () => {
    pedir.mockResolvedValue({ comando_id: 'k1', estado: 'pendente' });
    consultar
      .mockResolvedValueOnce({ ...base, estado: 'pendente' })
      .mockResolvedValueOnce({ ...base, estado: 'pendente' })
      .mockResolvedValue({ ...base, estado: 'pronto', url: '/api/v1/cameras/trechos/k1/arquivo?token=t' });
    const { result } = renderHook(() => useTrechoHistorico('c1', INICIO), { wrapper: wrapper() });

    expect(result.current.fase).toBe('buscando');
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
    expect(pedir).toHaveBeenCalledWith('c1', { inicio: INICIO, duracao_s: 60 });
    expect(consultar).toHaveBeenCalledWith('k1');

    await act(() => vi.advanceTimersByTimeAsync(INTERVALO_TRECHO_MS));
    await act(() => vi.advanceTimersByTimeAsync(INTERVALO_TRECHO_MS));
    await waitFor(() => expect(result.current.fase).toBe('pronto'));
    expect(result.current.url).toBe('/api/v1/cameras/trechos/k1/arquivo?token=t');
    expect(consultar).toHaveBeenCalledTimes(3);

    await act(() => vi.advanceTimersByTimeAsync(INTERVALO_TRECHO_MS * 3));
    expect(consultar).toHaveBeenCalledTimes(3);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('aparelho offline (409) não consulta', async () => {
    pedir.mockRejectedValue({ response: { status: 409, data: { code: 'CAMERA_SEM_AGENTE', message: 'O aparelho desta câmera está offline' } } });
    const { result } = renderHook(() => useTrechoHistorico('c1', INICIO), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.fase).toBe('offline'));
    expect(consultar).not.toHaveBeenCalled();
  });

  it('expirado → tentar de novo faz um pedido novo', async () => {
    pedir.mockResolvedValueOnce({ comando_id: 'k1', estado: 'pendente' }).mockResolvedValueOnce({ comando_id: 'k2', estado: 'pendente' });
    consultar.mockImplementation(async (id: string) =>
      id === 'k1' ? { ...base, estado: 'expirado' } : { ...base, comando_id: 'k2', estado: 'pronto', url: '/k2.mp4?token=t' },
    );
    const { result } = renderHook(() => useTrechoHistorico('c1', INICIO), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.fase).toBe('expirado'));
    act(() => result.current.tentarDeNovo());
    await waitFor(() => expect(result.current.fase).toBe('pronto'));
    expect(result.current.url).toBe('/k2.mp4?token=t');
    expect(pedir).toHaveBeenCalledTimes(2);
  });
});
