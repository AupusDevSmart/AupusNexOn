/**
 * AGRUPAMENTOS DO UNIFILAR (NEXON-31)
 *
 * Um grupo junta vários equipamentos sob um nome. Recolhido, vira um único bloco
 * (nó sintético `grupo:<id>`) e as linhas que chegavam nos membros passam a chegar
 * no bloco; aberto, os membros aparecem nas posições deles com uma moldura.
 *
 * Gravado em `diagramas_unitarios.configuracoes.grupos` (vai no PUT /layout).
 * Pontos de junção nunca são membros gravados (o id deles muda a cada carga):
 * o JP que só liga membros do grupo é escondido junto com o grupo.
 */

import type { Connection, Equipment, Grupo } from '../types/diagram.types';
import { getEquipmentSizeInPixels, GRID } from './diagramConstants';

export type GrupoUnifilar = Grupo;

export const TIPO_GRUPO = 'GRUPO_UNIFILAR';

/** Paleta dos grupos: verde da marca primeiro, depois tons que se distinguem no claro e no escuro. */
export const CORES_GRUPO = ['#70C04B', '#3B82F6', '#F59E0B', '#A855F7', '#EF4444', '#14B8A6', '#EC4899', '#64748B'] as const;
export const PREFIXO_GRUPO = 'grupo:';
/** Bloco recolhido em unidades de grid (precisa bater com EQUIPMENT_SIZES.GRUPO_UNIFILAR). */
export const TAMANHO_CARD = { width: 4, height: 2 } as const;

export const idNoGrupo = (grupoId: string) => `${PREFIXO_GRUPO}${grupoId}`;
export const grupoIdDoNo = (noId: string) => (noId.startsWith(PREFIXO_GRUPO) ? noId.slice(PREFIXO_GRUPO.length) : null);

const ehJunction = (eq: Equipment) => eq.tipo === 'JUNCTION_POINT';

