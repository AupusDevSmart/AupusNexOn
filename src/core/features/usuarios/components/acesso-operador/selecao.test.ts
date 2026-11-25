import { describe, expect, it } from 'vitest';
import {
  type EquipamentoArvore,
  type PlantaArvore,
  type Selecao,
  type UnidadeArvore,
  alternarCategoria,
  alternarEquipamento,
  alternarInstalacao,
  alternarPlantas,
  gravacoesDe,
  recortar,
  selecaoInicialGrupos,
  estadoPlantas,
  limparPlantas,
  marcarPlantas,
  categoriaDe,
  chipsDe,
  dataBr,
  definirVerGeracao,
  definirVerRs,
  estadoInstalacao,
  filtrarUnidades,
  payloadDe,
  resumoDe,
  revisar,
  selecaoInicial,
} from './selecao';

const eq = (id: string, tipo_codigo: string | null, extra: Partial<EquipamentoArvore> = {}): EquipamentoArvore => ({
  id,
  nome: extra.nome ?? id,
  tipo_codigo,
  tipo_nome: extra.tipo_nome ?? null,
  liberado: false,
  ver_rs: false,
  aceita_ver_rs: tipo_codigo === 'PIVO' || tipo_codigo === 'CARREGADOR_ELETRICO',
  novo: false,
  ...extra,
});

const usina: UnidadeArvore = {
  id: 'U1',
  nome: 'Usina Sol',
  tipo_unidade: 'UFV',
  tem_usina: true,
  ver_geracao: false,
  equipamentos: [eq('inv1', 'INVERSOR'), eq('inv2', 'INVERSOR'), eq('med1', 'METER_M160')],
};
const fazenda: UnidadeArvore = {
  id: 'U2',
  nome: 'Fazenda Norte',
  tipo_unidade: 'CARGA',
  tem_usina: false,
  ver_geracao: false,
  equipamentos: [
    eq('piv1', 'PIVO', { nome: 'Pivô Açude' }),
    eq('piv2', 'PIVO', { nome: 'Pivô 2' }),
    eq('dj1', 'DISJUNTOR'),
    eq('x1', 'SENSOR', { tipo_nome: 'Sensor de nível' }),
  ],
};
const plantas: PlantaArvore[] = [{ id: 'P1', nome: 'Planta', unidades: [usina, fazenda] }];
const vazia: Selecao = { equipamentos: {}, geracao: [], validade: null };

describe('categoriaDe', () => {
  it('agrupa pelos códigos da spec e cai no nome do tipo', () => {
    expect(categoriaDe({ tipo_codigo: 'PIVO', tipo_nome: 'x' }).rotulo).toBe('Pivôs');
    expect(categoriaDe({ tipo_codigo: 'EQTL_X', tipo_nome: null }).rotulo).toBe('Medidores');
    expect(categoriaDe({ tipo_codigo: 'MEDIDOR_Y', tipo_nome: null }).rotulo).toBe('Medidores');
    expect(categoriaDe({ tipo_codigo: 'METER_M160', tipo_nome: null }).rotulo).toBe('Medidores');
    expect(categoriaDe({ tipo_codigo: 'CARREGADOR_ELETRICO', tipo_nome: null }).rotulo).toBe('Carregadores');
    expect(categoriaDe({ tipo_codigo: 'SENSOR', tipo_nome: 'Sensor de nível' }).rotulo).toBe('Sensor de nível');
    expect(categoriaDe({ tipo_codigo: null, tipo_nome: null }).rotulo).toBe('Outros');
  });
});

