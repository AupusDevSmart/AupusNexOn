/**
 * Conversao objeto <-> form estruturado para o Catalogo IoT.
 *
 * Os JSONs `pontos` (tipo) e `mapeamento` (modelo) sao editados via campos no
 * builder. Estes helpers puros traduzem entre o objeto cru (como vem/vai pra
 * API) e o estado de formulario (linhas editaveis).
 *
 * PRINCIPIO: nao-destrutivo e SEM JSON cru. Todo campo conhecido tem UI propria
 * (inclusive os "avancados": group_order, publish, scales, bi_block, handshake,
 * metadados). Campos aninhados/desconhecidos que o builder nao expoe sao
 * preservados em `_extra` (por linha/objeto) ou `extrasUnknown` (top-level) e
 * reanexados no caminho de volta — nunca perdidos, nunca digitados como JSON.
 */

// Constantes espelhando mapping-validation.ts do backend (saida ja valida).
export const DATA_TYPES = ['U16', 'S16', 'U32', 'S32', 'FLOAT', 'COSFI', 'U32_SUM3'] as const;
export const MODES = ['avg', 'last', 'delta'] as const;
export const FACTORS = ['tp', 'tc', 'tp_tc', 'kd'] as const;
export const PROTOCOLOS = ['rtu', 'tcp', 'tcp_usr', 'serial'] as const;
export const TIMESTAMP_FORMATS = ['epoch', 'datetime'] as const;
export const TIMESTAMP_POSITIONS = ['first', 'last'] as const;

export type PontoKind = 'ai' | 'bi' | 'bo';

// ---------------------------------------------------------------------------
// Utils internos
// ---------------------------------------------------------------------------

let _uid = 0;
/** Chave estavel pra linhas em listas React. */
export const rowKey = (): string => `row_${++_uid}`;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isScalar(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** Valor cru -> string pra input (number vira texto; undefined vira ''). */
function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  return '';
}

/** Texto -> number, ou undefined se vazio/invalido. */
function toNum(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Valor aceita number ou string (ex: scale ref). Vazio = undefined. */
function parseNumOrStr(s: string): number | string | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : t;
}

/** Remove chaves vazias ('' ou undefined) de um objeto raso. */
function pruneEmpty(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === '') continue;
    out[k] = v;
  }
  return out;
}

// ===========================================================================
// Listas de strings e pares chave-valor (UI generica do "avancado")
// ===========================================================================

export interface KvRow {
  _key: string;
  name: string;
  value: string;
}

export const emptyKvRow = (): KvRow => ({ _key: rowKey(), name: '', value: '' });

function objToKvRows(obj: Record<string, unknown>): KvRow[] {
  return Object.entries(obj).map(([name, value]) => ({ _key: rowKey(), name, value: str(value) }));
}

/** Pares chave-valor -> objeto. Valor vira number quando numerico. */
function kvRowsToObj(rows: KvRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (name === '') continue;
    const v = parseNumOrStr(row.value);
    if (v === undefined) continue;
    out[name] = v;
  }
  return out;
}

// ===========================================================================
// PONTOS (tipo)
// ===========================================================================

export interface PontoRow {
  _key: string;
  id: string;
  label: string;
  unit: string;
  group: string;
  json: string;
  format: string;
  /** campos extras do ponto que o form nao expoe (preservados). */
  _extra: Record<string, unknown>;
}

export interface PublishForm {
  timestamp_format: string;
  timestamp_position: string;
  meta_fields: string[];
  /** subchaves de publish nao expostas (preservadas). */
  _extra: Record<string, unknown>;
}

export interface PontosForm {
  ai: PontoRow[];
  bi: PontoRow[];
  bo: PontoRow[];
  groupOrder: string[];
  publish: PublishForm;
  /** chaves top-level fora de ai/bi/bo/group_order/publish (preservadas). */
  extrasUnknown: Record<string, unknown>;
}

const PONTO_FIELDS = new Set(['id', 'label', 'unit', 'group', 'json', 'format']);
const PUBLISH_FIELDS = new Set(['timestamp_format', 'timestamp_position', 'meta_fields']);
const PONTOS_TOP = new Set(['ai', 'bi', 'bo', 'group_order', 'publish']);

