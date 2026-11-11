#!/usr/bin/env node
// Cross-check do Emulador Modbus RTU contra o DECODER REAL do firmware.
//
// Para cada modelo RTU do catálogo (o mesmo que o browser carrega), em vários cenários
// (valores neutros, TP/TC e casas decimais != 1, overrides do nó):
//   1. o encoder do emulador (src/.../emulador-encoder.ts) monta a tabela de registradores;
//   2. as expressões C de decodificação vêm do PRÓPRIO gerador (FirmwareGeneratorTonV2:
//      _catTransporte('rtu') + _applyScaleOverrides + _resolveScale + _decodeExpr), com o
//      mesmo encadeamento de casa decimal / apply_factor do _genDeviceReader;
//   3. um programa C++ é compilado com g++ e roda o decoder sobre os registradores;
//   4. compara o valor que a TON calcularia com o valor digitado (tolerância = meio passo
//      de quantização do registrador).
//
// Uso: node tools/emulador-crosscheck.mjs [--catalog arquivo.js]
//   (sem --catalog: baixa de FW_CATALOG_URL ou http://localhost:3001/api/v1/iot-catalog/device-catalog.js)

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { loadGenerators } from './fw-regress/load-generators.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
// TS -> ESM em memória (esbuild já é dependência do Vite)
async function importTs(file) {
  const r = buildSync({ entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const EMU = resolve(ROOT, 'src/features/supervisorio/components/emulador');
const enc = await importTs(resolve(EMU, 'emulador-encoder.ts'));
const cat = await importTs(resolve(EMU, 'emulador-catalog.ts'));

const argCat = process.argv.indexOf('--catalog');
let catalogCode;
if (argCat > 0) catalogCode = readFileSync(process.argv[argCat + 1], 'utf8');
else {
  const url = process.env.FW_CATALOG_URL || 'http://localhost:3001/api/v1/iot-catalog/device-catalog.js';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`catálogo HTTP ${r.status} em ${url}`);
  catalogCode = await r.text();
}

const { FirmwareGeneratorTonV2 } = loadGenerators({ catalogCode });
const G = FirmwareGeneratorTonV2.prototype;
// DEVICE_MODELS/DEVICE_POINTS do mesmo código de catálogo
const sandbox = {};
new Function('g', `${catalogCode}\n;g.DM = DEVICE_MODELS; g.DP = DEVICE_POINTS;`)(sandbox);
const { DM, DP } = sandbox;

// gerador determinístico
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const LIM = { U16: [0, 65535], S16: [-32768, 32767], U32: [0, 4294967295], S32: [-2147483648, 2147483647], COSFI: [-32767, 32767], FLOAT: [-1e6, 1e6], U32_SUM3: [-2e9, 2e9] };

function valorAleatorio(p, k) {
  const [mn, mx] = LIM[p.dataType] || LIM.U16;
  // raw alvo em até 1e6 (ou no limite do tipo), convertido pra engenharia
  const rmn = Math.max(mn, -1e6), rmx = Math.min(mx, 1e6);
  const raw = rmn + rnd() * (rmx - rmn);
  return Number(((raw * k) / p.scale).toPrecision(7));
}

const cenarios = [
  { nome: 'neutro', props: {}, cfg: (m) => enc.configPadrao(m) },
  { nome: 'tp13.8/tc80/dec', props: {}, cfg: (m) => {
    const c = enc.configPadrao(m); c.tp = 13.8; c.tc = 80;
    for (const k of Object.keys(c.decimais)) c.decimais[k] = c.decimais[k] - 1; return c; } },
  { nome: 'override-no', props: { tc_ratio: '40', tp_ratio: '1', current_scale_override: '100', voltage_scale_override: '10' }, cfg: (m) => ({ ...enc.configPadrao(m), tc: 80 }) },
];

const dir = mkdtempSync(join(tmpdir(), 'emu-xcheck-'));
let total = 0, falhas = 0, conflitos = 0;
const resumo = [];

for (const [id, base] of Object.entries(DM)) {
  if (!cat.isModeloRtu(base)) continue;
  for (const cen of cenarios) {
    const model = cat.resolverModeloRtu(base);
    const cfg = cen.cfg(model);
    const props = cen.props;
    const pdefs = (DP[model.tipo] && DP[model.tipo].ai) || [];
    const { pontos, foraDoBloco, alemDoBuffer } = cat.listarPontosAi(model, props, pdefs);
    const pontoDe = (pid) => pontos.find((x) => x.pid === pid || x.aliases.includes(pid));
    const fat = enc.calcularFatores(model, props, cfg);
    const valores = {};
    for (const p of pontos) valores[p.pid] = valorAleatorio(p, enc.fatorDoPonto(model, p, fat));
    const mont = enc.montarTabela({ model, props, valores, cfg, pointDefsAi: pdefs });
    const pidsConflito = new Set(mont.avisos.filter((a) => a.pid && /usado por/.test(a.texto)).flatMap((a) => (a.texto.match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1))));
    for (const p of pontos) if (pidsConflito.has(p.pid)) p.aliases.forEach((a) => pidsConflito.add(a));

    // ---- lado do GERADOR ----
    const gcat = G._catTransporte.call(G, base, 'rtu');
    const dev = { ...props, current_scale_override: G._parseScaleOverride(props.current_scale_override), voltage_scale_override: G._parseScaleOverride(props.voltage_scale_override) };
    const aiMap = G._applyScaleOverrides.call(G, gcat.ai_map || {}, dev);
    const blocks = gcat.ai_blocks || [];
    const offs = []; let acc = 0; for (const b of blocks) { offs.push(acc); acc += b.count; }
    const buf = [];
    blocks.forEach((b) => { const sp = b.func === 4 ? mont.table.input : mont.table.holding; for (let i = 0; i < b.count; i++) buf.push(sp.get(b.start + i) ?? 0); });
    const wo = gcat.word_order || 'high_first';
    const exprs = [];
    for (const [pid, m] of Object.entries(aiMap)) {
      if (m.block === undefined || m.offset === undefined || m.block >= blocks.length) continue;
      if (m.mode === 'delta') continue;
      if (foraDoBloco.includes(pid) || alemDoBuffer.includes(pid)) continue; // erro de catálogo (lê fora do buffer) — avisado na UI
      let d = G._decodeExpr.call(G, m.dataType || 'U16', 'buf', offs[m.block] + m.offset, G._resolveScale.call(G, m.scale, gcat.scales || {}), m, wo);
      if (!d) continue;
      if (m.decimal_src && gcat.decimal_regs) {
        const v = { dpt: '_fDPT', dct: '_fDCT', dpq: '_fDPQ' }[m.decimal_src]; if (v) d = `(${d}) * ${v}`;
      }
      if (m.apply_factor) {
        const v = { tp: '_fTP', tc: '_fTC', tp_tc: '_fatorEnergia' }[m.apply_factor]; if (v) d = `(${d}) * ${v}`;
      }
      exprs.push([pid, d]);
    }
    // fatores como o C calcula (lendo os registradores emulados)
    let fat_c = 'float _fTP = 1.0f, _fTC = 1.0f, _fatorEnergia = 1.0f;\n';
    if (gcat.tp_tc) {
      const t = gcat.tp_tc;
      const tpRaw = mont.table.holding.get(t.register + t.tp_offset) ?? 0;
      const tcRaw = mont.table.holding.get(t.register + t.tc_offset) ?? 0;
      fat_c += `{ uint16_t _tp_raw = ${tpRaw}, _tc_raw = ${tcRaw}; _fTP = (float)_tp_raw / ${(Number(t.scale_tp) || 1).toFixed(1)}f; _fTC = (float)_tc_raw / ${(Number(t.scale_tc) || 1).toFixed(1)}f;\n`;
      const tpOv = G._parseScaleOverride(props.tp_ratio), tcOv = G._parseScaleOverride(props.tc_ratio);
      if (tpOv) fat_c += `_fTP = ${tpOv.toFixed(1)}f;\n`;
      if (tcOv) fat_c += `_fTC = ${tcOv.toFixed(1)}f;\n`;
      fat_c += '_fatorEnergia = _fTP * _fTC; }\n';
    }
    fat_c += 'float _fDPT = 1.0f, _fDCT = 1.0f, _fDPQ = 1.0f;\n';
    if (gcat.decimal_regs) {
      const dr = gcat.decimal_regs, L = dr.layout || {};
      const w0 = mont.table.holding.get(dr.register) ?? 0, w1 = mont.table.holding.get(dr.register + (dr.count > 1 ? 1 : 0)) ?? 0;
      fat_c += `{ uint16_t _dec0 = ${w0}, _dec1 = ${w1}; (void)_dec1;\n`;
      for (const [k, v] of Object.entries({ dpt: '_fDPT', dct: '_fDCT', dpq: '_fDPQ' })) {
        const c = L[k]; if (!c) continue;
        const ex = c.byte === 'hi' ? `(_dec${c.word || 0} >> 8) & 0xFF` : `_dec${c.word || 0} & 0xFF`;
        fat_c += `${v} = _pow10i((int)(${ex}) - ${c.baseline ?? 4});\n`;
      }
      fat_c += '}\n';
    }
    const cpp = `#include <cstdio>
#include <cstdint>
#include <cstring>
static inline float _u32_to_float(uint16_t hi, uint16_t lo){ uint32_t u=((uint32_t)hi<<16)|(uint32_t)lo; float f; memcpy(&f,&u,sizeof(float)); return f; }
static inline float _pow10i(int e){ float r=1.0f; if(e>=0){ for(int i=0;i<e;i++) r*=10.0f; } else { for(int i=0;i<-e;i++) r/=10.0f; } return r; }
int main(){
  uint16_t buf[${Math.max(buf.length, 1)}] = {${buf.join(',') || 0}};
  ${fat_c}
${exprs.map(([pid, d]) => `  { float v = ${d}; printf("%s %.9g\\n", "${pid}", (double)v); }`).join('\n')}
  return 0;
}
`;
    const src = join(dir, 'x.cpp'), bin = join(dir, 'x');
    writeFileSync(src, cpp);
    execFileSync('g++', ['-O0', '-w', '-o', bin, src]);
    const out = execFileSync(bin, { encoding: 'utf8' });
    let ok = 0, bad = 0, conf = 0;
    for (const line of out.trim().split('\n')) {
      const [pid, s] = line.split(' ');
      const got = Number(s);
      const p = pontoDe(pid);
      const want = Number(valores[p.pid]);
      const k = enc.fatorDoPonto(model, p, enc.calcularFatores(model, props, cfg));
      const passo = p.dataType === 'FLOAT' ? Math.abs(want) * 2e-7 : Math.abs(k / p.scale);
      const tol = passo * 0.5 + Math.abs(want) * 2e-7 + 1e-9;
      total++;
      if (Math.abs(got - want) <= tol) ok++;
      else if (pidsConflito.has(pid)) { conf++; conflitos++; }
      else { bad++; falhas++; console.log(`  FALHA ${id} [${cen.nome}] ${pid} (${p.dataType} scale=${p.scale} k=${k}): digitado=${want} TON=${got} tol=${tol}`); }
      // readback da UI tem que bater com o C
      const rb = mont.leituras[pid];
      if (rb !== undefined && !pidsConflito.has(pid) && Math.abs(rb - got) > Math.abs(got) * 1e-5 + 1e-6) {
        falhas++; console.log(`  READBACK ${id} [${cen.nome}] ${pid}: UI=${rb} C=${got}`);
      }
    }
    resumo.push(`${id.padEnd(24)} ${cen.nome.padEnd(16)} pontos=${String(exprs.length).padStart(3)} ok=${String(ok).padStart(3)} falha=${bad} conflito-registrador=${conf}`);
  }
}
rmSync(dir, { recursive: true, force: true });
console.log(resumo.join('\n'));
console.log(`\nTOTAL comparações=${total} falhas=${falhas} conflitos(avisados na UI)=${conflitos}`);
process.exit(falhas ? 1 : 0);