describe('chips', () => {
  it('conta por tipo na ordem fixa, usinas por instalação', () => {
    const chips = chipsDe(plantas, vazia);
    expect(chips.map((c) => `${c.rotulo}:${c.total}`)).toEqual([
      'Pivôs:2',
      'Usinas:1',
      'Disjuntores:1',
      'Medidores:1',
      'Sensor de nível:1',
    ]);
    expect(chips.every((c) => c.estado === 'nenhum')).toBe(true);
  });

  it('tocar marca todos do tipo; tocar de novo desmarca', () => {
    const s1 = alternarCategoria(plantas, vazia, 'pivos');
    expect(Object.keys(s1.equipamentos).sort()).toEqual(['piv1', 'piv2']);
    expect(chipsDe(plantas, s1).find((c) => c.chave === 'pivos')?.estado).toBe('todos');
    const s2 = alternarCategoria(plantas, s1, 'pivos');
    expect(s2.equipamentos).toEqual({});
  });

  it('chip parcial vira todos', () => {
    const s1 = alternarEquipamento(fazenda, fazenda.equipamentos[0], vazia);
    expect(chipsDe(plantas, s1).find((c) => c.chave === 'pivos')?.estado).toBe('alguns');
    const s2 = alternarCategoria(plantas, s1, 'pivos');
    expect(Object.keys(s2.equipamentos).sort()).toEqual(['piv1', 'piv2']);
  });

  it('chip Usinas marca os inversores e, ao desmarcar, tira a geração', () => {
    const s1 = alternarCategoria(plantas, vazia, 'usinas');
    expect(Object.keys(s1.equipamentos).sort()).toEqual(['inv1', 'inv2']);
    const s2 = definirVerGeracao(usina, true, s1);
    expect(s2.geracao).toEqual(['U1']);
    const s3 = alternarCategoria(plantas, s2, 'usinas');
    expect(s3.equipamentos).toEqual({});
    expect(s3.geracao).toEqual([]);
  });
});

describe('instalação tri-state', () => {
  it('nenhum → todos → nenhum, com contagem', () => {
    expect(estadoInstalacao(usina, vazia)).toEqual({ estado: 'nenhum', marcados: 0, total: 3 });
    const s1 = alternarEquipamento(usina, usina.equipamentos[0], vazia);
    expect(estadoInstalacao(usina, s1)).toEqual({ estado: 'alguns', marcados: 1, total: 3 });
    const s2 = alternarInstalacao(usina, s1);
    expect(estadoInstalacao(usina, s2).estado).toBe('todos');
    const s3 = alternarInstalacao(usina, definirVerGeracao(usina, true, s2));
    expect(estadoInstalacao(usina, s3).estado).toBe('nenhum');
    expect(s3.geracao).toEqual([]);
  });

  it('marcar instalação preserva o Ver R$ de quem já estava marcado', () => {
    let s = alternarEquipamento(fazenda, fazenda.equipamentos[0], vazia);
    s = definirVerRs(fazenda.equipamentos[0], true, s);
    s = alternarInstalacao(fazenda, s);
    expect(s.equipamentos.piv1).toBe(true);
    expect(s.equipamentos.piv2).toBe(false);
  });
});

describe('Ver geração', () => {
  it('ligar marca todos os inversores; desmarcar um inversor desliga', () => {
    const s1 = definirVerGeracao(usina, true, vazia);
    expect(s1.geracao).toEqual(['U1']);
    expect(Object.keys(s1.equipamentos).sort()).toEqual(['inv1', 'inv2']);
    const s2 = alternarEquipamento(usina, usina.equipamentos[1], s1);
    expect(s2.geracao).toEqual([]);
    expect(Object.keys(s2.equipamentos)).toEqual(['inv1']);
  });

  it('desmarcar o medidor não mexe na geração', () => {
    let s = definirVerGeracao(usina, true, vazia);
    s = alternarEquipamento(usina, usina.equipamentos[2], s);
    s = alternarEquipamento(usina, usina.equipamentos[2], s);
    expect(s.geracao).toEqual(['U1']);
  });

  it('desligar só tira a geração e mantém os inversores', () => {
    const s = definirVerGeracao(usina, false, definirVerGeracao(usina, true, vazia));
    expect(s.geracao).toEqual([]);
    expect(Object.keys(s.equipamentos).length).toBe(2);
  });

  it('instalação sem usina ignora', () => {
    expect(definirVerGeracao(fazenda, true, vazia)).toBe(vazia);
  });
});

describe('Ver R$', () => {
  it('só em equipamento marcado que aceita', () => {
    expect(definirVerRs(fazenda.equipamentos[0], true, vazia)).toBe(vazia);
    const marcado = alternarEquipamento(fazenda, fazenda.equipamentos[2], vazia);
    expect(definirVerRs(fazenda.equipamentos[2], true, marcado)).toBe(marcado); // disjuntor
    const piv = alternarEquipamento(fazenda, fazenda.equipamentos[0], vazia);
    expect(definirVerRs(fazenda.equipamentos[0], true, piv).equipamentos.piv1).toBe(true);
  });

  it('desmarcar o equipamento leva o Ver R$ junto', () => {
    let s = alternarEquipamento(fazenda, fazenda.equipamentos[0], vazia);
    s = definirVerRs(fazenda.equipamentos[0], true, s);
    s = alternarEquipamento(fazenda, fazenda.equipamentos[0], s);
    s = alternarEquipamento(fazenda, fazenda.equipamentos[0], s);
    expect(s.equipamentos.piv1).toBe(false);
  });
});

