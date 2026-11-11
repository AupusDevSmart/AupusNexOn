/**
 * Emulador Modbus RTU — conversão valor de engenharia ⇄ registradores.
 *
 * É o INVERSO exato do que o firmware da TON faz ao ler o device (gerador:
 * _decodeExpr + casa decimal + apply_factor). Fórmula na TON:
 *
 *   valor = decode(dataType, word_order)(regs) / scale × fDec × fFator
 *
 *   fDec   = 10^(expoente lido em decimal_regs − baseline)   (M160, campo decimal_src)
 *   fFator = TP | TC | TP×TC                                  (campo apply_factor, cat.tp_tc)
 *            TP/TC = override do nó (tp_ratio/tc_ratio, arredondado .toFixed(1)) se houver,
 *                    senão o que a TON lê dos registradores tp_tc do "medidor".
 *
 * Validado contra as expressões C reais do gerador por tools/emulador-crosscheck.mjs (g++).
 */
import {
  type CatalogModel,
  type NodeProps,
  type PontoAi,
  listarPontosAi,
  listarPontosBi,
  parseScaleOverride,
  type DevicePointDef,
} from './emulador-catalog';

export type WordOrder = 'high_first' | 'low_first';

// ---------------------------------------------------------------------------
// Conversões de 32 bits
// ---------------------------------------------------------------------------

const f32buf = new DataView(new ArrayBuffer(4));

export function floatToU32(v: number): number {
  f32buf.setFloat32(0, v, false);
  return f32buf.getUint32(0, false);
}
export function u32ToFloat(u: number): number {
  f32buf.setUint32(0, u >>> 0, false);
  return f32buf.getFloat32(0, false);
}

function splitU32(u: number, wo: WordOrder): [number, number] {
  const hi = (u >>> 16) & 0xffff;
  const lo = u & 0xffff;
  return wo === 'low_first' ? [lo, hi] : [hi, lo];
}
function joinU32(words: number[], i: number, wo: WordOrder): number {
  const hi = wo === 'low_first' ? words[i + 1] : words[i];
  const lo = wo === 'low_first' ? words[i] : words[i + 1];
  return (((hi & 0xffff) << 16) | (lo & 0xffff)) >>> 0;
}

const LIMITES: Record<string, [number, number]> = {
  U16: [0, 0xffff],
  S16: [-0x8000, 0x7fff],
  U32: [0, 0xffffffff],
  S32: [-0x80000000, 0x7fffffff],
  COSFI: [-0x7fff, 0x7fff],
};

export interface EncodeResult {
  words: number[];
  /** true quando o valor não coube no tipo e foi limitado. */
  clamped: boolean;
}

/**
 * Codifica o valor "bruto" (já multiplicado pela escala e dividido pelos fatores)
 * nas words Modbus, na ordem em que ficam nos registradores.
 */
export function encodeRaw(dataType: string, raw: number, wo: WordOrder, meta: { count?: number; regs_per?: number } = {}): EncodeResult {
  if (!Number.isFinite(raw)) raw = 0;
  if (dataType === 'FLOAT') {
    return { words: splitU32(floatToU32(raw), wo), clamped: false };
  }
  if (dataType === 'U32_SUM3') {
    // Soma de N inteiros 32-bit (high/low fixo no gerador) — divide igualmente.
    const n = Number(meta.count) || 3;
    const per = Number(meta.regs_per) || 2;
    const total = Math.round(raw);
    const base = Math.trunc(total / n);
    const words: number[] = [];
    let clamped = false;
    for (let k = 0; k < n; k++) {
      let part = k === n - 1 ? total - base * (n - 1) : base;
      if (part > 0x7fffffff) { part = 0x7fffffff; clamped = true; }
      if (part < -0x80000000) { part = -0x80000000; clamped = true; }
      const u = part >>> 0;
      const w = [(u >>> 16) & 0xffff, u & 0xffff];
      for (let j = 0; j < per; j++) words.push(w[j] ?? 0);
    }
    return { words, clamped };
  }
  const [mn, mx] = LIMITES[dataType] ?? LIMITES.U16;
  let r = Math.round(raw);
  let clamped = false;
  if (r < mn) { r = mn; clamped = true; }
  if (r > mx) { r = mx; clamped = true; }
  switch (dataType) {
    case 'S16':
      return { words: [r & 0xffff], clamped };
    case 'U32':
    case 'S32':
      return { words: splitU32(r >>> 0, wo), clamped };
    case 'COSFI':
      return { words: [(r < 0 ? 0x8000 : 0) | (Math.abs(r) & 0x7fff)], clamped };
    default: // U16 e desconhecidos (gerador cai em U16 no default)
      return { words: [r & 0xffff], clamped };
  }
}

