import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithProviders, sonnerMockFactory } from '@/test-utils';
import { CamerasService } from '../services/cameras.service';
import type { Camera, CameraEvento, ResumoCameras } from '../types';
import { chaveHoje, deslocarDia, rotuloDia } from '../utils/agrupar-por-dia';
import { CamerasTab } from './CamerasTab';

vi.mock('sonner', () => sonnerMockFactory());

// Capacidades mutáveis por teste; o store real tem `persist` e pede localStorage.
const capacidades = { comandar: true, cadastroTecnico: true, configOperacional: true };
vi.mock('@/store/useUserStore', () => ({
  useUserStore: (seletor: (s: { capacidades: typeof capacidades; user: { id: string } }) => unknown) =>
    seletor({ capacidades, user: { id: 'u1' } }),
}));

vi.mock('../services/cameras.service', () => ({
  CamerasService: {
    marcarLido: vi.fn(() => Promise.resolve()),
    marcarTodosLidos: vi.fn(() => Promise.resolve()),
    armar: vi.fn(),
    acionar: vi.fn(),
    foto: vi.fn(),
  },
}));

const camerasMock = vi.fn();
const resumoMock = vi.fn();
const eventosMock = vi.fn();
vi.mock('../hooks/useCamerasUnidade', () => ({ useCamerasUnidade: () => camerasMock() }));
vi.mock('../hooks/useResumoCameras', () => ({ useResumoCameras: () => resumoMock() }));
vi.mock('../hooks/useEventosCameras', () => ({ useEventosCameras: () => eventosMock() }));
vi.mock('../hooks/useTokenMidia', () => ({
  useTokenMidia: () => ({ token: 'tok', carregando: false, erro: false, url: (c: string | null) => c, renovar: vi.fn() }),
}));
// Player e sheet têm cadeias próprias de hooks; aqui só interessa a aba.
vi.mock('./PlayerHls', () => ({ PlayerHls: () => <div data-testid="player">player</div> }));
vi.mock('./ConfigCamerasSheet', () => ({ ConfigCamerasSheet: () => null }));
vi.mock('../hooks/useConfigCameras', () => ({
  useAgentesCameras: () => ({ data: [] }),
  useConfigCameras: () => ({ data: undefined }),
}));

const hoje = chaveHoje();
const ontem = deslocarDia(hoje, -1);
const isoHoje = (h: string) => new Date(`${hoje}T${h}:00-03:00`).toISOString();
const isoOntem = (h: string) => new Date(`${ontem}T${h}:00-03:00`).toISOString();

function camera(parcial: Partial<Camera> & Pick<Camera, 'id' | 'nome'>): Camera {
  return {
    unidade_id: 'u',
    planta_id: 'p',
    agente_id: 'a1',
    equipamento_id: null,
    fabricante: 'intelbras',
    modelo: null,
    ip: '192.168.0.10',
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
    stream: { continuo: false, transcodificar: false, publicando: false, caminho: `cam-${parcial.id}` },
    analise: { ativa: true, sensibilidade: 50, area_minima_pct: 0.5, fps_analise: 4, classificar: true, classes_alerta: ['pessoa', 'veiculo'], clipe_s: 12, zonas: [] },
    created_at: isoHoje('00:00'),
    updated_at: isoHoje('00:00'),
    ...parcial,
  };
}

function evento(parcial: Partial<CameraEvento> & Pick<CameraEvento, 'id' | 'camera_id' | 'camera_nome' | 'tipo' | 'inicio_em'>): CameraEvento {
  return {
    unidade_id: 'u',
    titulo: '',
    fim_em: null,
    confianca: 0.9,
    armado: true,
    alerta: true,
    descartado: false,
    motivo_descarte: null,
    snapshot_url: '/api/v1/cameras/eventos/x/snapshot',
    clipe_url: null,
    lido_em: null,
    lido_por_nome: null,
    chamado_id: null,
    chamado_numero: null,
    dados: null,
    created_at: parcial.inicio_em,
    ...parcial,
  };
}

const CAMERAS: Camera[] = [
  camera({ id: 'cab', nome: 'Cabine / SSU', nao_lidos: 2, ordem: 1 }),
  camera({ id: 'por', nome: 'Portão', ordem: 2 }),
  camera({ id: 'iv3', nome: 'Arranjo IV3', status: 'offline', status_em: isoHoje('05:30'), ordem: 3 }),
];

const EVENTOS: CameraEvento[] = [
  evento({ id: 'e1', camera_id: 'cab', camera_nome: 'Cabine / SSU', tipo: 'pessoa', inicio_em: isoHoje('05:12'), chamado_numero: 412 }),
  evento({ id: 'e2', camera_id: 'cab', camera_nome: 'Cabine / SSU', tipo: 'pessoa', inicio_em: isoHoje('05:11') }),
  evento({ id: 'e5', camera_id: 'por', camera_nome: 'Portão', tipo: 'veiculo', inicio_em: isoOntem('19:46'), lido_em: isoOntem('20:00') }),
];

const RESUMO: ResumoCameras = {
  total: 6,
  online: 5,
  offline: 1,
  armado: true,
  armado_ate: isoHoje('06:30'),
  armamento_modo: 'agenda',
  nao_lidos: 3,
  ultimo_alerta: EVENTOS[0],
  noite: { inicio: null, alertas: 1, descartados: 14 },
  sem_sinal: [{ camera_id: 'iv3', camera_nome: 'Arranjo IV3', desde: isoHoje('05:30') }],
  comandos: { refletor: true, sirene: false },
};

const RESUMO_VAZIO: ResumoCameras = { ...RESUMO, total: 0, online: 0, offline: 0, armado: false, armado_ate: null, nao_lidos: 0, ultimo_alerta: null, noite: null, sem_sinal: [], comandos: { refletor: false, sirene: false } };

