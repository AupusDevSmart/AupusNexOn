import { describe, it, expect } from 'vitest';
import { RtuSlave, comCrc, crc16, type RtuEvento, type RtuTable } from '../modbus-rtu-slave';

const tabela = (): RtuTable => ({
  holding: new Map([[100, 2204], [101, 0x1234]]),
  input: new Map([[5038, 0x8000]]),
  coils: new Map(),
  discrete: new Map([[101, false], [102, true], [109, true], [110, false]]),
});

function novo(endereco = 7) {
  const eventos: RtuEvento[] = [];
  const s = new RtuSlave({ endereco, tabela, onEvento: (e) => eventos.push(e) });
  return { s, eventos };
}

describe('crc16', () => {
  it('vetor conhecido: 01 03 00 00 00 0A → C5 CD', () => {
    const f = comCrc([0x01, 0x03, 0x00, 0x00, 0x00, 0x0a]);
    expect(Array.from(f.slice(6))).toEqual([0xc5, 0xcd]);
    expect(crc16(f)).toBe(0); // CRC sobre frame+crc = 0
  });
});

describe('RtuSlave', () => {
  it('responde func 03 com registradores big-endian', () => {
    const { s, eventos } = novo();
    const [r] = s.feed(comCrc([7, 3, 0, 100, 0, 3]), 0);
    expect(Array.from(r.slice(0, 9))).toEqual([7, 3, 6, 0x08, 0x9c, 0x12, 0x34, 0, 0]);
    expect(crc16(r)).toBe(0);
    expect(eventos[0]).toMatchObject({ tipo: 'leitura', func: 3, start: 100, count: 3, foraDoMapa: [102] });
  });

  it('responde func 04 (input registers)', () => {
    const { s } = novo();
    const [r] = s.feed(comCrc([7, 4, 0x13, 0xae, 0, 1]), 0);
    expect(Array.from(r.slice(0, 5))).toEqual([7, 4, 2, 0x80, 0x00]);
  });

  it('responde func 02 com bits LSB-first', () => {
    const { s } = novo();
    const [r] = s.feed(comCrc([7, 2, 0, 101, 0, 10]), 0); // 101..110
    // bit1 (102) e bit8 (109) ligados → byte0=0b10, byte1=0b1
    expect(Array.from(r.slice(0, 5))).toEqual([7, 2, 2, 0x02, 0x01]);
  });

  it('ignora outros endereços e broadcast', () => {
    const { s, eventos } = novo();
    expect(s.feed(comCrc([3, 3, 0, 0, 0, 2]), 0)).toEqual([]);
    expect(s.feed(comCrc([0, 6, 0, 1, 0, 1]), 100)).toEqual([]);
    expect(eventos[0]).toMatchObject({ tipo: 'outro-escravo', endereco: 3 });
  });

  it('remonta frame entregue em pedaços e ressincroniza após lixo / resposta de outro escravo', () => {
    const { s } = novo();
    // resposta de outro escravo (addr 3) chega antes da requisição pra nós
    const lixo = comCrc([3, 3, 4, 0x11, 0x22, 0x33, 0x44]);
    const req = comCrc([7, 3, 0, 100, 0, 1]);
    const tudo = new Uint8Array([...lixo, ...req]);
    let resp: Uint8Array[] = [];
    for (let i = 0; i < tudo.length; i += 3) resp = resp.concat(s.feed(tudo.slice(i, i + 3), i / 3)); // pedaços de 3 bytes, 1 ms
    expect(resp).toHaveLength(1);
    expect(Array.from(resp[0].slice(0, 5))).toEqual([7, 3, 2, 0x08, 0x9c]);
  });

  it('descarta resto antigo depois de silêncio longo', () => {
    const { s } = novo();
    s.feed(new Uint8Array([7, 3, 0]), 0); // frame truncado
    const r = s.feed(comCrc([7, 3, 0, 100, 0, 1]), 500);
    expect(r).toHaveLength(1);
  });

  it('exceção pra função não suportada e quantidade inválida', () => {
    const { s } = novo();
    const r1 = s.feed(comCrc([7, 3, 0, 0, 0, 200]), 0)[0];
    expect(Array.from(r1.slice(0, 3))).toEqual([7, 0x83, 0x03]);
  });

  it('aceita escrita (05/06/16) com eco e registra', () => {
    const { s, eventos } = novo();
    const r = s.feed(comCrc([7, 5, 0, 0x33, 0xff, 0]), 0)[0];
    expect(Array.from(r.slice(0, 6))).toEqual([7, 5, 0, 0x33, 0xff, 0]);
    const r16 = s.feed(comCrc([7, 16, 0, 10, 0, 2, 4, 0, 1, 0, 2]), 1000)[0];
    expect(Array.from(r16.slice(0, 6))).toEqual([7, 16, 0, 10, 0, 2]);
    expect(eventos.filter((e) => e.tipo === 'escrita')).toHaveLength(2);
  });
});

