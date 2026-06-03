import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { IotDeviceTipo } from '@/services/iot-catalog.services';

// Mocks dos hooks de mutation (nao precisam acionar nada real)
vi.mock('@/hooks/useIotCatalog', () => ({
  useCreateIotDeviceModelo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIotDeviceModelo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { ModeloFormModal } from './ModeloFormModal';

const TIPOS: IotDeviceTipo[] = [
  {
    id: 't1',
    codigo: 'inversor_solar',
    nome: 'Inversor Solar',
    pontos: { ai: [], bi: [], bo: [] },
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
  },
];

describe('ModeloFormModal', () => {
  it('1. JSON invalido na aba JSON desabilita o botao "Salvar"', async () => {
    const user = userEvent.setup();
    render(<ModeloFormModal modelo={null} tipos={TIPOS} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Fabricante/i), 'Fronius');
    await user.type(screen.getByLabelText(/^Modelo/i), 'Symo');

    // Abre a aba JSON pra acessar o textarea de mapeamento.
    await user.click(screen.getByRole('tab', { name: /JSON/i }));

    const textarea = screen.getByLabelText(/Mapeamento Modbus/i);
    await user.clear(textarea);
    // `{{` em userEvent.type vira `{` literal -> "{ assim:" -> JSON invalido.
    await user.type(textarea, '{{ assim:');

    const saveBtn = screen.getByRole('button', { name: /Salvar/i });
    expect(saveBtn).toBeDisabled();
  });

  it('2. abre na aba Estruturado pedindo selecao de tipo', () => {
    render(<ModeloFormModal modelo={null} tipos={TIPOS} onClose={vi.fn()} />);
    expect(screen.getByText(/Selecione um tipo para carregar os pontos/i)).toBeInTheDocument();
  });
});
