import { describe, expect, it } from 'vitest';
import {
  dataCurta, dataHora, dataLonga, desvio, duracaoLonga, duracaoMin, energia, juntarE, mesAbrev, mesDe, mesExtenso, nf,
  nfAuto, nfOu, partes, slug, somarMes, tetoRedondo, variacao,
} from './formatos';

describe('formatos pt-BR', () => {
  it('nf usa milhar com ponto e decimal com vírgula', () => {
    expect(nf(121460)).toBe('121.460');
    expect(nf(3.97142, 2)).toBe('3,97');
    expect(nf(40.24, 1)).toBe('40,2');
    expect(nfOu(null)).toBe('—');
    expect(nfOu(Number.NaN, 1)).toBe('—');
    expect(nfAuto(22)).toBe('22');
    expect(nfAuto(7.4)).toBe('7,4');
  });

  it('energia vira MWh a partir de 10.000 kWh', () => {
    expect(energia(9999)).toEqual({ valor: '9.999', unidade: 'kWh' });
    expect(energia(10000)).toEqual({ valor: '10,0', unidade: 'MWh' });
    expect(energia(214200)).toEqual({ valor: '214,2', unidade: 'MWh' });
  });

  it('variação e desvio usam sinal tipográfico', () => {
    expect(variacao(214200, 201700)).toBe('+6,2%');
    expect(variacao(290400, 305050)).toBe('−4,8%');
    expect(variacao(1, 0)).toBeNull();
    expect(desvio(-15.81)).toBe('−15,8%');
    expect(desvio(0.01)).toBe('0,0%');
  });

  it('durações', () => {
    expect(duracaoMin(160)).toBe('2 h 40');
    expect(duracaoMin(45)).toBe('0 h 45');
    expect(duracaoMin(180)).toBe('3 h 00');
    expect(duracaoMin(775)).toBe('12 h 55');
    const h = 3_600_000;
    expect(duracaoLonga(2 * 24 * h + 3 * h + 38 * 60_000)).toBe('2 d 3 h');
    expect(duracaoLonga(19 * h + 20 * 60_000)).toBe('19 h 20');
  });

  it('datas no horário de Brasília', () => {
    const iso = '2026-10-11T07:02:00-03:00';
    expect(dataCurta(iso)).toBe('11/10');
    expect(dataHora(iso)).toBe('11/10 07:02');
    expect(dataLonga('2026-11-01T08:00:00-03:00')).toBe('01/11/2026');
    // UTC 02:30 do dia 1º ainda é dia 31 em Brasília.
    expect(dataHora('2026-11-01T02:30:00Z')).toBe('31/10 23:30');
    expect(partes('2026-10-20').semana).toBe(2); // terça
  });

  it('meses', () => {
    expect(mesExtenso('2026-10')).toBe('Outubro de 2026');
    expect(mesAbrev('2026-07')).toBe('jul');
    expect(somarMes('2026-01', -1)).toBe('2025-12');
    expect(somarMes('2026-12', 1)).toBe('2027-01');
    expect(mesDe(new Date('2026-10-20T12:00:00-03:00'))).toBe('2026-10');
  });

  it('auxiliares', () => {
    expect(juntarE(['a', 'b', 'c'])).toBe('a, b e c');
    expect(juntarE(['a'])).toBe('a');
    expect(slug('Fazenda Pontal · Sede Ção')).toBe('fazenda-pontal-sede-cao');
    expect(tetoRedondo(1543.5)).toBe(1600);
    expect(tetoRedondo(8400)).toBe(10000);
    expect(tetoRedondo(1176)).toBe(1200);
  });
});
