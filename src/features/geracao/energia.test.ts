import { describe, expect, it } from 'vitest';
import { nice, ticks } from 'd3-array';
import { esperadoNoInstante, mesclarFluxo, type PontoDemanda } from '@/features/supervisorio/components/sinoptico-graficos-v2/dados';
import type { PontoAnalise } from './api';
import {
  alternarSerie,
  consumoNoPeriodo,
  consumoPorChave,
  horaBrasilia,
  montarBarrasEnergia,
  montarDiaEnergia,
  periodosConsumo,
  seriesEfetivas,
  zeroEspelho,
  type SeriesLigadas,
} from './energia';

const TUDO: SeriesLigadas = { carga: true, geracao: true, esperado: true };
const SEM_CARGA: SeriesLigadas = { carga: false, geracao: true, esperado: true };

const ponto = (data: string, real: number | null, esp: number | null, extra: Partial<PontoAnalise> = {}): PontoAnalise => ({
  rotulo: data.slice(8), data, real_kwh: real, esperado_kwh: esp, sem_dados: real == null, futuro: false, ...extra,
});

describe('séries do cartão Energia', () => {
  it('carga e geração = espelhado; esperado só com geração e fonte', () => {
    expect(seriesEfetivas(TUDO, TUDO)).toMatchObject({ modo: 'fluxo', esperado: true });
    expect(seriesEfetivas({ ...TUDO, geracao: false }, TUDO)).toMatchObject({ modo: 'carga', esperado: false });
    expect(seriesEfetivas(TUDO, SEM_CARGA)).toMatchObject({ modo: 'geracao', carga: false, geracao: true });
    expect(seriesEfetivas(TUDO, { ...TUDO, esperado: false }).esperado).toBe(false);
  });

  it('sem carga disponível a geração aparece mesmo desligada', () => {
    expect(seriesEfetivas({ carga: true, geracao: false, esperado: false }, SEM_CARGA).modo).toBe('geracao');
  });

  it('nunca desliga as duas', () => {
    const soCarga = alternarSerie(TUDO, 'geracao', TUDO);
    expect(seriesEfetivas(soCarga, TUDO).modo).toBe('carga');
    const virou = alternarSerie(soCarga, 'carga', TUDO);
    expect(seriesEfetivas(virou, TUDO).modo).toBe('geracao');
    expect(alternarSerie(TUDO, 'geracao', SEM_CARGA)).toEqual(TUDO);
  });
});

describe('consultas de consumo', () => {
  const base = { referencia: '2026-10-20', inicio: '2026-10-01', fim: '2026-10-31' };
  it('por período', () => {
    expect(periodosConsumo({ ...base, periodo: 'dia' })).toEqual([{ tipo: 'dia', data: '2026-10-20' }]);
    expect(periodosConsumo({ ...base, periodo: 'mes' })).toEqual([{ tipo: 'mes', mes: '2026-10' }]);
    expect(periodosConsumo({ ...base, periodo: 'ano', inicio: '2026-01-01' })).toEqual([{ tipo: 'ano', ano: '2026' }]);
    expect(periodosConsumo({ ...base, periodo: 'total' })).toEqual([]);
  });
  it('semana que cruza o mês consulta os dois', () => {
    expect(periodosConsumo({ ...base, periodo: 'semana', inicio: '2026-09-28', fim: '2026-10-04' })).toEqual([
      { tipo: 'mes', mes: '2026-09' }, { tipo: 'mes', mes: '2026-10' },
    ]);
  });
  it('consumo por dia e por mês, sempre positivo', () => {
    const m = consumoPorChave([{ dia: 3, energia_kwh: -120 }, { dia: 4, energia_kwh: 80 }], { tipo: 'mes', mes: '2026-10' });
    expect([...m]).toEqual([['2026-10-03', 120], ['2026-10-04', 80]]);
    const a = consumoPorChave([{ mes_numero: 2, energia_kwh: -900 }], { tipo: 'ano', ano: '2026' });
    expect(a.get('2026-02')).toBe(900);
  });
});

