import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test-utils';
import { CamerasService } from '../services/cameras.service';
import { InstalacoesPc } from './InstalacoesPc';

vi.mock('../services/cameras.service', () => ({
  CamerasService: { instalacoesPc: vi.fn(), registroInstalacao: vi.fn() },
}));

const agora = new Date().toISOString();
const antigo = new Date(Date.now() - 2 * 3_600_000).toISOString();

describe('InstalacoesPc', () => {
  it('mostra erro com a mensagem, andamento parado e abre o registro', async () => {
    const user = userEvent.setup();
    vi.mocked(CamerasService.instalacoesPc).mockResolvedValue([
      { id: 'i1', sessao: 's1', usuario_nome: 'Lucas', unidade_id: 'u1', unidade_nome: 'UFV Aupus II', sistema: 'Ubuntu 24.04 x86_64', passo: '2/5 Programa da Raspberry', estado: 'erro', mensagem: 'mass-storage-gadget64 não encontrado', versao: '2026.11.18', created_at: agora, updated_at: agora },
      { id: 'i2', sessao: 's2', usuario_nome: 'Ana', unidade_id: null, unidade_nome: null, sistema: 'macOS', passo: '3/5 Ligar', estado: 'andamento', mensagem: null, versao: null, created_at: antigo, updated_at: antigo },
    ]);
    vi.mocked(CamerasService.registroInstalacao).mockResolvedValue('==== PASSO 2 de 5 ====\nDEU ERRO');
    renderWithProviders(<InstalacoesPc />);
    expect(await screen.findByText('mass-storage-gadget64 não encontrado')).toBeInTheDocument();
    expect(screen.getByText('Deu erro')).toBeInTheDocument();
    expect(screen.getByText('Parou sem avisar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ver registro/ }));
    expect(await screen.findByText(/DEU ERRO/)).toBeInTheDocument();
    expect(CamerasService.registroInstalacao).toHaveBeenCalledWith('i1');
  });
});
