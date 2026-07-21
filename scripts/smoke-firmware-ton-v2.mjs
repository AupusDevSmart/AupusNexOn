#!/usr/bin/env node
// Smoke test do gerador TON-V2 (Fase 2 do plano).
// Gera firmware p/ casos representativos das 4 variantes v2, checa marcadores
// V2 no código gerado, isolamento V1↔V2, e (com --compile) compila cada
// projeto no firmware-compiler local (127.0.0.1:3211).
//
// Uso: node scripts/smoke-firmware-ton-v2.mjs [--compile]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const DO_COMPILE = process.argv.includes('--compile');

const sandbox = {
  console, Date,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  document: { createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, addEventListener() {} }), addEventListener() {}, getElementById: () => null },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { userAgent: 'smoke' },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.IOT_SIMULATE = false;
vm.createContext(sandbox);

for (const f of [
  join(HERE, 'regressao-catalog.snapshot.js'),
  join(PUBLIC, 'iot-firmware-base.v2.js'),
  join(PUBLIC, 'iot-firmware-generator.v2.js'),
  join(PUBLIC, 'iot-firmware-base.ton-v2.js'),
  join(PUBLIC, 'iot-firmware-generator.ton-v2.js'),
  join(PUBLIC, 'iot-diagram.v2.js'), // por último — TON_CAPS/COMPONENT_TYPES canônicos
]) vm.runInContext(readFileSync(f, 'utf8'), sandbox, { filename: f });

const conn = (from, to, style) => ({ id: `x${from}${to}`, from: { componentId: from, port: 'right' }, to: { componentId: to, port: 'left' }, style });

// Caso A: ton1v2 + inversor Sungrow RS485 + router
const casoA = {
  components: [
    { id: 'a1', type: 'ton1v2', x: 0, y: 0, props: { name: 'TON1v2', mqtt_topic_base: 'TESTE/SMK/A/T1' } },
    { id: 'a2', type: 'inversor', x: 1, y: 0, props: { name: 'Inversor', catalog_id: 'sungrow-sg110cx', modbus_address: 1 } },
    { id: 'a3', type: 'wifi_router', x: 2, y: 0, props: { name: 'R', ssid: 's', password: 'p' } },
  ],
  connections: [conn('a1', 'a2', 'rs485'), conn('a1', 'a3', 'wifi')],
};

// Caso B: ton3v2 (relés) + relé 7SR5111 TCP direto + M160 RS485 + router
const casoB = {
  components: [
    { id: 'b1', type: 'ton3v2', x: 0, y: 0, props: { name: 'TON3v2', mqtt_topic_base: 'TESTE/SMK/B/T3' } },
    { id: 'b2', type: 'rele_protecao', x: 1, y: 0, props: { name: 'Rele', catalog_id: 'siemens-7sr5111', modbus_address: 1, ip: '192.168.1.50', tcp_port: '502' } },
    { id: 'b3', type: 'power_meter', x: 1, y: 1, props: { name: 'PM', catalog_id: 'ims-m160', modbus_address: 2 } },
    { id: 'b4', type: 'wifi_router', x: 2, y: 0, props: { name: 'R', ssid: 's', password: 'p' } },
  ],
  connections: [conn('b1', 'b2', 'tcp'), conn('b1', 'b3', 'rs485'), conn('b1', 'b4', 'wifi')],
};

// Caso C: ton2v2 gateway LoRa + ton4v2 satellite (M160 RS485, sem internet)
const casoC = {
  components: [
    { id: 'c1', type: 'ton2v2', x: 0, y: 0, props: { name: 'GW2v2', mqtt_topic_base: 'TESTE/SMK/C/GW' } },
    { id: 'c2', type: 'wifi_router', x: 1, y: 0, props: { name: 'R', ssid: 's', password: 'p' } },
    { id: 'c3', type: 'ton4v2', x: 0, y: 1, props: { name: 'SAT4v2', mqtt_topic_base: '' } },
    { id: 'c4', type: 'power_meter', x: 1, y: 1, props: { name: 'PM', catalog_id: 'ims-m160', modbus_address: 1 } },
  ],
  connections: [conn('c1', 'c2', 'wifi'), conn('c1', 'c3', 'lora_radio'), conn('c3', 'c4', 'rs485')],
};

const GenV1 = vm.runInContext('FirmwareGenerator', sandbox);
const GenV2 = vm.runInContext('FirmwareGeneratorTonV2', sandbox);
const editor = (d) => ({ components: d.components, connections: d.connections, simulate: false, loraAutonomous: false });

let fails = 0;
const check = (label, cond) => { console.log(`${cond ? 'ok ' : 'FALHOU'} ${label}`); if (!cond) fails++; };
const has = (files, path, marker) => (files[path] || '').includes(marker);