describe('barras de energia', () => {
  const pts = [ponto('2026-10-01', 600, 700), ponto('2026-10-02', 800, 750), ponto('2026-10-03', null, 500, { futuro: true })];
  const consumo = new Map([['2026-10-01', 300], ['2026-10-02', 450], ['2026-10-03', 999]]);

  it('só geração: barra + folga até o esperado', () => {
    const { linhas, zero } = montarBarrasEnergia(pts, 'mes', consumo, seriesEfetivas(TUDO, SEM_CARGA));
    expect(zero).toBe(0);
    expect(linhas[0]).toMatchObject({ barraGeracao: 600, folga: 100, marcaEsperado: 700, consumo: null });
    expect(linhas[1]).toMatchObject({ barraGeracao: 800, folga: 0 });
  });

  it('espelhado: geração pende do zero, consumo sobe dele, futuro sem consumo', () => {
    const ef = seriesEfetivas(TUDO, TUDO);
    const { linhas, zero } = montarBarrasEnergia(pts, 'mes', consumo, ef);
    expect(zero).toBeGreaterThanOrEqual(800);
    expect(linhas[0]).toMatchObject({ base: zero - 600, barraGeracao: 600, barraConsumo: 300, marcaEsperado: zero - 700 });
    expect(linhas[2]).toMatchObject({ base: zero, barraGeracao: 0, consumo: null });
    expect(consumoNoPeriodo(pts, 'mes', consumo)).toBe(300 + 450 + 999);
  });

  it('no ano o consumo casa pelo mês', () => {
    const anos = [ponto('2026-02-01', 10, null)];
    const { linhas } = montarBarrasEnergia(anos, 'ano', new Map([['2026-02', 5]]), seriesEfetivas(TUDO, TUDO));
    expect(linhas[0].consumo).toBe(5);
  });

  it.each([[812, 300], [6123, 3000], [45, 1200], [1, 1]])('zero do espelhado cai num tick (%s, %s)', (g, c) => {
    const z = zeroEspelho(g, c, 4);
    expect(z).toBeGreaterThanOrEqual(g);
    const [, topo] = nice(0, (z + c) * 1.1, 10);
    expect(ticks(0, topo, 4).some((t) => Math.abs(t - z) < 1e-9)).toBe(true);
  });
});

describe('dia', () => {
  const inicio = (h: number, m: number) => `2026-10-20T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`;
  const ger: PontoAnalise[] = [
    { ...ponto('2026-10-20', null, null), inicio: inicio(10, 0), real_kw: 100, esperado_kw: 120 },
    { ...ponto('2026-10-20', null, null), inicio: inicio(10, 15), real_kw: 200, esperado_kw: 150 },
    { ...ponto('2026-10-20', null, null), inicio: inicio(10, 30), real_kw: null, esperado_kw: null, futuro: true },
  ];
  const con = [
    { timestamp: new Date(inicio(10, 0)).toISOString(), potencia_kw: -50, energia_kwh: 0 },
    { timestamp: new Date(inicio(10, 5)).toISOString(), potencia_kw: -60, energia_kwh: 0 },
  ];

  it('só geração: contratado +1% e esperado positivo com teto', () => {
    const d = montarDiaEnergia({ data: '2026-10-20', geracao: ger, consumo: con, ef: seriesEfetivas(TUDO, SEM_CARGA), contratadoGeracao: 500, contratadoCarga: 300 });
    expect(d.pontos.map((p) => p.potencia)).toEqual([100, 200]);
    expect(d.referencias).toEqual({ contratado: 500, adicional: 505, percentualAdicional: 1 });
    expect(d.esperado.map((e) => e.valor)).toEqual([120, 150]);
    expect(d.pontos[0].tetoEsperado).toBe(150);
  });

  it('espelhado: geração negativa interpolada, consumo positivo, contratado da carga +5%', () => {
    const d = montarDiaEnergia({ data: '2026-10-20', geracao: ger, consumo: con, ef: seriesEfetivas(TUDO, TUDO), contratadoGeracao: null, contratadoCarga: 300 });
    expect(d.referencias).toBeUndefined();
    const em1005 = d.pontos.find((p) => p.date.getTime() === new Date(2026, 9, 20, 10, 5).getTime())!;
    expect(em1005.geracao).toBeCloseTo(-(100 + (100 * 5) / 15));
    expect(em1005.consumo).toBe(60);
    expect(em1005.valorAdicionalCarga).toBeCloseTo(315);
    expect(d.esperado[0].valor).toBe(-120);
    expect(d.pontos[0].tetoEsperado).toBe(-150);
  });

  it('geração e carga no relógio de Brasília, seja qual for o fuso do navegador', () => {
    expect(horaBrasilia('2026-10-20T06:15:00-03:00')).toBe('2026-10-20T06:15:00');
    expect(horaBrasilia('2026-10-20T13:05:00.000Z')).toBe('2026-10-20T10:05:00');
    expect(horaBrasilia(undefined)).toBeUndefined();
    const d = montarDiaEnergia({ data: '2026-10-20', geracao: ger, consumo: con, ef: seriesEfetivas(TUDO, TUDO), contratadoGeracao: null, contratadoCarga: null });
    expect(d.pontos[0].date).toEqual(new Date(2026, 9, 20, 10, 0));
    expect(d.esperado[1].date).toEqual(new Date(2026, 9, 20, 10, 15));
  });

  it('esperado no instante do tooltip, sem sinal', () => {
    const pts = [{ date: new Date(2026, 9, 20, 10, 0), valor: -120 }, { date: new Date(2026, 9, 20, 10, 15), valor: null }];
    expect(esperadoNoInstante(pts, new Date(2026, 9, 20, 10, 5))).toBe(120);
    expect(esperadoNoInstante(pts, new Date(2026, 9, 20, 10, 14))).toBeNull();
    expect(esperadoNoInstante(pts, new Date(2026, 9, 20, 11, 0))).toBeNull();
  });
});

