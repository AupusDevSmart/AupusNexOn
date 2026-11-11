import { describe, expect, it } from 'vitest';
import {
  anguloCalibrado, azimute, corpoCalibracao, distanciaM, fmtCoordenada, grausTxt, mensagemGeo, motivosPendentes, parseCoordenada, parsePar,
  pendenciasDoPivo, pontoDe, sentidoTxt, type Precondicoes,
} from './pivoCalibracaoContas';

// NEXON-103 — números do contrato da calibração (os mesmos do pivo-calibracao.util.spec da API).

const CENTRO = { lat: -16.0, lon: -48.0 };
const PONTA = { lat: -15.997, lon: -47.997 };
const PRE_OK: Precondicoes = { parado: true, modo_ton: true, tem_modo_ton: true, pendencias: [] };
const C_TXT = { lat: '-16,0000000', lon: '-48,0000000' };
const P_TXT = { lat: '-15,9970000', lon: '-47,9970000' };

describe('azimute e distância', () => {
  it('centro −16/−48 e ponta −15,997/−47,997: 43,9° (43,87) a uns 463 m', () => {
    expect(azimute(CENTRO, PONTA)).toBeCloseTo(43.87, 1);
    expect(grausTxt(azimute(CENTRO, PONTA))).toBe('43,9°');
    expect(Math.round(distanciaM(CENTRO, PONTA))).toBeGreaterThanOrEqual(462);
    expect(Math.round(distanciaM(CENTRO, PONTA))).toBeLessThanOrEqual(464);
  });

  it('ponta a leste do centro, mesma latitude: 90,0°', () => {
    expect(grausTxt(azimute(CENTRO, { lat: -16.0, lon: -47.996 }))).toBe('90,0°');
  });

  it('norte, sul e oeste: 0°, 180° e 270°', () => {
    expect(grausTxt(azimute(CENTRO, { lat: -15.99, lon: -48 }))).toBe('0,0°');
    expect(grausTxt(azimute(CENTRO, { lat: -16.01, lon: -48 }))).toBe('180,0°');
    expect(grausTxt(azimute(CENTRO, { lat: -16, lon: -48.004 }))).toBe('270,0°');
  });

  it('o texto fica em 0 a 359,9: 359,96 vira 0,0, nunca 360,0', () => {
    expect(grausTxt(359.96)).toBe('0,0°');
    expect(grausTxt(359.94)).toBe('359,9°');
    expect(grausTxt(-9.1)).toBe('350,9°');
    expect(grausTxt(null)).toBe('—');
  });
});

describe('ângulo em operação', () => {
  const cal = (sentido: 1 | -1) => ({ az_cal: 43.9, bruto_cal: 147, sentido });
  it.each([
    [147, 43.9, 43.9],
    [200, 96.9, 350.9],
    [10, 266.9, 180.9],
  ])('az_cal 43,9 · bruto_cal 147 · resolução 360 · bruto %i: horário %f, anti-horário %f', (bruto, horario, anti) => {
    expect(anguloCalibrado(bruto, cal(1), 360)).toBeCloseTo(horario, 2);
    expect(anguloCalibrado(bruto, cal(-1), 360)).toBeCloseTo(anti, 2);
  });

  it('resolução maior: cada posição vale 360/resolução', () => {
    expect(anguloCalibrado(1024, { az_cal: 10, bruto_cal: 0, sentido: 1 }, 4096)).toBeCloseTo(100, 2);
    expect(anguloCalibrado(1024, { az_cal: 10, bruto_cal: 0, sentido: -1 }, 4096)).toBeCloseTo(280, 2);
  });

  it('sentido em texto', () => {
    expect(sentidoTxt(1)).toBe('Horário');
    expect(sentidoTxt(-1)).toBe('Anti-horário');
  });
});

describe('coordenada digitada', () => {
  it('aceita vírgula ou ponto e sinal negativo', () => {
    expect(parseCoordenada('-16,0000000', 'lat')).toBe(-16);
    expect(parseCoordenada('-15.9970000', 'lat')).toBe(-15.997);
    expect(parseCoordenada(' −47,997 ', 'lon')).toBe(-47.997);   // menos tipográfico
    expect(parseCoordenada('16', 'lat')).toBe(16);
    expect(parseCoordenada('+16,5', 'lat')).toBe(16.5);
  });

  it('recusa vazio, texto, dois separadores e fora da faixa', () => {
    expect(parseCoordenada('', 'lat')).toBeNull();
    expect(parseCoordenada('-', 'lat')).toBeNull();
    expect(parseCoordenada('abc', 'lat')).toBeNull();
    expect(parseCoordenada('1.234,5', 'lat')).toBeNull();
    expect(parseCoordenada('16°00\'', 'lat')).toBeNull();
    expect(parseCoordenada('90,1', 'lat')).toBeNull();
    expect(parseCoordenada('-180,1', 'lon')).toBeNull();
    expect(parseCoordenada('-120', 'lon')).toBe(-120);
    expect(parseCoordenada('-120', 'lat')).toBeNull();
  });

  it('par colado de uma vez (Google Maps e variações)', () => {
    expect(parsePar('-16.123456, -48.654321')).toEqual({ lat: -16.123456, lon: -48.654321 });
    expect(parsePar('-16.123456,-48.654321')).toEqual({ lat: -16.123456, lon: -48.654321 });
    expect(parsePar('-16,123456; -48,654321')).toEqual({ lat: -16.123456, lon: -48.654321 });
    expect(parsePar('−16,0000000 / −48,0000000')).toEqual({ lat: -16, lon: -48 });
    expect(parsePar('-16,5 -48,2')).toEqual({ lat: -16.5, lon: -48.2 });
    expect(parsePar('-16,123456')).toBeNull();     // um número só: cola normal
    expect(parsePar('-16.5, -48.2, 900')).toBeNull();
  });

  it('do campo para o ponto e de volta', () => {
    expect(pontoDe(C_TXT)).toEqual(CENTRO);
    expect(pontoDe({ lat: '-16', lon: '' })).toBeNull();
    expect(fmtCoordenada(-15.997)).toBe('-15,9970000');
    expect(parseCoordenada(fmtCoordenada(-47.9971234), 'lon')).toBe(-47.9971234);
  });
});

