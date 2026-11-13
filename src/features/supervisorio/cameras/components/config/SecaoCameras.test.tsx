import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, sonnerMockFactory } from '@/test-utils';
import { CamerasService } from '../../services/cameras.service';
import type { Agente, Camera, CameraDescoberta } from '../../types';
import { nivelSensibilidade } from '../../utils/sensibilidade';
import { FormCamera } from './FormCamera';
import { SecaoCameras } from './SecaoCameras';

vi.mock('sonner', () => sonnerMockFactory());

vi.mock('../../services/cameras.service', () => ({
  CamerasService: {
    criar: vi.fn(),
    editar: vi.fn(),
    excluir: vi.fn(),
    descobertas: vi.fn(),
  },
}));

const AGENTE: Agente = {
  id: 'a1',
  unidade_id: 'u1',
  nome: 'Pi da cabine',
  versao: null,
  host: 'nexon-pi',
  ultimo_contato_em: new Date().toISOString(),
  cameras: 0,
  created_at: '2026-11-13T10:00:00Z',
  updated_at: '2026-11-13T10:00:00Z',
};

const DESCOBERTA: CameraDescoberta = {
  ip: '192.168.1.8',
  mac: null,
  fabricante: 'intelbras',
  modelo: 'VIPC-1230-B-G2',
  serial: null,
  porta_http: 80,
  porta_rtsp: 554,
  inicializada: true,
  visto_em: '2026-11-13T10:00:00Z',
};

vi.mock('../../hooks/useCamerasUnidade', () => ({ useCamerasUnidade: () => ({ data: [], isPending: false }) }));
vi.mock('../../hooks/useEquipamentosPontos', () => ({ useEquipamentosUnidade: () => ({ data: [] }) }));
vi.mock('../../hooks/useConfigCameras', async (original) => ({
  ...(await original<typeof import('../../hooks/useConfigCameras')>()),
  useAgentesCameras: () => ({ data: [AGENTE] }),
}));

function camera(analise: Partial<Camera['analise']> = {}): Camera {
  return {
    id: 'c1',
    unidade_id: 'u1',
    planta_id: 'p',
    agente_id: 'a1',
    equipamento_id: null,
    nome: 'Portão',
    fabricante: 'intelbras',
    modelo: null,
    ip: '192.168.1.9',
    porta_rtsp: 554,
    porta_http: 80,
    usuario: 'admin',
    canal: 1,
    ativa: true,
    ordem: 1,
    status: 'online',
    status_em: null,
    ultimo_contato_em: null,
    miniatura_url: null,
    miniatura_em: null,
    nao_lidos: 0,
    ultimo_alerta_em: null,
    stream: { continuo: false, transcodificar: false, publicando: false, caminho: 'cam-c1' },
    analise: { ativa: true, sensibilidade: 50, area_minima_pct: 0.5, fps_analise: 4, classificar: true, classes_alerta: ['pessoa'], clipe_s: 12, zonas: [], ...analise },
    created_at: '2026-11-13T10:00:00Z',
    updated_at: '2026-11-13T10:00:00Z',
  };
}

