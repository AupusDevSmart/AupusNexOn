import { describe, it, expect } from 'vitest';
import { EmuladorSerial, SERIAL_TON, type PortaSerial } from '../web-serial-transport';
import { RtuSlave, comCrc } from '../modbus-rtu-slave';

function portaFake() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const escritos: Uint8Array[] = [];
  let abertaCom: unknown = null;
  let fechada = false;
  const porta: PortaSerial = {
    readable: null,
    writable: null,
    async open(opts) {
      abertaCom = opts;
      porta.readable = new ReadableStream<Uint8Array>({ start: (c) => { ctrl = c; } });
      porta.writable = new WritableStream<Uint8Array>({ write: (ch) => { escritos.push(ch); } });
    },
    async close() { fechada = true; },
  };
  return { porta, enviar: (b: Uint8Array) => ctrl.enqueue(b), cair: () => ctrl.error(new Error('device lost')), escritos, abertaCom: () => abertaCom, fechada: () => fechada };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('EmuladorSerial', () => {
  it('abre 9600 8N1, responde requisição fatiada e fecha', async () => {
    const f = portaFake();
    const slave = new RtuSlave({ endereco: 4, tabela: () => ({ holding: new Map([[10, 0xabcd]]), input: new Map(), coils: new Map(), discrete: new Map() }) });
    let t = 0;
    const emu = new EmuladorSerial({ porta: f.porta, slave, agora: () => t++ });
    await emu.iniciar();
    expect(f.abertaCom()).toEqual(SERIAL_TON);
    const req = comCrc([4, 3, 0, 10, 0, 1]);
    f.enviar(req.slice(0, 3));
    f.enviar(req.slice(3));
    await tick();
    expect(f.escritos).toHaveLength(1);
    expect(Array.from(f.escritos[0].slice(0, 5))).toEqual([4, 3, 2, 0xab, 0xcd]);
    await emu.parar();
    expect(emu.ativo).toBe(false);
    expect(f.fechada()).toBe(true);
  });

  it('avisa quando o adaptador cai', async () => {
    const f = portaFake();
    const slave = new RtuSlave({ endereco: 1, tabela: () => ({ holding: new Map(), input: new Map(), coils: new Map(), discrete: new Map() }) });
    let erro: unknown = null;
    const emu = new EmuladorSerial({ porta: f.porta, slave, onErro: (e) => (erro = e) });
    await emu.iniciar();
    f.cair();
    await tick();
    expect(String(erro)).toMatch(/device lost/);
    expect(emu.ativo).toBe(false);
    expect(f.fechada()).toBe(true);
  });
});
