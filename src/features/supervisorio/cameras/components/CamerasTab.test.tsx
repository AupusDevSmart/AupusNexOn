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

  it('faixa de status, comandos e grade seguem o contrato', async () => {
    const usuario = userEvent.setup();
    render();
    expect(screen.getByText('Armado pela agenda até 06:30')).toBeInTheDocument();
    expect(screen.getByText(/5 de 6 online/)).toBeInTheDocument();
    expect(screen.getByText('· 1 sem sinal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3\s*não vistos/ })).toBeInTheDocument();
    expect(screen.getByText('Noite: 1 intrusão, 14 movimentos descartados. Arranjo IV3 sem sinal desde 05:30.')).toBeInTheDocument();

    // Refletor tem ponto configurado; sirene não. Armado → "Desarmar", com confirmação.
    expect(screen.getByRole('button', { name: 'Refletores' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sirene' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configurar câmeras' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Desarmar' }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Desarmar as câmeras?' });
    expect(CamerasService.armar).not.toHaveBeenCalled();
    vi.mocked(CamerasService.armar).mockResolvedValue({ ...RESUMO, armado: false, armado_ate: null });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desarmar' }));
    expect(CamerasService.armar).toHaveBeenCalledWith('u', { armado: false });

    const grade = screen.getByRole('region', { name: 'Câmeras da usina' });
    expect(within(grade).getByRole('button', { name: 'Cabine / SSU — online, 2 eventos não vistos' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(grade).getByRole('button', { name: 'Portão — online' })).toBeInTheDocument();
    expect(within(grade).getByRole('button', { name: 'Arranjo IV3 — sem sinal' })).toBeInTheDocument();
  });

  it('sem capacidade de comandar, os comandos somem e a tela segue visível', () => {
    capacidades.comandar = false;
    capacidades.cadastroTecnico = false;
    capacidades.configOperacional = false;
    render();
    expect(screen.getByText('Armado pela agenda até 06:30')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refletores' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desarmar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configurar câmeras' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tirar foto agora' })).not.toBeInTheDocument();
  });

  it('abre na primeira câmera, ao vivo, e trocar de câmera troca o player', async () => {
    const usuario = userEvent.setup();
    render();
    const player = screen.getByRole('region', { name: 'Câmera' });
    expect(within(player).getByRole('heading', { level: 2, name: 'Cabine / SSU' })).toBeInTheDocument();
    expect(within(player).getByText('Ao vivo')).toBeInTheDocument();
    expect(screen.getByTestId('player')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tirar foto agora' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tela cheia' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Arranjo IV3 — sem sinal' }));
    expect(within(player).getByRole('heading', { level: 2, name: 'Arranjo IV3' })).toBeInTheDocument();
    expect(within(player).getByText(/Sem sinal desde 05:30/)).toBeInTheDocument();
    expect(screen.queryByTestId('player')).not.toBeInTheDocument();
  });

  it('eventos ao lado: agrupa por dia, abre no player, marca visto e volta ao vivo', async () => {
    const usuario = userEvent.setup();
    render();
    const painel = screen.getByRole('region', { name: 'Eventos' });
    expect(within(painel).getByRole('region', { name: rotuloDia(hoje) })).toBeInTheDocument();
    const grupoOntem = within(painel).getByRole('region', { name: rotuloDia(ontem) });
    expect(within(grupoOntem).getByRole('button', { name: /^Veículo detectado · Portão · / })).toBeInTheDocument();

    const grupoHoje = within(painel).getByRole('region', { name: rotuloDia(hoje) });
    await usuario.click(within(grupoHoje).getByRole('button', { name: /^Pessoa detectada · Cabine \/ SSU · 05:12/ }));

    const player = screen.getByRole('region', { name: 'Câmera' });
    expect(within(player).getByText('Pessoa')).toBeInTheDocument();
    expect(screen.queryByTestId('player')).not.toBeInTheDocument();
    expect(CamerasService.marcarLido).toHaveBeenCalledWith('e1');

    // Anterior/próximo andam na lista; o primeiro não tem "mais novo".
    expect(screen.getByRole('button', { name: 'Evento mais novo' })).toBeDisabled();
    await usuario.click(screen.getByRole('button', { name: 'Evento mais antigo' }));
    expect(CamerasService.marcarLido).toHaveBeenCalledWith('e2');

    await usuario.keyboard('{Escape}');
    expect(screen.getByTestId('player')).toBeInTheDocument();
    expect(within(player).getByText('Ao vivo')).toBeInTheDocument();
  });

  it('lista vazia com filtro oferece limpar filtros', async () => {
    const usuario = userEvent.setup();
    eventosMock.mockReturnValue(pronto({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }));
    render();
    expect(screen.getByText('Nenhum evento ainda')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Animais' }));
    expect(screen.getByText('Nada com esse filtro')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });
});
