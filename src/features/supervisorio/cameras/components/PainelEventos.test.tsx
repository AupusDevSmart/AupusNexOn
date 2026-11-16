import { render, screen } from '@testing-library/react';
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

function montar(onApagar?: (l: CameraEvento[]) => void) {
  const onAbrirEvento = vi.fn();
  render(
    <PainelEventos
      eventos={{ data: { data: [ev('e1'), ev('e2')], pagination: { total: 2, page: 1, limit: 50, pages: 1 } } as never, isPending: false, isError: false, refetch: vi.fn() }}
      filtro="todas"
      onFiltro={vi.fn()}
      somenteNaoVistos={false}
      onSomenteNaoVistos={vi.fn()}
      escopo="todas"
      onEscopo={vi.fn()}
      cameraNome="Portão"
      naoVistos={0}
      eventoSelId={null}
      onAbrirEvento={onAbrirEvento}
      onMarcarTodos={vi.fn()}
      marcandoTodos={false}
      onMostrarMais={vi.fn()}
      urlMidia={() => null}
      onApagar={onApagar}
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