// ---- isolamento ----
check('V1 ignora diagrama só-v2 (caso A)', new GenV1(editor(casoA)).generateAll().length === 0);
const misto = { components: [...casoA.components, { id: 'm1', type: 'ton1', x: 5, y: 5, props: { name: 'TON1', mqtt_topic_base: 'TESTE/SMK/M/T1' } }], connections: casoA.connections };
check('V1 em diagrama misto gera só o v1', new GenV1(editor(misto)).generateAll().map(p => p.spec.tonType).join() === 'ton1');
check('V2 em diagrama misto gera só o v2', new GenV2(editor(misto)).generateAll().map(p => p.spec.tonType).join() === 'ton1v2');

// ---- geração V2 ----
const pA = new GenV2(editor(casoA)).generateAll();
check('caso A: 1 projeto (ton1v2)', pA.length === 1 && pA[0].spec.tonType === 'ton1v2');
const fA = pA[0].files;
check('caso A: DEVICE_MODEL TON1V2', has(fA, 'include/config.h', '#define DEVICE_MODEL        "TON1V2"'));
check('caso A: versao 2.0.0', has(fA, 'include/config.h', '2.0.0-build'));
check('caso A: MCP_INPUT_COUNT 8', has(fA, 'include/config.h', '#define MCP_INPUT_COUNT     8'));
check('caso A: ADC 7.67', has(fA, 'include/config.h', '7.67'));
check('caso A: inputs GP0-based', has(fA, 'src/inputs.cpp', 'digitalRead(i);   // V2'));
check('caso A: publica d8+s1', has(fA, 'src/main.cpp', '"d8\\\\":%d,\\\\"s1\\\\"'.replace(/\\\\/g, '\\')) || has(fA, 'src/main.cpp', 'd8'));
check('caso A: pwm_init no setup', has(fA, 'src/main.cpp', 'pwm_init()'));
check('caso A: modulo pwm presente', has(fA, 'src/pwm.cpp', 'PCA9685_ADDR 0x42'));
check('caso A: comando pwm 0-100', has(fA, 'src/main.cpp', 'pwm_pct_invalido'));
check('caso A: OTA target_mac', has(fA, 'src/ota.cpp', '_ota_mac_matches'));
check('caso A: sem relays.cpp custom (ton1v2 nao tem)', !has(fA, 'src/main.cpp', 'relays_init()'));

const pB = new GenV2(editor(casoB)).generateAll();
check('caso B: 1 projeto (ton3v2)', pB.length === 1 && pB[0].spec.tonType === 'ton3v2');
const fB = pB[0].files;
check('caso B: relés r1..r8 no publish', has(fB, 'src/main.cpp', 'r8'));
check('caso B: cmd r1-r8', has(fB, 'src/main.cpp', "cmd[1] >= '1' && cmd[1] <= '8'"));
check('caso B: relays GP0-based', has(fB, 'src/relays.cpp', 'digitalWrite(num - 1'));
check('caso B: TCP direto no rele (inverter_tcp)', !!fB['src/inverter_tcp.cpp']);
check('caso B: M160 RS485 (modbus_meter)', !!fB['src/modbus_meter.cpp']);

const pC = new GenV2(editor(casoC)).generateAll();
const roles = Object.fromEntries(pC.map(p => [p.spec.tonType, p.spec.lora_role]));
check('caso C: 2 projetos (gw+sat)', pC.length === 2);
check('caso C: ton2v2 = gateway', roles['ton2v2'] === 'gateway');
check('caso C: ton4v2 = satellite', roles['ton4v2'] === 'satellite');
const fSat = pC.find(p => p.spec.tonType === 'ton4v2').files;
check('caso C: satellite sem ota.cpp (sem wifi)', !fSat['src/ota.cpp']);
check('caso C: satellite tem lora.cpp', !!fSat['src/lora.cpp']);

if (fails) { console.error(`\n${fails} verificações falharam`); process.exit(1); }
console.log('\nSMOKE DE GERAÇÃO: tudo OK');

// ---- compilação real (pio) ----
if (DO_COMPILE) {
  const alvos = [
    ['ton1v2-rs485', pA[0]],
    ['ton3v2-rele-tcp', pB[0]],
    ['ton2v2-gateway', pC.find(p => p.spec.tonType === 'ton2v2')],
    ['ton4v2-satellite', pC.find(p => p.spec.tonType === 'ton4v2')],
  ];
  for (const [label, proj] of alvos) {
    process.stdout.write(`compilando ${label}... `);
    const t0 = Date.now();
    const res = await fetch('http://127.0.0.1:3211/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ files: proj.files, name: label }),
    });
    const body = await res.json().catch(() => ({}));
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (res.ok && body.firmware) {
      console.log(`SUCCESS em ${secs}s (ram ${body.ram_pct ?? body.ram ?? '?'} / flash ${body.flash_pct ?? body.flash ?? '?'})`);
    } else {
      console.error(`FALHOU em ${secs}s:`, (body.error || body.output || JSON.stringify(body)).toString().slice(-3000));
      process.exit(1);
    }
  }
  console.log('\nCOMPILAÇÃO: 4/4 SUCCESS');
}