describe('estado inicial, busca, resumo', () => {
  it('lê liberado / ver_rs / ver_geracao / validade da árvore', () => {
    const arv: PlantaArvore[] = [
      {
        id: 'P1',
        nome: 'P',
        unidades: [
          { ...usina, ver_geracao: true, equipamentos: usina.equipamentos.map((e) => ({ ...e, liberado: e.tipo_codigo === 'INVERSOR' })) },
          { ...fazenda, equipamentos: [{ ...fazenda.equipamentos[0], liberado: true, ver_rs: true }] },
        ],
      },
    ];
    const s = selecaoInicial({ plantas: arv, vinculo: { id: 'V', validade: '2026-12-31' } });
    expect(s).toEqual({ equipamentos: { inv1: false, inv2: false, piv1: true }, geracao: ['U1'], validade: '2026-12-31' });
  });

  it('busca sem acento: instalação inteira quando o nome dela casa', () => {
    expect(filtrarUnidades([usina, fazenda], 'sol').map((u) => u.equipamentos.length)).toEqual([3]);
    const r = filtrarUnidades([usina, fazenda], 'acude');
    expect(r).toHaveLength(1);
    expect(r[0].equipamentos.map((e) => e.id)).toEqual(['piv1']);
    expect(filtrarUnidades([usina, fazenda], '  ')).toHaveLength(2);
  });

  it('resumo no formato do backend', () => {
    expect(resumoDe(plantas, vazia)).toBe('nenhum equipamento');
    let s = definirVerGeracao(usina, true, vazia);
    s = alternarCategoria(plantas, s, 'pivos');
    s = alternarEquipamento(fazenda, fazenda.equipamentos[3], s);
    expect(resumoDe(plantas, s)).toBe('1 usina · 2 inversores · 2 pivôs · 1 outro equipamento');
  });
});

describe('revisão e payload', () => {
  it('lista o que entra, sai, R$, geração e validade', () => {
    const antes: Selecao = { equipamentos: { piv1: false, dj1: false }, geracao: [], validade: null };
    let depois = alternarEquipamento(fazenda, fazenda.equipamentos[2], antes); // sai dj1
    depois = definirVerRs(fazenda.equipamentos[0], true, depois);
    depois = definirVerGeracao(usina, true, depois);
    depois = { ...depois, validade: '2027-01-31' };
    const r = revisar(plantas, antes, depois);
    expect(r.entram.sort()).toEqual(['inv1', 'inv2']);
    expect(r.saem).toEqual(['dj1']);
    expect(r.verRsLigado).toEqual(['Pivô Açude']);
    expect(r.geracaoLigada).toEqual(['Usina Sol']);
    expect(r.validade).toEqual({ de: null, para: '2027-01-31' });
    expect(r.mudou).toBe(true);
    expect(r.removeTudo).toBe(false);
  });

  it('sem mudança e remoção total', () => {
    const s: Selecao = { equipamentos: { piv1: true }, geracao: [], validade: null };
    expect(revisar(plantas, s, s).mudou).toBe(false);
    const r = revisar(plantas, s, vazia);
    expect(r.saem).toEqual(['Pivô Açude']);
    expect(r.removeTudo).toBe(true);
  });

  it('payload do PUT', () => {
    const s: Selecao = { equipamentos: { piv1: true, inv1: false }, geracao: ['U1'], validade: '' };
    expect(payloadDe('PROP', s)).toEqual({
      proprietarioId: 'PROP',
      validade: null,
      equipamentos: [
        { id: 'piv1', verRs: true },
        { id: 'inv1', verRs: false },
      ],
      unidadesGeracao: ['U1'],
    });
  });

  it('dataBr', () => {
    expect(dataBr('2026-12-31')).toBe('31/12/2026');
    expect(dataBr(null)).toBe('');
  });
});

