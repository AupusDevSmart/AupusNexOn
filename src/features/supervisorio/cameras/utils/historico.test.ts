import { describe, expect, it } from 'vitest';
import type { CameraEvento, CameraGravacao } from '../types';
import {
  deslocarTrecho,
  diaHoraDe,
  diasDisponiveis,
  faixaGravada,
  foraDaGravacao,
  horaDeSegundos,
  inicioDoTrecho,
  instante,
  marcadoresDoDia,
  pctDoDia,
  rotuloTrecho,
  segundosDeHora,
  segundosDoToque,
  segundosNoDia,
  textoDisco,
} from './historico';

const DIA = '2026-11-16';
const ev = (id: string, inicio_em: string, camera_id = 'c1') => ({ id, camera_id, tipo: 'pessoa', inicio_em }) as CameraEvento;
const grav = (p: Partial<CameraGravacao> = {}): CameraGravacao => ({
  ativa: true,
  de: null,
  ate: null,
  uso_gb: null,
  livre_gb: null,
  em: '2026-11-16T15:00:00Z',
  config: { ativa: true, dias: 7, stream: 'secundario' },
  ...p,
});

describe('linha do tempo de 24 h (Brasília)', () => {
  it('hora ↔ segundos', () => {
    expect(segundosDeHora('14:32:10')).toBe(14 * 3600 + 32 * 60 + 10);
    expect(segundosDeHora('24:00:00')).toBeNull();
    expect(horaDeSegundos(52_330)).toBe('14:32:10');
    expect(horaDeSegundos(-5)).toBe('00:00:00');
    expect(horaDeSegundos(90_000)).toBe('23:59:59');
  });

  it('instante e dia/hora usam UTC−3', () => {
    expect(instante(DIA, '10:00:00').toISOString()).toBe('2026-11-16T13:00:00.000Z');
    expect(diaHoraDe('2026-11-17T02:30:00Z')).toEqual({ dia: DIA, hora: '23:30:00' });
    expect(segundosNoDia('2026-11-16T03:00:30Z', DIA)).toBe(30);
    expect(segundosNoDia('2026-11-17T03:00:00Z', DIA)).toBeNull();
  });

  it('toque na barra vira segundos e o trecho começa 10 s antes', () => {
    expect(segundosDoToque(0, 390)).toBe(0);
    expect(segundosDoToque(195, 390)).toBe(43_200);
    expect(segundosDoToque(500, 390)).toBe(86_399);
    expect(inicioDoTrecho(43_200)).toBe(43_190);
    expect(inicioDoTrecho(4)).toBe(0);
    expect(pctDoDia(21_600)).toBe(25);
  });

  it('‹ › atravessam a meia-noite', () => {
    expect(deslocarTrecho(DIA, '23:59:30', 60)).toEqual({ dia: '2026-11-17', hora: '00:00:30' });
    expect(deslocarTrecho(DIA, '00:00:30', -60)).toEqual({ dia: '2026-11-15', hora: '23:59:30' });
    expect(rotuloTrecho('23:59:30')).toBe('23:59:30 – 00:00:30');
  });

  it('marcas: só eventos da câmera e do dia, em ordem', () => {
    const m = marcadoresDoDia(
      [ev('b', '2026-11-16T21:00:00Z'), ev('a', '2026-11-16T09:00:00Z'), ev('x', '2026-11-16T10:00:00Z', 'c2'), ev('ontem', '2026-11-16T02:00:00Z')],
      DIA,
      'c1',
    );
    expect(m.map((x) => [x.id, x.pct])).toEqual([
      ['a', 25],
      ['b', 75],
    ]);
  });

  it('faixa gravada é o pedaço de de/ate dentro do dia', () => {
    expect(faixaGravada(grav({ de: '2026-11-10T00:00:00Z', ate: '2026-11-16T15:00:00Z' }), DIA)).toEqual({ inicioPct: 0, fimPct: 50 });
    expect(faixaGravada(grav({ de: '2026-11-16T09:00:00Z', ate: '2026-11-20T00:00:00Z' }), DIA)).toEqual({ inicioPct: 25, fimPct: 100 });
    expect(faixaGravada(grav({ de: '2026-11-17T09:00:00Z', ate: '2026-11-18T00:00:00Z' }), DIA)).toBeNull();
    expect(faixaGravada(grav(), DIA)).toBeNull();
  });
});

describe('dias e limites da gravação', () => {
  const agora = new Date('2026-11-16T15:00:00Z');

  it('últimos 7 dias, cortados por de/ate', () => {
    expect(diasDisponiveis(undefined, agora)).toEqual([
      '2026-11-16',
      '2026-11-15',
      '2026-11-14',
      '2026-11-13',
      '2026-11-12',
      '2026-11-11',
      '2026-11-10',
    ]);
    expect(diasDisponiveis(grav({ de: '2026-11-14T12:00:00Z', ate: agora.toISOString() }), agora)).toEqual(['2026-11-16', '2026-11-15', '2026-11-14']);
  });

  it('fora da gravação: futuro, antes de `de`, depois de `ate`', () => {
    const g = grav({ de: '2026-11-14T12:00:00Z', ate: '2026-11-16T14:00:00Z' });
    expect(foraDaGravacao(g, new Date('2026-11-16T16:00:00Z'), 60, agora)).toBe(true);
    expect(foraDaGravacao(g, new Date('2026-11-14T11:00:00Z'), 60, agora)).toBe(true);
    expect(foraDaGravacao(g, new Date('2026-11-16T14:30:00Z'), 60, agora)).toBe(true);
    expect(foraDaGravacao(g, new Date('2026-11-15T10:00:00Z'), 60, agora)).toBe(false);
    expect(foraDaGravacao(undefined, new Date('2026-11-15T10:00:00Z'), 60, agora)).toBe(false);
  });

  it('texto do disco', () => {
    expect(textoDisco(grav({ de: '2026-11-10T15:00:00Z', ate: '2026-11-16T15:00:00Z', livre_gb: 120.4 }))).toBe('Gravando · 6 dias guardados · 120 GB livres');
    expect(textoDisco(grav({ ativa: false, livre_gb: 3.25 }))).toBe('Gravação parada · 3,3 GB livres');
    expect(textoDisco(grav({ em: null }))).toBe('Aguardando o aparelho informar a gravação');
    expect(textoDisco(grav({ config: { ativa: false, dias: 7, stream: 'secundario' } }))).toBe('Gravação contínua desligada');
    expect(textoDisco(undefined)).toBe('Este aparelho ainda não grava histórico');
  });
});
