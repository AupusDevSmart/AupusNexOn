#!/usr/bin/env node
// Harness de regressão do gerador de firmware V1 (Fase 0 do plano TON-V2).
//
// Gera firmware de TODOS os diagramas reais do corpus com os scripts públicos
// atuais e compara os hashes com um baseline. Critério: byte-idêntico para
// qualquer diagrama sem componente v2.
//
// Uso:
//   node scripts/regressao-firmware-v1.mjs --baseline   # grava scripts/regressao-baseline.json
//   node scripts/regressao-firmware-v1.mjs --check      # compara com o baseline (exit 1 se divergir)
//
// O corpus (regressao-corpus.json) e o catálogo (regressao-catalog.snapshot.js)
// são snapshots congelados — regenerar só quando a INTENÇÃO for mudar a base
// de comparação.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const BASELINE_PATH = join(HERE, 'regressao-baseline.json');

const mode = process.argv.includes('--baseline') ? 'baseline'
  : process.argv.includes('--check') ? 'check' : null;
if (!mode) { console.error('use --baseline ou --check'); process.exit(2); }

// ---- sandbox com Date congelado (FIRMWARE_VERSION embute timestamp) ----
const FIXED_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) { args.length === 0 ? super(FIXED_MS) : super(...args); }
  static now() { return FIXED_MS; }
}

const sandbox = {
  console, Date: FrozenDate,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  document: { createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, addEventListener() {} }), addEventListener() {}, getElementById: () => null },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { userAgent: 'harness' },
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.IOT_SIMULATE = false;
vm.createContext(sandbox);

function load(label, path) {
  const src = readFileSync(path, 'utf8');
  vm.runInContext(src, sandbox, { filename: label });
}

load('catalog', join(HERE, 'regressao-catalog.snapshot.js'));
load('base', join(PUBLIC, 'iot-firmware-base.v2.js'));
load('generator', join(PUBLIC, 'iot-firmware-generator.v2.js'));
load('diagram', join(PUBLIC, 'iot-diagram.v2.js')); // COMPONENT_TYPES (o gerador lê em runtime)

const corpus = JSON.parse(readFileSync(join(HERE, 'regressao-corpus.json'), 'utf8'));

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const results = {};

for (const proj of corpus) {
  const key = `${proj.id} (${proj.nome})`;
  try {
    const editor = {
      components: proj.diagrama.components || [],
      connections: proj.diagrama.connections || [],
      simulate: false,
      loraAutonomous: false,
    };
    const gen = new (vm.runInContext('FirmwareGenerator', sandbox))(editor);
    const projects = gen.generateAll();
    const out = {};
    for (const p of projects) {
      const files = {};
      for (const [path, content] of Object.entries(p.files || {})) files[path] = sha(String(content));
      out[p.name] = { files, warnings: (p.warnings || []).slice().sort() };
    }
    results[key] = out;
  } catch (e) {
    results[key] = { __error: String(e && e.message || e) };
  }
}

if (mode === 'baseline') {
  writeFileSync(BASELINE_PATH, JSON.stringify(results, null, 2));
  const nProj = Object.keys(results).length;
  const nTons = Object.values(results).reduce((a, r) => a + (r.__error ? 0 : Object.keys(r).length), 0);
  const nErr = Object.values(results).filter((r) => r.__error).length;
  console.log(`baseline gravado: ${nProj} diagramas, ${nTons} firmwares, ${nErr} com erro de geração`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const diffs = [];
const keys = new Set([...Object.keys(baseline), ...Object.keys(results)]);
for (const k of keys) {
  const a = JSON.stringify(baseline[k]);
  const b = JSON.stringify(results[k]);
  if (a !== b) diffs.push(k);
}
if (diffs.length) {
  console.error(`REGRESSÃO: ${diffs.length} diagrama(s) divergem do baseline:`);
  for (const d of diffs) console.error(`  - ${d}`);
  process.exit(1);
}
console.log(`OK: ${keys.size} diagramas byte-idênticos ao baseline`);