/** Espelho JS do decoder C (com Math.fround onde o C usa float). Usado em testes e na UI. */
export function decodeRaw(dataType: string, words: number[], wo: WordOrder, meta: { count?: number; regs_per?: number } = {}): number {
  switch (dataType) {
    case 'S16':
      return (words[0] << 16) >> 16;
    case 'U32':
      return joinU32(words, 0, wo);
    case 'S32':
      return joinU32(words, 0, wo) | 0;
    case 'FLOAT':
      return u32ToFloat(joinU32(words, 0, wo));
    case 'COSFI':
      return (words[0] & 0x8000 ? -1 : 1) * (words[0] & 0x7fff);
    case 'U32_SUM3': {
      const n = Number(meta.count) || 3;
      const per = Number(meta.regs_per) || 2;
      let s = 0;
      for (let k = 0; k < n; k++) s += ((((words[k * per] & 0xffff) << 16) | (words[k * per + 1] & 0xffff)) | 0);
      return s;
    }
    default:
      return words[0] & 0xffff;
  }
}

// ---------------------------------------------------------------------------
// Configuração do "device" emulado (registradores que não são pontos)
// ---------------------------------------------------------------------------

export interface EmuladorConfig {
  /** Relação TP que o "medidor" reporta (registrador tp_tc). */
  tp: number;
  /** Relação TC que o "medidor" reporta (registrador tp_tc). */
  tc: number;
  /** Expoentes de casa decimal por campo (dpt/dct/dpq) do M160. */
  decimais: Record<string, number>;
}

export function configPadrao(model: CatalogModel): EmuladorConfig {
  const decimais: Record<string, number> = {};
  for (const [k, cfg] of Object.entries(model.decimal_regs?.layout || {})) decimais[k] = cfg.baseline ?? 4;
  return { tp: 1, tc: 1, decimais };
}

/**
 * Fatores que a TON aplica — calculados como o firmware calcula (raw/scale do
 * registrador, ou override do nó com .toFixed(1)).
 */
export function calcularFatores(model: CatalogModel, props: NodeProps, cfg: EmuladorConfig) {
  let fTP = 1, fTC = 1;
  let tpRaw = 0, tcRaw = 0;
  const t = model.tp_tc;
  if (t) {
    const sTp = Number(t.scale_tp) || 1;
    const sTc = Number(t.scale_tc) || 1;
    tpRaw = clampU16(Math.round((Number(cfg.tp) || 0) * sTp));
    tcRaw = clampU16(Math.round((Number(cfg.tc) || 0) * sTc));
    fTP = Math.fround(tpRaw / sTp);
    fTC = Math.fround(tcRaw / sTc);
    const tcOv = parseScaleOverride(props?.tc_ratio);
    const tpOv = parseScaleOverride(props?.tp_ratio);
    if (tpOv) fTP = Number(tpOv.toFixed(1));
    if (tcOv) fTC = Number(tcOv.toFixed(1));
  }
  const dec: Record<string, number> = {};
  for (const [k, l] of Object.entries(model.decimal_regs?.layout || {})) {
    const base = l.baseline ?? 4;
    const exp = clampU8(Math.round(cfg.decimais?.[k] ?? base));
    dec[k] = Math.pow(10, exp - base);
  }
  return {
    fTP, fTC, fatorEnergia: Math.fround(fTP * fTC), tpRaw, tcRaw, dec,
    tpOverride: !!(t && parseScaleOverride(props?.tp_ratio)),
    tcOverride: !!(t && parseScaleOverride(props?.tc_ratio)),
  };
}
type Fatores = ReturnType<typeof calcularFatores>;

const clampU16 = (n: number) => Math.min(0xffff, Math.max(0, n | 0));
const clampU8 = (n: number) => Math.min(0xff, Math.max(0, n | 0));