export const emptyPublish = (): PublishForm => ({
  timestamp_format: '',
  timestamp_position: '',
  meta_fields: [],
  _extra: {},
});

export function emptyPontoRow(): PontoRow {
  return { _key: rowKey(), id: '', label: '', unit: '', group: '', json: '', format: '', _extra: {} };
}

export const emptyPontosForm = (): PontosForm => ({
  ai: [],
  bi: [],
  bo: [],
  groupOrder: [],
  publish: emptyPublish(),
  extrasUnknown: {},
});

function pontoToRow(raw: unknown): PontoRow {
  const row = emptyPontoRow();
  if (!isObj(raw)) return row;
  row.id = str(raw.id);
  row.label = str(raw.label);
  row.unit = str(raw.unit);
  row.group = str(raw.group);
  row.json = str(raw.json);
  row.format = str(raw.format);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!PONTO_FIELDS.has(k)) extra[k] = v;
  row._extra = extra;
  return row;
}

function rowToPonto(row: PontoRow): Record<string, unknown> | null {
  if (row.id.trim() === '') return null;
  const base = pruneEmpty({
    id: row.id.trim(),
    label: row.label,
    unit: row.unit,
    group: row.group,
    json: row.json,
    format: row.format,
  });
  return { ...row._extra, ...base };
}

function publishToForm(raw: unknown): PublishForm {
  const pub = emptyPublish();
  if (!isObj(raw)) return pub;
  pub.timestamp_format = str(raw.timestamp_format);
  pub.timestamp_position = str(raw.timestamp_position);
  pub.meta_fields = Array.isArray(raw.meta_fields) ? raw.meta_fields.map(str) : [];
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!PUBLISH_FIELDS.has(k)) extra[k] = v;
  pub._extra = extra;
  return pub;
}

function publishToObj(pub: PublishForm): Record<string, unknown> | null {
  const known = pruneEmpty({
    timestamp_format: pub.timestamp_format,
    timestamp_position: pub.timestamp_position,
  });
  const metaFields = pub.meta_fields.map((s) => s.trim()).filter((s) => s !== '');
  const obj: Record<string, unknown> = { ...pub._extra, ...known };
  if (metaFields.length) obj.meta_fields = metaFields;
  return Object.keys(obj).length ? obj : null;
}

export function pontosToForm(pontos: Record<string, unknown> | undefined): PontosForm {
  const p = pontos ?? {};
  const form = emptyPontosForm();
  form.ai = Array.isArray(p.ai) ? p.ai.map(pontoToRow) : [];
  form.bi = Array.isArray(p.bi) ? p.bi.map(pontoToRow) : [];
  form.bo = Array.isArray(p.bo) ? p.bo.map(pontoToRow) : [];
  form.groupOrder = Array.isArray(p.group_order) ? p.group_order.map(str) : [];
  form.publish = publishToForm(p.publish);
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!PONTOS_TOP.has(k)) extras[k] = v;
  form.extrasUnknown = extras;
  return form;
}

export function formToPontos(form: PontosForm): Record<string, unknown> {
  const out: Record<string, unknown> = { ...form.extrasUnknown };
  const groupOrder = form.groupOrder.map((s) => s.trim()).filter((s) => s !== '');
  if (groupOrder.length) out.group_order = groupOrder;
  const publish = publishToObj(form.publish);
  if (publish) out.publish = publish;
  out.ai = form.ai.map(rowToPonto).filter((x): x is Record<string, unknown> => x !== null);
  out.bi = form.bi.map(rowToPonto).filter((x): x is Record<string, unknown> => x !== null);
  out.bo = form.bo.map(rowToPonto).filter((x): x is Record<string, unknown> => x !== null);
  return out;
}

// ===========================================================================
// MAPEAMENTO (modelo)
// ===========================================================================

export interface AiBlockRow {
  _key: string;
  start: string;
  count: string;
  func: string;
  label: string;
  _extra: Record<string, unknown>;
}

