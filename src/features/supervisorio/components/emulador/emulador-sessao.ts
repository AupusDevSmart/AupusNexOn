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
}

const MAX_LOG = 200;
/** Sem nenhuma consulta pro nosso endereço depois disso → alerta na UI. */
export const ALERTA_SEM_CONSULTA_MS = 20_000;

type Listener = () => void;

class Sessao {
  estado: EstadoSessao;
  private tabela: RtuTable;
  private slave: RtuSlave;
  private serial: EmuladorSerial;
  private notificar: () => void;

  constructor(nodeId: string, nome: string, endereco: number, porta: PortaSerial, tabela: RtuTable, notificar: () => void) {
    this.tabela = tabela;
    this.notificar = notificar;
    this.estado = {
      nodeId, nome, endereco, porta: descreverPorta(porta), ativo: false, inicio: Date.now(),
      rx: 0, tx: 0, leituras: 0, escritas: 0, ultimaLeitura: null, outrosEnderecos: {}, foraDoMapa: 0, erro: null, log: [],
    };
    this.slave = new RtuSlave({ endereco, tabela: () => this.tabela, onEvento: (e) => this.evento(e) });
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
      case 'escrita':
        s.escritas++;
        this.log(`TON ESCREVEU func ${fn(e.func)} reg/coil ${e.start} x${e.count} valores=[${e.valores.join(', ')}] (comando recebido — o emulador não muda pontos sozinho)`, 'info');
        break;
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

  setTabela(t: RtuTable) {
    this.tabela = t;
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

  async iniciar(nodeId: string, nome: string, endereco: number, porta: PortaSerial, tabela: RtuTable) {
    const velha = sessoes.get(nodeId);
    if (velha?.estado.ativo) await velha.parar();
    const s = new Sessao(nodeId, nome, endereco, porta, tabela, notificar);
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
  atualizar(nodeId: string, tabela: RtuTable, endereco: number) {
    const s = sessoes.get(nodeId);
    if (!s) return;
    s.setTabela(tabela);
    s.setEndereco(endereco);
  },
};
