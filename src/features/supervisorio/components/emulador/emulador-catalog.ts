/**
 * Emulador Modbus RTU — leitura do catálogo de devices (DEVICE_MODELS / DEVICE_POINTS).
 *
 * O emulador faz o PC se passar por um device real no RS485 da TON. Por isso ele usa
 * EXATAMENTE o mesmo mapa que o gerador de firmware usa pra ler esse device:
 *   - overlay `por_transporte.rtu` (mesma regra de FirmwareGenerator._catTransporte);
 *   - overrides de escala do nó (current/voltage_scale_override — _applyScaleOverrides);
 *   - pontos `mode: 'delta'` são DERIVADOS (a TON calcula last - first) → não editáveis.
 *
 * Tudo aqui é puro (sem window): o catálogo é passado como argumento.
 */

export interface AiMapEntry {
  block?: number;
  offset?: number;
  scale?: number | string;
  dataType?: string;
  mode?: string;
  decimal_src?: string;
  apply_factor?: string;
  regs_per?: number;
  count?: number;
  format?: string;
  [k: string]: unknown;
}

export interface CatalogModel {
  fabricante?: string;
  modelo?: string;
  tipo?: string;
  protocolo?: string;
  word_order?: string;
  scales?: Record<string, number>;
  ai_blocks?: { start: number; count: number; func: number; label?: string }[];
  ai_map?: Record<string, AiMapEntry>;
  bi_block?: { start: number; count: number; func: number } | null;
  bi_blocks?: { start: number; count: number; func?: number; label?: string }[];
  bi_map?: Record<string, { coil?: number; block?: number; bit?: number; [k: string]: unknown }>;
  tp_tc?: { register: number; count: number; tp_offset: number; tc_offset: number; scale_tp?: number; scale_tc?: number };
  decimal_regs?: {
    register: number;
    count: number;
    layout?: Record<string, { word?: number; byte?: 'hi' | 'lo'; baseline?: number }>;
  };
  handshake?: { register: number; count: number; func: number };
  por_transporte?: Record<string, Partial<CatalogModel>>;
  [k: string]: unknown;
}

export interface DevicePointDef {
  id: string;
  label?: string;
  unit?: string;
  group?: string;
}

/** Tipo do componente no diagrama → device_type do catálogo (campo device_select). */
export const TIPOS_EMULAVEIS: Record<string, { catalogTipo: string; label: string }> = {
  power_meter: { catalogTipo: 'medidor_energia', label: 'Power Meter' },
  medidor_comum: { catalogTipo: 'medidor_energia', label: 'Medidor Concessionária' },
  inversor: { catalogTipo: 'inversor_solar', label: 'Inversor Solar' },
  rele_protecao: { catalogTipo: 'rele_protecao', label: 'Relé de Proteção' },
  encoder: { catalogTipo: 'encoder_posicao', label: 'Encoder' },
};

/** Só modelos que falam Modbus RTU no fio ('rtu', 'tcp/rtu'). TCP / USR / serial ficam fora. */
export function isModeloRtu(model: CatalogModel | null | undefined): boolean {
  const p = String(model?.protocolo ?? '').toLowerCase();
  return p.split(/[/,\s]+/).includes('rtu');
}

/** Aplica o overlay `por_transporte.rtu` (cópia rasa — igual ao gerador). */
export function resolverModeloRtu(model: CatalogModel): CatalogModel {
  const overlay = model.por_transporte?.rtu;
  if (!overlay || typeof overlay !== 'object') return model;
  const out: CatalogModel = { ...model, ...overlay };
  delete out.por_transporte;
  return out;
}