export interface AiMapRow {
  _key: string;
  pointId: string;
  pointLabel: string;
  orphan: boolean;
  block: string;
  offset: string;
  scale: string;
  dataType: string;
  mode: string;
  apply_factor: string;
  _extra: Record<string, unknown>;
}

export interface BiBoMapRow {
  _key: string;
  pointId: string;
  pointLabel: string;
  orphan: boolean;
  register: string;
  coil: string;
  func: string;
  _extra: Record<string, unknown>;
}

export interface BiBlockForm {
  start: string;
  count: string;
  func: string;
  _extra: Record<string, unknown>;
}

export interface HandshakeForm {
  register: string;
  count: string;
  func: string;
  _extra: Record<string, unknown>;
}

export interface MapeamentoForm {
  aiBlocks: AiBlockRow[];
  aiRows: AiMapRow[];
  biRows: BiBoMapRow[];
  boRows: BiBoMapRow[];
  // avancado estruturado
  scales: KvRow[];
  biBlock: BiBlockForm;
  handshake: HandshakeForm;
  meta: KvRow[];
  /** chaves top-level aninhadas/desconhecidas preservadas invisivelmente. */
  extrasUnknown: Record<string, unknown>;
}

const AIMAP_FIELDS = new Set(['block', 'offset', 'scale', 'dataType', 'mode', 'apply_factor']);
const BIBO_FIELDS = new Set(['register', 'coil', 'func']);
const BLOCK_FIELDS = new Set(['start', 'count', 'func', 'label']);
const STRUCTURED_TOP = new Set(['ai_blocks', 'ai_map', 'bi_map', 'bo_map', 'catalog_id']);
const BIBLOCK_FIELDS = new Set(['start', 'count', 'func']);
const HANDSHAKE_FIELDS = new Set(['register', 'count', 'func']);

export const emptyBiBlock = (): BiBlockForm => ({ start: '', count: '', func: '', _extra: {} });
export const emptyHandshake = (): HandshakeForm => ({ register: '', count: '', func: '', _extra: {} });

export function emptyAiBlockRow(): AiBlockRow {
  return { _key: rowKey(), start: '', count: '', func: '', label: '', _extra: {} };
}

export const emptyMapeamentoForm = (): MapeamentoForm => ({
  aiBlocks: [],
  aiRows: [],
  biRows: [],
  boRows: [],
  scales: [],
  biBlock: emptyBiBlock(),
  handshake: emptyHandshake(),
  meta: [],
  extrasUnknown: {},
});

function blockToRow(raw: unknown): AiBlockRow {
  const row = emptyAiBlockRow();
  if (!isObj(raw)) return row;
  row.start = str(raw.start);
  row.count = str(raw.count);
  row.func = str(raw.func);
  row.label = str(raw.label);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!BLOCK_FIELDS.has(k)) extra[k] = v;
  row._extra = extra;
  return row;
}

function rowToBlock(row: AiBlockRow): Record<string, unknown> | null {
  const start = toNum(row.start);
  const count = toNum(row.count);
  if (start === undefined && count === undefined && row.label.trim() === '') return null;
  const out: Record<string, unknown> = { ...row._extra };
  if (start !== undefined) out.start = start;
  if (count !== undefined) out.count = count;
  const func = toNum(row.func);
  if (func !== undefined) out.func = func;
  if (row.label.trim() !== '') out.label = row.label;
  return out;
}

function aiEntryToRow(pointId: string, pointLabel: string, raw: unknown, orphan: boolean): AiMapRow {
  const row: AiMapRow = {
    _key: rowKey(),
    pointId,
    pointLabel,
    orphan,
    block: '',
    offset: '',
    scale: '',
    dataType: '',
    mode: '',
    apply_factor: '',
    _extra: {},
  };
  if (!isObj(raw)) return row;
  row.block = str(raw.block);
  row.offset = str(raw.offset);
  row.scale = str(raw.scale);
  row.dataType = str(raw.dataType);
  row.mode = str(raw.mode);
  row.apply_factor = str(raw.apply_factor);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!AIMAP_FIELDS.has(k)) extra[k] = v;
  row._extra = extra;
  return row;
}

