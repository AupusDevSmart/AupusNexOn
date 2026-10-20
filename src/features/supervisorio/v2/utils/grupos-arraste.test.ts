/**
 * Arraste dos grupos (NEXON-31) de ponta a ponta sem navegador: monta a tela como
 * o DiagramV2 monta, converte o mouse como o DiagramViewport converte e confere
 * no store onde tudo foi parar.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagramStore } from '../hooks/useDiagramStore';
import type { Equipment } from '../types/diagram.types';
import { caixaDaMoldura, idNoGrupo, montarVisao, posicaoRealDoArraste, TAMANHO_CARD, type GrupoUnifilar } from './grupos';

const eq = (id: string, x: number, y: number): Equipment => ({
  id, nome: id, tag: id, tipo: 'INVERSOR', unidadeId: 'u', diagramaId: 'd', posicaoX: x, posicaoY: y, rotacao: 0,
  labelPosition: 'top', status: 'normal', createdAt: new Date(0), updatedAt: new Date(0), deletedAt: null,
});
const linha = (pref: string, y: number, n: number) => Array.from({ length: n }, (_, i) => eq(`${pref}${i}`, i * 3, y));

// Como na Pontal: fileiras intercaladas — o centro de B cai dentro da moldura de A aberto
const A = linha('A', 0, 8);
const B = [eq('B0', 9, 3), eq('B1', 12, 3)];
const grupos: GrupoUnifilar[] = [
  { id: 'a', nome: 'A', equipamentoIds: A.map(e => e.id) },
  { id: 'b', nome: 'B', equipamentoIds: B.map(e => e.id) },
];

const tela = () => {
  const st = useDiagramStore.getState();
  return montarVisao(st.equipamentos, st.conexoes, st.grupos, new Set(st.gruposAbertos));
};

/** Faz o que o DiagramV2 (useEffect) e o DiagramViewport (mousemove) fazem. */
const arrastar = (noId: string, telaX: number, telaY: number) => {
  const v = tela();
  useDiagramStore.setState({ deslocamentoVisual: v.deslocamentoDoEquipamento });
  const st = useDiagramStore.getState();
  st.startDraggingEquipamento(noId, { x: 0, y: 0 });
  const real = posicaoRealDoArraste(noId, telaX, telaY, useDiagramStore.getState().deslocamentoVisual);
  const gid = noId.replace('grupo:', '');
  useDiagramStore.getState().moverCardGrupo(gid, real.x, real.y);
  useDiagramStore.getState().endDraggingEquipamento();
};

beforeEach(() => {
  useDiagramStore.setState({
    equipamentos: [...A, ...B],
    conexoes: [],
    grupos,
    gruposAbertos: [],
    deslocamentoVisual: new Map(),
    isDirty: false,
  });
});

describe('bloco recolhido com grupo aberto em cima', () => {
  it('desliza para fora da moldura e continua no lugar real salvo', () => {
    useDiagramStore.setState({ gruposAbertos: ['a'] });
    const v = tela();
    const moldura = caixaDaMoldura(v.abertos[0].caixa);
    const card = v.cards.find(c => c.grupo.id === 'b')!.no;
    const caixaCard = { minX: card.posicaoX, minY: card.posicaoY, maxX: card.posicaoX + TAMANHO_CARD.width, maxY: card.posicaoY + TAMANHO_CARD.height };
    const sobrepoe = caixaCard.minX < moldura.maxX && caixaCard.maxX > moldura.minX && caixaCard.minY < moldura.maxY && caixaCard.maxY > moldura.minY;
    expect(sobrepoe).toBe(false);
    expect(v.deslocamentoDoEquipamento.get(idNoGrupo('b'))).toBeDefined();
    // nada salvo mudou
    expect(useDiagramStore.getState().equipamentos.find(e => e.id === 'B0')!.posicaoY).toBe(3);
  });

  it('arrastar o bloco deslocado leva para onde o mouse soltou (sem pulo)', () => {
    useDiagramStore.setState({ gruposAbertos: ['a'] });
    arrastar(idNoGrupo('b'), 30, 20); // solta com o canto do bloco em (30, 20) na tela
    // longe da moldura: aparece exatamente onde soltou, ainda com A aberto
    const naTela = tela().cards.find(c => c.grupo.id === 'b')!.no;
    expect([naTela.posicaoX, naTela.posicaoY]).toEqual([30, 20]);
    useDiagramStore.setState({ gruposAbertos: [] }); // fecha A: bloco B sem deslocamento
    const card = tela().cards.find(c => c.grupo.id === 'b')!.no;
    expect([card.posicaoX, card.posicaoY]).toEqual([30, 20]);
    expect(useDiagramStore.getState().isDirty).toBe(true);
  });

  it('sem grupo aberto o bloco vai exatamente onde soltar', () => {
    arrastar(idNoGrupo('b'), -10, 40);
    const card = tela().cards.find(c => c.grupo.id === 'b')!.no;
    expect([card.posicaoX, card.posicaoY]).toEqual([-10, 40]);
    // os membros foram junto, mantendo o espaçamento
    const bs = useDiagramStore.getState().equipamentos.filter(e => e.id.startsWith('B')).map(e => e.posicaoX);
    expect(bs[1] - bs[0]).toBe(3);
  });
});

describe('grupo aberto arrastado pelo nome', () => {
  it('move o grupo inteiro para onde soltar', () => {
    useDiagramStore.setState({ gruposAbertos: ['a', 'b'] });
    const antes = tela().abertos.find(a => a.grupo.id === 'b')!.caixa;
    // pega o "bloco" de B como aparece na tela e anda +5,+7
    const membrosNaTela = tela().abertos.find(a => a.grupo.id === 'b')!.membros;
    const cx = Math.round((Math.min(...membrosNaTela.map(m => m.posicaoX)) + Math.max(...membrosNaTela.map(m => m.posicaoX)) + 2) / 2 - 2);
    const cy = Math.round((membrosNaTela[0].posicaoY * 2 + 2) / 2 - 1);
    // congela como o DiagramV2 faz durante o arraste
    const v0 = tela();
    useDiagramStore.setState({ deslocamentoVisual: v0.deslocamentoDoEquipamento });
    const real = posicaoRealDoArraste(idNoGrupo('b'), cx + 5, cy + 7, v0.deslocamentoDoEquipamento);
    useDiagramStore.getState().moverCardGrupo('b', real.x, real.y);
    const st = useDiagramStore.getState();
    const depois = montarVisao(st.equipamentos, st.conexoes, st.grupos, new Set(st.gruposAbertos), { deslocamentos: v0.deslocamentos })
      .abertos.find(a => a.grupo.id === 'b')!.caixa;
    expect(depois.minX - antes.minX).toBe(5);
    expect(depois.minY - antes.minY).toBe(7);
  });
});

describe('clique sem arrastar', () => {
  it('bloco afastado não muda de lugar real ao só clicar', () => {
    useDiagramStore.setState({ gruposAbertos: ['a'] });
    const v = tela();
    useDiagramStore.setState({ deslocamentoVisual: v.deslocamentoDoEquipamento });
    const antes = useDiagramStore.getState().equipamentos.map(e => [e.posicaoX, e.posicaoY]);
    useDiagramStore.getState().startDraggingEquipamento(idNoGrupo('b'), { x: 0, y: 0 });
    useDiagramStore.getState().endDraggingEquipamento();
    expect(useDiagramStore.getState().equipamentos.map(e => [e.posicaoX, e.posicaoY])).toEqual(antes);
  });
});
