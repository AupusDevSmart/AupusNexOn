// Gera public/iot-firmware-controle.js a partir da fonte canonica firmware-libs/controle_ufv/
// (lib pura + glue). O gerador TON-V2 usa ControleUfvGen.files() quando a TON tem inversor com
// setpoint (controle pelo MED, docs/IOT-CONTROLE-MED-CONCESSIONARIA-IMPLEMENTACAO.md §5).
//   node tools/sync-controle-lib.mjs          -> regenera
//   node tools/sync-controle-lib.mjs --check  -> exit 1 se o JS nao bate com a fonte
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'firmware-libs', 'controle_ufv');
const OUT = join(ROOT, 'public', 'iot-firmware-controle.js');

const FILES = [
  ['include/controle_ufv.h', join(LIB, 'controle_ufv.h')],
  ['src/controle_ufv.cpp', join(LIB, 'controle_ufv.cpp')],
  ['include/ctl.h', join(LIB, 'glue', 'ctl.h')],
  ['src/ctl.cpp', join(LIB, 'glue', 'ctl.cpp')],
];

const corpo = FILES.map(([dst, src]) => `    ${JSON.stringify(dst)}: ${JSON.stringify(readFileSync(src, 'utf8'))},`).join('\n');
const js = `// GERADO por tools/sync-controle-lib.mjs a partir de firmware-libs/controle_ufv/ — NAO editar aqui.
// Controle pelo MED na TON da UFV (Fase B): lib controle_ufv + glue ctl.cpp.
// Carregado ANTES dos geradores (iot-diagram.tsx e tools/fw-regress).
var ControleUfvGen = (function () {
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
  if (atual !== js) { console.error('iot-firmware-controle.js desatualizado: rode node tools/sync-controle-lib.mjs'); process.exit(1); }
  console.log('iot-firmware-controle.js ok (identico a firmware-libs/controle_ufv)');
} else {
  writeFileSync(OUT, js);
  console.log(`gerado ${OUT} (${js.length} bytes)`);
}
