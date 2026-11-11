// Gera public/iot-firmware-pivo.js a partir da fonte canonica firmware-libs/pivo_local/
// (lib pura + glue). Os dois geradores (V1 e TON-V2) usam PivoLocalGen.files().
//   node tools/sync-pivo-lib.mjs          -> regenera
//   node tools/sync-pivo-lib.mjs --check  -> exit 1 se o JS nao bate com a fonte (smoke)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'firmware-libs', 'pivo_local');
const OUT = join(ROOT, 'public', 'iot-firmware-pivo.js');

const FILES = [
  ['include/pivo_local.h', join(LIB, 'pivo_local.h')],
  ['src/pivo_local.cpp', join(LIB, 'pivo_local.cpp')],
  ['include/pivo.h', join(LIB, 'glue', 'pivo.h')],
  ['src/pivo.cpp', join(LIB, 'glue', 'pivo.cpp')],
];

const corpo = FILES.map(([dst, src]) => `    ${JSON.stringify(dst)}: ${JSON.stringify(readFileSync(src, 'utf8'))},`).join('\n');
const js = `// GERADO por tools/sync-pivo-lib.mjs a partir de firmware-libs/pivo_local/ — NAO editar aqui.
// Pivo na TON (sequencia local): lib pivo_local + glue pivo.cpp. docs/IOT-PIVO-TON-LOCAL.md
// Carregado ANTES dos geradores (iot-diagram.tsx e tools/fw-regress).
var PivoLocalGen = (function () {
  var FILES = {
${corpo}
  };
  return {
    files: function () { var o = {}; for (var k in FILES) o[k] = FILES[k]; return o; },
  };
})();
`;

if (process.argv.includes('--check')) {
  const atual = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (atual !== js) { console.error('iot-firmware-pivo.js desatualizado: rode node tools/sync-pivo-lib.mjs'); process.exit(1); }
  console.log('iot-firmware-pivo.js ok (identico a firmware-libs/pivo_local)');
} else {
  writeFileSync(OUT, js);
  console.log(`gerado ${OUT} (${js.length} bytes)`);
}
