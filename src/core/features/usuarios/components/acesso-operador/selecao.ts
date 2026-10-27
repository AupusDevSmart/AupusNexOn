/**
 * Tela "Acesso do operador" (NEXON-20, spec 4.4) — lógica PURA da seleção.
 * Testada em selecao.test.ts. Nada aqui fala com a API ou com o React.
 *
 * Modelo: um vínculo por operador × proprietário. O que o operador vê é uma
 * lista explícita de equipamentos (com "Ver R$" em pivô/carregador) mais as
 * instalações com "Ver geração" (que implica todos os inversores dela).
 */

export interface EquipamentoArvore {
  id: string;
  nome: string;
  tipo_codigo: string | null;
  tipo_nome: string | null;
  liberado: boolean;
  ver_rs: boolean;
  aceita_ver_rs: boolean;
  novo: boolean;
}

export interface UnidadeArvore {
  id: string | null;
  nome: string;
  tipo_unidade: string | null;
  tem_usina: boolean;
  ver_geracao: boolean;
  equipamentos: EquipamentoArvore[];
}

export interface PlantaArvore {
  id: string;
  nome: string;
  unidades: UnidadeArvore[];
}

export interface ArvoreAcesso {
  operador: { id: string; nome: string; email?: string };
  proprietario: { id: string; nome: string };
  vinculo: { id: string; validade: string | null } | null;
  plantas: PlantaArvore[];
}

/** Estado editável: equipamento → verRs; instalações com "Ver geração"; validade. */
export interface Selecao {
  equipamentos: Record<string, boolean>;
  geracao: string[];
  validade: string | null;
}

export type EstadoMarcacao = 'todos' | 'alguns' | 'nenhum';

// ---------------------------------------------------------------------------
// Categorias (chips por tipo)
// ---------------------------------------------------------------------------

export type ChaveCategoria = string;

export const CAT_USINAS = 'usinas';

const CATEGORIAS_FIXAS: Array<{ chave: string; rotulo: string; casa: (codigo: string) => boolean }> = [
  { chave: 'pivos', rotulo: 'Pivôs', casa: (c) => c === 'PIVO' },
  { chave: CAT_USINAS, rotulo: 'Usinas', casa: (c) => c === 'INVERSOR' },
  { chave: 'carregadores', rotulo: 'Carregadores', casa: (c) => c === 'CARREGADOR_ELETRICO' },
  { chave: 'disjuntores', rotulo: 'Disjuntores', casa: (c) => c === 'DISJUNTOR' },
  { chave: 'softstarters', rotulo: 'Soft-starters', casa: (c) => c === 'SOFTSTARTER' },
  {
    chave: 'medidores',
    rotulo: 'Medidores',
    casa: (c) => c.startsWith('METER') || c.startsWith('EQTL') || c.startsWith('MEDIDOR'),
  },
  { chave: 'motores', rotulo: 'Motores', casa: (c) => c === 'MOTOR' },
];

/** Categoria do chip de um equipamento: fixa pelo código, ou o nome do tipo. */
export function categoriaDe(e: Pick<EquipamentoArvore, 'tipo_codigo' | 'tipo_nome'>): {
  chave: ChaveCategoria;
  rotulo: string;
} {
  const codigo = (e.tipo_codigo ?? '').trim().toUpperCase();
  const fixa = codigo ? CATEGORIAS_FIXAS.find((c) => c.casa(codigo)) : undefined;
  if (fixa) return { chave: fixa.chave, rotulo: fixa.rotulo };
  const nome = (e.tipo_nome ?? '').trim();
  if (nome) return { chave: `tipo:${nome.toLowerCase()}`, rotulo: nome };
  if (codigo) return { chave: `tipo:${codigo.toLowerCase()}`, rotulo: codigo };
  return { chave: 'outros', rotulo: 'Outros' };
}

export interface Chip {
  chave: ChaveCategoria;
  rotulo: string;
  /** Usinas: instalações com usina; demais: equipamentos do tipo. */
  total: number;
  estado: EstadoMarcacao;
}

