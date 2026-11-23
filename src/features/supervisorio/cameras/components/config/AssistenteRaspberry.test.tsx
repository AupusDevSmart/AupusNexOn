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
  comando_windows: `powershell -ExecutionPolicy Bypass -Command "irm 'https://exemplo/instalar?so=windows' | iex"`,
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

  it('escolhe o jeito e guia uma coisa por tela até copiar o comando', async () => {
    const user = userEvent.setup();
    abrir();
    expect(screen.getByText(/Entra em/)).toHaveTextContent('Entra em UFV Aupus II');
    // O mais rápido vem marcado, com o porquê.
    expect(screen.getByRole('radio', { name: /Cartão no computador/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Mais rápido')).toBeInTheDocument();
    expect(screen.getByText(/grava direto no cartão/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Por que Cabo USB-C?' })).toBeInTheDocument();
    // O que comprar: cartão rápido em primeiro.
    await user.click(screen.getByRole('button', { name: /O que comprar/ }));
    expect(screen.getByText('Cartão microSD')).toBeInTheDocument();
    expect(screen.getByText(/SanDisk Extreme, Samsung PRO Plus/)).toBeInTheDocument();
    await waitFor(() => expect(CamerasService.instalador).toHaveBeenCalledWith('u1'));
    await user.click(screen.getByRole('radio', { name: /Cabo USB-C/ }));

    await user.click(screen.getByRole('button', { name: /Começar/ }));
    expect(screen.getByText('Passo 1 de 12')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Separe o Raspberry e um cabo USB-C' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    expect(screen.getByRole('heading', { name: 'Abra o Terminal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    expect(screen.getByRole('heading', { name: 'Copie o comando' })).toBeInTheDocument();
    expect(await screen.findByText(INSTALADOR.comando)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copiar comando' }));
    expect(await navigator.clipboard.readText()).toBe(INSTALADOR.comando);
    expect(lerSessao('u1')?.subpasso).toBe(3);

    // Volta à escolha e troca para Windows: comando do PowerShell.
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Voltar' }));
    // Linux: teclas do Linux (Ctrl + Alt + T e colar com Ctrl + Shift + V).
    await user.click(screen.getByRole('radio', { name: /^Linux/ }));
    await user.click(screen.getByRole('button', { name: /Começar/ }));
    await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    expect(screen.getByRole('heading', { name: 'Abra o Terminal' })).toBeInTheDocument();
    expect(screen.getByText('Alt')).toBeInTheDocument();
    expect(screen.queryByText('Cmd')).toBeNull();
    for (let i = 0; i < 2; i++) await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    expect(screen.getByText(/Ctrl \+ Shift \+ V/)).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('radio', { name: /^Windows/ }));
    await user.click(screen.getByRole('button', { name: /Começar/ }));
    await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    expect(screen.getByRole('heading', { name: 'Abra o PowerShell' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    // O comando leva o jeito escolhido (cabo), para o instalador pular o que não é desse jeito.
    expect(screen.getByText(/\$env:NEXON_MODO='cabo'; irm 'https:\/\/exemplo\/instalar\?so=windows' \| iex/)).toBeInTheDocument();
  });

  it('cartão no computador: 9 telas, cartão no computador antes do comando e depois a etapa Ligar', async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole('button', { name: /Começar/ }));
    expect(screen.getByText('Passo 1 de 9')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tire o cartão SD do Raspberry' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    expect(screen.getByRole('heading', { name: 'Coloque o cartão no computador' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    expect(await screen.findByText(/NEXON_MODO=cartao|curl -fsSL/)).toBeInTheDocument();
    // Nenhuma tela manda tirar o cartão do computador antes de gravar.
    for (let i = 0; i < 5; i++) {
      expect(screen.queryByText(/tire agora/i)).toBeNull();
      await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    }
    expect(screen.getByRole('heading', { name: 'Coloque o cartão de volta no Raspberry' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Terminei de gravar/ }));
    expect(screen.getByRole('heading', { name: 'Ligue no local' })).toBeInTheDocument();
  });

  it('pendrive como memória: pergunta primeiro, comando com o jeito pendrive e 8 telas', async () => {
    const user = userEvent.setup();
    abrir();
    expect(screen.getByRole('radio', { name: /Cartão microSD \(recomendado\)/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: /Pendrive \(sem microSD\)/ }));
    // Sem microSD não pergunta como gravar o cartão.
    expect(screen.queryByRole('radiogroup', { name: 'Jeito de gravar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Começar/ }));
    expect(screen.getByText('Passo 1 de 8')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coloque o pendrive no computador' })).toBeInTheDocument();
    for (let i = 0; i < 7; i++) await user.click(screen.getByRole('button', { name: /Feito, próximo/ }));
    expect(screen.getByRole('heading', { name: 'Coloque o pendrive no Raspberry e ligue' })).toBeInTheDocument();
    expect(lerSessao('u1')?.jeito).toBe('usb');
  });

  it('avança pelas etapas, marca o checklist e guarda a etapa para reabrir', async () => {
    const user = userEvent.setup();
    gravarSessao('u1', { ...sessaoNova('pc'), etapa: 2 });
    abrir();
    expect(screen.getByRole('heading', { name: 'Ligue no local' })).toBeInTheDocument();
    const etapas = screen.getByRole('list', { name: 'Etapas' });
    expect(within(etapas).getByRole('button', { current: 'step' })).toHaveTextContent('Ligar');

    const fonte = screen.getByRole('checkbox', { name: /Fonte/ });
    await user.click(fonte);
    expect(fonte).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /Próximo/ }));
    expect(screen.getByRole('heading', { name: 'Procurando o Raspberry…' })).toBeInTheDocument();
    // Sem aparelho novo, não dá para seguir para câmeras.
    expect(screen.getByRole('button', { name: 'Esperando…' })).toBeDisabled();

    await waitFor(() => expect(lerSessao('u1')?.idsIniciais).toEqual(['a-velho']));
    const guardada = lerSessao('u1');
    expect(guardada?.etapa).toBe(3);
    expect(guardada?.marcados).toEqual(['fonte']);
    expect(guardada?.procurandoDesde).toEqual(expect.any(Number));

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { name: 'Ligue no local' })).toBeInTheDocument();
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

    expect(await screen.findByText('Conectado!')).toBeInTheDocument();
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
