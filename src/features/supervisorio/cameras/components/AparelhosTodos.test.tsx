import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, sonnerMockFactory } from '@/test-utils';
import { CamerasService } from '../services/cameras.service';
import type { AgenteGlobal } from '../types';
import { AparelhosTodos } from './AparelhosTodos';

vi.mock('sonner', () => sonnerMockFactory());
vi.mock('../services/cameras.service', () => ({
  CamerasService: { todosAgentes: vi.fn(), atualizacaoDisponivel: vi.fn(), comandoAparelho: vi.fn(), estadoComandoAparelho: vi.fn() },
}));

const agora = new Date().toISOString();
function ap(extra: Partial<AgenteGlobal>): AgenteGlobal {
  return {
    id: 'a1', unidade_id: 'u1', nome: 'Raspberry', versao: '0.4.4', host: 'nexon-cam', ultimo_contato_em: agora, cameras: 2,
    created_at: agora, updated_at: agora, unidade_nome: 'UFV Aupus II', planta_nome: 'Planta A', ...extra,
  };
}

describe('AparelhosTodos', () => {
  beforeEach(() => {
    vi.mocked(CamerasService.atualizacaoDisponivel).mockResolvedValue({ versao: '0.4.5' });
    vi.mocked(CamerasService.comandoAparelho).mockReset().mockResolvedValue({ id: 'c1' });
    vi.mocked(CamerasService.todosAgentes).mockResolvedValue([
      ap({ id: 'a1' }),
      ap({ id: 'a2', unidade_nome: 'UFV Sul', versao: '0.4.5' }),
      ap({ id: 'a3', unidade_nome: 'UFV Norte', ultimo_contato_em: null }),
    ]);
  });

  it('lista todas as usinas, conta e atualiza só os desatualizados online', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AparelhosTodos />);
    expect(await screen.findByText(/UFV Sul/)).toBeInTheDocument();
    expect(screen.getByText(/UFV Norte/)).toBeInTheDocument();
    expect(screen.getByText('Nunca se conectou')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Desatualizados/ }));
    expect(screen.queryByText(/UFV Sul/)).toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Atualizar todos (1)' }));
    await user.click(screen.getByRole('button', { name: 'Atualizar todos' }));
    await waitFor(() => expect(CamerasService.comandoAparelho).toHaveBeenCalledTimes(1));
    expect(CamerasService.comandoAparelho).toHaveBeenCalledWith('a1', 'atualizar');
  });

  it('busca por usina', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AparelhosTodos />);
    await screen.findByText(/UFV Sul/);
    await user.type(screen.getByLabelText('Buscar aparelho'), 'norte');
    expect(screen.queryByText(/UFV Sul/)).toBeNull();
    expect(screen.getByText(/UFV Norte/)).toBeInTheDocument();
  });
});
