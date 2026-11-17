import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test-utils';
import { CamerasService } from '../../services/cameras.service';
import type { Agente, Camera, InstaladorAparelho } from '../../types';
import { gravarSessao, lerSessao, sessaoNova } from '../../utils/assistente-raspberry';
import { AssistenteRaspberry } from './AssistenteRaspberry';

vi.mock('sonner', async () => (await import('@/test-utils')).sonnerMockFactory());

vi.mock('../../services/cameras.service', () => ({
  CamerasService: {
    agentes: vi.fn(),
    instalador: vi.fn(),
    listar: vi.fn(),
    descobertas: vi.fn(),
  },
}));

const agente = (id: string, nome: string, criado = '2026-11-10T10:00:00Z'): Agente => ({
  id,
  unidade_id: 'u1',
  nome,
  versao: '0.4.3',
  host: nome,
  ultimo_contato_em: null,
  cameras: 0,
  created_at: criado,
  updated_at: criado,
});

const VELHO = agente('a-velho', 'pi-cabine');
const NOVO = agente('a-novo', 'nexon-cam', '2026-11-17T12:00:00Z');

const INSTALADOR: InstaladorAparelho = {
  versao: '0.4.3',
  tamanho: 1_100_000_000,
  publicado_em: '2026-11-16T10:00:00Z',
  valido_ate: '2099-01-01T12:00:00Z',
  url_imagem: 'https://exemplo/nexon.img.xz',
  comando: 'curl -fsSL https://exemplo/instalar | bash -s -- --chave abc123',
  vinculo_automatico: { valido_ate: '2099-01-01T12:00:00Z' },
  usina: 'UFV Aupus II',
};

const camera = (id: string, agenteId: string, status: Camera['status']): Camera =>
  ({ id, unidade_id: 'u1', agente_id: agenteId, nome: `Câmera ${id}`, ip: `192.168.1.${id.length + 10}`, status, ordem: 0 }) as Camera;

function abrir(extra: Partial<{ onFechar: () => void; onVincular: () => void }> = {}) {
  return renderWithProviders(
    <AssistenteRaspberry unidadeId="u1" unidadeNome="UFV Aupus II" onFechar={extra.onFechar ?? vi.fn()} onVincular={extra.onVincular ?? vi.fn()} />,
  );
}

describe('AssistenteRaspberry', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(CamerasService.agentes).mockReset().mockResolvedValue([VELHO]);
    vi.mocked(CamerasService.instalador).mockReset().mockResolvedValue(INSTALADOR);
    vi.mocked(CamerasService.listar).mockReset().mockResolvedValue([]);
    vi.mocked(CamerasService.descobertas).mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pede o comando com a usina, mostra o destino e copia o comando', async () => {
    const user = userEvent.setup();
    abrir();
    expect(await screen.findByText(INSTALADOR.comando)).toBeInTheDocument();
    expect(CamerasService.instalador).toHaveBeenCalledWith('u1');
    expect(screen.getByText(/Este Raspberry vai entrar em:/)).toHaveTextContent('Este Raspberry vai entrar em: UFV Aupus II');
    expect(screen.getByText(/Ele já leva a chave de UFV Aupus II/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copiar comando de instalação' }));
    expect(await navigator.clipboard.readText()).toBe(INSTALADOR.comando);
    expect(screen.getByRole('button', { name: 'Copiar comando de instalação' })).toHaveTextContent('Copiado');
  });

  it('avança pelas etapas, marca o checklist e guarda a etapa para reabrir', async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText(INSTALADOR.comando);

    await user.click(screen.getByRole('button', { name: /Já gravei, próximo/ }));
    expect(screen.getByRole('heading', { name: 'Ligue o Raspberry no local' })).toBeInTheDocument();
    const etapas = screen.getByRole('list', { name: 'Etapas' });
    expect(within(etapas).getByRole('button', { current: 'step' })).toHaveTextContent('Ligar');

    const fonte = screen.getByRole('checkbox', { name: /Fonte oficial de 27 W/ });
    await user.click(fonte);
    expect(fonte).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /Liguei tudo, próximo/ }));
    expect(screen.getByRole('heading', { name: 'Esperando o Raspberry chegar' })).toBeInTheDocument();
    // Sem aparelho novo, não dá para seguir para câmeras.
    expect(screen.getByRole('button', { name: 'Esperando o Raspberry…' })).toBeDisabled();

    const guardada = lerSessao('u1');
    expect(guardada?.etapa).toBe(3);
    expect(guardada?.marcados).toEqual(['fonte']);
    expect(guardada?.idsIniciais).toEqual(['a-velho']);
    expect(guardada?.procurandoDesde).toEqual(expect.any(Number));

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { name: 'Ligue o Raspberry no local' })).toBeInTheDocument();
  });

  it('detecta ao vivo o aparelho que não existia quando abriu e comemora', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    gravarSessao('u1', { ...sessaoNova('pc'), etapa: 3, procurandoDesde: Date.now() });
    abrir();
    expect(await screen.findByText('Procurando o Raspberry…')).toBeInTheDocument();
    // O que já estava na usina não conta como novo.
    await waitFor(() => expect(lerSessao('u1')?.idsIniciais).toEqual(['a-velho']));
    expect(screen.queryByText(/conectado!/)).toBeNull();

    vi.mocked(CamerasService.agentes).mockResolvedValue([VELHO, NOVO]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(await screen.findByText('Raspberry ‘nexon-cam’ conectado!')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Raspberry 'nexon-cam' conectado!");
    expect(screen.getByRole('button', { name: /Ver câmeras/ })).toBeEnabled();
  });

  it('mostra só as câmeras do aparelho novo e conclui limpando a sessão', async () => {
    const user = userEvent.setup();
    vi.mocked(CamerasService.agentes).mockResolvedValue([VELHO, NOVO]);
    vi.mocked(CamerasService.listar).mockResolvedValue([camera('c1', 'a-novo', 'online'), camera('c22', 'a-velho', 'online')]);
    gravarSessao('u1', { ...sessaoNova('pc'), etapa: 4, idsIniciais: ['a-velho'], procurandoDesde: Date.now() });
    const fechar = vi.fn();
    abrir({ onFechar: fechar });

    const lista = await screen.findByRole('list', { name: 'Câmeras do aparelho' });
    expect(within(lista).getByText('Câmera c1')).toBeInTheDocument();
    expect(within(lista).queryByText('Câmera c22')).toBeNull();
    expect(within(lista).getByRole('img', { name: 'online' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(fechar).toHaveBeenCalled();
    expect(lerSessao('u1')).toBeNull();
  });

  it('pelo pendrive, a etapa Conectar oferece o vincular', async () => {
    const user = userEvent.setup();
    const vincular = vi.fn();
    gravarSessao('u1', { ...sessaoNova('pendrive'), etapa: 3, idsIniciais: ['a-velho'], procurandoDesde: Date.now() });
    abrir({ onVincular: vincular });
    await user.click(await screen.findByRole('button', { name: 'Vincular aparelho' }));
    expect(vincular).toHaveBeenCalled();
  });
});
