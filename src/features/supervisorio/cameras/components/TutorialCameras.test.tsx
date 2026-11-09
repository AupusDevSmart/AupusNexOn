import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, sonnerMockFactory } from '@/test-utils';
import type { Agente } from '../types';
import { COMANDOS_AGENTE, textoEnvAgente } from '../utils/agentes';
import { TutorialCameras } from './TutorialCameras';

vi.mock('sonner', () => sonnerMockFactory());

const agentesMock = vi.fn(() => ({ data: [] as Agente[] }));
vi.mock('../hooks/useConfigCameras', () => ({ useAgentesCameras: () => agentesMock() }));

function agente(extra: Partial<Agente> = {}): Agente {
  return {
    id: 'a1',
    unidade_id: 'u1',
    nome: 'Mini-PC cabine',
    versao: null,
    host: null,
    ultimo_contato_em: null,
    cameras: 0,
    created_at: '2026-11-09T10:00:00Z',
    updated_at: '2026-11-09T10:00:00Z',
    ...extra,
  };
}

describe('TutorialCameras', () => {
  beforeEach(() => {
    agentesMock.mockReturnValue({ data: [] });
  });

  it('mostra os cinco passos, o .env e os atalhos de cadastro para quem cadastra', async () => {
    const abrir = vi.fn();
    renderWithProviders(
      <TutorialCameras unidadeId="u1" unidadeNome="UFV Aupus II" podeCadastrar podeConfigurar onAbrirConfig={abrir} />,
    );
    expect(screen.getByRole('heading', { name: /Ligue as câmeras de UFV Aupus II/ })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText(/NEXON_AGENTE_TOKEN=cole-aqui-o-token-do-agente/)).toBeInTheDocument();
    expect(screen.getByText(/docker compose up -d --build/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Criar agente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar câmera' }));
    await userEvent.click(screen.getByRole('button', { name: 'Configurar unidade' }));
    expect(abrir.mock.calls.map((c) => c[0])).toEqual(['agentes', 'cameras', 'unidade']);
  });

  it('marca o agente criado e conectado conforme o estado real', () => {
    agentesMock.mockReturnValue({ data: [agente({ ultimo_contato_em: new Date().toISOString() })] });
    renderWithProviders(<TutorialCameras unidadeId="u1" podeCadastrar podeConfigurar onAbrirConfig={vi.fn()} />);
    expect(screen.getByText(/1 agente criado: Mini-PC cabine/)).toBeInTheDocument();
    expect(screen.getByText(/Agente conectado: Mini-PC cabine/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar agente' })).toBeNull();
  });

  it('agente criado sem contato pede para aguardar', () => {
    agentesMock.mockReturnValue({ data: [agente()] });
    renderWithProviders(<TutorialCameras unidadeId="u1" podeCadastrar podeConfigurar onAbrirConfig={vi.fn()} />);
    expect(screen.getByText(/Aguardando o agente se conectar/)).toBeInTheDocument();
  });

  it('quem não cadastra nem configura vê só a explicação, sem botões', () => {
    renderWithProviders(
      <TutorialCameras unidadeId="u1" podeCadastrar={false} podeConfigurar={false} onAbrirConfig={vi.fn()} />,
    );
    expect(screen.getByText('Nenhuma câmera nesta usina')).toBeInTheDocument();
    expect(screen.getByText(/feita pela equipe da Aupus/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('copia o .env para a área de transferência', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithProviders(<TutorialCameras unidadeId="u1" podeCadastrar podeConfigurar onAbrirConfig={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copiar arquivo .env' }));
    expect(writeText).toHaveBeenCalledWith(textoEnvAgente());
    await userEvent.click(screen.getByRole('button', { name: 'Copiar comandos' }));
    expect(writeText).toHaveBeenLastCalledWith(COMANDOS_AGENTE);
  });

  it('o .env aponta para a API informada, sem barra final', () => {
    expect(textoEnvAgente('https://api.exemplo/api/v1')).toContain('NEXON_API_URL=https://api.exemplo/api/v1\n');
  });
});
