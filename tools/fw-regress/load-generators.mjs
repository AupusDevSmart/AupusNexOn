// Carrega os geradores de firmware (JS estático de public/) num sandbox vm,
// SEM browser e com Date CONGELADO. Retorna as classes FirmwareGenerator (V1) e
// FirmwareGeneratorTonV2, mais as bases, prontas pra rodar em Node.
//
// Por que sandbox: os arquivos declaram `var FIRMWARE_BASE = {...}` e
// `var FirmwareGenerator = class {...}` no topo — em vm viram propriedades do
// global do contexto, então dá pra capturá-las sem tocar no arquivo.
//
// Por que Date congelado: a ÚNICA fonte de não-determinismo do gerador é o
// `#define FIRMWARE_VERSION "..build<YYYYMMDDHHmm>"` (new Date() no momento da
// geração). Pra regressão byte-idêntica precisamos do MESMO instante no capture e
// no check — senão o diff acusa diferença que não é de lógica. Congelar isola a
// lógica diagrama→firmware, que é o que a Fase 6 vai mexer. (Num diff real, o
// mesmo instante vale pro "antes" E pro "depois", então mudança de lógica aparece.)
//
// Os geradores só tocam o browser em 3 flags OPCIONAIS
// (IOT_SIMULATE / IOT_LORA_AUTONOMOUS / IOT_DISABLE_TP_TC), todas guardadas por
// `typeof window !== 'undefined'` + try/catch → com window ausente caem em false,
// que é EXATAMENTE o default de produção. Por isso não definimos `window`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../../public');

// Instante fixo do "build" carimbado no FIRMWARE_VERSION. Qualquer valor serve —
// só precisa ser IDÊNTICO entre capture e check. Escolhido um valor estável óbvio.
const FROZEN_ISO = '2020-01-01T00:00:00.000Z';

function makeFrozenDate() {
  const RealDate = Date;
  const FIXED_MS = new RealDate(FROZEN_ISO).getTime();
  // new Date()  -> instante fixo;  new Date(x) -> Date real (parsing normal).
  // Instâncias continuam sendo Date reais, então getFullYear/getMonth/etc. funcionam.
  function FrozenDate(...args) {
    if (!(this instanceof FrozenDate)) return new RealDate(FIXED_MS).toString();
    return args.length === 0 ? new RealDate(FIXED_MS) : new RealDate(...args);
  }
  FrozenDate.now = () => FIXED_MS;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  FrozenDate.prototype = RealDate.prototype;
  return FrozenDate;
}

function runFile(sandbox, file) {
  const code = readFileSync(resolve(PUBLIC, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

/**
 * Carrega tudo o que o gerador precisa, NA ORDEM DO BROWSER (iot-diagram.tsx):
 *   1. catálogo dinâmico (DEVICE_POINTS / DEVICE_MODELS) — vem do backend, passado como
 *      `catalogCode` (snapshot congelado pelo run.mjs);
 *   2. base + gerador V1;  3. base + gerador TON-V2;
 *   4. iot-diagram.v2.js — define COMPONENT_TYPES / TON_CAPS (usados em analyze()).
 * Sem DOM: o único top-level de cada arquivo é guardado por `typeof window`.
 *
 * @param {string} catalogCode  conteúdo de /iot-catalog/device-catalog.js (obrigatório;
 *                              é INPUT do firmware, então tem que ser o mesmo no capture e no check).
 */
export function loadGenerators({ catalogCode }) {
  if (!catalogCode || typeof catalogCode !== 'string') {
    throw new Error('catalogCode ausente — o catálogo de devices é input do firmware e precisa ser passado (snapshot).');
  }
  const sandbox = vm.createContext({
    console,
    Date: makeFrozenDate(),
    // sem `window`: as flags de browser caem no default de produção (false).
  });

  vm.runInContext(catalogCode, sandbox, { filename: 'device-catalog.js' });
  runFile(sandbox, 'iot-firmware-base.v2.js');
  runFile(sandbox, 'iot-firmware-generator.v2.js');
  runFile(sandbox, 'iot-firmware-base.ton-v2.js');
  runFile(sandbox, 'iot-firmware-generator.ton-v2.js');
  runFile(sandbox, 'iot-diagram.v2.js'); // COMPONENT_TYPES / TON_CAPS

  const missing = ['DEVICE_POINTS', 'COMPONENT_TYPES', 'FirmwareGenerator', 'FirmwareGeneratorTonV2']
    .filter((g) => typeof sandbox[g] === 'undefined');
  if (missing.length) throw new Error(`globais não carregaram: ${missing.join(', ')}`);

  return {
    FirmwareGenerator: sandbox.FirmwareGenerator,
    FirmwareGeneratorTonV2: sandbox.FirmwareGeneratorTonV2,
    frozenIso: FROZEN_ISO,
  };
}
