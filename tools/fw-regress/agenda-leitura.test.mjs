// Teste do agendador de leitura (public/iot-firmware-agenda.js): gera o C++ e roda no PC.
//   node tools/fw-regress/agenda-leitura.test.mjs   (precisa de g++)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const AGENDA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'iot-firmware-agenda.js');
const DIR = mkdtempSync(join(tmpdir(), 'agenda-'));
const c = { DEVICE_POINTS: { medidor_energia: { leituras_min: 12 }, inversor_solar: { leituras_min: 1 }, rele_protecao: {} } };
vm.createContext(c); vm.runInContext(readFileSync(AGENDA, 'utf8'), c);
const devs = [{ name: 'PM', catalog_device: { tipo: 'medidor_energia' } }, { name: 'INV1', catalog_device: { tipo: 'inversor_solar' } },
  { name: 'INV2', catalog_device: { tipo: 'inversor_solar', leituras_min: 2 } }, { name: 'RELE', catalog_device: { tipo: 'rele_protecao' } }];
const cpp = vm.runInContext('AgendaLeituraGen', c).gerar({ prefixo: '_ag', devs, cicloMs: 4000, fnSample: 'sample_one', fnPublish: 'publish_all',
  assinaturaPublish: 'int publish', sample: (i) => `n[${i}]++`, publish: (i) => `p[${i}]++`, nome: (i) => devs[i].name });
writeFileSync(join(DIR, 't.cpp'), `#include <cstdio>
#include <cstdint>
static unsigned long T = 0; unsigned long millis() { return T; }
int n[4], p[4];
${cpp}
int main() {
  int pub = 0;
  for (T = 1000; T <= 600000; T += 1000) { sample_one(); if (T % 60000 == 0) { publish_all(1); pub++; } }
  printf("leituras em 10 min: PM(12/min)=%d INV1(1/min)=%d INV2(modelo 2/min)=%d RELE(sem config=16s)=%d\\n", n[0], n[1], n[2], n[3]);
  printf("publicacoes (10 janelas): PM=%d INV1=%d INV2=%d RELE=%d\\n", p[0], p[1], p[2], p[3]);
  bool ok = n[0] >= 110 && n[0] <= 121 && n[1] == 10 && n[2] >= 19 && n[2] <= 20 && n[3] >= 36 && n[3] <= 38 && p[0] == 10 && p[1] == 10 && p[3] == 10;
  puts(ok ? "OK" : "FALHOU"); return ok ? 0 : 1;
}`);
execFileSync('g++', ['-std=c++17', '-o', join(DIR, 't'), join(DIR, 't.cpp')]);
process.stdout.write(execFileSync(join(DIR, 't')).toString());
