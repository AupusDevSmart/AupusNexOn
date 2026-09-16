#!/usr/bin/env node
// Validação de FIDELIDADE do harness: prova que rodar o gerador em Node (run.mjs)
// produz o MESMO fonte que o BROWSER real produz. Sem isso, o baseline "ouro" poderia
// reproduzir fielmente um artefato específico do Node, divergente do que vai pra campo.
//
// Método: injeta o CONTEÚDO dos mesmos scripts (catálogo snapshot + 5 arquivos do
// gerador) num Chrome de verdade (Puppeteer), roda generateAll() com o MESMO input do
// banco, e compara arquivo-a-arquivo com o golden — normalizando só a linha
// FIRMWARE_VERSION (que carrega o timestamp do build; no Node está congelado, no browser
// é a hora real). Zero diferença fora dessa linha = harness fiel ao browser.
//
// Uso: node browser-crosscheck.mjs [projId ...]   (default: 3 projetos representativos)

import { getDiagrama, buildBombaIoMap } from './db.mjs';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../../public');
const GOLDEN = resolve(__dirname, 'golden');
const CATALOG_SNAP = resolve(__dirname, 'catalog-snapshot.js');
const require = createRequire('/var/www/service-nexon/aupus-nexon-api/relatorios-boletim/');
const puppeteer = require('puppeteer');
const CHROME = '/root/.cache/puppeteer/chrome/linux-121.0.6167.85/chrome-linux64/chrome';

const DEFAULT_PROJS = [
  '9ef55b08099e4cba11875f137c', // Bancada — TON único + relé 7SR5
  'd7976de5b2d58d62b38e836035', // Pivos 1 a 3 — 3 TONs + LoRa
  '8378232b04d1c9f7f7fd7e8e8b', // IoT Posto — bomba (usa _bombaIoByEquip)
];
const projIds = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PROJS;

// Normaliza a única linha não-determinística (build timestamp) pra comparar lógica.
const normFwVersion = (s) => s.replace(/FIRMWARE_VERSION(\s+)"[^"]*"/g, 'FIRMWARE_VERSION$1"NORM"');

const SCRIPTS = [
  CATALOG_SNAP,
  join(PUBLIC, 'iot-firmware-base.v2.js'),
  join(PUBLIC, 'iot-firmware-generator.v2.js'),
  join(PUBLIC, 'iot-firmware-base.ton-v2.js'),
  join(PUBLIC, 'iot-firmware-generator.ton-v2.js'),
  join(PUBLIC, 'iot-diagram.v2.js'),
];

/** Lê os arquivos do golden de um firmware (label) como Map<relPath, content>. */
function goldenFilesFor(projId, label) {
  const dir = join(GOLDEN, projId, label);
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else out.set(relative(dir, full), readFileSync(full, 'utf8'));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

async function main() {
  if (!existsSync(GOLDEN)) throw new Error('golden ausente — rode "node run.mjs capture" antes.');
  if (!existsSync(CATALOG_SNAP)) throw new Error('catalog-snapshot.js ausente — rode capture antes.');
  const scriptContents = SCRIPTS.map((f) => readFileSync(f, 'utf8'));

  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-gpu'], headless: 'new' });
  let totalFiles = 0, totalDiff = 0, projFail = 0;
  try {
    for (const projId of projIds) {
      const diagrama = getDiagrama(projId);
      if (!diagrama) { console.log(`  ! ${projId}: sem diagrama`); continue; }
      const bombaMap = buildBombaIoMap(diagrama.components || []);
      const input = { components: diagrama.components || [], connections: diagrama.connections || [] };

      const page = await browser.newPage();
      for (const content of scriptContents) await page.addScriptTag({ content });
      const browserProjects = await page.evaluate((input, bombaMap) => {
        const run = (Gen) => {
          const g = new Gen(input);
          g._bombaIoByEquip = bombaMap;
          g._carregadorIoByEquip = bombaMap;
          return g.generateAll();
        };
        const out = [];
        out.push(...run(window.FirmwareGenerator));
        if (window.FirmwareGeneratorTonV2) out.push(...run(window.FirmwareGeneratorTonV2));
        return out.map((p) => ({ name: p.name, files: p.files }));
      }, input, bombaMap);
      await page.close();

      // Compara cada firmware (por ordem/índice, igual ao writeTree do run.mjs).
      browserProjects.forEach((bp, idx) => {
        const label = `${String(idx).padStart(2, '0')}__${(bp.name || 'ton').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'ton'}`;
        const golden = goldenFilesFor(projId, label);
        const bfiles = bp.files || {};
        const paths = new Set([...Object.keys(bfiles), ...golden.keys()]);
        let diffs = 0;
        for (const p of paths) {
          const b = bfiles[p] != null ? normFwVersion(String(bfiles[p])) : null;
          const g = golden.has(p) ? normFwVersion(golden.get(p)) : null;
          if (b == null) { console.log(`    ~ ${label}/${p}: só no golden (Node)`); diffs++; continue; }
          if (g == null) { console.log(`    ~ ${label}/${p}: só no browser`); diffs++; continue; }
          totalFiles++;
          if (b !== g) {
            diffs++;
            const lb = b.split('\n'), lg = g.split('\n');
            const n = Math.max(lb.length, lg.length);
            for (let i = 0; i < n; i++) if (lb[i] !== lg[i]) {
              console.log(`    ✗ ${label}/${p} (linha ${i + 1})`);
              console.log(`        node   : ${lg[i] ?? '(vazio)'}`);
              console.log(`        browser: ${lb[i] ?? '(vazio)'}`);
              break;
            }
          }
        }
        totalDiff += diffs;
        console.log(`  ${diffs === 0 ? '✓' : '✗'} ${projId} / ${label}: ${diffs} diferença(s)`);
        if (diffs) projFail++;
      });
    }
  } finally {
    await browser.close();
  }
  console.log(`\n[crosscheck] ${totalFiles} arquivos comparados; ${totalDiff} diferença(s) fora do FIRMWARE_VERSION.`);
  if (totalDiff === 0) console.log('✅ HARNESS FIEL AO BROWSER: o baseline ouro reproduz o que o browser gera.');
  else console.log(`❌ ${projFail} firmware(s) divergiram — investigar antes de confiar no baseline.`);
  process.exit(totalDiff === 0 ? 0 : 1);
}

main().catch((e) => { console.error('[crosscheck] ERRO:', e); process.exit(2); });
