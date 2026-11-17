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
vi.mock('./config/AssistenteRaspberry', () => ({ AssistenteRaspberry: () => <div>assistente aberto</div> }));

function agente(extra: Partial<Agente> = {}): Agente {
  return {
    id: 'a1',
    unidade_id: 'u1',
    nome: 'Raspberry cabine',
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

  it('sem Raspberry: passo 1 de 3, abre o assistente ou vincula um já ligado', async () => {
    const abrir = vi.fn();
    renderWithProviders(
      <TutorialCameras unidadeId="u1" unidadeNome="UFV Aupus II" podeCadastrar podeConfigurar onAbrirConfig={abrir} />,
    );
    expect(screen.getByRole('heading', { name: /Ligue as câmeras de UFV Aupus II/ })).toBeInTheDocument();
    expect(screen.getByText('Passo 1 de 3')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    // Só o passo atual mostra ação.
    expect(screen.queryByRole('button', { name: 'Ver câmeras encontradas' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Já está ligado/ }));
    expect(abrir).toHaveBeenCalledWith('agentes');
    await userEvent.click(screen.getByRole('button', { name: 'Instalar Raspberry' }));
    expect(screen.getByText('assistente aberto')).toBeInTheDocument();
  });

  it('Raspberry online: passo 1 feito e passo 2 abre as câmeras encontradas', async () => {
    const abrir = vi.fn();
    agentesMock.mockReturnValue({ data: [agente({ ultimo_contato_em: new Date().toISOString() })] });
    renderWithProviders(<TutorialCameras unidadeId="u1" podeCadastrar podeConfigurar onAbrirConfig={abrir} />);
    expect(screen.getByText('Passo 2 de 3')).toBeInTheDocument();
    expect(screen.getByText(/Raspberry cabine online/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Instalar Raspberry' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ver câmeras encontradas' }));
    expect(abrir).toHaveBeenCalledWith('cameras');
  });

  it('Raspberry vinculado sem contato: espera ele ligar', () => {
    agentesMock.mockReturnValue({ data: [agente()] });
    renderWithProviders(<TutorialCameras unidadeId="u1" podeCadastrar podeConfigurar onAbrirConfig={vi.fn()} />);
    expect(screen.getByText(/Esperando/)).toBeInTheDocument();
    expect(screen.getByText('Passo 1 de 3')).toBeInTheDocument();
  });

  it('quem não cadastra nem configura vê só a explicação, sem botões', () => {
    renderWithProviders(
      <TutorialCameras unidadeId="u1" podeCadastrar={false} podeConfigurar={false} onAbrirConfig={vi.fn()} />,
    );
    expect(screen.getByText('Nenhuma câmera nesta usina')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('o .env aponta para a API informada, sem barra final', () => {
    const env = textoEnvAgente('https://api.exemplo/api/v1');
    expect(env).toContain('NEXON_API_URL=https://api.exemplo/api/v1\n');
    expect(env).not.toContain('NEXON_ANALISE');
  });
});
