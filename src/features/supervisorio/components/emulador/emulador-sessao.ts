/**
 * Sessões de emulação ativas (fora do React): a emulação continua rodando com o modal
 * fechado — o usuário fecha o modal e vai olhar o unifilar enquanto o PC responde à TON.
 *
 * Uma sessão por nó do diagrama. A tabela de registradores é trocada ao vivo quando os
 * valores mudam no modal (setTabela), sem reabrir a porta.
 */
import { RtuSlave, type RtuEvento, type RtuTable } from './modbus-rtu-slave';
import { EmuladorSerial, type PortaSerial, descreverPorta } from './web-serial-transport';

export interface EstadoSessao {
  nodeId: string;
  nome: string;
  endereco: number;
  porta: string;
  ativo: boolean;
  inicio: number;
  rx: number;
  tx: number;
  leituras: number;
  escritas: number;
  ultimaLeitura: number | null;
  /** Endereços que a TON consultou e não são o nosso (diagnóstico de firmware/endereço). */
  outrosEnderecos: Record<number, number>;
  /** Registradores pedidos que não existem no mapa do modelo. */
  foraDoMapa: number;
  erro: string | null;
  log: { ts: number; texto: string; nivel: 'ok' | 'aviso' | 'erro' | 'info' }[];
  /** Setpoints que a TON escreveu e o efeito nas leituras (controle pelo MED). */
  obedecendo: string[];
}

/** Recalcula a tabela com o que a TON escreveu (limite de P / Q). null = não mexe. */
export type RecalcEscritas = (escritos: Map<number, number>) => { table: RtuTable; efeitos: string[] } | null;

const MAX_LOG = 200;
/** Sem nenhuma consulta pro nosso endereço depois disso → alerta na UI. */
export const ALERTA_SEM_CONSULTA_MS = 20_000;

type Listener = () => void;

class Sessao {
  estado: EstadoSessao;
  private tabela: RtuTable;
  private efetiva: RtuTable | null = null;   // tabela + escritas da TON (cache até mudar algo)
  private escritos = new Map<number, number>();
  private recalc: RecalcEscritas | null = null;
  private slave: RtuSlave;
  private serial: EmuladorSerial;
  private notificar: () => void;

  constructor(nodeId: string, nome: string, endereco: number, porta: PortaSerial, tabela: RtuTable, notificar: () => void) {
    this.tabela = tabela;
    this.notificar = notificar;
    this.estado = {
      nodeId, nome, endereco, porta: descreverPorta(porta), ativo: false, inicio: Date.now(),
      rx: 0, tx: 0, leituras: 0, escritas: 0, ultimaLeitura: null, outrosEnderecos: {}, foraDoMapa: 0, erro: null, log: [], obedecendo: [],
    };
    this.slave = new RtuSlave({ endereco, tabela: () => this.tabelaEfetiva(), onEvento: (e) => this.evento(e) });
    this.serial = new EmuladorSerial({
      porta,
      slave: this.slave,
      onTrafego: (dir, n) => { if (dir === 'rx') this.estado.rx += n; else this.estado.tx += n; },
      onErro: (e) => {
        this.estado.ativo = false;
        this.estado.erro = `Porta serial caiu: ${e instanceof Error ? e.message : String(e)}`;
        this.log(this.estado.erro, 'erro');
        this.notificar();
      },
    });
  }

  /** Tabela servida: a do modal + o que a TON escreveu (read-back) + efeito do limite/Q nas leituras. */
  private tabelaEfetiva(): RtuTable {
    if (!this.escritos.size) return this.tabela;
    if (this.efetiva) return this.efetiva;
    let base = this.tabela;
    const r = this.recalc ? this.recalc(this.escritos) : null;
    if (r) { base = r.table; this.estado.obedecendo = r.efeitos; }
    const holding = new Map(base.holding);
    for (const [k, v] of this.escritos) holding.set(k, v);
    this.efetiva = { ...base, holding };
    return this.efetiva;
  }

  private log(texto: string, nivel: EstadoSessao['log'][number]['nivel']) {
    const l = this.estado.log;
    l.push({ ts: Date.now(), texto, nivel });
    if (l.length > MAX_LOG) l.splice(0, l.length - MAX_LOG);
  }