describe('mesclarFluxo sem interpolar (Demanda de antes)', () => {
  it('segura o último valor até o próximo ponto', () => {
    const p = (min: number, potencia: number): PontoDemanda => ({ date: new Date(2026, 0, 1, 10, min), potencia });
    const r = mesclarFluxo([p(0, 100), p(15, 200)], [p(5, 50)]);
    expect(r.map((x) => x.geracao)).toEqual([-100, -100, -200]);
  });

  it('rede (medidor bidirecional) tem curva própria e não soma na geração nem no consumo', () => {
    const p = (min: number, potencia: number): PontoDemanda => ({ date: new Date(2026, 0, 1, 10, min), potencia });
    // rede = líquido exportado do A966: +120 exportando, −30 importando
    const r = mesclarFluxo([p(0, 100), p(15, 100)], [p(0, 10), p(15, 10)], undefined, { rede: [p(0, 120), p(15, -30)] });
    expect(r.map((x) => x.geracao)).toEqual([-100, -100]);
    expect(r.map((x) => x.consumo)).toEqual([10, 10]);
    expect(r.map((x) => x.rede)).toEqual([-120, 30]); // exporta para baixo, importa para cima
  });

  it('sem carga (paraCima): geração e exportação da rede para cima, importação para baixo', () => {
    const p = (min: number, potencia: number): PontoDemanda => ({ date: new Date(2026, 0, 1, 10, min), potencia, valorContratado: 295 });
    const r = mesclarFluxo([p(0, 100), p(15, 100)], [], undefined, { rede: [p(0, 120), p(15, -30)], paraCima: true });
    expect(r.map((x) => x.geracao)).toEqual([100, 100]);
    expect(r.map((x) => x.rede)).toEqual([120, -30]);
    expect(r[0].valorContratado).toBe(295);
  });

  it('série de geração com sinal: importação não vira geração', () => {
    const p = (min: number, potencia: number): PontoDemanda => ({ date: new Date(2026, 0, 1, 10, min), potencia });
    // geração = líquido exportado do A966: +120 exportando, −30 importando
    const r = mesclarFluxo([p(0, 120), p(15, -30)], [p(0, 10), p(15, 10)]);
    expect(r.map((x) => x.geracao)).toEqual([-120, -0]);
    expect(r.map((x) => x.consumo)).toEqual([10, 40]);
    expect(r.map((x) => x.potencia)).toEqual([-110, 40]);
  });
});