describe('barramento com vários escravos na mesma porta (resolver)', () => {
  it('responde cada endereço com a sua tabela e ignora os outros', () => {
    const tab = (v: number) => ({ holding: new Map([[10, v]]), input: new Map(), coils: new Map(), discrete: new Map() });
    const evs: Record<number, string[]> = { 1: [], 2: [] };
    const outros: number[] = [];
    const s = new RtuSlave({
      endereco: 0, tabela: () => tab(0),
      resolver: (a) => (a === 1 || a === 2 ? { tabela: () => tab(a * 100), onEvento: (e) => evs[a].push(e.tipo) } : null),
      onEvento: (e) => { if (e.tipo === 'outro-escravo') outros.push(e.endereco); },
    });
    const req = (a: number) => comCrc([a, 3, 0, 10, 0, 1]);
    const r1 = s.feed(req(1), 0)[0], r2 = s.feed(req(2), 100)[0];
    expect([r1[0], (r1[3] << 8) | r1[4]]).toEqual([1, 100]);
    expect([r2[0], (r2[3] << 8) | r2[4]]).toEqual([2, 200]);
    expect(s.feed(req(3), 200)).toEqual([]);
    expect(outros).toEqual([3]);
    expect(evs).toEqual({ 1: ['leitura'], 2: ['leitura'] });
  });
});

describe('eco do conversor (USR devolve o que transmite)', () => {
  it('lixo parecendo início de FC16 não engole a pergunta que vem colada', () => {
    const tab = { holding: new Map(), input: new Map([[7012, 7]]), coils: new Map(), discrete: new Map() };
    const s = new RtuSlave({ endereco: 1, tabela: () => tab });
    // eco: 2º byte 0x10 (FC16) e 7º byte 0x50 → "frame" de 89 bytes que nunca completa
    const eco = [0x01, 0x10, 0x00, 0x00, 0x00, 0x00, 0x50, 0x12, 0x34, 0x56, 0x78];
    const req = Array.from(comCrc([1, 4, 0x1b, 0x64, 0, 1]));
    const r = s.feed(new Uint8Array([...eco, ...req]), 0);
    expect(r).toHaveLength(1);
    expect([r[0][0], r[0][1], (r[0][3] << 8) | r[0][4]]).toEqual([1, 4, 7]);
  });

  it('frame incompleto de verdade continua esperando o resto', () => {
    const tab = { holding: new Map([[0, 1]]), input: new Map(), coils: new Map(), discrete: new Map() };
    const s = new RtuSlave({ endereco: 1, tabela: () => tab });
    const req = comCrc([1, 16, 0, 0, 0, 1, 2, 0, 9]);
    expect(s.feed(req.subarray(0, 5), 0)).toEqual([]);
    expect(s.feed(req.subarray(5), 5)).toHaveLength(1);
  });
});