describe('Câmeras encontradas', () => {
  beforeEach(() => {
    vi.mocked(CamerasService.descobertas).mockReset().mockResolvedValue([DESCOBERTA]);
    vi.mocked(CamerasService.criar).mockReset().mockResolvedValue(camera());
  });

  it('mostra a câmera achada pelo aparelho e cadastra pedindo só nome, usuário e senha', async () => {
    renderWithProviders(<SecaoCameras unidadeId="u1" />);
    const secao = await screen.findByRole('region', { name: 'Câmeras encontradas' });
    expect(within(secao).getByText('Intelbras VIPC-1230-B-G2 · 192.168.1.8')).toBeInTheDocument();
    expect(CamerasService.descobertas).toHaveBeenCalledWith('a1');

    await userEvent.click(within(secao).getByRole('button', { name: /Adicionar/ }));

    // IP e portas já vêm da descoberta e ficam escondidos em "Avançado".
    expect(screen.queryByLabelText('IP da câmera')).toBeNull();
    expect(screen.getByLabelText('Usuário')).toHaveValue('admin');
    await userEvent.type(screen.getByLabelText('Nome'), 'Cabine');
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo1');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar câmera' }));

    await waitFor(() => expect(CamerasService.criar).toHaveBeenCalled());
    const payload = vi.mocked(CamerasService.criar).mock.calls[0][0];
    expect(payload).toMatchObject({
      unidade_id: 'u1',
      nome: 'Cabine',
      ip: '192.168.1.8',
      usuario: 'admin',
      senha: 'segredo1',
      porta_rtsp: 554,
      porta_http: 80,
      fabricante: 'intelbras',
      modelo: 'VIPC-1230-B-G2',
      agente_id: 'a1',
    });
  });

  it('câmera de fábrica pede para criar a senha antes', async () => {
    vi.mocked(CamerasService.descobertas).mockResolvedValue([{ ...DESCOBERTA, inicializada: false }]);
    renderWithProviders(<SecaoCameras unidadeId="u1" />);
    expect(await screen.findByText(/Crie a senha da câmera em/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'http://192.168.1.8' })).toHaveAttribute('href', 'http://192.168.1.8');
  });
});

describe('FormCamera — só movimento', () => {
  beforeEach(() => {
    vi.mocked(CamerasService.editar).mockReset().mockResolvedValue(camera());
  });

  it('não mostra classes de alerta e manda a sensibilidade do seletor, sem classes_alerta', async () => {
    renderWithProviders(
      <FormCamera unidadeId="u1" camera={camera({ sensibilidade: 50 })} agentes={[AGENTE]} equipamentos={[]} proximaOrdem={2} onSalvo={vi.fn()} onCancelar={vi.fn()} />,
    );
    expect(screen.queryByRole('group', { name: 'Classes que geram alerta' })).toBeNull();
    expect(screen.queryByText(/Pessoas|Veículos|Animais/)).toBeNull();

    // 50 gravado → Média (55), o nível mais próximo.
    const grupo = screen.getByRole('radiogroup', { name: 'Sensibilidade' });
    expect(within(grupo).getByRole('radio', { name: 'Média' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(grupo).getByRole('radio', { name: 'Alta' }));
    expect(within(grupo).getByRole('radio', { name: 'Alta' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(CamerasService.editar).toHaveBeenCalled());
    const [, payload] = vi.mocked(CamerasService.editar).mock.calls[0];
    expect(payload.analise).toEqual({ ativa: true, sensibilidade: 80, clipe_s: 12 });
    expect(payload.analise).not.toHaveProperty('classes_alerta');
  });

  it('clipe e vídeo contínuo ficam em Avançado', async () => {
    renderWithProviders(
      <FormCamera unidadeId="u1" camera={camera()} agentes={[AGENTE]} equipamentos={[]} proximaOrdem={2} onSalvo={vi.fn()} onCancelar={vi.fn()} />,
    );
    expect(screen.getByRole('switch', { name: 'Detecção de movimento ativa' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Clipe (segundos)')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Avançado' }));
    expect(screen.getByLabelText('Clipe (segundos)')).toHaveValue('12');
    expect(screen.getByRole('switch', { name: 'Vídeo contínuo' })).toBeInTheDocument();
  });

  it('valores antigos caem no nível mais próximo', () => {
    expect(nivelSensibilidade(0)).toBe(30);
    expect(nivelSensibilidade(42)).toBe(30);
    expect(nivelSensibilidade(43)).toBe(55);
    expect(nivelSensibilidade(67)).toBe(55);
    expect(nivelSensibilidade(68)).toBe(80);
    expect(nivelSensibilidade(100)).toBe(80);
    expect(nivelSensibilidade(undefined)).toBe(55);
  });
});