describe('motivos pendentes do Salvar calibração', () => {
  const tudoOk = { precondicoes: PRE_OK, leitura: { valor: 147 }, centro: C_TXT, ponta: P_TXT };

  it('tudo certo: nada pendente', () => {
    expect(motivosPendentes(tudoOk)).toEqual([]);
  });

  it('pré-condições: mostra os textos prontos do servidor, todos', () => {
    const pendencias = ['Pivô em movimento: a calibração só é feita com o pivô parado', 'Chave seletora em modo CLP: passe para o modo TON'];
    expect(motivosPendentes({ ...tudoOk, precondicoes: { parado: false, modo_ton: false, tem_modo_ton: true, pendencias } })).toEqual(pendencias);
  });

  it('pré-condição que falha sem texto do servidor ainda bloqueia', () => {
    expect(pendenciasDoPivo({ parado: null, modo_ton: true, tem_modo_ton: false, pendencias: [] })).toEqual(['Sem leitura do estado do pivô: não dá para saber se ele está parado']);
    expect(pendenciasDoPivo({ parado: true, modo_ton: false, tem_modo_ton: true, pendencias: [] })).toEqual(['Chave seletora em modo CLP: passe para o modo TON']);
    expect(pendenciasDoPivo(null)).toHaveLength(1);
    expect(pendenciasDoPivo(PRE_OK)).toEqual([]);
  });

  it('sem leitura válida do encoder: pede para ler; recusada ou vencida diz o porquê', () => {
    expect(motivosPendentes({ ...tudoOk, leitura: null })).toEqual(['Leia o encoder: toque em "Ler encoder" com o pivô parado']);
    expect(motivosPendentes({ ...tudoOk, leitura: null, semLeituraPorque: 'A leitura do encoder venceu (vale 10 minutos): leia de novo' }))
      .toEqual(['A leitura do encoder venceu (vale 10 minutos): leia de novo']);
  });

  it('centro e ponta: vazio, inválido e muito próximos', () => {
    expect(motivosPendentes({ ...tudoOk, centro: { lat: '', lon: '' }, ponta: { lat: '-15,997', lon: '' } })).toEqual([
      'Informe a posição do centro (latitude e longitude)', 'Informe a posição da ponta (latitude e longitude)',
    ]);
    expect(motivosPendentes({ ...tudoOk, ponta: { lat: '-95', lon: '-47,997' } })).toEqual(['Posição da ponta inválida: use graus decimais, como −16,1234567']);
    // 0,0003° de latitude ≈ 33 m
    expect(motivosPendentes({ ...tudoOk, ponta: { lat: '-15,9997', lon: '-48' } })).toEqual(['Pontos muito próximos: 33 m (mínimo 50 m)']);
  });

  it('mostra todos os motivos de uma vez, na ordem da tela', () => {
    const m = motivosPendentes({
      precondicoes: { parado: false, modo_ton: true, tem_modo_ton: true, pendencias: ['Pivô em movimento: a calibração só é feita com o pivô parado'] },
      leitura: null, centro: { lat: '', lon: '' }, ponta: { lat: 'x', lon: '1' },
    });
    expect(m).toHaveLength(4);
    expect(m[0]).toMatch(/Pivô em movimento/);
    expect(m[1]).toMatch(/Leia o encoder/);
    expect(m[2]).toMatch(/posição do centro/);
    expect(m[3]).toMatch(/Posição da ponta inválida/);
  });

  it('corpo do POST: só os seis campos, números de verdade', () => {
    expect(corpoCalibracao({ valor: 147 }, 1, C_TXT, P_TXT)).toEqual({ bruto_cal: 147, sentido: 1, centro_lat: -16, centro_lon: -48, ponta_lat: -15.997, ponta_lon: -47.997 });
    expect(corpoCalibracao(null, 1, C_TXT, P_TXT)).toBeNull();
    expect(corpoCalibracao({ valor: 147 }, -1, C_TXT, { lat: '', lon: '' })).toBeNull();
  });
});

describe('localização do aparelho', () => {
  it('negada, indisponível e demorada têm mensagem própria', () => {
    expect(mensagemGeo(1)).toMatch(/negada/);
    expect(mensagemGeo(2)).toMatch(/indisponível/);
    expect(mensagemGeo(3)).toMatch(/15 s/);
    expect(mensagemGeo(undefined)).toMatch(/digite a coordenada/);
  });
});