/** Produto dos fatores aplicados a um ponto (decimal × apply_factor), como no C. */
export function fatorDoPonto(model: CatalogModel, p: Pick<PontoAi, 'decimal_src' | 'apply_factor'>, f: Fatores): number {
  let k = 1;
  if (p.decimal_src && model.decimal_regs) k *= f.dec[p.decimal_src] ?? 1;
  if (p.apply_factor && model.tp_tc) {
    if (p.apply_factor === 'tp') k *= f.fTP;
    else if (p.apply_factor === 'tc') k *= f.fTC;
    else if (p.apply_factor === 'tp_tc') k *= f.fatorEnergia;
  }
  return k;
}

// ---------------------------------------------------------------------------
// Tabela de registradores
// ---------------------------------------------------------------------------

export interface RegisterTable {
  holding: Map<number, number>; // func 03
  input: Map<number, number>; // func 04
  coils: Map<number, boolean>; // func 01
  discrete: Map<number, boolean>; // func 02
}

export interface Aviso {
  nivel: 'erro' | 'aviso' | 'info';
  texto: string;
  pid?: string;
}

export interface MontagemTabela {
  table: RegisterTable;
  /** Valor que a TON vai calcular para cada ponto (readback pelo espelho do decoder). */
  leituras: Record<string, number>;
  avisos: Aviso[];
  fatores: Fatores;
}

export interface EntradaEmulador {
  model: CatalogModel; // já resolvido (overlay rtu)
  props: NodeProps;
  valores: Record<string, number | string | null | undefined>;
  bi?: Record<string, boolean | undefined>;
  cfg: EmuladorConfig;
  pointDefsAi?: DevicePointDef[];
  pointDefsBi?: DevicePointDef[];
}