  private evento(e: RtuEvento) {
    const s = this.estado;
    const fn = (f: number) => `0${f}`;
    switch (e.tipo) {
      case 'leitura':
        s.leituras++;
        s.ultimaLeitura = Date.now();
        if (e.foraDoMapa.length) {
          s.foraDoMapa += e.foraDoMapa.length;
          this.log(`TON leu func ${fn(e.func)} reg ${e.start} x${e.count} — ${e.foraDoMapa.length} registrador(es) fora do mapa do modelo (respondido 0): ${e.foraDoMapa.slice(0, 5).join(', ')}${e.foraDoMapa.length > 5 ? '…' : ''}`, 'aviso');
        } else {
          this.log(`TON leu func ${fn(e.func)} reg ${e.start} x${e.count}`, 'ok');
        }
        break;
      case 'escrita': {
        s.escritas++;
        if (e.func === 6 || e.func === 16) {
          e.valores.forEach((v, i) => this.escritos.set(e.start + i, v & 0xffff));
          this.efetiva = null;
          this.tabelaEfetiva();
        }
        const ef = s.obedecendo.length ? ` → ${s.obedecendo.join(' · ')}` : ' (comando recebido)';
        this.log(`TON ESCREVEU func ${fn(e.func)} reg/coil ${e.start} x${e.count} valores=[${e.valores.join(', ')}]${ef}`, 'info');
        break;
      }
      case 'excecao':
        this.log(`Exceção 0x${e.codigo.toString(16).padStart(2, '0')} enviada (func ${fn(e.func)}): ${e.motivo}`, 'aviso');
        break;
      case 'outro-escravo': {
        const antes = s.outrosEnderecos[e.endereco] ?? 0;
        s.outrosEnderecos[e.endereco] = antes + 1;
        if (antes === 0) this.log(`TON está consultando o endereço ${e.endereco} (não é este emulador — ${s.endereco})`, 'info');
        break;
      }
      case 'descartado':
        // ruído/eco/frames de outros escravos — não polui o log
        break;
    }
    this.notificar();
  }

  async iniciar() {
    await this.serial.iniciar();
    this.estado.ativo = true;
    this.estado.erro = null;
    this.estado.inicio = Date.now();
    this.log(`Porta aberta (${this.estado.porta}) 9600 8N1 — respondendo como escravo ${this.estado.endereco}`, 'ok');
    this.notificar();
  }

  async parar() {
    await this.serial.parar();
    this.estado.ativo = false;
    this.log('Emulação parada, porta fechada', 'info');
    this.notificar();
  }

  setTabela(t: RtuTable, recalc?: RecalcEscritas | null) {
    this.tabela = t;
    if (recalc !== undefined) this.recalc = recalc;
    this.efetiva = null;
  }

  /** Esquece o que a TON escreveu (volta aos valores digitados). */
  limparEscritas() {
    this.escritos.clear();
    this.efetiva = null;
    this.estado.obedecendo = [];
    this.log('Setpoints escritos pela TON descartados — leituras voltam aos valores digitados', 'info');
    this.notificar();
  }

  setEndereco(endereco: number) {
    if (endereco === this.estado.endereco) return;
    this.slave.setEndereco(endereco);
    this.log(`Endereço alterado para ${endereco}`, 'info');
    this.estado.endereco = endereco;
    this.notificar();
  }
}

const sessoes = new Map<string, Sessao>();
const listeners = new Set<Listener>();
let versao = 0;
const notificar = () => { versao++; listeners.forEach((l) => l()); };

export const emuladorSessoes = {
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  versao: () => versao,
  get(nodeId: string): EstadoSessao | null { return sessoes.get(nodeId)?.estado ?? null; },
  ativas(): EstadoSessao[] { return [...sessoes.values()].map((s) => s.estado).filter((e) => e.ativo); },

  async iniciar(nodeId: string, nome: string, endereco: number, porta: PortaSerial, tabela: RtuTable, recalc?: RecalcEscritas | null) {
    const velha = sessoes.get(nodeId);
    if (velha?.estado.ativo) await velha.parar();
    const s = new Sessao(nodeId, nome, endereco, porta, tabela, notificar);
    if (recalc) s.setTabela(tabela, recalc);
    sessoes.set(nodeId, s);
    try {
      await s.iniciar();
    } catch (e) {
      s.estado.erro = e instanceof Error ? e.message : String(e);
      notificar();
      throw e;
    }
  },
  async parar(nodeId: string) {
    await sessoes.get(nodeId)?.parar();
  },
  async pararTodas() {
    await Promise.all([...sessoes.values()].map((s) => (s.estado.ativo ? s.parar() : null)));
  },
  atualizar(nodeId: string, tabela: RtuTable, endereco: number, recalc?: RecalcEscritas | null) {
    const s = sessoes.get(nodeId);
    if (!s) return;
    s.setTabela(tabela, recalc);
    s.setEndereco(endereco);
  },
  limparEscritas(nodeId: string) {
    sessoes.get(nodeId)?.limparEscritas();
  },
};
