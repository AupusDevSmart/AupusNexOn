import { describe, expect, it } from 'vitest';
import {
  agruparPorDia,
  chaveDia,
  chaveHoje,
  deslocarDia,
  diaCompleto,
  diaCurto,
  rotuloDia,
  semanaCurta,
} from './agrupar-por-dia';

describe('chaveDia', () => {
  it('usa o dia de Brasília, não o UTC', () => {
    // 01:30 UTC de 08/11 ainda é 22:30 de 07/11 em Brasília (UTC-3).
    expect(chaveDia('2026-11-08T01:30:00.000Z')).toBe('2026-11-07');
    expect(chaveDia('2026-11-08T03:00:00.000Z')).toBe('2026-11-08');
  });

  it('devolve vazio para data inválida', () => {
    expect(chaveDia('nada')).toBe('');
  });

  it('chaveHoje aceita o agora', () => {
    expect(chaveHoje(new Date('2026-11-07T12:00:00.000Z'))).toBe('2026-11-07');
  });
});

describe('deslocarDia / formatos', () => {
  it('anda dias cruzando mês e ano', () => {
    expect(deslocarDia('2026-11-07', -1)).toBe('2026-11-06');
    expect(deslocarDia('2026-11-01', -1)).toBe('2026-10-31');
    expect(deslocarDia('2026-12-31', 1)).toBe('2027-01-01');
    expect(deslocarDia('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('formata curto e completo', () => {
    expect(diaCurto('2026-11-07')).toBe('07/11');
    expect(diaCompleto('2026-11-07')).toBe('07/11/2026');
  });

  it('dia da semana curto, minúsculo e sem ponto', () => {
    expect(semanaCurta('2026-11-05')).toBe('qui');
    expect(semanaCurta('2026-11-08')).toBe('dom');
  });
});

describe('rotuloDia', () => {
  const hoje = '2026-11-07';
  it('Hoje, Ontem e dia da semana', () => {
    expect(rotuloDia('2026-11-07', hoje)).toBe('Hoje · 07/11');
    expect(rotuloDia('2026-11-06', hoje)).toBe('Ontem · 06/11');
    expect(rotuloDia('2026-11-05', hoje)).toBe('qui · 05/11');
  });
});

describe('agruparPorDia', () => {
  const hoje = '2026-11-07';
  const eventos = [
    { id: 'e1', em: '2026-11-07T08:12:41.000Z' },
    { id: 'e2', em: '2026-11-07T08:11:58.000Z' },
    { id: 'e3', em: '2026-11-06T22:46:03.000Z' },
    { id: 'e4', em: '2026-11-05T10:46:20.000Z' },
    { id: 'e5', em: null },
  ];

  it('agrupa na ordem de chegada com rótulo por dia', () => {
    const grupos = agruparPorDia(eventos, (e) => e.em, hoje);
    expect(grupos.map((g) => g.rotulo)).toEqual(['Hoje · 07/11', 'Ontem · 06/11', 'qui · 05/11', 'Sem data']);
    expect(grupos[0].itens.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(grupos[1].chave).toBe('2026-11-06');
    expect(grupos[3].itens[0].id).toBe('e5');
  });

  it('lista vazia vira sem grupos', () => {
    expect(agruparPorDia([], () => null, hoje)).toEqual([]);
  });
});