export function montarTabela(e: EntradaEmulador): MontagemTabela {
  const { model, props, cfg } = e;
  const wo: WordOrder = model.word_order === 'low_first' ? 'low_first' : 'high_first';
  const table: RegisterTable = { holding: new Map(), input: new Map(), coils: new Map(), discrete: new Map() };
  const dono = { holding: new Map<number, string>(), input: new Map<number, string>() };
  const avisos: Aviso[] = [];
  const leituras: Record<string, number> = {};
  const espaco = (func: number) => (func === 0x04 ? 'input' : 'holding') as 'input' | 'holding';

  const escrever = (func: number, start: number, words: number[], quem: string) => {
    const sp = espaco(func);
    words.forEach((w, i) => {
      const addr = start + i;
      const anterior = dono[sp].get(addr);
      if (anterior && anterior !== quem && !anterior.startsWith('~') && table[sp].get(addr) !== w) {
        avisos.push({ nivel: 'aviso', texto: `Registrador ${addr} (func 0${func}) é usado por "${anterior}" e "${quem}" com valores diferentes — vale o de "${quem}".`, pid: quem });
      }
      table[sp].set(addr, w & 0xffff);
      dono[sp].set(addr, quem);
    });
  };

  // 1) Zeros em tudo que a TON lê (blocos AI + handshake) — registrador "existe" = sem exceção.
  for (const b of model.ai_blocks || []) {
    const sp = espaco(b.func);
    for (let i = 0; i < b.count; i++) {
      if (!table[sp].has(b.start + i)) { table[sp].set(b.start + i, 0); dono[sp].set(b.start + i, '~bloco'); }
    }
  }
  if (model.handshake) {
    const h = model.handshake;
    const sp = espaco(h.func);
    for (let i = 0; i < h.count; i++) if (!table[sp].has(h.register + i)) { table[sp].set(h.register + i, 0); dono[sp].set(h.register + i, '~handshake'); }
  }

  // 2) Registradores de configuração (sempre func 03 no firmware).
  const fatores = calcularFatores(model, props, cfg);
  if (model.tp_tc) {
    const t = model.tp_tc;
    const words = new Array(Math.max(t.count, t.tp_offset + 1, t.tc_offset + 1)).fill(0);
    words[t.tp_offset] = fatores.tpRaw;
    words[t.tc_offset] = fatores.tcRaw;
    escrever(0x03, t.register, words, 'Relação TP/TC');
    if (fatores.tpRaw === 0 || fatores.tcRaw === 0) {
      avisos.push({ nivel: 'erro', texto: 'Relação TP/TC = 0 zera todas as grandezas multiplicadas por TP/TC. Use 1 se não houver TP/TC.' });
    }
  }
  if (model.decimal_regs) {
    const d = model.decimal_regs;
    const words = new Array(Math.max(d.count, 1)).fill(0);
    for (const [k, l] of Object.entries(d.layout || {})) {
      const w = l.word || 0;
      const exp = clampU8(Math.round(cfg.decimais?.[k] ?? l.baseline ?? 4));
      words[w] = l.byte === 'hi' ? (words[w] & 0x00ff) | (exp << 8) : (words[w] & 0xff00) | exp;
    }
    escrever(0x03, d.register, words, 'Casas decimais');
  }

  // 3) Pontos AI.
  const { pontos, foraDoBloco, alemDoBuffer, sobrepostos } = listarPontosAi(model, props, e.pointDefsAi);
  for (const [x, y] of sobrepostos) {
    avisos.push({ nivel: 'aviso', texto: `Catálogo: "${x}" e "${y}" usam registradores em comum — mudar um altera o outro (vale o último da lista). Revisar o mapa do modelo.`, pid: y });
  }
  if (alemDoBuffer.length) {
    avisos.push({ nivel: 'aviso', texto: `Catálogo: ${alemDoBuffer.join(', ')} fica(m) depois do 64º registrador do bloco — a TON (ModbusMaster) só guarda 64; nem o equipamento real chega certo. Ignorado(s).` });
  }
  if (foraDoBloco.length) {
    avisos.push({ nivel: 'aviso', texto: `Catálogo: ${foraDoBloco.join(', ')} está(ão) fora do bloco que a TON lê — nem o equipamento real chega certo; ignorado(s) no emulador.` });
  }
  const semValor: string[] = [];
  for (const p of pontos) {
    const bruto = e.valores?.[p.pid];
    let v = bruto === '' || bruto === null || bruto === undefined ? NaN : Number(bruto);
    if (!Number.isFinite(v)) { semValor.push(p.label); v = 0; }
    const k = fatorDoPonto(model, p, fatores);
    if (k === 0) {
      avisos.push({ nivel: 'erro', texto: `${p.label}: fator TP/TC = 0, impossível representar o valor.`, pid: p.pid });
      continue;
    }
    const raw = (v * p.scale) / k;
    const enc = encodeRaw(p.dataType, raw, wo, p.meta);
    if (enc.clamped) {
      avisos.push({ nivel: 'aviso', texto: `${p.label}: ${v} ${p.unit} não cabe em ${p.dataType} (escala ${p.scale}) — limitado.`, pid: p.pid });
    }
    escrever(p.func, p.register, enc.words, p.pid);
    // readback com a matemática do C (float)
    leituras[p.pid] = Math.fround(Math.fround(Math.fround(decodeRaw(p.dataType, enc.words, wo, p.meta)) / p.scale) * k);
    for (const a of p.aliases) leituras[a] = leituras[p.pid];
  }
  if (semValor.length) {
    avisos.push({ nivel: 'info', texto: `${semValor.length} ponto(s) sem valor serão enviados como 0: ${semValor.slice(0, 6).join(', ')}${semValor.length > 6 ? '…' : ''}` });
  }

  // 4) BI: zera os blocos lidos e liga os bits marcados.
  const biBlocks = Array.isArray(model.bi_blocks) && model.bi_blocks.length > 0
    ? model.bi_blocks.map((b) => ({ ...b, func: b.func || 0x02 }))
    : model.bi_block ? [model.bi_block] : [];
  for (const b of biBlocks) {
    const m = b.func === 0x02 ? table.discrete : table.coils;
    for (let i = 0; i < b.count; i++) if (!m.has(b.start + i)) m.set(b.start + i, false);
  }
  for (const p of listarPontosBi(model, e.pointDefsBi)) {
    (p.func === 0x02 ? table.discrete : table.coils).set(p.address, !!e.bi?.[p.pid]);
  }

  return { table, leituras, avisos, fatores };
}

/** Valores típicos (botão "preencher típicos") — só preenche pids que existem no modelo. */
export const VALORES_TIPICOS: Record<string, number> = {
  va: 220, vb: 220, vc: 220, vab: 380, vbc: 380, vca: 380,
  ia: 10, ib: 10, ic: 10, in: 0,
  freq: 60, freq_rede: 60,
  fp_a: 0.92, fp_b: 0.92, fp_c: 0.92, fp_t: 0.92, fp: 0.92, fp_total: 0.92,
  cosfi_a: 0.92, cosfi_b: 0.92, cosfi_c: 0.92, fator_potencia: 0.92,
  pt: 6072, st: 6600, qt: 2587, pa_total: 6072, pr_total: 2587, potencia_ativa: 6072,
  work_state: 0, estado_operacao: 0,
};
