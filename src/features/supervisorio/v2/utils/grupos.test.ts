import { describe, expect, it } from 'vitest';
import type { Connection, Equipment } from '../types/diagram.types';
import { caixaDe, membroMaisProximo, gruposDaConfiguracao, idNoGrupo, montarVisao, posicaoDoCard, resumoDoGrupo, statusDoGrupo, type GrupoUnifilar } from './grupos';

const eq = (id: string, x: number, y: number, tipo = 'INVERSOR', extra: Partial<Equipment> = {}): Equipment => ({
  id, nome: id, tag: id, tipo, unidadeId: 'u', diagramaId: 'd', posicaoX: x, posicaoY: y, rotacao: 0,
  labelPosition: 'top', status: 'normal', createdAt: new Date(0), updatedAt: new Date(0), deletedAt: null, ...extra,
});
const con = (id: string, o: string, d: string, po: Connection['portaOrigem'] = 'bottom', pd: Connection['portaDestino'] = 'top'): Connection => ({
  id, diagramaId: 'd', equipamentoOrigemId: o, portaOrigem: po, equipamentoDestinoId: d, portaDestino: pd,
  createdAt: new Date(0), updatedAt: new Date(0), deletedAt: null,
});

// Medidor M em cima, barramento por JP, 3 inversores embaixo (I1..I3), I1-I2 ligados entre si
const equipamentos = [
  eq('M', 10, 0, 'MEDIDOR'),
  eq('jp1', 11, 4, 'JUNCTION_POINT'),
  eq('jp2', 5, 6, 'JUNCTION_POINT'),
  eq('I1', 4, 8), eq('I2', 8, 8), eq('I3', 12, 8),
];
const conexoes = [
  con('c1', 'M', 'jp1'),
  con('c2', 'jp1', 'I3'),
  con('c3', 'jp1', 'jp2'),
  con('c4', 'jp2', 'I1'),
  con('c5', 'jp2', 'I2'),
  con('c6', 'I1', 'I2', 'right', 'left'),
];
const grupo: GrupoUnifilar = { id: 'g', nome: 'Inversores', equipamentoIds: ['I1', 'I2', 'I3', 'jp1', 'fantasma'] };

describe('montarVisao (NEXON-31)', () => {
  it('sem grupo devolve as mesmas listas', () => {
    const v = montarVisao(equipamentos, conexoes, [], new Set());
    expect(v.equipamentos).toBe(equipamentos);
    expect(v.conexoes).toBe(conexoes);
    expect(v.temGrupos).toBe(false);
  });

  it('recolhido: membros e JPs internos somem, linhas de fora chegam no bloco sem repetir', () => {
    const v = montarVisao(equipamentos, conexoes, [grupo], new Set());
    const ids = v.equipamentos.map(e => e.id).sort();
    // jp2 só liga I1/I2 → some; jp1 liga o medidor → fica
    expect(ids).toEqual(['M', 'grupo:g', 'jp1'].sort());
    expect(v.cards).toHaveLength(1);
    expect(v.cards[0].membros.map(m => m.id)).toEqual(['I1', 'I2', 'I3']); // JP nunca é membro
    const visiveis = v.conexoes.map(c => `${c.equipamentoOrigemId}>${c.equipamentoDestinoId}`);
    expect(visiveis).toEqual(['M>jp1', `jp1>${idNoGrupo('g')}`]);
  });

  it('aberto: tudo volta como era e a moldura cobre os membros', () => {
    const v = montarVisao(equipamentos, conexoes, [grupo], new Set(['g']));
    expect(v.equipamentos.map(e => e.id)).toEqual(equipamentos.map(e => e.id));
    expect(v.conexoes).toHaveLength(conexoes.length);
    expect(v.abertos[0].caixa).toEqual({ minX: 4, minY: 8, maxX: 14, maxY: 10 });
  });

  it('equipamento fica num grupo só (vale o primeiro)', () => {
    const v = montarVisao(equipamentos, conexoes, [grupo, { id: 'h', nome: 'B', equipamentoIds: ['I1'] }], new Set());
    expect(v.cards.map(c => c.grupo.id)).toEqual(['g']);
  });
});

describe('bloco do grupo', () => {
  it('fica no centro dos membros ou na posição salva', () => {
    const membros = [eq('a', 0, 0), eq('b', 10, 4)];
    expect(caixaDe(membros)).toEqual({ minX: 0, minY: 0, maxX: 12, maxY: 6 });
    expect(posicaoDoCard({ id: 'g', nome: 'x', equipamentoIds: [] }, membros)).toEqual({ x: 4, y: 2 });
    expect(posicaoDoCard({ id: 'g', nome: 'x', equipamentoIds: [], posicaoX: 1, posicaoY: 2 }, membros)).toEqual({ x: 1, y: 2 });
  });

  it('status pega o pior e o resumo conta por tipo', () => {
    const m = [eq('a', 0, 0), eq('b', 0, 0, 'INVERSOR', { status: 'alerta' }), eq('c', 0, 0, 'MEDIDOR')];
    expect(statusDoGrupo(m)).toBe('alerta');
    expect(resumoDoGrupo(m)).toEqual([{ rotulo: 'Inversor', quantidade: 2 }, { rotulo: 'Medidor', quantidade: 1 }]);
  });

  it('lê configuracoes antigas sem quebrar', () => {
    expect(gruposDaConfiguracao(undefined)).toEqual([]);
    expect(gruposDaConfiguracao({ grupos: [{ id: 'g', nome: 'a', equipamentoIds: [' e1 '] }, null] })).toEqual([
      { id: 'g', nome: 'a', equipamentoIds: ['e1'] },
    ]);
  });
});

describe('interligar grupo', () => {
  it('linha do bloco vai para o membro mais perto da outra ponta', () => {
    const membros = [eq('a', 0, 0), eq('b', 10, 0), eq('c', 20, 0)];
    expect(membroMaisProximo(membros, { x: 19, y: 5 })?.id).toBe('c');
    expect(membroMaisProximo(membros, { x: 0, y: -5 })?.id).toBe('a');
    expect(membroMaisProximo([], { x: 0, y: 0 })).toBeNull();
  });
});
