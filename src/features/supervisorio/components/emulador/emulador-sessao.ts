/**
 * Sessões de emulação ativas (fora do React): a emulação continua rodando com o modal
 * fechado — o usuário fecha o modal e vai olhar o unifilar enquanto o PC responde à TON.
 *
 * Uma sessão por nó do diagrama. A tabela de registradores é trocada ao vivo quando os
 * valores mudam no modal (setTabela), sem reabrir a porta.
 */
import { RtuSlave, type RtuEvento, type RtuTable } from './modbus-rtu-slave';
import { EmuladorSerial, type PortaSerial, descreverPorta } from './web-serial-transport';
import type { EstadoInversor } from './emulador-setpoints';

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
  /** Inversor: como a TON deixou (chave de limite, modo de reativo, ligado) e o que está sendo servido. */
  inversor: EstadoInversor | null;
}

/**
 * Recalcula a tabela com o que a TON escreveu (limite de P / Q / FP / ligar-desligar), já com os
 * holding registers no estado de fábrica. Chamado também sem escrita nenhuma. null = não mexe.
 */
export type RecalcEscritas = (escritos: Map<number, number>) => { table: RtuTable; efeitos: string[]; inversor?: EstadoInversor } | null;

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
  private notificar: () => void;
  readonly porta: PortaSerial;

  constructor(nodeId: string, nome: string, endereco: number, porta: PortaSerial, tabela: RtuTable, notificar: () => void) {
    this.porta = porta;
    this.tabela = tabela;
    this.notificar = notificar;
    this.estado = {
      nodeId, nome, endereco, porta: descreverPorta(porta), ativo: false, inicio: Date.now(),
      rx: 0, tx: 0, leituras: 0, escritas: 0, ultimaLeitura: null, outrosEnderecos: {}, foraDoMapa: 0, erro: null, log: [], obedecendo: [], inversor: null,
    };
  }

  /** Tabela servida: a do modal + o que a TON escreveu (read-back) + efeito do limite/Q nas leituras. */
  tabelaEfetiva(): RtuTable {
    if (!this.escritos.size && !this.recalc) return this.tabela;
    if (this.efetiva) return this.efetiva;
    let base = this.tabela;
    const r = this.recalc ? this.recalc(this.escritos) : null;
    this.estado.obedecendo = r?.efeitos ?? [];
    this.estado.inversor = r?.inversor ?? null;
    if (r) base = r.table;
    const holding = new Map(base.holding);
    for (const [k, v] of this.escritos) holding.set(k, v);
    this.efetiva = { ...base, holding };
    return this.efetiva;
  }

  log(texto: string, nivel: EstadoSessao['log'][number]['nivel']) {
    const l = this.estado.log;
    l.push({ ts: Date.now(), texto, nivel });
    if (l.length > MAX_LOG) l.splice(0, l.length - MAX_LOG);
  }

  evento(e: RtuEvento) {
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
        // Diagnóstico: bytes que não formaram pergunta válida (eco, ruído, pergunta picada/corrompida).
        this.log(`Descartados ${e.bytes} byte(s) que não formam pergunta válida: ${e.hex ?? ''}`, 'aviso');
        break;
    }
    this.notificar();
  }

  /** Barramento abriu a porta / passou a atender este endereço. */
  marcarAtivo(compartilhada: number) {
    this.estado.ativo = true;
    this.estado.erro = null;
    this.estado.inicio = Date.now();
    this.log(`Porta ${this.estado.porta} 9600 8N1 — respondendo como escravo ${this.estado.endereco}${compartilhada > 1 ? ` (porta compartilhada com ${compartilhada - 1} outro(s) emulado(s))` : ''}`, 'ok');
    this.notificar();
  }

  marcarParado(motivo: string | null) {
    this.estado.ativo = false;
    if (motivo) { this.estado.erro = motivo; this.log(motivo, 'erro'); } else this.log('Emulação parada', 'info');
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
    this.tabelaEfetiva();
    this.log('Comandos da TON descartados — inversor volta ao estado de fábrica (sem limite, reativo desligado, ligado)', 'info');
    this.notificar();
  }

  setEndereco(endereco: number) {
    if (endereco === this.estado.endereco) return;
    this.log(`Endereço alterado para ${endereco}`, 'info');
    this.estado.endereco = endereco;
    this.notificar();
  }
}

/**
 * Barramento = uma porta serial aberta. Vários emulados (endereços diferentes) dividem a mesma
 * porta — um PC com UM adaptador RS485 faz o papel de todos os inversores de uma UFV.
 */
class Barramento {
  readonly porta: PortaSerial;
  readonly membros = new Set<Sessao>();
  private serial: EmuladorSerial;
  private slave: RtuSlave;
  private aberta = false;