export function listarModelosRtu(
  models: Record<string, CatalogModel>,
  catalogTipo: string,
): { id: string; label: string }[] {
  return Object.entries(models || {})
    .filter(([, m]) => m && m.tipo === catalogTipo && isModeloRtu(m))
    .map(([id, m]) => ({ id, label: `${m.fabricante ?? '?'} ${m.modelo ?? id}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ---- overrides de escala (cópia fiel de FirmwareGenerator._applyScaleOverrides) ----

export function parseScaleOverride(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}
const isCurrentPid = (pid: string) => /^(i[abc]|I[abc]|ia|ib|ic|Ia|Ib|Ic)$/.test(pid);
const isVoltagePid = (pid: string) => /^(v[abc]|V[abc]|v(ab|bc|ca)|V(ab|bc|ca))$/.test(pid);

export interface NodeProps {
  current_scale_override?: unknown;
  voltage_scale_override?: unknown;
  tc_ratio?: unknown;
  tp_ratio?: unknown;
  [k: string]: unknown;
}

export function aplicarOverridesEscala(aiMap: Record<string, AiMapEntry>, props: NodeProps): Record<string, AiMapEntry> {
  const iOver = parseScaleOverride(props?.current_scale_override);
  const vOver = parseScaleOverride(props?.voltage_scale_override);
  if (!iOver && !vOver) return aiMap;
  const out: Record<string, AiMapEntry> = {};
  for (const [pid, m] of Object.entries(aiMap)) {
    if (iOver && isCurrentPid(pid)) out[pid] = { ...m, scale: iOver };
    else if (vOver && isVoltagePid(pid)) out[pid] = { ...m, scale: vOver };
    else out[pid] = m;
  }
  return out;
}

/** Mesma regra de FirmwareGenerator._resolveScale. */
export function resolverEscala(scale: unknown, scales: Record<string, number> | undefined): number {
  if (scale === undefined || scale === null) return 1;
  if (typeof scale === 'number') return scale;
  if (typeof scale === 'string' && scales && scales[scale] !== undefined) return scales[scale];
  return 1;
}

// ---- pontos editáveis ----

export interface PontoAi {
  pid: string;
  label: string;
  unit: string;
  dataType: string;
  /** Escala efetiva (já com override). value = raw / scale × fatores. */
  scale: number;
  /** Registrador absoluto inicial e função (3 = holding, 4 = input). */
  register: number;
  func: number;
  regs: number;
  decimal_src?: string;
  apply_factor?: string;
  format?: string;
  meta: AiMapEntry;
  /** Outros pids que apontam pro MESMO registrador/tipo/escala (recebem o mesmo valor). */
  aliases: string[];
}

export interface PontoBi {
  pid: string;
  label: string;
  /** Endereço absoluto do bit e função (1 = coils, 2 = discrete inputs). */
  address: number;
  func: number;
}

/** ku8MaxBufferSize da lib ModbusMaster usada pela TON. */
export const MODBUSMASTER_MAX_WORDS = 64;

export function regsDoTipo(m: AiMapEntry): number {
  const dt = m.dataType || 'U16';
  if (dt === 'U32_SUM3') return (Number(m.regs_per) || 2) * (Number(m.count) || 3);
  return Number(m.regs_per) || (dt === 'U32' || dt === 'S32' || dt === 'FLOAT' ? 2 : 1);
}

/**
 * Pontos AI que o emulador deve servir (exclui `mode: 'delta'`, que é derivado).
 * Os derivados vêm em `derivados` só pra UI explicar por que sumiram.
 */
export function listarPontosAi(
  model: CatalogModel,
  props: NodeProps,
  pointDefs: DevicePointDef[] = [],
): { pontos: PontoAi[]; derivados: string[]; foraDoBloco: string[]; alemDoBuffer: string[]; sobrepostos: [string, string][] } {
  const blocks = model.ai_blocks || [];
  const aiMap = aplicarOverridesEscala(model.ai_map || {}, props);
  const defs = new Map(pointDefs.map((p) => [p.id, p]));
  const pontos: PontoAi[] = [];
  const derivados: string[] = [];
  const foraDoBloco: string[] = [];
  const alemDoBuffer: string[] = [];
  const porChave = new Map<string, PontoAi>();
  for (const [pid, m] of Object.entries(aiMap)) {
    if (m.block === undefined || m.offset === undefined) continue;
    if (m.block >= blocks.length) continue;
    if (m.mode === 'delta') { derivados.push(pid); continue; }
    const b = blocks[m.block];
    // Ponto além do fim do bloco: o firmware lê fora do buffer (lixo) — erro de catálogo.
    if (m.offset + regsDoTipo(m) > b.count) { foraDoBloco.push(pid); continue; }
    // ModbusMaster (RS485 da TON) guarda no máximo 64 words por resposta: o resto do bloco se perde.
    if (m.offset + regsDoTipo(m) > MODBUSMASTER_MAX_WORDS) { alemDoBuffer.push(pid); continue; }
    const scale = resolverEscala(m.scale, model.scales);
    const chave = `${b.func}:${b.start + m.offset}:${m.dataType || 'U16'}:${scale}:${m.decimal_src ?? ''}:${m.apply_factor ?? ''}`;
    const igual = porChave.get(chave);
    if (igual) { igual.aliases.push(pid); continue; }
    const def = defs.get(pid);
    const ponto: PontoAi = {
      pid,
      label: def?.label || (typeof m.label === 'string' ? m.label : pid),
      unit: def?.unit ?? (typeof m.unit === 'string' ? m.unit : ''),
      dataType: m.dataType || 'U16',
      scale,
      register: b.start + m.offset,
      func: b.func,
      regs: regsDoTipo(m),
      decimal_src: m.decimal_src,
      apply_factor: m.apply_factor,
      format: m.format,
      meta: m,
      aliases: [],
    };
    porChave.set(chave, ponto);
    pontos.push(ponto);
  }
  // Pontos diferentes que dividem registradores (erro de catálogo): não dá pra ajustar
  // um sem mexer no outro — nem no equipamento real os dois fazem sentido ao mesmo tempo.
  const sobrepostos: [string, string][] = [];
  for (let i = 0; i < pontos.length; i++) {
    for (let j = i + 1; j < pontos.length; j++) {
      const a = pontos[i], b = pontos[j];
      if ((a.func === 0x04) !== (b.func === 0x04)) continue;
      if (a.register < b.register + b.regs && b.register < a.register + a.regs) sobrepostos.push([a.pid, b.pid]);
    }
  }
  return { pontos, derivados, foraDoBloco, alemDoBuffer, sobrepostos };
}

/**
 * Pontos BI que a TON lê no RS485 — os mesmos 2 esquemas do gerador:
 *   novo:   bi_blocks[] + bi_map {pid:{block,bit}}
 *   legado: bi_block   + bi_map {pid:{coil}}  (coil relativo ao start do bloco)
 * Entradas tipo {register, func} (work_state dos inversores) NÃO são lidas como BI
 * no RS485 — o work_state chega como AI.
 */
export function listarPontosBi(model: CatalogModel, pointDefs: DevicePointDef[] = []): PontoBi[] {
  const biMap = model.bi_map || {};
  const defs = new Map(pointDefs.map((p) => [p.id, p]));
  const label = (pid: string) => defs.get(pid)?.label || pid;
  const out: PontoBi[] = [];
  const novos = Array.isArray(model.bi_blocks) && model.bi_blocks.length > 0 ? model.bi_blocks : null;
  if (novos) {
    for (const [pid, m] of Object.entries(biMap)) {
      if (m.bit === undefined || m.block === undefined || m.block >= novos.length) continue;
      const b = novos[m.block];
      out.push({ pid, label: label(pid), address: b.start + m.bit, func: b.func || 0x02 });
    }
    return out;
  }
  const bb = model.bi_block;
  if (bb && Object.keys(biMap).length > 0) {
    for (const [pid, m] of Object.entries(biMap)) {
      if (m.coil === undefined) continue;
      out.push({ pid, label: label(pid), address: bb.start + m.coil, func: bb.func === 0x02 ? 0x02 : 0x01 });
    }
  }
  return out;
}

/** Códigos de work_state (Sungrow) — mesmos de _work_state_text no firmware. */
export const WORK_STATE_CODES: { value: number; label: string }[] = [
  { value: 0x0000, label: 'Run' },
  { value: 0x8000, label: 'Stop' },
  { value: 0x1300, label: 'Key Stop' },
  { value: 0x1500, label: 'Emergency Stop' },
  { value: 0x1400, label: 'Standby' },
  { value: 0x1200, label: 'Initial Standby' },
  { value: 0x1600, label: 'Starting' },
  { value: 0x9100, label: 'Alarm Run' },
  { value: 0x8100, label: 'Derating Run' },
  { value: 0x8200, label: 'Dispatch Run' },
  { value: 0x5500, label: 'Fault' },
  { value: 0x2500, label: 'Communication Fault' },
];
