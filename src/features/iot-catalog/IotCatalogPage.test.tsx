import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, sonnerMockFactory } from '@/test-utils';
import type { IotDeviceModelo, IotDeviceTipo } from '@/services/iot-catalog.services';

// Mock dos hooks pra evitar QueryClientProvider e network real.
// Cada hook retorna shape minimo que o componente consome.
const mkTipo = (id: string, codigo: string, nome: string): IotDeviceTipo => ({
  id,
  codigo,
  nome,
  pontos: { ai: [], bi: [], bo: [] },
  created_at: '2026-05-22T10:00:00Z',
  updated_at: '2026-05-22T10:00:00Z',
});

const mkModelo = (
  id: string,
  tipo_id: string,
  fabricante: string,
  modelo: string,
): IotDeviceModelo => ({
  id,
  tipo_id,
  fabricante,
  modelo,
  protocolo: 'rtu',
  connection_note: null,
  mapeamento: { catalog_id: `${fabricante}-${modelo}`.toLowerCase() },
  created_at: '2026-05-22T10:00:00Z',
  updated_at: '2026-05-22T10:00:00Z',
});

const TIPOS: IotDeviceTipo[] = [
  mkTipo('t1', 'inversor_solar', 'Inversor Solar'),
  mkTipo('t2', 'medidor_energia', 'Medidor de Energia'),
];

// 20 modelos: 15 inversores (Sungrow + GoodWe + Huawei) + 5 medidores (CHINT).
// Garante mais de 1 pagina (PAGE_SIZE=15) e mistura de tipos pra filtrar.
const MODELOS: IotDeviceModelo[] = [
  ...Array.from({ length: 12 }, (_, i) =>
    mkModelo(`m-sg-${i}`, 't1', 'Sungrow', `SG${i + 1}CX`),
  ),
  mkModelo('m-gw', 't1', 'GoodWe', 'GW-MT'),
  mkModelo('m-hw', 't1', 'Huawei', 'SUN2000'),
  mkModelo('m-weg', 't1', 'WEG', 'SIW400'),
  ...Array.from({ length: 5 }, (_, i) =>
    mkModelo(`m-md-${i}`, 't2', 'CHINT', `PD${600 + i}`),
  ),
];

// Mock dos hooks ANTES de importar o componente.
vi.mock('@/hooks/useIotCatalog', () => ({
  useIotDeviceTipos: () => ({ data: TIPOS, isLoading: false }),
  useIotDeviceModelos: () => ({ data: MODELOS, isLoading: false }),
  useRemoveIotDeviceTipo: () => ({ mutateAsync: vi.fn() }),
  useRemoveIotDeviceModelo: () => ({ mutateAsync: vi.fn() }),
  useDuplicateIotDeviceModelo: () => ({ mutateAsync: vi.fn() }),
}));

// Modais como stubs — nao testamos eles aqui, so a pagina.
vi.mock('./TipoFormModal', () => ({
  TipoFormModal: () => <div data-testid="tipo-modal" />,
}));
vi.mock('./ModeloFormModal', () => ({
  ModeloFormModal: () => <div data-testid="modelo-modal" />,
}));

// sonner toast: factory do test-utils.
vi.mock('sonner', () => sonnerMockFactory());

// Importa o componente DEPOIS dos mocks (vi.mock eh hoisted, entao OK qualquer ordem).
import { IotCatalogPage } from './IotCatalogPage';

describe('IotCatalogPage', () => {
  it('1. filtro de texto reduz a tabela a modelos que casam com a busca', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IotCatalogPage />);

    // Por default abre na aba "Modelos" — todos os 20 visiveis (com paginacao).
    // Primeira pagina tem 15 itens. Sungrow tem 12, todos cabem na pagina 1.
    const sungrowAntes = screen.getAllByText(/Sungrow/).length;
    expect(sungrowAntes).toBeGreaterThan(0);

    const search = screen.getByPlaceholderText(/Buscar por fabricante ou modelo/i);
    await user.type(search, 'goodwe');

    // Apos filtro: so 1 modelo (GoodWe GW-MT).
    expect(screen.getByText('GoodWe')).toBeInTheDocument();
    // Confirma que outros fabricantes nao aparecem mais.
    expect(screen.queryByText('Sungrow')).not.toBeInTheDocument();
    expect(screen.queryByText('CHINT')).not.toBeInTheDocument();
  });

  it('2. filtro por tipo (dropdown) limita aos modelos do tipo escolhido', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IotCatalogPage />);

    // Antes: ha modelos de Inversor Solar (Sungrow, GoodWe, etc.) e Medidor (CHINT).
    // Aplicar filtro "Medidor de Energia" deve mostrar SO CHINT na tabela.
    const tipoSelect = screen.getByRole('combobox');
    await user.click(tipoSelect);

    // Opcao "Medidor de Energia" no dropdown.
    const option = await screen.findByRole('option', { name: /Medidor de Energia/i });
    await user.click(option);

    // Apos filtro: CHINT visivel, Sungrow/GoodWe/Huawei/WEG nao.
    expect(screen.getAllByText('CHINT').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sungrow')).not.toBeInTheDocument();
    expect(screen.queryByText('GoodWe')).not.toBeInTheDocument();
  });

  it('3. paginacao: pagina 1 mostra 15 itens, navegar pra pagina 2 mostra os restantes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IotCatalogPage />);

    // PAGE_SIZE = 15. Pagina 1 deve mostrar contador "Mostrando 1 a 15 de 20".
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(/de 20 resultados/);
    expect(screen.getByText(/Mostrando/).textContent).toContain('1');
    expect(screen.getByText(/Mostrando/).textContent).toContain('15');

    // Sungrow tem 12 modelos — todos devem caber na pagina 1.
    const sungrowAntes = screen.getAllByText('Sungrow').length;
    expect(sungrowAntes).toBe(12);

    // Botao "proxima pagina" — segundo chevron (chevron-right).
    // Localiza pelo title attribute do botao (usando text proximo).
    const nextBtn = screen.getAllByRole('button').find(
      (b) => b.querySelector('svg.lucide-chevron-right'),
    );
    expect(nextBtn).toBeDefined();
    await user.click(nextBtn!);

    // Pagina 2: 5 itens restantes (16-20). Sungrow nao deveria aparecer mais
    // (todos 12 ficaram na pagina 1).
    expect(screen.getByText(/Mostrando/)).toHaveTextContent(/de 20 resultados/);
    expect(screen.queryByText('Sungrow')).not.toBeInTheDocument();
    // CHINT tem 5 itens — todos devem aparecer.
    expect(screen.getAllByText('CHINT').length).toBe(5);
  });
});
