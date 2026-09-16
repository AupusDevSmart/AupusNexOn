#!/usr/bin/env node
// Harness de regressão BYTE-IDÊNTICA do gerador de firmware (Fase 6 do refactor IoT).
//
// Objetivo: provar que uma mudança no gerador (ex.: passar a ler de iot_vinculos em
// vez de props.io_config / ton_bo / ton_bi / ton_ai) produz o MESMO código-fonte de
// firmware, arquivo por arquivo, byte por byte, pra TODO projeto TON real.
//
// Uso:
//   node run.mjs capture         # congela o baseline "ouro" (o ponto que funciona HOJE)
//   node run.mjs check           # regenera e faz diff contra o ouro; exit≠0 se divergir
//   node run.mjs capture --out X # baseline num diretório alternativo
//
// O gerador roda em Node puro (ver load-generators.mjs), com Date congelado. Os INPUTS
// (diagrama + bombaIoMap) vêm do banco exatamente como o browser os monta.

import { loadGenerators } from './load-generators.mjs';
import { listTonProjects, getDiagrama, buildBombaIoMap, getModbusBoByEquip } from './db.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const mode = argv[0];
const outFlag = argv.indexOf('--out');
// FASE 6 (pós-scrub): o io_config.bo NÃO existe mais no props/diagrama — a fonte da verdade
// do comando de relé é iot_vinculos(modbus_bo), e a produção SEMPRE hidrata o io_config.bo a
// partir dele antes de gerar. O harness espelha isso: SEMPRE hidrata do vínculo. O golden
// (capturado quando o bo ainda estava no props) segue válido — a hidratação reproduz byte a byte.
// (--from-vinculos vira no-op; mantido só por compatibilidade de linha de comando.)
const GOLDEN = resolve(__dirname, 'golden');
const CURRENT = resolve(__dirname, 'current');
const CATALOG_SNAP = resolve(__dirname, 'catalog-snapshot.js');
const CATALOG_URL = process.env.FW_CATALOG_URL || 'http://localhost:3001/api/v1/iot-catalog/device-catalog.js';

if (mode !== 'capture' && mode !== 'check') {
  console.error('uso: node run.mjs <capture|check> [--out <dir>]');
  process.exit(2);
}

function sanitize(s) {
  return String(s || 'ton').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'ton';
}
function safeRel(p) {
  const r = String(p).replace(/\\/g, '/');
  if (r.startsWith('/') || r.split('/').includes('..')) throw new Error(`path suspeito: ${p}`);
  return r;
}

// FASE 6: ESPELHA a função de produção hydrateIoConfigBo() do iot-diagram.tsx — hidrata
// props.io_config.bo de cada relé com a projeção dos vínculos (modbus_bo). Merge por
// comando: vínculo sobrescreve, props preenche lacuna. Componente sem vínculo fica intacto.
function applyVinculosBo(diagrama, boByEquip) {
  let touched = 0;
  for (const c of diagrama.components || []) {
    const eq = (c.props?.equipamento_id || '').trim();
    const vin = eq ? boByEquip[eq] : undefined;
    if (!vin || Object.keys(vin).length === 0) continue; // sem vínculo: props intacto
    const propsBo = c.props?.io_config?.bo && typeof c.props.io_config.bo === 'object' ? c.props.io_config.bo : {};
    c.props = c.props || {};
    c.props.io_config = { ...(c.props.io_config || {}), bo: { ...propsBo, ...vin } };
    touched++;
  }
  return touched;
}

// Gera todos os projetos de firmware de UM projeto de diagrama (V1 + V2), como o browser.
function generateFor(gens, diagrama, bombaMap) {
  const editor = { components: diagrama.components || [], connections: diagrama.connections || [] };
  const out = [];
  for (const [Gen] of [[gens.FirmwareGenerator], [gens.FirmwareGeneratorTonV2]]) {
    const g = new Gen(editor);
    g._bombaIoByEquip = bombaMap;
    g._carregadorIoByEquip = bombaMap;
    out.push(...g.generateAll());
  }
  return out;
}

function writeTree(baseDir, projId, projNome, fwProjects) {
  const projDir = join(baseDir, projId);
  mkdirSync(projDir, { recursive: true });
  const manifest = { projeto_id: projId, nome: projNome, firmwares: [] };
  fwProjects.forEach((fw, idx) => {
    const label = `${String(idx).padStart(2, '0')}__${sanitize(fw.name)}`;
    const fwDir = join(projDir, label);
    const files = fw.files || {};
    const paths = Object.keys(files).sort();
    for (const p of paths) {
      const rel = safeRel(p);
      const dest = join(fwDir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, String(files[p]));
    }
    manifest.firmwares.push({
      label, name: fw.name, tonType: fw.spec?.tonType, equipamentoId: fw.spec?.equipamentoId,
      topicBase: fw.spec?.topicBase, nFiles: paths.length,
      warnings: fw.warnings || [], files: paths,
    });
  });
  writeFileSync(join(projDir, '_manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function walk(dir, base = dir, acc = new Map()) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, base, acc);
    else acc.set(relative(base, full), readFileSync(full));
  }
  return acc;
}

function firstDiffLine(a, b) {
  const la = a.split('\n'), lb = b.split('\n');
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    if (la[i] !== lb[i]) {
      return { line: i + 1, golden: la[i] ?? '(sem linha)', current: lb[i] ?? '(sem linha)' };
    }
  }
  return null;
}