export interface Caixa {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Caixa (em grid) que envolve os equipamentos, usando o tamanho real de cada tipo. */
export function caixaDe(equipamentos: Equipment[]): Caixa | null {
  if (equipamentos.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const eq of equipamentos) {
    const size = getEquipmentSizeInPixels(eq.tipo);
    const w = size.width / GRID.SIZE;
    const h = size.height / GRID.SIZE;
    minX = Math.min(minX, eq.posicaoX);
    minY = Math.min(minY, eq.posicaoY);
    maxX = Math.max(maxX, eq.posicaoX + w);
    maxY = Math.max(maxY, eq.posicaoY + h);
  }
  return { minX, minY, maxX, maxY };
}

/** Onde o bloco recolhido fica: posição salva ou o centro dos membros. */
export function posicaoDoCard(grupo: GrupoUnifilar, membros: Equipment[]): { x: number; y: number } {
  if (Number.isFinite(grupo.posicaoX) && Number.isFinite(grupo.posicaoY)) {
    return { x: grupo.posicaoX as number, y: grupo.posicaoY as number };
  }
  const c = caixaDe(membros);
  if (!c) return { x: 0, y: 0 };
  return {
    x: Math.round((c.minX + c.maxX) / 2 - TAMANHO_CARD.width / 2),
    y: Math.round((c.minY + c.maxY) / 2 - TAMANHO_CARD.height / 2),
  };
}

/** Status mais grave entre os membros (falha > alerta > normal). */
export function statusDoGrupo(membros: Equipment[]): Equipment['status'] {
  if (membros.some(m => m.status === 'falha')) return 'falha';
  if (membros.some(m => m.status === 'alerta')) return 'alerta';
  if (membros.length && membros.every(m => m.status === 'desconhecido')) return 'desconhecido';
  return 'normal';
}

/** "10 Inversores · 2 Medidores" — o que tem dentro, pelo tipo/categoria. */
export function resumoDoGrupo(membros: Equipment[]): { rotulo: string; quantidade: number }[] {
  const cont = new Map<string, number>();
  for (const m of membros) {
    const r = rotuloTipo(m);
    cont.set(r, (cont.get(r) ?? 0) + 1);
  }
  return [...cont.entries()]
    .map(([rotulo, quantidade]) => ({ rotulo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function rotuloTipo(eq: Equipment): string {
  const t = `${eq.categoria ?? ''} ${eq.tipo ?? ''}`.toUpperCase();
  if (t.includes('INVERSOR')) return 'Inversor';
  if (t.includes('MEDIDOR') || t.includes('SSU') || t.includes('METER')) return 'Medidor';
  if (t.includes('DISJUNTOR')) return 'Disjuntor';
  if (t.includes('TRANSFORM') || t.includes('TRAFO')) return 'Transformador';
  if (t.includes('CHAVE') || t.includes('SECCIONADORA')) return 'Chave';
  if (t.includes('PIVO')) return 'Pivô';
  if (t.includes('MOTOR') || t.includes('BOMBA')) return 'Motor';
  if (t.includes('STRING') || t.includes('PAINEL') || t.includes('MODULO')) return 'Painel';
  return 'Equipamento';
}

export interface CardDeGrupo {
  grupo: GrupoUnifilar;
  no: Equipment;
  membros: Equipment[];
}

export interface GrupoAberto {
  grupo: GrupoUnifilar;
  membros: Equipment[];
  caixa: Caixa;
}

export interface VisaoUnifilar {
  /** O que vai para o roteamento: equipamentos visíveis + nós sintéticos dos grupos recolhidos. */
  equipamentos: Equipment[];
  conexoes: Connection[];
  cards: CardDeGrupo[];
  abertos: GrupoAberto[];
  /** id do equipamento → id do grupo (só membros válidos). */
  grupoDoEquipamento: Map<string, string>;
  /** grupo recolhido → ids escondidos nele (membros + JPs que são galho dele). */
  escondidosPorGrupo: Map<string, string[]>;
  /**
   * Grupos abertos se afastam SÓ NA TELA para não ficarem um por cima do outro:
   * quanto cada um andou (grid). O desenho salvo não muda.
   */
  deslocamentos: Map<string, Deslocamento>;
  /** id do equipamento → quanto ele está deslocado na tela (membros e JPs de grupo aberto). */
  deslocamentoDoEquipamento: Map<string, Deslocamento>;
  temGrupos: boolean;
}

export interface Deslocamento {
  dx: number;
  dy: number;
}

export interface OpcoesVisao {
  /** Reusa deslocamentos já calculados (durante um arraste, para nada pular). */
  deslocamentos?: ReadonlyMap<string, Deslocamento>;
}

/**
 * Monta o que aparece na tela a partir do layout real e de quais grupos estão
 * abertos. Sem grupos devolve as mesmas listas (mesma referência).
 */
export function montarVisao(
  equipamentos: Equipment[],
  conexoes: Connection[],
  grupos: GrupoUnifilar[],
  abertos: ReadonlySet<string>,
  opcoes: OpcoesVisao = {},
): VisaoUnifilar {
  const porId = new Map(equipamentos.map(e => [e.id, e]));
  const grupoDoEquipamento = new Map<string, string>();
  const membrosPorGrupo = new Map<string, Equipment[]>();

  for (const g of grupos) {
    const membros: Equipment[] = [];
    for (const id of g.equipamentoIds) {
      const eq = porId.get(id);
      if (!eq || ehJunction(eq) || grupoDoEquipamento.has(id)) continue;
      grupoDoEquipamento.set(id, g.id);
      membros.push(eq);
    }
    if (membros.length) membrosPorGrupo.set(g.id, membros);
  }

  const gruposValidos = grupos.filter(g => membrosPorGrupo.has(g.id));
  if (gruposValidos.length === 0) {
    return {
      equipamentos,
      conexoes,
      cards: [],
      abertos: [],
      grupoDoEquipamento,
      escondidosPorGrupo: new Map(),
      deslocamentos: new Map(),
      deslocamentoDoEquipamento: new Map(),
      temGrupos: false,
    };
  }

  // Dono de cada equipamento (aberto ou recolhido): membros + JPs que são galho do grupo
  const dono = new Map<string, string>();
  for (const g of gruposValidos) {
    for (const m of membrosPorGrupo.get(g.id)!) dono.set(m.id, g.id);
  }

  const vizinhos = new Map<string, Set<string>>();
  for (const c of conexoes) {
    const o = c.equipamentoOrigemId?.trim();
    const d = c.equipamentoDestinoId?.trim();
    if (!o || !d) continue;
    if (!vizinhos.has(o)) vizinhos.set(o, new Set());
    if (!vizinhos.has(d)) vizinhos.set(d, new Set());
    vizinhos.get(o)!.add(d);
    vizinhos.get(d)!.add(o);
  }
  // JP que é "galho" do grupo pertence a ele: todos os vizinhos já caem no mesmo
  // grupo, exceto no máximo um JP (o barramento de onde o galho sai). Repete até
  // estabilizar, então uma cadeia de JPs internos entra das pontas para dentro.
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const eq of equipamentos) {
      if (!ehJunction(eq) || dono.has(eq.id)) continue;
      const grupoAlvo = new Set<string>();
      let soltos = 0;
      let soltoNaoJp = false;
      for (const v of vizinhos.get(eq.id) ?? []) {
        const alvo = dono.get(v);
        if (alvo) { grupoAlvo.add(alvo); continue; }
        soltos++;
        const viz = porId.get(v);
        if (!viz || !ehJunction(viz)) soltoNaoJp = true;
      }
      if (grupoAlvo.size === 1 && !soltoNaoJp && soltos <= 1) {
        dono.set(eq.id, [...grupoAlvo][0]);
        mudou = true;
      }
    }
  }

  // Quem some da tela: tudo de grupo recolhido → nó sintético do grupo
  const destinoDe = new Map<string, string>();
  for (const [eqId, gid] of dono) if (!abertos.has(gid)) destinoDe.set(eqId, idNoGrupo(gid));

  // Grupos abertos: molduras não se sobrepõem na tela
  const abertosValidos = gruposValidos.filter(g => abertos.has(g.id));
  const deslocamentos = new Map<string, Deslocamento>(
    opcoes.deslocamentos
      ? abertosValidos.map(g => [g.id, opcoes.deslocamentos!.get(g.id) ?? { dx: 0, dy: 0 }])
      : separarCaixas(abertosValidos.map(g => ({ id: g.id, caixa: caixaDaMoldura(caixaDe(membrosPorGrupo.get(g.id)!)!) }))),
  );
  const deslocamentoDoEquipamento = new Map<string, Deslocamento>();
  for (const [eqId, gid] of dono) {
    const d = deslocamentos.get(gid);
    if (d && (d.dx || d.dy)) deslocamentoDoEquipamento.set(eqId, d);
  }
  // O grupo aberto é arrastado pelo nome como se fosse o bloco: o arraste desconta isto
  for (const [gid, d] of deslocamentos) if (d.dx || d.dy) deslocamentoDoEquipamento.set(idNoGrupo(gid), d);
  const naTela = (e: Equipment): Equipment => {
    const d = deslocamentoDoEquipamento.get(e.id);
    return d ? { ...e, posicaoX: e.posicaoX + d.dx, posicaoY: e.posicaoY + d.dy } : e;
  };

  const abertosOut: GrupoAberto[] = [];
  for (const g of abertosValidos) {
    const membrosNaTela = membrosPorGrupo.get(g.id)!.map(naTela);
    abertosOut.push({ grupo: g, membros: membrosNaTela, caixa: caixaDe(membrosNaTela)! });
  }
  const molduras = abertosOut.map(a => caixaDaMoldura(a.caixa));

  const cards: CardDeGrupo[] = [];
  const nosSinteticos: Equipment[] = [];
  for (const g of gruposValidos) {
    const membros = membrosPorGrupo.get(g.id)!;
    if (abertos.has(g.id)) continue;
    const real = posicaoDoCard(g, membros);
    // Bloco que cairia debaixo de um grupo aberto desliza para fora da moldura (só na tela)
    const d = opcoes.deslocamentos
      ? opcoes.deslocamentos.get(g.id) ?? { dx: 0, dy: 0 }
      : tirarDeBaixo({ minX: real.x, minY: real.y, maxX: real.x + TAMANHO_CARD.width, maxY: real.y + TAMANHO_CARD.height }, molduras);
    if (d.dx || d.dy) {
      deslocamentos.set(g.id, d);
      deslocamentoDoEquipamento.set(idNoGrupo(g.id), d);
    }
    const pos = { x: real.x + d.dx, y: real.y + d.dy };
    const base = membros[0];
    const no: Equipment = {
      id: idNoGrupo(g.id),
      nome: g.nome,
      tag: g.nome,
      tipo: TIPO_GRUPO,
      unidadeId: base.unidadeId,
      diagramaId: base.diagramaId,
      posicaoX: pos.x,
      posicaoY: pos.y,
      rotacao: 0,
      labelPosition: 'top',
      status: statusDoGrupo(membros),
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
      deletedAt: null,
    };
    nosSinteticos.push(no);
    cards.push({ grupo: g, no, membros });
  }

  const visiveis = equipamentos.filter(e => !destinoDe.has(e.id));
  const visiveisNaTela = deslocamentoDoEquipamento.size ? visiveis.map(naTela) : visiveis;
  const escondidosPorGrupo = new Map<string, string[]>();
  for (const [eqId, no] of destinoDe) {
    const gid = grupoIdDoNo(no)!;
    if (!escondidosPorGrupo.has(gid)) escondidosPorGrupo.set(gid, []);
    escondidosPorGrupo.get(gid)!.push(eqId);
  }

  // Religa as conexões: ponta em membro recolhido passa a ser o bloco; descarta as internas e repetidas
  const vistas = new Set<string>();
  const conexoesVisao: Connection[] = [];
  for (const c of conexoes) {
    const o0 = c.equipamentoOrigemId?.trim();
    const d0 = c.equipamentoDestinoId?.trim();
    if (!o0 || !d0) {
      conexoesVisao.push(c);
      continue;
    }
    const o = destinoDe.get(o0) ?? o0;
    const d = destinoDe.get(d0) ?? d0;
    if (o === o0 && d === d0) {
      conexoesVisao.push(c);
      continue;
    }
    if (o === d) continue;
    const portaO = c.portaOrigem ?? 'top';
    const portaD = c.portaDestino ?? 'top';
    const chave = [`${o}|${portaO}`, `${d}|${portaD}`].sort().join('>');
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    conexoesVisao.push({
      ...c,
      id: `${c.id}@grp`,
      equipamentoOrigemId: o,
      portaOrigem: portaO,
      equipamentoDestinoId: d,
      portaDestino: portaD,
    });
  }

  return {
    equipamentos: [...visiveisNaTela, ...nosSinteticos],
    conexoes: conexoesVisao,
    cards,
    abertos: abertosOut,
    grupoDoEquipamento,
    escondidosPorGrupo,
    deslocamentos,
    deslocamentoDoEquipamento,
    temGrupos: true,
  };
}

/** Centro (grid) de um equipamento, pelo tamanho real do tipo. */
export function centroDe(eq: Equipment): { x: number; y: number } {
  const size = getEquipmentSizeInPixels(eq.tipo);
  return { x: eq.posicaoX + size.width / GRID.SIZE / 2, y: eq.posicaoY + size.height / GRID.SIZE / 2 };
}

/**
 * Linha ligada no bloco de um grupo recolhido vira linha de um equipamento de
 * verdade (a API só guarda equipamento ou junção): o membro mais perto da outra
 * ponta. Recolhido, a linha continua chegando no bloco; aberto, no membro.
 */
export function membroMaisProximo(membros: Equipment[], alvo: { x: number; y: number }): Equipment | null {
  let melhor: Equipment | null = null;
  let menor = Infinity;
  for (const m of membros) {
    const c = centroDe(m);
    const d = Math.hypot(c.x - alvo.x, c.y - alvo.y);
    if (d < menor) {
      menor = d;
      melhor = m;
    }
  }
  return melhor;
}

/**
 * Desloca o grupo inteiro (membros + JPs que são galho dele) — é assim que o
 * bloco recolhido "anda": ele fica sempre no centro dos membros, então abrir o
 * grupo mostra os equipamentos ali mesmo, sem a tela pular para outro lugar.
 */
export function deslocarGrupo(
  equipamentos: Equipment[],
  conexoes: Connection[],
  grupos: GrupoUnifilar[],
  grupoId: string,
  dx: number,
  dy: number,
): Equipment[] {
  if (dx === 0 && dy === 0) return equipamentos;
  // Todos recolhidos: assim os JPs internos do grupo entram no deslocamento
  const ids = new Set(montarVisao(equipamentos, conexoes, grupos, new Set()).escondidosPorGrupo.get(grupoId) ?? []);
  if (ids.size === 0) return equipamentos;
  return equipamentos.map(e => (ids.has(e.id) ? { ...e, posicaoX: e.posicaoX + dx, posicaoY: e.posicaoY + dy } : e));
}

/**
 * Grupo gravado com bloco fora do centro (versão anterior, em que o bloco andava
 * sozinho): leva os membros até o bloco e limpa a posição. Depois disso o bloco
 * é sempre o centro dos membros.
 */
export function levarMembrosAteOBloco(
  equipamentos: Equipment[],
  conexoes: Connection[],
  grupos: GrupoUnifilar[],
): { equipamentos: Equipment[]; grupos: GrupoUnifilar[]; mudou: boolean } {
  let eqs = equipamentos;
  let mudou = false;
  const saida = grupos.map(g => {
    if (!Number.isFinite(g.posicaoX) || !Number.isFinite(g.posicaoY)) return g;
    const membros = eqs.filter(e => g.equipamentoIds.includes(e.id) && e.tipo !== 'JUNCTION_POINT');
    const limpo = { ...g, posicaoX: null, posicaoY: null };
    if (membros.length) {
      const centro = posicaoDoCard(limpo, membros);
      const dx = (g.posicaoX as number) - centro.x;
      const dy = (g.posicaoY as number) - centro.y;
      eqs = deslocarGrupo(eqs, conexoes, grupos, g.id, dx, dy);
    }
    mudou = true;
    return limpo;
  });
  return { equipamentos: eqs, grupos: saida, mudou };
}

/** Moldura do grupo aberto em grid (mesma folga do desenho: nome em cima, rótulos embaixo). */
export function caixaDaMoldura(c: Caixa): Caixa {
  return { minX: c.minX - 0.6, minY: c.minY - 1.4, maxX: c.maxX + 0.6, maxY: c.maxY + 0.8 };
}

const deslocarCaixa = (c: Caixa, dx: number, dy: number): Caixa => ({
  minX: c.minX + dx, maxX: c.maxX + dx, minY: c.minY + dy, maxY: c.maxY + dy,
});

const encostam = (a: Caixa, b: Caixa, folga: number) =>
  a.minX < b.maxX + folga && a.maxX + folga > b.minX && a.minY < b.maxY + folga && a.maxY + folga > b.minY;

/**
 * Bloco recolhido que cairia debaixo de moldura aberta: anda o mínimo para o lado
 * mais perto até ficar fora de todas (fica clicável e arrastável).
 */
export function tirarDeBaixo(card: Caixa, molduras: Caixa[], folga = 0.5): Deslocamento {
  let dx = 0, dy = 0;
  for (let i = 0; i < 20; i++) {
    const atual = deslocarCaixa(card, dx, dy);
    const m = molduras.find(mm => encostam(atual, mm, folga));
    if (!m) break;
    const opcoes = [
      { dx: m.minX - folga - atual.maxX, dy: 0 },
      { dx: m.maxX + folga - atual.minX, dy: 0 },
      { dx: 0, dy: m.minY - folga - atual.maxY },
      { dx: 0, dy: m.maxY + folga - atual.minY },
    ];
    const melhor = opcoes.reduce((a, b) => (Math.abs(a.dx) + Math.abs(a.dy) <= Math.abs(b.dx) + Math.abs(b.dy) ? a : b));
    dx += melhor.dx;
    dy += melhor.dy;
  }
  // arredonda para longe da moldura (grid inteiro)
  const r = (v: number) => (v > 0 ? Math.ceil(v - 1e-9) : Math.floor(v + 1e-9)) || 0;
  return { dx: r(dx), dy: r(dy) };
}

/**
 * Tira caixas de cima umas das outras: de cima para baixo (e da esquerda para a
 * direita), a que invade outra já posicionada anda o mínimo para baixo ou para a
 * direita até sair. `porUltimo` = quem se ajeita (as outras ficam).
 */
export function separarCaixas(
  itens: { id: string; caixa: Caixa }[],
  porUltimo?: string | null,
  folga = 1,
): Map<string, Deslocamento> {
  const saida = new Map<string, Deslocamento>();
  const ordem = [...itens].sort((a, b) => {
    if (a.id === porUltimo) return 1;
    if (b.id === porUltimo) return -1;
    return a.caixa.minY - b.caixa.minY || a.caixa.minX - b.caixa.minX;
  });
  const postas: Caixa[] = [];
  for (const { id, caixa } of ordem) {
    let dx = 0, dy = 0;
    for (let i = 0; i < 200; i++) {
      const atual = deslocarCaixa(caixa, dx, dy);
      const batidas = postas.filter(p => encostam(atual, p, folga));
      if (batidas.length === 0) break;
      const baixo = Math.max(...batidas.map(p => p.maxY)) + folga - atual.minY;
      const direita = Math.max(...batidas.map(p => p.maxX)) + folga - atual.minX;
      if (baixo <= direita) dy += baixo;
      else dx += direita;
    }
    dx = Math.ceil(dx - 1e-9) || 0; // || 0 tira o -0
    dy = Math.ceil(dy - 1e-9) || 0;
    saida.set(id, { dx, dy });
    postas.push(deslocarCaixa(caixa, dx, dy));
  }
  return saida;
}

/**
 * Versão que GRAVA (botão "Organizar grupos"): anda o grupo inteiro de verdade
 * (`deslocarGrupo`) para nenhum ficar por cima de outro.
 */
export function separarGrupos(
  equipamentos: Equipment[],
  conexoes: Connection[],
  grupos: GrupoUnifilar[],
  porUltimo?: string | null,
  folga = 1,
): { equipamentos: Equipment[]; movidos: string[] } {
  const cards = montarVisao(equipamentos, conexoes, grupos, new Set()).cards;
  if (cards.length < 2) return { equipamentos, movidos: [] };
  const desl = separarCaixas(
    cards.map(c => ({ id: c.grupo.id, caixa: caixaDaMoldura(caixaDe(c.membros)!) })),
    porUltimo,
    folga,
  );
  let eqs = equipamentos;
  const movidos: string[] = [];
  for (const [id, { dx, dy }] of desl) {
    if (!dx && !dy) continue;
    eqs = deslocarGrupo(eqs, conexoes, grupos, id, dx, dy);
    movidos.push(id);
  }
  return { equipamentos: eqs, movidos };
}

/**
 * Arraste: posição na tela (grid) → posição real, descontando o que só existe na
 * tela (membro ou grupo afastado, bloco que saiu de baixo de moldura). O
 * afastamento fica congelado durante o arraste; ao soltar um bloco, o store
 * acerta a posição real para onde ele aparece (`endDraggingEquipamento`).
 */
export function posicaoRealDoArraste(
  id: string,
  x: number,
  y: number,
  deslocamentoVisual: ReadonlyMap<string, Deslocamento>,
): { x: number; y: number } {
  const d = deslocamentoVisual.get(id);
  return d ? { x: x - d.dx, y: y - d.dy } : { x, y };
}

/** Lê os grupos de `configuracoes` tolerando lixo. */
export function gruposDaConfiguracao(configuracoes: unknown): GrupoUnifilar[] {
  const grupos = (configuracoes as { grupos?: unknown } | null | undefined)?.grupos;
  if (!Array.isArray(grupos)) return [];
  return grupos
    .filter((g): g is GrupoUnifilar => !!g && typeof g.id === 'string' && Array.isArray(g.equipamentoIds))
    .map(g => ({ ...g, equipamentoIds: g.equipamentoIds.map(id => String(id).trim()) }));
}

export function novoIdGrupo(): string {
  return `grp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