function biboEntryToRow(pointId: string, pointLabel: string, raw: unknown, orphan: boolean): BiBoMapRow {
  const row: BiBoMapRow = {
    _key: rowKey(),
    pointId,
    pointLabel,
    orphan,
    register: '',
    coil: '',
    func: '',
    _extra: {},
  };
  if (!isObj(raw)) return row;
  row.register = str(raw.register);
  row.coil = str(raw.coil);
  row.func = str(raw.func);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!BIBO_FIELDS.has(k)) extra[k] = v;
  row._extra = extra;
  return row;
}

function aiRowFilled(row: AiMapRow): boolean {
  return (
    row.block.trim() !== '' ||
    row.offset.trim() !== '' ||
    row.scale.trim() !== '' ||
    row.dataType !== '' ||
    row.mode !== '' ||
    row.apply_factor !== '' ||
    Object.keys(row._extra).length > 0
  );
}

function biboRowFilled(row: BiBoMapRow): boolean {
  return (
    row.register.trim() !== '' ||
    row.coil.trim() !== '' ||
    row.func.trim() !== '' ||
    Object.keys(row._extra).length > 0
  );
}

function rowToAiEntry(row: AiMapRow): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row._extra };
  const block = toNum(row.block);
  const offset = toNum(row.offset);
  const scale = parseNumOrStr(row.scale);
  if (block !== undefined) out.block = block;
  if (offset !== undefined) out.offset = offset;
  if (scale !== undefined) out.scale = scale;
  if (row.dataType !== '') out.dataType = row.dataType;
  if (row.mode !== '') out.mode = row.mode;
  if (row.apply_factor !== '') out.apply_factor = row.apply_factor;
  return out;
}

function rowToBiboEntry(row: BiBoMapRow): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row._extra };
  const register = toNum(row.register);
  const coil = toNum(row.coil);
  const func = toNum(row.func);
  if (register !== undefined) out.register = register;
  if (coil !== undefined) out.coil = coil;
  if (func !== undefined) out.func = func;
  return out;
}

function tripletToForm(
  raw: unknown,
  fields: Set<string>,
): { values: Record<string, string>; _extra: Record<string, unknown> } {
  const values: Record<string, string> = {};
  const extra: Record<string, unknown> = {};
  if (isObj(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (fields.has(k)) values[k] = str(v);
      else extra[k] = v;
    }
  }
  return { values, _extra: extra };
}

function biBlockToForm(raw: unknown): BiBlockForm {
  const { values, _extra } = tripletToForm(raw, BIBLOCK_FIELDS);
  return { start: values.start ?? '', count: values.count ?? '', func: values.func ?? '', _extra };
}

function handshakeToForm(raw: unknown): HandshakeForm {
  const { values, _extra } = tripletToForm(raw, HANDSHAKE_FIELDS);
  return {
    register: values.register ?? '',
    count: values.count ?? '',
    func: values.func ?? '',
    _extra,
  };
}

function tripletToObj(
  parts: Array<[string, string]>,
  extra: Record<string, unknown>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = { ...extra };
  for (const [k, v] of parts) {
    const n = toNum(v);
    if (n !== undefined) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

interface TipoPontosLite {
  ai?: Array<{ id?: unknown; label?: unknown }>;
  bi?: Array<{ id?: unknown; label?: unknown }>;
  bo?: Array<{ id?: unknown; label?: unknown }>;
}

function pointList(pontos: unknown, kind: PontoKind): Array<{ id: string; label: string }> {
  if (!isObj(pontos)) return [];
  const arr = (pontos as TipoPontosLite)[kind];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p) => ({ id: str(isObj(p) ? p.id : ''), label: str(isObj(p) ? p.label : '') }))
    .filter((p) => p.id !== '');
}

