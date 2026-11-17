import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CameraEvento } from '../types';
import { PainelEventos } from './PainelEventos';

const agora = new Date().toISOString();
const ev = (id: string): CameraEvento => ({
  id,
  camera_id: 'c1',
  camera_nome: 'Portão',
  unidade_id: 'u',
  tipo: 'pessoa',
  titulo: '',
  inicio_em: agora,
  fim_em: null,
  confianca: 0.9,
  armado: true,
  alerta: true,
  descartado: false,
  motivo_descarte: null,
  snapshot_url: null,
  clipe_url: null,
  lido_em: agora,
  lido_por_nome: null,
  chamado_id: null,
  chamado_numero: null,
  dados: null,
  created_at: agora,
});

function montar(onApagar?: (l: CameraEvento[]) => void, onPeriodo?: (p: unknown) => void) {
  const onAbrirEvento = vi.fn();
  render(
    <PainelEventos
      eventos={{ data: { data: [ev('e1'), ev('e2')], pagination: { total: 2, page: 1, limit: 50, pages: 1 } } as never, isPending: false, isError: false, refetch: vi.fn() }}
      filtro="todas"
      onFiltro={vi.fn()}
      somenteNaoVistos={false}
      onSomenteNaoVistos={vi.fn()}
      cameraFiltro={null}
      onCameraFiltro={vi.fn()}
      naoVistos={0}
      eventoSelId={null}
      onAbrirEvento={onAbrirEvento}
      onMarcarTodos={vi.fn()}
      marcandoTodos={false}
      onMostrarMais={vi.fn()}
      urlMidia={() => null}
      onApagar={onApagar}
      onPeriodo={onPeriodo}
    />,
  );
  return { onAbrirEvento };
}