const ehInversor = (e: EquipamentoArvore) => (e.tipo_codigo ?? '').toUpperCase() === 'INVERSOR';

function estadoDe(marcados: number, total: number): EstadoMarcacao {
  if (total === 0 || marcados === 0) return 'nenhum';
  return marcados >= total ? 'todos' : 'alguns';
}

const todasUnidades = (plantas: PlantaArvore[]) => plantas.flatMap((p) => p.unidades);
const todosEquipamentos = (plantas: PlantaArvore[]) =>
  todasUnidades(plantas).flatMap((u) => u.equipamentos);

/** Chips na ordem fixa (Pivôs, Usinas, Carregadores…), depois os outros tipos por nome. */
export function chipsDe(plantas: PlantaArvore[], sel: Selecao): Chip[] {
  const contagem = new Map<string, { rotulo: string; total: number; estado: EstadoMarcacao; marcados: number }>();
  for (const e of todosEquipamentos(plantas)) {
    const { chave, rotulo } = categoriaDe(e);
    if (chave === CAT_USINAS) continue; // contadas por instalação abaixo
    const c = contagem.get(chave) ?? { rotulo, total: 0, marcados: 0, estado: 'nenhum' as EstadoMarcacao };
    c.total += 1;
    if (e.id in sel.equipamentos) c.marcados += 1;
    c.estado = estadoDe(c.marcados, c.total);
    contagem.set(chave, c);
  }
  // Usinas: conta instalações com usina; "todos" quando todas têm todos os inversores.
  const usinas = todasUnidades(plantas).filter((u) => u.tem_usina);
  if (usinas.length) {
    const estados = usinas.map((u) => estadoInversores(u, sel));
    const estado: EstadoMarcacao = estados.every((x) => x === 'todos')
      ? 'todos'
      : estados.some((x) => x !== 'nenhum')
        ? 'alguns'
        : 'nenhum';
    contagem.set(CAT_USINAS, { rotulo: 'Usinas', total: usinas.length, marcados: 0, estado });
  }
  const ordemFixa = CATEGORIAS_FIXAS.map((c) => c.chave);
  return [...contagem.entries()]
    .map(([chave, c]) => ({ chave, rotulo: c.rotulo, total: c.total, estado: c.estado }))
    .sort((a, b) => {
      const ia = ordemFixa.indexOf(a.chave);
      const ib = ordemFixa.indexOf(b.chave);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.rotulo.localeCompare(b.rotulo, 'pt-BR');
    });
}

function estadoInversores(u: UnidadeArvore, sel: Selecao): EstadoMarcacao {
  const inv = u.equipamentos.filter(ehInversor);
  return estadoDe(inv.filter((e) => e.id in sel.equipamentos).length, inv.length);
}

/** Toque no chip: tudo daquele tipo marcado → desmarca; senão marca todos. */
export function alternarCategoria(plantas: PlantaArvore[], sel: Selecao, chave: ChaveCategoria): Selecao {
  const alvo = todosEquipamentos(plantas).filter((e) => categoriaDe(e).chave === chave);
  if (alvo.length === 0) return sel;
  const tudoMarcado = alvo.every((e) => e.id in sel.equipamentos);
  const equipamentos = { ...sel.equipamentos };
  let geracao = sel.geracao;
  if (tudoMarcado) {
    for (const e of alvo) delete equipamentos[e.id];
    // Sem inversor marcado não há "Ver geração".
    if (chave === CAT_USINAS) {
      const comUsina = new Set(
        todasUnidades(plantas)
          .filter((u) => u.tem_usina && u.id)
          .map((u) => u.id as string),
      );
      geracao = geracao.filter((g) => !comUsina.has(g));
    }
  } else {
    for (const e of alvo) if (!(e.id in equipamentos)) equipamentos[e.id] = false;
  }
  return { ...sel, equipamentos, geracao };
}

// ---------------------------------------------------------------------------
// Instalação (tri-state) e equipamento
// ---------------------------------------------------------------------------

export function estadoInstalacao(u: UnidadeArvore, sel: Selecao): {
  estado: EstadoMarcacao;
  marcados: number;
  total: number;
} {
  const total = u.equipamentos.length;
  const marcados = u.equipamentos.filter((e) => e.id in sel.equipamentos).length;
  return { estado: estadoDe(marcados, total), marcados, total };
}