/**
 * Constroi o form do mapeamento. Gera UMA LINHA POR PONTO do tipo (pre-carrega
 * o contrato), preenchida com o mapa existente quando ha. Chaves mapeadas que
 * nao existem mais no tipo viram linhas orfas no fim. Os "avancados" sao
 * roteados pra UI estruturada; o que nao casar fica preservado em extrasUnknown.
 */
export function mapeamentoToForm(
  mapeamento: Record<string, unknown> | undefined,
  tipoPontos: unknown,
): MapeamentoForm {
  const m = mapeamento ?? {};
  const form = emptyMapeamentoForm();
  form.aiBlocks = Array.isArray(m.ai_blocks) ? m.ai_blocks.map(blockToRow) : [];

  const buildRows = <T>(
    kind: PontoKind,
    mapKey: 'ai_map' | 'bi_map' | 'bo_map',
    fromEntry: (id: string, label: string, raw: unknown, orphan: boolean) => T,
  ): T[] => {
    const map = isObj(m[mapKey]) ? (m[mapKey] as Record<string, unknown>) : {};
    const points = pointList(tipoPontos, kind);
    const used = new Set<string>();
    const rows = points.map((pt) => {
      used.add(pt.id);
      return fromEntry(pt.id, pt.label, map[pt.id], false);
    });
    for (const [id, raw] of Object.entries(map)) {
      if (!used.has(id)) rows.push(fromEntry(id, '', raw, true));
    }
    return rows;
  };

  form.aiRows = buildRows('ai', 'ai_map', aiEntryToRow);
  form.biRows = buildRows('bi', 'bi_map', biboEntryToRow);
  form.boRows = buildRows('bo', 'bo_map', biboEntryToRow);

  // Avancado: roteia cada chave top-level pra UI certa.
  for (const [k, v] of Object.entries(m)) {
    if (STRUCTURED_TOP.has(k)) continue;
    if (k === 'scales' && isObj(v)) {
      form.scales = objToKvRows(v);
    } else if (k === 'bi_block') {
      form.biBlock = biBlockToForm(v);
    } else if (k === 'handshake') {
      form.handshake = handshakeToForm(v);
    } else if (isScalar(v)) {
      form.meta.push({ _key: rowKey(), name: k, value: str(v) });
    } else {
      form.extrasUnknown[k] = v;
    }
  }

  return form;
}

/** Monta o objeto `mapeamento`. Nao inclui catalog_id (campo a parte). */
export function formToMapeamento(form: MapeamentoForm): Record<string, unknown> {
  const out: Record<string, unknown> = { ...form.extrasUnknown };

  // metadados escalares (num_mppts, word_order, ...)
  Object.assign(out, kvRowsToObj(form.meta));

  const scales = kvRowsToObj(form.scales);
  if (Object.keys(scales).length) out.scales = scales;

  const biBlock = tripletToObj(
    [
      ['start', form.biBlock.start],
      ['count', form.biBlock.count],
      ['func', form.biBlock.func],
    ],
    form.biBlock._extra,
  );
  if (biBlock) out.bi_block = biBlock;

  const handshake = tripletToObj(
    [
      ['register', form.handshake.register],
      ['count', form.handshake.count],
      ['func', form.handshake.func],
    ],
    form.handshake._extra,
  );
  if (handshake) out.handshake = handshake;

  out.ai_blocks = form.aiBlocks
    .map(rowToBlock)
    .filter((x): x is Record<string, unknown> => x !== null);

  const ai_map: Record<string, unknown> = {};
  for (const row of form.aiRows) {
    if (row.pointId.trim() === '' || !aiRowFilled(row)) continue;
    ai_map[row.pointId.trim()] = rowToAiEntry(row);
  }
  out.ai_map = ai_map;

  const buildBibo = (rows: BiBoMapRow[]): Record<string, unknown> => {
    const o: Record<string, unknown> = {};
    for (const row of rows) {
      if (row.pointId.trim() === '' || !biboRowFilled(row)) continue;
      o[row.pointId.trim()] = rowToBiboEntry(row);
    }
    return o;
  };
  out.bi_map = buildBibo(form.biRows);
  out.bo_map = buildBibo(form.boRows);

  return out;
}
