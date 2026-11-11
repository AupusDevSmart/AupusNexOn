import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from '@/store/useUserStore';
import type { AvisoDeExclusao } from './AvisoDeExclusoes';
import type { AlcanceDoAviso } from './exclusao-compartilhada';

const get = vi.fn();
const post = vi.fn();
const toast = vi.fn();
vi.mock('@/config/api', () => ({ api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }));
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));

const { AvisoDeExclusoes } = await import('./AvisoDeExclusoes');

const aviso = (mudar: Partial<AvisoDeExclusao> = {}): AvisoDeExclusao => ({
  id: '7',
  recurso: 'plantas',
  registro_id: 'P1',
  nome: 'UFV Jacuba',
  origem: 'nexon',
  apagado_em: '2026-10-26T19:25:00.000Z',
  apagado_por: null,
  recebido_em: '2026-11-07T20:07:00.000Z',
  abaixo: 0,
  ...mudar,
});

const semNadaDebaixo: AlcanceDoAviso = { unidades: 0, equipamentos: 0, naoApagadosLa: { unidades: 0, equipamentos: 0, nomesDasInstalacoes: [] } };

/** As respostas da API por rota: a lista e o alcance */
function responder(avisos: AvisoDeExclusao[], alcance: AlcanceDoAviso | Error = semNadaDebaixo) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/alcance')) {
      if (alcance instanceof Error) throw alcance;
      return { data: alcance };
    }
    return { data: { total: avisos.length, avisos } };
  });
}

let queryClient: QueryClient;
const comQuery = (ui: ReactNode) => render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

async function abrirOSheet() {
  comQuery(<AvisoDeExclusoes />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
}

/**
 * A exclusão feita no outro produto chega como aviso (10/11/2026): alguém
 * decide "apagar aqui também" ou "manter só aqui", e a decisão vale para o que
 * fica debaixo.
 */
describe('AvisoDeExclusoes', () => {
  beforeEach(() => {
    queryClient = new QueryClient();
    get.mockReset();
    post.mockReset().mockResolvedValue({ data: { apagados: 0, avisosFechados: 0 } });
    toast.mockReset();
    responder([aviso()]);
    useUserStore.setState({ acessivel: ['sincronizacao.gerenciar'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sem a permissão de gerenciar o compartilhamento, não aparece nem consulta', () => {
    useUserStore.setState({ acessivel: ['plantas.view'] });
    const { container } = comQuery(<AvisoDeExclusoes />);
    expect(container).toBeEmptyDOMElement();
    expect(get).not.toHaveBeenCalled();
  });

  it('mostra quantos esperam e, no sheet, a data da exclusão lá e o que vai junto', async () => {
    responder([aviso({ abaixo: 12 })]);
    await abrirOSheet();

    expect(screen.getByText(/1 exclusão feita no .* espera sua decisão/)).toBeInTheDocument();
    expect(await screen.findByText('UFV Jacuba')).toBeInTheDocument();
    expect(screen.getByText(/exclusão no .* em 26\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Junto, 12 avisos do que fica debaixo/)).toBeInTheDocument();
  });

  it('manter só aqui: um clique, e as listas abertas se atualizam', async () => {
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    post.mockResolvedValue({ data: { apagados: 0, avisosFechados: 3 } });
    await abrirOSheet();
    responder([]);

    fireEvent.click(await screen.findByRole('button', { name: /Manter só aqui/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/sincronizacao/exclusoes/7/decisao', { decisao: 'manter' }));
    await waitFor(() => expect(invalidar).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mantido só aqui: UFV Jacuba', description: expect.stringMatching(/3 avisos junto/) }));
  });

  it('apagar sem nada debaixo: o segundo clique confirma, sem pedir o nome', async () => {
    await abrirOSheet();

    fireEvent.click(await screen.findByRole('button', { name: /Apagar aqui também/ }));
    expect(post).not.toHaveBeenCalled();
    expect(await screen.findByText(/Apaga aqui/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/digite o nome/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/sincronizacao/exclusoes/7/decisao', { decisao: 'apagar' }));
  });

  it('apagar com algo debaixo diz quanto vai junto, o que lá não foi apagado, e pede o nome', async () => {
    responder([aviso()], { unidades: 2, equipamentos: 3, naoApagadosLa: { unidades: 1, equipamentos: 0, nomesDasInstalacoes: ['Usina só daqui'] } });
    await abrirOSheet();

    fireEvent.click(await screen.findByRole('button', { name: /Apagar aqui também/ }));

    expect(await screen.findByText(/com 2 instalações e 3 equipamentos debaixo/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/1 instalação existe só aqui ou continua no .* \(Usina só daqui\)/);
    const confirmar = screen.getByRole('button', { name: /Confirmar/ });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/digite o nome/), { target: { value: 'ufv  jacuba ' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(post).toHaveBeenCalledWith('/sincronizacao/exclusoes/7/decisao', { decisao: 'apagar' }));
  });

  it('sem conseguir conferir o que vai junto, pede o nome', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    responder([aviso()], new Error('rede'));
    await abrirOSheet();

    fireEvent.click(await screen.findByRole('button', { name: /Apagar aqui também/ }));

    expect(await screen.findByText(/Não foi possível conferir o que vai junto/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled();
  });

  it('sem a lista, diz que não conseguiu conferir (antes ficava calado)', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    get.mockRejectedValue(new Error('404'));
    comQuery(<AvisoDeExclusoes />);

    expect(await screen.findByText(/Não foi possível conferir as exclusões feitas no/)).toBeInTheDocument();
    expect(erro).toHaveBeenCalled();
    responder([aviso()]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/1 exclusão feita no/)).toBeInTheDocument();
  });

  it('sem nada esperando, não aparece', async () => {
    responder([]);
    const { container } = comQuery(<AvisoDeExclusoes />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