/** Checkbox da instalação: todos → nenhum; alguns/nenhum → todos. */
export function alternarInstalacao(u: UnidadeArvore, sel: Selecao): Selecao {
  const { estado } = estadoInstalacao(u, sel);
  const equipamentos = { ...sel.equipamentos };
  let geracao = sel.geracao;
  if (estado === 'todos') {
    for (const e of u.equipamentos) delete equipamentos[e.id];
    if (u.id) geracao = geracao.filter((g) => g !== u.id);
  } else {
    for (const e of u.equipamentos) if (!(e.id in equipamentos)) equipamentos[e.id] = false;
  }
  return { ...sel, equipamentos, geracao };
}

/** Desmarcar um inversor desliga o "Ver geração" da instalação dele. */
export function alternarEquipamento(u: UnidadeArvore, e: EquipamentoArvore, sel: Selecao): Selecao {
  const equipamentos = { ...sel.equipamentos };
  let geracao = sel.geracao;
  if (e.id in equipamentos) {
    delete equipamentos[e.id];
    if (ehInversor(e) && u.id) geracao = geracao.filter((g) => g !== u.id);
  } else {
    equipamentos[e.id] = false;
  }
  return { ...sel, equipamentos, geracao };
}

/** "Ver geração" ligado marca todos os inversores; desligado só tira a geração. */
export function definirVerGeracao(u: UnidadeArvore, ligado: boolean, sel: Selecao): Selecao {
  if (!u.id || !u.tem_usina) return sel;
  const id = u.id;
  if (!ligado) return { ...sel, geracao: sel.geracao.filter((g) => g !== id) };
  const equipamentos = { ...sel.equipamentos };
  for (const e of u.equipamentos) if (ehInversor(e) && !(e.id in equipamentos)) equipamentos[e.id] = false;
  return { ...sel, equipamentos, geracao: sel.geracao.includes(id) ? sel.geracao : [...sel.geracao, id] };
}

/** "Ver R$" só vale em equipamento marcado que aceita (pivô, carregador). */
export function definirVerRs(e: EquipamentoArvore, ligado: boolean, sel: Selecao): Selecao {
  if (!e.aceita_ver_rs || !(e.id in sel.equipamentos)) return sel;
  return { ...sel, equipamentos: { ...sel.equipamentos, [e.id]: ligado } };
}

// ---------------------------------------------------------------------------
// Estado inicial, busca, resumo, revisão e payload
// ---------------------------------------------------------------------------

