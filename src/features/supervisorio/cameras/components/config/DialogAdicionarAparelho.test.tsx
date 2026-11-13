import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test-utils';
import { CamerasService } from '../../services/cameras.service';
import type { Agente, PedidoPareamento } from '../../types';
import { DialogAdicionarAparelho } from './DialogAdicionarAparelho';

// Fábrica assíncrona: o `toast` importado acima precisa existir antes do mock.
vi.mock('sonner', async () => (await import('@/test-utils')).sonnerMockFactory());

vi.mock('../../services/cameras.service', () => ({
  CamerasService: {
    pareamentosProximos: vi.fn(),
    vincularPareamento: vi.fn(),
  },
}));

const AGENTE: Agente = {
  id: 'a1',
  unidade_id: 'u1',
  nome: 'nexon-pi',
  versao: null,
  host: 'nexon-pi',
  ultimo_contato_em: null,
  cameras: 0,
  created_at: '2026-11-13T10:00:00Z',
  updated_at: '2026-11-13T10:00:00Z',
};

const PEDIDO: PedidoPareamento = {
  codigo: '482913',
  host: 'nexon-pi',
  mac: null,
  ip_local: '192.168.1.20',
  criado_em: '2026-11-13T10:00:00Z',
  expira_em: '2026-11-13T10:30:00Z',
};

describe('DialogAdicionarAparelho', () => {
  beforeEach(() => {
    vi.mocked(CamerasService.pareamentosProximos).mockReset().mockResolvedValue([]);
    vi.mocked(CamerasService.vincularPareamento).mockReset().mockResolvedValue({ agente: AGENTE });
  });

  it('vincula pelo código de 6 dígitos na unidade atual', async () => {
    const fechar = vi.fn();
    renderWithProviders(<DialogAdicionarAparelho unidadeId="u1" aberto onFechar={fechar} />);
    const botao = screen.getByRole('button', { name: 'Vincular pelo código' });
    expect(botao).toBeDisabled();

    // Só dígitos, no máximo 6.
    await userEvent.type(screen.getByLabelText('Ou digite o código de 6 dígitos'), '48-29a137');
    expect(screen.getByLabelText('Ou digite o código de 6 dígitos')).toHaveValue('482913');
    await userEvent.click(botao);

    await waitFor(() =>
      expect(CamerasService.vincularPareamento).toHaveBeenCalledWith({ codigo: '482913', unidade_id: 'u1' }),
    );
    await waitFor(() => expect(fechar).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Aparelho nexon-pi vinculado', expect.anything());
  });

  it('lista o aparelho encontrado nesta rede e vincula com um toque', async () => {
    vi.mocked(CamerasService.pareamentosProximos).mockResolvedValue([PEDIDO]);
    renderWithProviders(<DialogAdicionarAparelho unidadeId="u1" aberto onFechar={vi.fn()} />);
    expect(await screen.findByText('Aparelho encontrado nesta rede: nexon-pi')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nome (opcional)'), 'Pi da cabine');
    await userEvent.click(screen.getByRole('button', { name: 'Vincular nexon-pi' }));
    await waitFor(() =>
      expect(CamerasService.vincularPareamento).toHaveBeenCalledWith({ codigo: '482913', unidade_id: 'u1', nome: 'Pi da cabine' }),
    );
  });

  it('código errado ou expirado mostra o erro da API', async () => {
    vi.mocked(CamerasService.vincularPareamento).mockRejectedValue({
      response: { data: { message: 'Código não encontrado ou expirado' } },
    });
    const fechar = vi.fn();
    renderWithProviders(<DialogAdicionarAparelho unidadeId="u1" aberto onFechar={fechar} />);
    await userEvent.type(screen.getByLabelText('Ou digite o código de 6 dígitos'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Vincular pelo código' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Código não encontrado ou expirado'));
    expect(fechar).not.toHaveBeenCalled();
  });
});
