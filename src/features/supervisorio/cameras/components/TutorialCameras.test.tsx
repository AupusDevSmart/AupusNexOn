import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, sonnerMockFactory } from '@/test-utils';
import type { Agente } from '../types';
import { textoEnvAgente } from '../utils/agentes';
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

  it('mostra os cinco passos do fluxo simples e os atalhos para quem cadastra', async () => {
    const abrir = vi.fn();
    renderWithProviders(
      <TutorialCameras unidadeId="u1" unidadeNome="UFV Aupus II" podeCadastrar podeConfigurar onAbrirConfig={abrir} />,
    );
    expect(screen.getByRole('heading', { name: /Ligue as câmeras de UFV Aupus II/ })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('Ligue a câmera e o aparelho no switch PoE')).toBeInTheDocument();
    expect(screen.getByText('Grave o cartão do aparelho e ligue na tomada')).toBeInTheDocument();
    expect(screen.getByText('Arme por horário')).toBeInTheDocument();
    // Sem token, .env nem análise por IA na tela.
    expect(screen.queryByText(/NEXON_AGENTE_TOKEN|NEXON_ANALISE|docker compose/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar aparelho' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver câmeras encontradas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Configurar armamento' }));
    expect(abrir.mock.calls.map((c) => c[0])).toEqual(['agentes', 'cameras', 'unidade']);
  });

  it('marca o aparelho online conforme o estado real', () => {
    agentesMock.mockReturnValue({ data: [agente({ ultimo_contato_em: new Date().toISOString() })] });
    renderWithProviders(<TutorialCameras unidadeId="u1" podeCadastrar podeConfigurar onAbrirConfig={vi.fn()} />);
    expect(screen.getByText(/Aparelho online: Mini-PC cabine/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar aparelho' })).toBeNull();
  });

  it('aparelho vinculado sem contato pede para aguardar', () => {
    agentesMock.mockReturnValue({ data: [agente()] });
    renderWithProviders(<TutorialCameras unidadeId="u1" podeCadastrar podeConfigurar onAbrirConfig={vi.fn()} />);
    expect(screen.getByText(/Aparelho vinculado, aguardando ficar online/)).toBeInTheDocument();
  });

  it('quem não cadastra nem configura vê só a explicação, sem botões', () => {
    renderWithProviders(
      <TutorialCameras unidadeId="u1" podeCadastrar={false} podeConfigurar={false} onAbrirConfig={vi.fn()} />,
    );
    expect(screen.getByText('Nenhuma câmera nesta usina')).toBeInTheDocument();
    expect(screen.getByText(/feita pela equipe da Aupus/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('o .env aponta para a API informada, sem barra final', () => {
    const env = textoEnvAgente('https://api.exemplo/api/v1');
    expect(env).toContain('NEXON_API_URL=https://api.exemplo/api/v1\n');
    expect(env).not.toContain('NEXON_ANALISE');
  });
});