export function selecaoInicial(arvore: Pick<ArvoreAcesso, 'plantas' | 'vinculo'>): Selecao {
  const equipamentos: Record<string, boolean> = {};
  const geracao: string[] = [];
  for (const u of todasUnidades(arvore.plantas)) {
    if (u.ver_geracao && u.id) geracao.push(u.id);
    for (const e of u.equipamentos) if (e.liberado) equipamentos[e.id] = !!e.ver_rs;
  }
  return { equipamentos, geracao, validade: arvore.vinculo?.validade ?? null };
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Busca por nome. Instalação cujo nome casa aparece inteira; senão só os
 * equipamentos que casam (e a instalação some se nenhum casar).
 */
export function filtrarUnidades(unidades: UnidadeArvore[], termo: string): UnidadeArvore[] {
  const t = normalizar(termo);
  if (!t) return unidades;
  const out: UnidadeArvore[] = [];
  for (const u of unidades) {
    if (normalizar(u.nome).includes(t)) {
      out.push(u);
      continue;
    }
    const eqs = u.equipamentos.filter((e) => normalizar(e.nome).includes(t));
    if (eqs.length) out.push({ ...u, equipamentos: eqs });
  }
  return out;
}

const ROTULOS_RESUMO: Array<[string, string, string]> = [
  ['INVERSOR', 'inversor', 'inversores'],
  ['PIVO', 'pivô', 'pivôs'],
  ['CARREGADOR_ELETRICO', 'carregador', 'carregadores'],
  ['DISJUNTOR', 'disjuntor', 'disjuntores'],
  ['MOTOR', 'motor', 'motores'],
];

/** Mesmo texto do backend (`resumoVinculo`): "2 usinas · 14 inversores · 1 pivô". */
export function resumoDe(plantas: PlantaArvore[], sel: Selecao): string {
  const porCodigo = new Map<string, number>();
  let total = 0;
  for (const e of todosEquipamentos(plantas)) {
    if (!(e.id in sel.equipamentos)) continue;
    total += 1;
    const c = (e.tipo_codigo ?? '').toUpperCase();
    porCodigo.set(c, (porCodigo.get(c) ?? 0) + 1);
  }
  const partes: string[] = [];
  const usinas = sel.geracao.length;
  if (usinas) partes.push(`${usinas} ${usinas === 1 ? 'usina' : 'usinas'}`);
  let conhecidos = 0;
  for (const [c, um, varios] of ROTULOS_RESUMO) {
    const q = porCodigo.get(c) ?? 0;
    conhecidos += q;
    if (q) partes.push(`${q} ${q === 1 ? um : varios}`);
  }
  const outros = total - conhecidos;
  if (outros > 0) partes.push(`${outros} ${outros === 1 ? 'outro equipamento' : 'outros equipamentos'}`);
  return partes.join(' · ') || 'nenhum equipamento';
}

export interface Revisao {
  entram: string[];
  saem: string[];
  verRsLigado: string[];
  verRsDesligado: string[];
  geracaoLigada: string[];
  geracaoDesligada: string[];
  validade: { de: string | null; para: string | null } | null;
  mudou: boolean;
  /** Nada marcado: salvar remove o vínculo com este proprietário. */
  removeTudo: boolean;
}

/** O que muda entre o que está salvo e o que está na tela (por nome). */
export function revisar(plantas: PlantaArvore[], antes: Selecao, depois: Selecao): Revisao {
  const entram: string[] = [];
  const saem: string[] = [];
  const verRsLigado: string[] = [];
  const verRsDesligado: string[] = [];
  const geracaoLigada: string[] = [];
  const geracaoDesligada: string[] = [];
  for (const u of todasUnidades(plantas)) {
    for (const e of u.equipamentos) {
      const a = e.id in antes.equipamentos;
      const d = e.id in depois.equipamentos;
      if (!a && d) entram.push(e.nome);
      if (a && !d) saem.push(e.nome);
      if (a && d && e.aceita_ver_rs && antes.equipamentos[e.id] !== depois.equipamentos[e.id]) {
        (depois.equipamentos[e.id] ? verRsLigado : verRsDesligado).push(e.nome);
      }
      if (!a && d && e.aceita_ver_rs && depois.equipamentos[e.id]) verRsLigado.push(e.nome);
    }
    if (u.id) {
      const a = antes.geracao.includes(u.id);
      const d = depois.geracao.includes(u.id);
      if (!a && d) geracaoLigada.push(u.nome);
      if (a && !d) geracaoDesligada.push(u.nome);
    }
  }
  const validade =
    (antes.validade ?? null) !== (depois.validade ?? null)
      ? { de: antes.validade ?? null, para: depois.validade ?? null }
      : null;
  const mudou =
    entram.length + saem.length + verRsLigado.length + verRsDesligado.length +
      geracaoLigada.length + geracaoDesligada.length > 0 || validade !== null;
  return {
    entram,
    saem,
    verRsLigado,
    verRsDesligado,
    geracaoLigada,
    geracaoDesligada,
    validade,
    mudou,
    removeTudo: Object.keys(depois.equipamentos).length === 0,
  };
}

/** Corpo do `PUT /usuarios/:id/vinculos`. */
export function payloadDe(proprietarioId: string, sel: Selecao) {
  return {
    proprietarioId,
    validade: sel.validade || null,
    equipamentos: Object.entries(sel.equipamentos).map(([id, verRs]) => ({ id, verRs })),
    unidadesGeracao: [...sel.geracao],
  };
}

/** "2026-12-31" → "31/12/2026". */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}