// O catálogo de devices (DEVICE_POINTS/DEVICE_MODELS) é INPUT do firmware. Congelamos
// um snapshot no capture e reusamos no check — assim uma mudança no catálogo entre as
// duas rodadas não vira falso-positivo; o teste isola a LÓGICA do gerador.
async function getCatalogCode(mode) {
  if (mode === 'capture') {
    const res = await fetch(CATALOG_URL);
    if (!res.ok) throw new Error(`falha ao buscar catálogo (${CATALOG_URL}): HTTP ${res.status}`);
    const code = await res.text();
    if (!/var\s+DEVICE_POINTS\s*=/.test(code)) throw new Error('catálogo baixado não define DEVICE_POINTS — backend no ar?');
    writeFileSync(CATALOG_SNAP, code);
    console.log(`[fw-regress] catálogo snapshotado (${code.length} bytes) ← ${CATALOG_URL}`);
    return code;
  }
  if (!existsSync(CATALOG_SNAP)) {
    throw new Error(`snapshot do catálogo ausente (${CATALOG_SNAP}). Rode "capture" antes.`);
  }
  console.log('[fw-regress] usando catálogo do snapshot (congelado no capture).');
  return readFileSync(CATALOG_SNAP, 'utf8');
}

async function run() {
  const catalogCode = await getCatalogCode(mode);
  const gens = loadGenerators({ catalogCode });
  const projects = listTonProjects();
  const outDir = outFlag >= 0 ? resolve(argv[outFlag + 1]) : (mode === 'capture' ? GOLDEN : CURRENT);

  const boByEquip = getModbusBoByEquip();

  console.log(`[fw-regress] modo=${mode}  projetos=${projects.length}  Date congelado=${gens.frozenIso}`);
  console.log(`[fw-regress] io_config.bo hidratado do vínculo — como a produção (${Object.keys(boByEquip).length} relé(s) com comando)`);
  console.log(`[fw-regress] saída: ${outDir}`);
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  let totalFw = 0, totalFiles = 0;
  for (const p of projects) {
    const diagrama = getDiagrama(p.id);
    if (!diagrama) { console.warn(`  ! ${p.nome} (${p.id}): sem diagrama, pulado`); continue; }
    applyVinculosBo(diagrama, boByEquip);
    const bombaMap = buildBombaIoMap(diagrama.components || []);
    const fw = generateFor(gens, diagrama, bombaMap);
    const man = writeTree(outDir, p.id, p.nome, fw);
    const nFiles = man.firmwares.reduce((s, f) => s + f.nFiles, 0);
    totalFw += fw.length; totalFiles += nFiles;
    console.log(`  • ${p.nome} (${p.id})  →  ${fw.length} firmware(s), ${nFiles} arquivo(s)`);
  }
  console.log(`[fw-regress] total: ${totalFw} firmwares, ${totalFiles} arquivos.`);

  if (mode === 'capture') {
    console.log(`\n✅ baseline "ouro" congelado em ${outDir}`);
    console.log('   (commit este diretório: é o ponto-de-retorno da regressão da Fase 6.)');
    return;
  }

  // --- check: diff current vs golden ---
  if (!existsSync(GOLDEN)) {
    console.error(`\n❌ baseline ouro não existe (${GOLDEN}). Rode "node run.mjs capture" ANTES de mudar o gerador.`);
    process.exit(2);
  }
  const goldenFiles = walk(GOLDEN);
  const currentFiles = walk(outDir);
  const allPaths = new Set([...goldenFiles.keys(), ...currentFiles.keys()]);
  // _manifest.json muda com metadados derivados; comparamos, mas separamos do "fonte".
  const problems = [];
  for (const path of [...allPaths].sort()) {
    const g = goldenFiles.get(path), c = currentFiles.get(path);
    if (g && !c) { problems.push({ kind: 'REMOVIDO', path }); continue; }
    if (!g && c) { problems.push({ kind: 'NOVO', path }); continue; }
    if (!g.equals(c)) {
      const d = firstDiffLine(g.toString('utf8'), c.toString('utf8'));
      problems.push({ kind: 'ALTERADO', path, diff: d });
    }
  }

  if (problems.length === 0) {
    console.log('\n✅ BYTE-IDÊNTICO: nenhum arquivo divergiu do baseline ouro. Seguro.');
    return;
  }
  console.error(`\n❌ ${problems.length} divergência(s) vs baseline ouro:`);
  for (const pr of problems.slice(0, 60)) {
    if (pr.kind === 'ALTERADO' && pr.diff) {
      console.error(`  ~ ${pr.path}  (1ª diff. linha ${pr.diff.line})`);
      console.error(`      ouro : ${pr.diff.golden}`);
      console.error(`      novo : ${pr.diff.current}`);
    } else {
      console.error(`  ${pr.kind === 'NOVO' ? '+' : '-'} ${pr.path}  [${pr.kind}]`);
    }
  }
  if (problems.length > 60) console.error(`  … +${problems.length - 60} outras`);
  const srcProblems = problems.filter((p) => !p.path.endsWith('_manifest.json'));
  console.error(`\n  (${srcProblems.length} em arquivos de FONTE, ${problems.length - srcProblems.length} em _manifest.json)`);
  process.exit(1);
}

run().catch((e) => { console.error('[fw-regress] ERRO:', e); process.exit(2); });
