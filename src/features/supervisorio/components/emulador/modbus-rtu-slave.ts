/**
 * Escravo Modbus RTU puro (sem I/O): recebe bytes do barramento e devolve as respostas.
 *
 * Por que parsear por TAMANHO + CRC e não pelo silêncio de 3,5 caracteres: o Web Serial
 * entrega bytes em pedaços com jitter de vários ms (bem acima dos ~4 ms de 3,5 chars a
 * 9600), então o gap não é confiável. Usamos o gap só como "reset" grosso (> GAP_RESET_MS).
 *
 * O barramento pode ter outros escravos (devices reais na mesma TON): requisições a outros
 * endereços e as respostas deles são ignoradas — o parser desliza byte a byte até achar um
 * frame com CRC válido.
 */

export interface RtuTable {
  holding: Map<number, number>;
  input: Map<number, number>;
  coils: Map<number, boolean>;
  discrete: Map<number, boolean>;
}

export type RtuEvento =
  | { tipo: 'leitura'; func: number; start: number; count: number; foraDoMapa: number[]; ts: number }
  | { tipo: 'escrita'; func: number; start: number; count: number; valores: number[]; ts: number }
  | { tipo: 'excecao'; func: number; codigo: number; motivo: string; ts: number }
  | { tipo: 'outro-escravo'; endereco: number; func: number; ts: number }
  | { tipo: 'descartado'; bytes: number; ts: number };

export const GAP_RESET_MS = 40;
const MAX_BUF = 512;

export function crc16(buf: Uint8Array, len = buf.length): number {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

export function comCrc(bytes: number[]): Uint8Array {
  const out = new Uint8Array(bytes.length + 2);
  out.set(bytes);
  const c = crc16(out, bytes.length);
  out[bytes.length] = c & 0xff;
  out[bytes.length + 1] = (c >>> 8) & 0xff;
  return out;
}

/** Tamanho esperado de uma REQUISIÇÃO (mestre → escravo), ou null se não dá pra saber ainda. */
function tamanhoRequisicao(buf: Uint8Array, n: number): number | null | -1 {
  if (n < 2) return null;
  const fc = buf[1];
  if (fc >= 1 && fc <= 6) return 8;
  if (fc === 15 || fc === 16) {
    if (n < 7) return null;
    return 9 + buf[6];
  }
  return -1; // função desconhecida nesta posição
}

export interface RtuSlaveOpts {
  endereco: number;
  tabela: () => RtuTable;
  onEvento?: (e: RtuEvento) => void;
}

export class RtuSlave {
  private buf = new Uint8Array(MAX_BUF);
  private n = 0;
  private ultimoByte = -Infinity;
  private opts: RtuSlaveOpts;

  constructor(opts: RtuSlaveOpts) {
    this.opts = opts;
  }

  setEndereco(endereco: number) {
    this.opts.endereco = endereco;
  }

  /** Alimenta bytes recebidos; devolve as respostas a escrever no barramento. */
  feed(chunk: Uint8Array, agora: number = Date.now()): Uint8Array[] {
    if (agora - this.ultimoByte > GAP_RESET_MS && this.n > 0) {
      this.emit({ tipo: 'descartado', bytes: this.n, ts: agora });
      this.n = 0;
    }
    this.ultimoByte = agora;
    for (const b of chunk) {
      if (this.n >= MAX_BUF) { this.buf.copyWithin(0, 1); this.n--; }
      this.buf[this.n++] = b;
    }
    const respostas: Uint8Array[] = [];
    let descartados = 0;
    while (this.n >= 4) {
      const len = tamanhoRequisicao(this.buf, this.n);
      if (len === null) break;
      if (len === -1 || len > 256) { this.shift(1); descartados++; continue; }
      if (this.n < len) break;
      const c = crc16(this.buf, len - 2);
      if (this.buf[len - 2] !== (c & 0xff) || this.buf[len - 1] !== ((c >>> 8) & 0xff)) {
        this.shift(1); descartados++; continue;
      }
      const frame = this.buf.slice(0, len);
      this.shift(len);
      if (descartados) { this.emit({ tipo: 'descartado', bytes: descartados, ts: agora }); descartados = 0; }
      const r = this.tratar(frame, agora);
      if (r) respostas.push(r);
    }
    if (descartados) this.emit({ tipo: 'descartado', bytes: descartados, ts: agora });
    return respostas;
  }

  private shift(k: number) {
    this.buf.copyWithin(0, k, this.n);
    this.n -= k;
  }

  private emit(e: RtuEvento) {
    this.opts.onEvento?.(e);
  }

  private excecao(addr: number, fc: number, codigo: number, motivo: string, ts: number): Uint8Array {
    this.emit({ tipo: 'excecao', func: fc, codigo, motivo, ts });
    return comCrc([addr, fc | 0x80, codigo]);
  }

  private tratar(f: Uint8Array, ts: number): Uint8Array | null {
    const addr = f[0];
    const fc = f[1];
    if (addr === 0) return null; // broadcast: nunca responde
    if (addr !== this.opts.endereco) {
      this.emit({ tipo: 'outro-escravo', endereco: addr, func: fc, ts });
      return null;
    }
    const start = (f[2] << 8) | f[3];
    const qtd = (f[4] << 8) | f[5];
    const t = this.opts.tabela();

    if (fc === 1 || fc === 2) {
      if (qtd < 1 || qtd > 2000) return this.excecao(addr, fc, 0x03, `quantidade inválida (${qtd})`, ts);
      const mapa = fc === 1 ? t.coils : t.discrete;
      const nbytes = Math.ceil(qtd / 8);
      const dados = new Array(nbytes).fill(0);
      const fora: number[] = [];
      for (let i = 0; i < qtd; i++) {
        const a = start + i;
        if (!mapa.has(a)) fora.push(a);
        if (mapa.get(a)) dados[i >> 3] |= 1 << (i & 7);
      }
      this.emit({ tipo: 'leitura', func: fc, start, count: qtd, foraDoMapa: fora, ts });
      return comCrc([addr, fc, nbytes, ...dados]);
    }
    if (fc === 3 || fc === 4) {
      if (qtd < 1 || qtd > 125) return this.excecao(addr, fc, 0x03, `quantidade inválida (${qtd})`, ts);
      const mapa = fc === 3 ? t.holding : t.input;
      const dados: number[] = [];
      const fora: number[] = [];
      for (let i = 0; i < qtd; i++) {
        const a = start + i;
        if (!mapa.has(a)) fora.push(a);
        const w = mapa.get(a) ?? 0;
        dados.push((w >> 8) & 0xff, w & 0xff);
      }
      this.emit({ tipo: 'leitura', func: fc, start, count: qtd, foraDoMapa: fora, ts });
      return comCrc([addr, fc, qtd * 2, ...dados]);
    }
    // Escritas (comandos BO / setpoints): aceita e registra no log — o emulador não
    // muda os pontos por conta própria, mas mostra que o comando chegou.
    if (fc === 5 || fc === 6) {
      this.emit({ tipo: 'escrita', func: fc, start, count: 1, valores: [qtd], ts });
      return comCrc(Array.from(f.slice(0, 6)));
    }
    if (fc === 15 || fc === 16) {
      const valores: number[] = [];
      if (fc === 16) for (let i = 0; i < qtd; i++) valores.push((f[7 + 2 * i] << 8) | f[8 + 2 * i]);
      this.emit({ tipo: 'escrita', func: fc, start, count: qtd, valores, ts });
      return comCrc(Array.from(f.slice(0, 6)));
    }
    return this.excecao(addr, fc, 0x01, `função ${fc} não suportada`, ts);
  }
}