  constructor(porta: PortaSerial, private aoFechar: () => void) {
    this.porta = porta;
    this.slave = new RtuSlave({
      endereco: 0,
      tabela: () => ({ holding: new Map(), input: new Map(), coils: new Map(), discrete: new Map() }),
      resolver: (end) => {
        const m = this.deEndereco(end);
        return m ? { tabela: () => m.tabelaEfetiva(), onEvento: (e) => m.evento(e) } : null;
      },
      onEvento: (e) => { for (const m of this.ativos()) m.evento(e); },   // outro-escravo / descartado
    });
    this.serial = new EmuladorSerial({
      porta,
      slave: this.slave,
      onTrafego: (dir, n) => { for (const m of this.ativos()) { if (dir === 'rx') m.estado.rx += n; else m.estado.tx += n; } },
      onErro: (e) => {
        this.aberta = false;
        const msg = `Porta serial caiu: ${e instanceof Error ? e.message : String(e)}`;
        for (const m of [...this.membros]) m.marcarParado(msg);
        this.membros.clear();
        this.aoFechar();
      },
    });
  }

  private ativos() { return [...this.membros].filter((m) => m.estado.ativo); }
  deEndereco(end: number): Sessao | null { return this.ativos().find((m) => m.estado.endereco === end) ?? null; }

  async entrar(s: Sessao) {
    const dono = this.deEndereco(s.estado.endereco);
    if (dono && dono !== s) throw new Error(`O endereço ${s.estado.endereco} já é emulado nesta porta por "${dono.estado.nome}". Use outro endereço.`);
    if (!this.aberta) { await this.serial.iniciar(); this.aberta = true; }
    this.membros.add(s);
    s.marcarAtivo(this.membros.size);
  }

  async sair(s: Sessao) {
    if (!this.membros.delete(s)) return;
    s.marcarParado(null);
    if (this.membros.size === 0 && this.aberta) {
      this.aberta = false;
      await this.serial.parar();
      this.aoFechar();
    }
  }
}

const sessoes = new Map<string, Sessao>();
const barramentos = new Map<PortaSerial, Barramento>();
const barramentoDe = (porta: PortaSerial) => {
  let b = barramentos.get(porta);
  if (!b) { b = new Barramento(porta, () => { barramentos.delete(porta); notificar(); }); barramentos.set(porta, b); }
  return b;
};
const listeners = new Set<Listener>();
let versao = 0;
const notificar = () => { versao++; listeners.forEach((l) => l()); };

export const emuladorSessoes = {
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  versao: () => versao,
  get(nodeId: string): EstadoSessao | null { return sessoes.get(nodeId)?.estado ?? null; },
  ativas(): EstadoSessao[] { return [...sessoes.values()].map((s) => s.estado).filter((e) => e.ativo); },

  /** Portas já abertas por este navegador (para mais um emulado entrar no mesmo barramento). */
  portasAbertas(): { porta: PortaSerial; descricao: string; enderecos: number[] }[] {
    return [...barramentos.values()].map((b) => ({
      porta: b.porta, descricao: descreverPorta(b.porta),
      enderecos: [...b.membros].filter((m) => m.estado.ativo).map((m) => m.estado.endereco).sort((x, y) => x - y),
    })).filter((x) => x.enderecos.length > 0);
  },

  async iniciar(nodeId: string, nome: string, endereco: number, porta: PortaSerial, tabela: RtuTable, recalc?: RecalcEscritas | null) {
    const velha = sessoes.get(nodeId);
    if (velha?.estado.ativo) await barramentos.get(velha.porta)?.sair(velha);
    const s = new Sessao(nodeId, nome, endereco, porta, tabela, notificar);
    if (recalc) s.setTabela(tabela, recalc);
    sessoes.set(nodeId, s);
    try {
      await barramentoDe(porta).entrar(s);
    } catch (e) {
      s.estado.erro = e instanceof Error ? e.message : String(e);
      notificar();
      throw e;
    }
  },
  async parar(nodeId: string) {
    const s = sessoes.get(nodeId);
    if (s) await barramentos.get(s.porta)?.sair(s);
  },
  async pararTodas() {
    for (const s of sessoes.values()) if (s.estado.ativo) await barramentos.get(s.porta)?.sair(s);
  },
  atualizar(nodeId: string, tabela: RtuTable, endereco: number, recalc?: RecalcEscritas | null) {
    const s = sessoes.get(nodeId);
    if (!s) return;
    s.setTabela(tabela, recalc);
    const dono = s.estado.ativo ? barramentos.get(s.porta)?.deEndereco(endereco) : null;
    if (dono && dono !== s) { s.log(`Endereço ${endereco} já é de "${dono.estado.nome}" nesta porta — mantido ${s.estado.endereco}`, 'aviso'); notificar(); return; }
    s.setEndereco(endereco);
  },
  limparEscritas(nodeId: string) {
    sessoes.get(nodeId)?.limparEscritas();
  },
};