describe('planta e tudo (NEXON-143)', () => {
  const outra: PlantaArvore = {
    id: 'P2',
    nome: 'Outra',
    unidades: [{ id: 'U3', nome: 'Sítio', tipo_unidade: 'CARGA', tem_usina: false, ver_geracao: false, equipamentos: [eq('c1', 'CARREGADOR_ELETRICO')] }],
  };
  const duas = [...plantas, outra];

  it('marcar a planta marca todos os equipamentos dela e só dela', () => {
    const s = alternarPlantas(plantas, vazia);
    expect(Object.keys(s.equipamentos).sort()).toEqual(['dj1', 'inv1', 'inv2', 'med1', 'piv1', 'piv2', 'x1']);
    expect(estadoPlantas(plantas, s)).toEqual({ estado: 'todos', marcados: 7, total: 7 });
    expect(estadoPlantas([outra], s).estado).toBe('nenhum');
    expect(estadoPlantas(duas, s).estado).toBe('alguns');
  });

  it('alguns → marca o resto mantendo o Ver R$ já ligado', () => {
    const s0: Selecao = { equipamentos: { piv1: true }, geracao: [], validade: null };
    const s = alternarPlantas(plantas, s0);
    expect(s.equipamentos.piv1).toBe(true);
    expect(s.equipamentos.piv2).toBe(false);
  });

  it('todos → limpa a planta, inclusive o Ver geração, sem tocar na outra', () => {
    const s0 = { ...marcarPlantas(duas, vazia), geracao: ['U1'] };
    const s = alternarPlantas(plantas, s0);
    expect(Object.keys(s.equipamentos)).toEqual(['c1']);
    expect(s.geracao).toEqual([]);
  });

  it('limpar tudo zera a seleção mas guarda a validade', () => {
    const s0 = { ...marcarPlantas(duas, vazia), geracao: ['U1'], validade: '2026-12-31' };
    expect(limparPlantas(duas, s0)).toEqual({ equipamentos: {}, geracao: [], validade: '2026-12-31' });
  });
});

describe('vários proprietários (NEXON-143)', () => {
  const pB: PlantaArvore = {
    id: 'PB',
    nome: 'Planta B',
    unidades: [{ id: 'UB', nome: 'Sítio B', tipo_unidade: 'CARGA', tem_usina: false, ver_geracao: false, equipamentos: [eq('b1', 'PIVO', { liberado: true })] }],
  };
  const grupos = [
    { proprietario: { id: 'A', nome: 'Ana' }, vinculo: null, plantas },
    { proprietario: { id: 'B', nome: 'Beto' }, vinculo: { id: 'V', validade: '2027-01-31' }, plantas: [pB] },
  ];

  it('inicial junta os grupos e pega a validade do vínculo', () => {
    const s0 = selecaoInicialGrupos(grupos);
    expect(Object.keys(s0.equipamentos)).toEqual(['b1']);
    expect(s0.validade).toBe('2027-01-31');
  });

  it('recorta a seleção pelas plantas do dono', () => {
    const s = { equipamentos: { b1: true, piv1: false }, geracao: ['U1'], validade: null };
    expect(recortar([pB], s)).toEqual({ equipamentos: { b1: true }, geracao: [], validade: null });
  });

  it('um PUT por dono que mudou; dono sem vínculo e sem marcação fica de fora', () => {
    const s0 = selecaoInicialGrupos(grupos);
    expect(gravacoesDe(grupos, s0, s0)).toEqual([]);
    const s1 = { ...s0, equipamentos: { ...s0.equipamentos, piv1: false } };
    const g1 = gravacoesDe(grupos, s0, s1);
    expect(g1.map((g) => g.grupo.proprietario.id)).toEqual(['A']);
    expect(g1[0].payload.equipamentos).toEqual([{ id: 'piv1', verRs: false }]);
    const s2 = { ...s0, equipamentos: {} };
    const g2 = gravacoesDe(grupos, s0, s2);
    expect(g2.map((g) => [g.grupo.proprietario.id, g.remove])).toEqual([['B', true]]);
  });

  it('validade de um dono não vai para outro; mexer no campo vale para todos os salvos', () => {
    const s0 = selecaoInicialGrupos(grupos);
    const s1 = { ...s0, equipamentos: { ...s0.equipamentos, piv1: false } };
    expect(gravacoesDe(grupos, s0, s1)[0].payload.validade).toBeNull();
    const s2 = { ...s1, validade: '2027-06-30' };
    expect(gravacoesDe(grupos, s0, s2).map((g) => [g.grupo.proprietario.id, g.payload.validade])).toEqual([
      ['A', '2027-06-30'],
      ['B', '2027-06-30'],
    ]);
  });
});