describe('PainelEventos · apagar em lote', () => {
  it('sem permissão não mostra "Selecionar"', () => {
    montar();
    expect(screen.queryByRole('button', { name: /selecionar/i })).toBeNull();
  });

  it('admin marca eventos e apaga só os marcados; clique na seleção não abre o evento', async () => {
    const onApagar = vi.fn();
    const { onAbrirEvento } = montar(onApagar);
    await userEvent.click(screen.getByRole('button', { name: /selecionar/i }));
    const apagar = screen.getByRole('button', { name: /^apagar$/i });
    expect(apagar).toBeDisabled();
    await userEvent.click(screen.getAllByRole('button', { name: /^marcar pessoa/i })[0]);
    expect(screen.getByText('1 marcado')).toBeInTheDocument();
    expect(onAbrirEvento).not.toHaveBeenCalled();
    await userEvent.click(apagar);
    expect(onApagar).toHaveBeenCalledWith([expect.objectContaining({ id: 'e1' })]);
  });

  it('"Marcar todos" marca a lista carregada', async () => {
    const onApagar = vi.fn();
    montar(onApagar);
    await userEvent.click(screen.getByRole('button', { name: /selecionar/i }));
    await userEvent.click(screen.getByRole('button', { name: /marcar todos \(2\)/i }));
    await userEvent.click(screen.getByRole('button', { name: /^apagar$/i }));
    expect(onApagar.mock.calls[0][0].map((e: CameraEvento) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('PainelEventos · período', () => {
  it('atalho "Ontem" aplica o período', async () => {
    const onPeriodo = vi.fn();
    montar(undefined, onPeriodo);
    await userEvent.click(screen.getByRole('button', { name: /filtrar por período/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ontem' }));
    expect(onPeriodo).toHaveBeenCalledWith(expect.objectContaining({ de: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), ate: null }));
  });

  it('faixa "Noite" vai das 18h às 6h', async () => {
    const onPeriodo = vi.fn();
    montar(undefined, onPeriodo);
    await userEvent.click(screen.getByRole('button', { name: /filtrar por período/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^noite/i }));
    expect(onPeriodo).toHaveBeenCalledWith(expect.objectContaining({ horaDe: '18:00', horaAte: '06:00' }));
  });

  it('mostra o resumo do período e limpa pelo X', async () => {
    const onPeriodo = vi.fn();
    render(
      <PainelEventos
        eventos={{ data: { data: [], pagination: { total: 0, page: 1, limit: 50, pages: 0 } } as never, isPending: false, isError: false, refetch: vi.fn() }}
        filtro="todas"
        onFiltro={vi.fn()}
        somenteNaoVistos={false}
        onSomenteNaoVistos={vi.fn()}
        cameraFiltro={null}
        onCameraFiltro={vi.fn()}
        naoVistos={0}
        eventoSelId={null}
        onAbrirEvento={vi.fn()}
        onMarcarTodos={vi.fn()}
        marcandoTodos={false}
        onMostrarMais={vi.fn()}
        urlMidia={() => null}
        periodo={{ de: null, ate: null, horaDe: '18:00', horaAte: '06:00' }}
        onPeriodo={onPeriodo}
      />,
    );
    expect(screen.getByRole('button', { name: /filtrar por período: toda noite, 18h–6h/i })).toBeInTheDocument();
    expect(screen.getByText('Nada neste período')).toBeInTheDocument();
    expect(screen.getByText('Nenhum evento neste período')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todo o período' }));
    expect(onPeriodo).toHaveBeenLastCalledWith({ de: null, ate: null, horaDe: null, horaAte: null });
    onPeriodo.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar período' }));
    expect(onPeriodo).toHaveBeenCalledWith({ de: null, ate: null, horaDe: null, horaAte: null });
  });

  it('dois cliques no calendário formam o intervalo', async () => {
    const onPeriodo = vi.fn();
    montar(undefined, onPeriodo);
    await userEvent.click(screen.getByRole('button', { name: /filtrar por período/i }));
    const dias = (await screen.findAllByRole('gridcell')).map((c) => c.querySelector('button')).filter((b): b is HTMLButtonElement => !!b && !b.disabled);
    await userEvent.click(dias[0]);
    expect(onPeriodo).toHaveBeenLastCalledWith(expect.objectContaining({ ate: null }));
    const primeiro = onPeriodo.mock.lastCall![0].de as string;
    await userEvent.click(dias[2]);
    const ultimo = onPeriodo.mock.lastCall![0];
    expect(ultimo.de).toBe(primeiro);
    expect(ultimo.ate! > primeiro).toBe(true);
  });
});

describe('PainelEventos · seletor de câmera', () => {
  const muitas = Array.from({ length: 12 }, (_, i) => ({
    id: `c${i + 1}`,
    nome: i === 6 ? 'Portão' : `Câmera ${i + 1}`,
    status: 'online' as const,
    naoVistos: 0,
  }));

  function montarComCameras(cameraFiltro: string | null, onCameraFiltro = vi.fn()) {
    render(
      <PainelEventos
        eventos={{ data: { data: [], pagination: { total: 0, page: 1, limit: 50, pages: 0 } } as never, isPending: false, isError: false, refetch: vi.fn() }}
        filtro="todas"
        onFiltro={vi.fn()}
        somenteNaoVistos={false}
        onSomenteNaoVistos={vi.fn()}
        cameras={muitas}
        cameraFiltro={cameraFiltro}
        onCameraFiltro={onCameraFiltro}
        naoVistos={0}
        eventoSelId={null}
        onAbrirEvento={vi.fn()}
        onMarcarTodos={vi.fn()}
        marcandoTodos={false}
        onMostrarMais={vi.fn()}
        urlMidia={() => null}
      />,
    );
    return onCameraFiltro;
  }

  it('com muitas câmeras a lista tem busca (sem acento) e escolher filtra', async () => {
    const onCameraFiltro = montarComCameras(null);
    await userEvent.click(screen.getByRole('button', { name: 'Câmera: Todas as câmeras' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar câmera' }), 'portao');
    const opcoes = screen.getByRole('group', { name: 'Câmera' });
    expect(within(opcoes).getAllByRole('button')).toHaveLength(1);
    await userEvent.click(within(opcoes).getByRole('button', { name: 'Portão' }));
    expect(onCameraFiltro).toHaveBeenCalledWith('c7');
  });

  it('lista vazia de uma câmera oferece voltar para todas', async () => {
    const onCameraFiltro = montarComCameras('c7');
    expect(screen.getByText('Nada registrado em Portão até agora.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas as câmeras' }));
    expect(onCameraFiltro).toHaveBeenCalledWith(null);
  });
});