function pronto<T>(data: T) {
  return { data, isPending: false, isError: false, error: null, refetch: vi.fn() };
}

function render() {
  return renderWithProviders(
    <TooltipProvider>
      <CamerasTab unidadeId="u" unidadeNome="UFV Aupus II" />
    </TooltipProvider>,
  );
}

describe('CamerasTab', () => {
  beforeEach(() => {
    capacidades.comandar = true;
    capacidades.cadastroTecnico = true;
    capacidades.configOperacional = true;
    camerasMock.mockReturnValue(pronto(CAMERAS));
    resumoMock.mockReturnValue(pronto(RESUMO));
    eventosMock.mockReturnValue(pronto({ data: EVENTOS, pagination: { page: 1, limit: 50, total: 3, totalPages: 1 } }));
    vi.mocked(CamerasService.marcarLido).mockClear();
  });

  it('mostra o esqueleto enquanto carrega', () => {
    camerasMock.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() });
    render();
    expect(screen.getByRole('status', { name: 'Carregando câmeras' })).toBeInTheDocument();
  });

  it('estado vazio com botão de cadastro só para cadastro técnico', () => {
    camerasMock.mockReturnValue(pronto([]));
    resumoMock.mockReturnValue(pronto(RESUMO_VAZIO));
    // Sem câmera, a aba vira o tutorial de ligação (NEXON-88); o atalho de cadastro é só do cadastro técnico.
    const { unmount } = render();
    expect(screen.getByRole('heading', { name: /Ligue as câmeras de UFV Aupus II/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver câmeras encontradas' })).toBeInTheDocument();
    unmount();

    capacidades.cadastroTecnico = false;
    const segundo = render();
    expect(screen.getByRole('heading', { name: /Ligue as câmeras/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver câmeras encontradas' })).not.toBeInTheDocument();
    segundo.unmount();

    // Quem não cadastra nem configura (proprietário) vê só a explicação.
    capacidades.configOperacional = false;
    render();
    expect(screen.getByText('Nenhuma câmera nesta usina')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Ligue as câmeras/ })).not.toBeInTheDocument();
    capacidades.cadastroTecnico = true;
    capacidades.configOperacional = true;
  });

  it('cabeçalho, comandos, grade, último alerta e resumo da noite seguem o contrato', () => {
    render();
    expect(screen.getByText('Armado até 06:30 · 5 de 6 online')).toBeInTheDocument();
    // Refletor tem ponto configurado; sirene não. Armado → botão "Desarmar" pressionado.
    expect(screen.getByRole('button', { name: 'Refletores' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sirene' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desarmar' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Configurar câmeras' })).toBeInTheDocument();

    const grade = screen.getByRole('region', { name: 'Grade de câmeras' });
    expect(within(grade).getByRole('button', { name: 'Cabine / SSU — 2 alertas não lidos' })).toBeInTheDocument();
    expect(within(grade).getByRole('button', { name: 'Portão — ao vivo' })).toBeInTheDocument();
    expect(within(grade).getByRole('button', { name: 'Arranjo IV3 — sem sinal' })).toBeInTheDocument();

    expect(screen.getByText('Pessoa detectada · Cabine / SSU')).toBeInTheDocument();
    expect(screen.getByText('05:12 · chamado CH-0412 aberto')).toBeInTheDocument();
    expect(screen.getByText('Noite: 1 intrusão, 14 movimentos descartados. Arranjo IV3 sem sinal desde 05:30.')).toBeInTheDocument();
  });

  it('sem capacidade de comandar, os comandos somem e a tela segue visível', () => {
    capacidades.comandar = false;
    capacidades.cadastroTecnico = false;
    capacidades.configOperacional = false;
    render();
    expect(screen.getByText('Armado até 06:30 · 5 de 6 online')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refletores' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desarmar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configurar câmeras' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Foto' })).not.toBeInTheDocument();
  });

  it('painel Câmera abre na primeira câmera, ao vivo, com os eventos do dia', () => {
    render();
    expect(screen.getByRole('heading', { level: 2, name: 'Cabine / SSU' })).toBeInTheDocument();
    expect(screen.getByText('Ao vivo')).toBeInTheDocument();
    expect(screen.getByTestId('player')).toBeInTheDocument();
    // Controles indisponíveis ficam desabilitados por aria, com os demais ativos.
    expect(screen.getByRole('button', { name: 'Áudio' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Foto' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: 'Tela cheia' })).toBeInTheDocument();
  });

  it('Todas as notificações agrupa por dia e abrir um evento leva à câmera e marca lido', async () => {
    const usuario = userEvent.setup();
    render();
    await usuario.click(screen.getByRole('tab', { name: /Todas as notificações/ }));

    expect(screen.getByText('3 não lidas')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: rotuloDia(hoje) })).toBeInTheDocument();
    const grupoOntem = screen.getByRole('region', { name: rotuloDia(ontem) });
    expect(within(grupoOntem).getByText('Veículo detectado')).toBeInTheDocument();
    expect(within(grupoOntem).getByText(/Portão · /)).toBeInTheDocument();

    const grupoHoje = screen.getByRole('region', { name: rotuloDia(hoje) });
    await usuario.click(within(grupoHoje).getAllByRole('button')[0]);

    // Voltou para a aba Câmera na câmera do evento, mostrando a gravação.
    expect(screen.getByRole('heading', { level: 2, name: 'Cabine / SSU' })).toBeInTheDocument();
    expect(screen.getByText('Gravação')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ao vivo' })).toBeInTheDocument();
    expect(CamerasService.marcarLido).toHaveBeenCalledWith('e1');
  });
});
