import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompartilhadosNaCascata } from './exclusao-compartilhada';

const get = vi.fn();
vi.mock('@/config/api', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

const { ConfirmarExclusao } = await import('./ConfirmarExclusao');

const cascata = (mudar: Partial<CompartilhadosNaCascata> = {}): CompartilhadosNaCascata => ({
  total: 0,
  plantas: 0,
  unidades: 0,
  equipamentos: 0,
  usuarios: 0,
  nomesDasInstalacoes: [],
  ...mudar,
});

const montar = (onConfirmar = vi.fn()) => {
  render(
    <ConfirmarExclusao
      aberto
      onAbertoChange={vi.fn()}
      recurso="plantas"
      id="P1 "
      nome="UFV Jacuba"
      oQueSai="a planta, as instalações e os equipamentos dela"
      excluindo={false}
      onConfirmar={onConfirmar}
    />,
  );
  return onConfirmar;
};

/**
 * Excluir o que é compartilhado com o NexON (10/11/2026): em 26/10 a tela não
 * dizia nada, e o NexON escondeu usinas com TON ativa.
 */
describe('ConfirmarExclusao', () => {
  // Com chaves: o beforeEach que devolve uma função a roda como limpeza (o mockReset devolve o
  // próprio mock, que era chamado depois de cada teste e rejeitava com "rede")
  beforeEach(() => {
    get.mockReset();
  });

  it('compartilhado: diz o quê, diz que lá vira aviso e pede o nome digitado', async () => {
    get.mockResolvedValue({ data: cascata({ total: 3, plantas: 1, unidades: 2, nomesDasInstalacoes: ['UFV Jacuba I', 'UFV Jacuba II'] }) });
    const onConfirmar = montar();

    expect(await screen.findByText(/1 planta e 2 instalações \(UFV Jacuba I, UFV Jacuba II\)/)).toBeInTheDocument();
    expect(screen.getByText(/lá aparece um aviso para alguém decidir/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/sincronizacao/vinculos/plantas/P1/cascata');
    const excluir = screen.getByRole('button', { name: 'Excluir' });
    expect(excluir).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/digite o nome/), { target: { value: 'ufv  jacuba ' } });
    expect(excluir).toBeEnabled();
    fireEvent.click(excluir);
    expect(onConfirmar).toHaveBeenCalledWith(true);
  });

  it('não compartilhado: exclui sem pedir o nome, e o texto não diz "permanentemente"', async () => {
    get.mockResolvedValue({ data: cascata() });
    const onConfirmar = montar();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled());
    expect(screen.queryByLabelText(/digite o nome/)).toBeNull();
    expect(screen.getByText(/Os dados ficam guardados/)).toBeInTheDocument();
    expect(screen.queryByText(/permanentemente/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirmar).toHaveBeenCalledWith(false);
  });

  it('sem a conferência, avisa e deixa a API decidir (sem a confirmação, ela recusa o compartilhado)', async () => {
    get.mockImplementation(() => Promise.reject(new Error('rede')));
    const onConfirmar = montar();

    expect(await screen.findByText(/Não foi possível conferir o compartilhamento/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/digite o nome/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirmar).toHaveBeenCalledWith(false);
  });
});
