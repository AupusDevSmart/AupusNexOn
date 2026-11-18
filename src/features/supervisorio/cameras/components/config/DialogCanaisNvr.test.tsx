import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, sonnerMockFactory } from '@/test-utils';
import { CamerasService } from '../../services/cameras.service';
import type { Agente, Camera, CameraDescoberta } from '../../types';
import { DialogCanaisNvr } from './DialogCanaisNvr';

vi.mock('sonner', () => sonnerMockFactory());
vi.mock('../../services/cameras.service', () => ({ CamerasService: { criar: vi.fn().mockResolvedValue({}) } }));

const agente = { id: 'ag1', nome: 'Pi' } as Agente;
const nvr: CameraDescoberta = {
  ip: '192.168.1.30', mac: 'dd:dd', fabricante: 'intelbras', modelo: 'NVD 1404', serial: null,
  porta_http: 80, porta_rtsp: 554, inicializada: true, visto_em: new Date().toISOString(), gravador: true, canais_sugeridos: 4,
};

describe('DialogCanaisNvr', () => {
  it('cria uma câmera por canal escolhido, com o canal e o IP do gravador, sem repetir os que já existem', async () => {
    const user = userEvent.setup();
    const ja = [{ id: 'c1', ip: '192.168.1.30', canal: 1 } as Camera];
    renderWithProviders(<DialogCanaisNvr unidadeId="u1" agente={agente} descoberta={nvr} cameras={ja} onFechar={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Canal 1 (já adicionado)' })).toBeDisabled();
    await user.type(screen.getByLabelText('Senha do gravador'), 'segredo1');
    await user.click(screen.getByRole('button', { name: 'Marcar todos' }));
    await user.click(screen.getByRole('button', { name: /Adicionar 3 canais/ }));
    await waitFor(() => expect(CamerasService.criar).toHaveBeenCalledTimes(3));
    expect(vi.mocked(CamerasService.criar).mock.calls.map((c) => c[0].canal)).toEqual([2, 3, 4]);
    expect(vi.mocked(CamerasService.criar).mock.calls[0][0]).toMatchObject({ ip: '192.168.1.30', agente_id: 'ag1', nome: 'Câmera 2', usuario: 'admin' });
  });
});
