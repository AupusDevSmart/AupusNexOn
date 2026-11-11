/**
 * Transporte Web Serial (Chrome/Edge) para o escravo Modbus RTU do emulador.
 *
 * Fio: adaptador USB-RS485 no PC → A/B (RJ45) da TON. Serial fixa em 9600 8N1, igual ao
 * firmware (RS485_BAUD / RS485_CONFIG nos geradores). O adaptador cuida da direção (DE/RE).
 */
import type { RtuSlave } from './modbus-rtu-slave';

export const SERIAL_TON = { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' as const, bufferSize: 4096 };

/** Subconjunto de SerialPort usado aqui (permite fake nos testes). */
export interface PortaSerial {
  open(opts: typeof SERIAL_TON): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}

export function webSerialDisponivel(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator && !!(navigator as unknown as { serial?: unknown }).serial;
}

export async function pedirPorta(): Promise<PortaSerial> {
  const serial = (navigator as unknown as { serial: { requestPort(): Promise<PortaSerial> } }).serial;
  return serial.requestPort();
}

export function descreverPorta(p: PortaSerial | null): string {
  const i = p?.getInfo?.();
  if (!i || (i.usbVendorId === undefined && i.usbProductId === undefined)) return 'porta serial';
  const hex = (n?: number) => (n === undefined ? '????' : n.toString(16).padStart(4, '0'));
  return `USB ${hex(i.usbVendorId)}:${hex(i.usbProductId)}`;
}

export interface EmuladorSerialOpts {
  porta: PortaSerial;
  slave: RtuSlave;
  /** Bytes que passaram pelo fio (pra contadores/diagnóstico). */
  onTrafego?: (dir: 'rx' | 'tx', n: number) => void;
  /** Erro fatal (porta caiu, adaptador desconectado). */
  onErro?: (e: unknown) => void;
  agora?: () => number;
}

export class EmuladorSerial {
  private o: EmuladorSerialOpts;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private rodando = false;
  private loop: Promise<void> | null = null;

  constructor(o: EmuladorSerialOpts) {
    this.o = o;
  }

  get ativo() {
    return this.rodando;
  }

  async iniciar(): Promise<void> {
    if (this.rodando) return;
    await this.o.porta.open(SERIAL_TON);
    if (!this.o.porta.readable || !this.o.porta.writable) {
      await this.o.porta.close().catch(() => {});
      throw new Error('Porta serial abriu sem canais de leitura/escrita.');
    }
    this.writer = this.o.porta.writable.getWriter();
    this.reader = this.o.porta.readable.getReader();
    this.rodando = true;
    this.loop = this.ler();
  }

  private async ler() {
    const agora = this.o.agora ?? (() => performance.now());
    try {
      while (this.rodando && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;
        this.o.onTrafego?.('rx', value.length);
        for (const resp of this.o.slave.feed(value, agora())) {
          await this.writer!.write(resp);
          this.o.onTrafego?.('tx', resp.length);
        }
      }
    } catch (e) {
      if (this.rodando) this.o.onErro?.(e);
    } finally {
      const caiu = this.rodando;
      this.rodando = false;
      if (caiu) await this.liberar();
    }
  }

  private async liberar() {
    try { this.reader?.releaseLock(); } catch { /* já liberado */ }
    try { this.writer?.releaseLock(); } catch { /* já liberado */ }
    this.reader = null;
    this.writer = null;
    await this.o.porta.close().catch(() => {});
  }

  async parar(): Promise<void> {
    if (!this.rodando && !this.reader) return;
    this.rodando = false;
    try { await this.reader?.cancel(); } catch { /* porta já caiu */ }
    await this.loop?.catch(() => {});
    await this.liberar();
  }
}
