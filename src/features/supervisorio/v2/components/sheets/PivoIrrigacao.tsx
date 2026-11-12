import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { fmt } from './sheetParts';
import { NX, s, NxSwitch, NxDialogHead } from './nxMock';
import { baixarModelo, lerPlanilha, textoAgenda, type AgendaItem, type ItemPlanilha } from './pivoAgendaPlanilha';

/**
 * Planejamento de irrigação do pivô no web (antiga "Irrigação avançada"), diálogo de 520 px.
 * Estilos inline com as variáveis NX.
 *
 * NEXON-98: é este diálogo que o botão principal da ficha abre. Pivô parado → "Ligar". Pivô
 * ligado → abre com a irrigação em curso, mostra "Desligar" e, ao editar qualquer opção, o
 * botão vira "Salvar e enviar" (o pivô reinicia com as novas opções).
 *
 * Redesenho (11/11/2026): uma tela só. As abas Ângulo e Segmentos saíram; Direção é só Direita ou
 * Esquerda; Água é um switch; ligar parado saiu da tela (pedido do dono); as faixas do canhão ficam na
 * própria tela; a Parada tem "Por tempo", "Por ângulo" (círculo) e "Por segmento" (anel: para no
 * fim do quarto de volta escolhido); a Agenda usa as opções da tela em vez de repetir os campos.
 */

export type Direcao = 'Avanço' | 'Reverso';
/** Valor gravado (Avanço/Reverso, = girar_direita/girar_esquerda) → o que aparece na tela. */
export const DIRECAO_LABEL: Record<Direcao, string> = { 'Avanço': 'Direita', 'Reverso': 'Esquerda' };
export interface FaixaCanhao { id: string; liga: number; desliga: number }
/** percentual = percentímetro 0–100 % (1 casa; 0 = parado irrigando). lamina (mm) = o que o operador digitou —
 *  vai junto e o servidor recalcula o % com a lâmina a 100 % do cadastro. */
export interface ConfigIrrigacao {
  direcao: Direcao; percentual: number; lamina?: number | null; semAgua: boolean; canhao: boolean; faixasCanhao: FaixaCanhao[];
  /** Marcado pelo servidor: parado em pivô sem o ponto Percentímetro — só a bomba liga, o pivô não gira. */
  semGiro?: boolean;
}

/** 59.7 → "59,7"; 60 → "60". */
export const fmtPct = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(1).replace('.', ','));
export type Parada = { tipo: 'semParar' } | { tipo: 'porAngulo'; angulo: number } | { tipo: 'porGraus'; graus: number } | { tipo: 'porVoltas'; voltas: number } | { tipo: 'porTempo'; minutos: number };
export type Modo = 'simples' | 'angulo' | 'segmentos';
export interface EnvioIrrigacao {
  modo: Modo; config: ConfigIrrigacao; parada: Parada; inicio: Date | null; anguloFinal?: number; segmento?: number;
  /** Só no reinício pelo Planejamento: false = o operador mexeu na Parada (vale a nova, do zero,
   *  mesmo com o mesmo valor); true = intacta, herda a parada em curso. Ausente = decide pelo valor. */
  manterParada?: boolean;
}
/** Abas do Planejamento: a irrigação (uma tela só) e a agenda. */
export type AbaIrrigacao = 'simples' | 'agenda';

export interface Programacao {
  id: string; nome: string; ativo: boolean; hora_inicio: string; dias: number[]; modo: 'percurso' | 'tempo';
  duracao_min?: number | null; sentido: 'horario' | 'anti_horario'; velocidade?: number | null; com_agua?: boolean;
  /** liga o canhão final junto com o pivô (só com água) */
  canhao?: boolean;
}
export type NovaProgramacao = Omit<Programacao, 'id'>;

export const CONFIG_PADRAO: ConfigIrrigacao = { direcao: 'Reverso', percentual: 60, semAgua: false, canhao: false, faixasCanhao: [] };

// ------------------------------------------------------------- programação
const VERDE = '#72BF4A';
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const diasTxt = (d: number[]) => {
  const k = [...d].sort((a, b) => a - b).join(',');
  if (k === '1,2,3,4,5') return 'Seg a sex';
  if (k === '1,2,3,4,5,6,7') return 'Todos os dias';
  if (k === '6,7') return 'Sáb e dom';
  return d.map((x) => DIAS[x - 1]).join(', ');
};
const fimDe = (ini: string, min?: number | null) => {
  if (!min) return null;
  const [h, m] = ini.split(':').map(Number);
  const t = (h * 60 + m + min) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
/** "Seg a sex · 21:00 → 05:00" / "100% · Molhado · Direita". */
export function textoProgramacao(p: Programacao) {
  const fim = fimDe(p.hora_inicio, p.duracao_min);
  const dir = p.sentido === 'horario' ? 'Direita' : 'Esquerda';
  return {
    quando: `${diasTxt(p.dias)} · ${p.hora_inicio}${fim ? ` → ${fim}` : ''}`,
    det: `${p.com_agua === false ? `Seco · ${dir}` : `${p.velocidade != null ? `${fmt(p.velocidade, 0)}%` : '—'} · Molhado · ${dir}${p.canhao ? ' · canhão' : ''}`}${p.ativo ? '' : ' · pausado'}`,
  };
}
const GRUPOS_DIAS: Array<{ v: string; label: string; dias: number[] }> = [
  { v: 'uteis', label: 'Seg a sex', dias: [1, 2, 3, 4, 5] },
  { v: 'todos', label: 'Todos os dias', dias: [1, 2, 3, 4, 5, 6, 7] },
  { v: 'fds', label: 'Sáb e dom', dias: [6, 7] },
];

// ------------------------------------------------------------------ faixas
export const norm = (g: number) => ((Math.round(g) % 360) + 360) % 360;
const comp = (f: FaixaCanhao) => norm(f.desliga - f.liga);
const contem = (f: FaixaCanhao, g: number) => norm(g - f.liga) < comp(f);
const novoId = () => Math.random().toString(36).slice(2, 10);

/** Encaixa o ângulo no arco [lo, hi] (sentido horário); fora dele, vai para a ponta mais perto. */
function limitar(a: number, lo: number, hi: number) {
  const g = norm(a), span = norm(hi - lo);
  if (norm(g - lo) <= span) return g;
  const dLo = Math.min(norm(g - lo), norm(lo - g)), dHi = Math.min(norm(g - hi), norm(hi - g));
  return dLo <= dHi ? norm(lo) : norm(hi);
}
function vizinhos(fs: FaixaCanhao[], i: number) {
  const f = fs[i];
  const outras = fs.filter((_, j) => j !== i);
  if (!outras.length) return { ant: null, prox: null };
  const ant = outras.reduce((m, o) => (norm(f.liga - o.liga) < norm(f.liga - m.liga) ? o : m));
  const prox = outras.reduce((m, o) => (norm(o.liga - f.liga) < norm(m.liga - f.liga) ? o : m));
  return { ant, prox };
}
export function moverAlca(fs: FaixaCanhao[], i: number, alca: 'liga' | 'desliga', a: number): FaixaCanhao[] {
  const f = fs[i];
  const { ant, prox } = vizinhos(fs, i);
  const out = [...fs];
  if (alca === 'liga') out[i] = { ...f, liga: ant ? limitar(a, ant.desliga, f.desliga - 1) : limitar(a, f.desliga + 1, f.desliga - 1) };
  else out[i] = { ...f, desliga: prox ? limitar(a, f.liga + 1, prox.liga) : limitar(a, f.liga + 1, f.liga - 1) };
  return out;
}
/** Nova faixa começando em g (comprimento até 30°, sem invadir a próxima). */
function faixaEm(fs: FaixaCanhao[], g: number): FaixaCanhao | null {
  if (fs.length >= 5) return null;
  const a = norm(g);
  if (fs.some((f) => contem(f, a) || f.liga === a)) return null;
  const ate = fs.length ? Math.min(...fs.map((f) => norm(f.liga - a) || 360)) : 360;
  const len = Math.min(30, ate);
  if (len < 1) return null;
  return { id: novoId(), liga: a, desliga: norm(a + len) };
}
/** "+ Adicionar faixa": no meio do maior vão livre (ou no ângulo atual, sem faixas). */
function faixaNoVao(fs: FaixaCanhao[], atual: number): FaixaCanhao | null {
  if (fs.length >= 5) return null;
  if (!fs.length) return faixaEm(fs, atual);
  const ord = [...fs].sort((x, y) => x.liga - y.liga);
  let melhor = { ini: 0, len: 0 };
  ord.forEach((f, i) => {
    const prox = ord[(i + 1) % ord.length];
    const len = ord.length === 1 ? 360 - comp(f) : norm(prox.liga - f.desliga);
    if (len > melhor.len) melhor = { ini: f.desliga, len };
  });
  if (melhor.len < 2) return null;
  return faixaEm(fs, melhor.ini + Math.max(0, (melhor.len - 30) / 2));
}
/**
 * A tela mostra o canhão LIGADO a volta toda e o operador marca os trechos onde NÃO irrigar; a
 * API guarda o contrário (as faixas em que o canhão fica ligado). Uma lista é o complemento da
 * outra na volta: o fim de um arco é o começo do próximo. Ids fixos (a assinatura do envio é JSON).
 */
export function complementoFaixas(fs: FaixaCanhao[]): FaixaCanhao[] {
  const o = fs.filter((f) => comp(f) > 0).sort((a, b) => a.liga - b.liga);
  return o.map((f, i) => ({ id: `c${i}`, liga: norm(f.desliga), desliga: norm(o[(i + 1) % o.length].liga) }))
    .filter((f) => o.length === 1 || comp(f) > 0);   // trechos encostados não deixam faixa entre eles
}
export const textoZonas = (zs: FaixaCanhao[]) =>
  zs.length ? `Não irriga: ${zs.map((z) => `${z.liga}°–${z.desliga}°`).join('; ')}` : 'Ligado a volta toda';

// --------------------------------------------------------------- geometria
const ponto = (cx: number, cy: number, r: number, g: number) => {
  const t = (g * Math.PI) / 180;
  return [cx + r * Math.sin(t), cy - r * Math.cos(t)] as const;
};
export function arco(cx: number, cy: number, r: number, a0: number, len: number, setor = false) {
  if (len >= 359.9) return setor ? `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` : `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
  const [x0, y0] = ponto(cx, cy, r, a0), [x1, y1] = ponto(cx, cy, r, a0 + len);
  const big = len > 180 ? 1 : 0;
  const a = `A${r} ${r} 0 ${big} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  return setor ? `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} ${a} Z` : `M${x0.toFixed(1)} ${y0.toFixed(1)} ${a}`;
}
/** Anel (segmento) entre os raios ri e ro, de a0 a a1 graus. */
function anel(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number) {
  const [x0, y0] = ponto(cx, cy, ro, a0), [x1, y1] = ponto(cx, cy, ro, a1);
  const [x2, y2] = ponto(cx, cy, ri, a1), [x3, y3] = ponto(cx, cy, ri, a0);
  const f = (n: number) => n.toFixed(1);
  return `M${f(x0)} ${f(y0)} A${ro} ${ro} 0 0 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${ri} ${ri} 0 0 0 ${f(x3)} ${f(y3)} Z`;
}
const anguloDo = (e: RPointerEvent<SVGSVGElement>, cx: number, cy: number, vb: number) => {
  const r = e.currentTarget.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * vb, y = ((e.clientY - r.top) / r.height) * vb;
  return { g: norm((Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI), d: Math.hypot(x - cx, y - cy), x, y };
};

// ------------------------------------------------------------------ dials
/** Aba Ângulo: círculo de 220 px do app (toque escolhe o ângulo final). */
// ------------------------------------------------------------------ dials
/** Parada por ângulo: círculo do app (toque escolhe o ângulo final). */
function DialAngulo({ atual, final, direcao, onChange }: { atual: number; final: number; direcao: Direcao; onChange: (g: number) => void }) {
  const [ini, len] = direcao === 'Reverso' ? [final, norm(atual - final)] : [atual, norm(final - atual)];
  const [ax, ay] = ponto(110, 110, 100, atual), [fx, fy] = ponto(110, 110, 100, final);
  const set = (e: RPointerEvent<SVGSVGElement>) => onChange(anguloDo(e, 110, 110, 220).g);
  return (
    <svg viewBox="0 0 220 220" width="190" height="190" role="img" aria-label="Ângulo final" style={{ touchAction: 'none', cursor: 'pointer' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
      onPointerMove={(e) => { if (e.buttons) set(e); }}>
      <circle cx="110" cy="110" r="100" fill="#26301F" stroke={NX.borda} />
      {len > 0 && <path d={arco(110, 110, 100, ini, len, true)} fill="rgba(114,191,74,0.35)" />}
      <line x1="110" y1="110" x2={ax} y2={ay} stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="110" y1="110" x2={fx} y2={fy} stroke={VERDE} strokeWidth="2.5" strokeDasharray="4 4" />
      <circle cx={fx} cy={fy} r="9" fill={VERDE} />
      <text x="110" y="24" fontSize="11" fill={NX.mudo} textAnchor="middle">0°</text>
      <text x="200" y="114" fontSize="11" fill={NX.mudo} textAnchor="end">90°</text>
      <text x="110" y="204" fontSize="11" fill={NX.mudo} textAnchor="middle">180°</text>
      <text x="20" y="114" fontSize="11" fill={NX.mudo}>270°</text>
    </svg>
  );
}

/** Fim do segmento no sentido do giro: Direita cresce o ângulo, Esquerda diminui. */
export const fimDoSegmento = (seg: number, direcao: Direcao) => (direcao === 'Reverso' ? seg * 90 : ((seg + 1) * 90) % 360);
/** Segmento que o pivô vai percorrer a partir de `atual` (em cima da divisa, é o próximo no sentido do giro). */
export const segmentoDoGiro = (atual: number, direcao: Direcao) => {
  const a = direcao === 'Reverso' ? atual - 0.001 : atual;   // sem arredondar: `norm` devolveria a divisa
  return Math.floor((((a % 360) + 360) % 360) / 90) % 4;
};

/** Parada por segmento: 4 quartos de volta (anel do app); o pivô para no fim do escolhido. */
function AnelSegmentos({ sel, atual, onSel }: { sel: number; atual: number; onSel: (i: number) => void }) {
  const [ax, ay] = ponto(110, 110, 100, atual);
  const segs = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 220 220" width="190" height="190" role="img" aria-label="Segmentos do pivô">
      <circle cx="110" cy="110" r="100" fill="#26301F" />
      {segs.map((i) => (
        <path key={i} role="button" aria-label={`Segmento ${i + 1}`} aria-pressed={i === sel} d={anel(110, 110, 50, 100, i * 90 + 2, (i + 1) * 90 - 2)} stroke={NX.card} strokeWidth="3" style={{ cursor: 'pointer' }}
          fill={i === sel ? VERDE : 'rgba(114,191,74,0.30)'} onClick={() => onSel(i)} />
      ))}
      <circle cx="110" cy="110" r="46" fill={NX.card} />
      <line x1="110" y1="110" x2={ax} y2={ay} stroke={NX.texto} strokeWidth="2.5" strokeLinecap="round" />
      {segs.map((i) => {
        const [x, y] = ponto(110, 110, 74, i * 90 + 45);
        return <text key={i} x={x} y={y + 4} fontSize="12" fontWeight="700" fill="#FFFFFF" textAnchor="middle" style={{ pointerEvents: 'none' }}>{i + 1}</text>;
      })}
    </svg>
  );
}

/** Canhão: o círculo inteiro é canhão ligado; os arcos (`faixas`) são os trechos onde NÃO irrigar, com alças de início e fim. */
function DialCanhao({ atual, faixas, onChange }: { atual: number; faixas: FaixaCanhao[]; onChange: (fs: FaixaCanhao[]) => void }) {
  const VB = 290, cx = 145, cy = 145, r = 117;
  const arraste = useRef<{ i: number; alca: 'liga' | 'desliga' } | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const [ax, ay] = ponto(cx, cy, r, atual);
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    const p = anguloDo(e, cx, cy, VB);
    inicio.current = { x: p.x, y: p.y };
    let melhor: { i: number; alca: 'liga' | 'desliga'; d: number } | null = null;
    faixas.forEach((f, i) => (['liga', 'desliga'] as const).forEach((alca) => {
      const [hx, hy] = ponto(cx, cy, r, f[alca]);
      const d = Math.hypot(hx - p.x, hy - p.y);
      if (d <= 30 && (!melhor || d < melhor.d)) melhor = { i, alca, d };
    }));
    const m = melhor as { i: number; alca: 'liga' | 'desliga' } | null;
    arraste.current = m ? { i: m.i, alca: m.alca } : null;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (!arraste.current || !e.buttons) return;
    onChange(moverAlca(faixas, arraste.current.i, arraste.current.alca, anguloDo(e, cx, cy, VB).g));
  };
  const up = (e: RPointerEvent<SVGSVGElement>) => {
    const p = anguloDo(e, cx, cy, VB);
    const ini = inicio.current;
    if (!arraste.current && ini && Math.hypot(p.x - ini.x, p.y - ini.y) < 10 && p.d <= r + 12) {
      const nova = faixaEm(faixas, p.g);
      if (nova) onChange([...faixas, nova]);
    }
    arraste.current = null; inicio.current = null;
  };
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} width="260" height="260" role="img" aria-label={`Canhão final, ${faixas.length} trecho(s) sem irrigar`}
      style={{ touchAction: 'none', display: 'block', maxWidth: '100%' }} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      <circle cx={cx} cy={cy} r={r} fill={NX.ok} fillOpacity="0.35" stroke={NX.ok} strokeWidth="5" />
      {[0, 90, 180, 270].map((g) => {
        const [x, y] = ponto(cx, cy, r + 16, g);
        return <text key={g} x={x} y={y + 4} fontSize="11" textAnchor="middle" fill={NX.mudo}>{g}°</text>;
      })}
      {faixas.map((f) => (
        <g key={f.id}>
          <path d={arco(cx, cy, r, f.liga, comp(f), true)} fill={NX.card} />
          <path d={arco(cx, cy, r, f.liga, comp(f), true)} fill={NX.bad} fillOpacity="0.25" />
          <path d={arco(cx, cy, r, f.liga, comp(f))} fill="none" stroke={NX.bad} strokeWidth="5" />
        </g>
      ))}
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke={NX.texto} strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill={NX.texto} />
      {faixas.map((f, i) => (['liga', 'desliga'] as const).map((alca) => {
        const [hx, hy] = ponto(cx, cy, r, f[alca]);
        return (
          <circle key={`${f.id}-${alca}`} cx={hx} cy={hy} r="12" fill={alca === 'liga' ? NX.bad : NX.card}
            stroke={alca === 'liga' ? '#FFFFFF' : NX.bad} strokeWidth="2.5" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))', cursor: 'grab' }}>
            <title>{`Trecho ${i + 1} sem irrigar, ${alca === 'liga' ? 'começa' : 'termina'} em ${f[alca]} graus`}</title>
          </circle>
        );
      }))}
    </svg>
  );
}

// ------------------------------------------------------------------ painel
interface Props {
  nome: string;
  angulo: number | null;
  ultima: ConfigIrrigacao;
  lamina100: number;
  tempoVolta100: number;
  ponta: { ativo: boolean; inicio: string; fim: string } | null;
  enviando: boolean;
  /** Por que o NexON não comanda o canhão (falta o ponto Canhao ou o status Canhao_ligado); null = comanda */
  semCanhaoMotivo?: string | null;
  abaInicial?: AbaIrrigacao;
  programacoes: Programacao[] | null;
  onRemoverProgramacao: (id: string) => void;
  onSalvarProgramacao: (p: NovaProgramacao) => Promise<boolean>;
  onEnviar: (e: EnvioIrrigacao) => void;
  onClose: () => void;
  /** Pivô girando (ou ligando): o diálogo passa a ser "desligar ou modificar". */
  ligado?: boolean;
  /** Irrigação em curso (config e parada que o servidor guardou) — ponto de partida da edição. */
  emCurso?: { config: ConfigIrrigacao; parada?: Parada | { tipo: string } | null } | null;
  /** Desligar pelo diálogo (o pai confirma com alerta). Sem ele o botão não aparece. */
  onDesligar?: () => void;
  /** Desligar indisponível (sem comando, sequência em andamento…). */
  desligarOff?: boolean;
  /** Enviar indisponível (sequência do pivô em andamento). */
  enviarOff?: boolean;
  /** Pivô ligado sem irrigação registrada pelo NexON (ligado no painel): as opções abaixo são um
   *  palpite (última enviada + sentido lido), então o envio fica liberado mesmo sem edição. */
  semRegistro?: boolean;
  /** Parada automática em curso que o reinício mantém enquanto a Parada não for alterada. */
  notaParada?: string | null;
  /** A mudança sai sem reiniciar (só o percentímetro, e a TON troca girando)? Muda o aviso. */
  semReinicio?: (e: EnvioIrrigacao) => boolean;
  /** Dá para ligar PARADO (água sem girar): pelo percentímetro em 0 % ou, sem o ponto, só com a
   *  bomba (o servidor não manda girar). Falso = pivô sem percentímetro e sem bomba configurada. */
  podeParado?: boolean;
  /** Agenda por data (planilha): o que está agendado de hoje em diante. null = carregando ou indisponível. */
  agenda?: AgendaItem[] | null;
  /** Sobe a planilha. Devolve null se gravou, ou o motivo da recusa (nada é gravado pela metade). */
  onImportarAgenda?: (itens: ItemPlanilha[], substituir: boolean) => Promise<string | null>;
  /** Apaga a agenda por data de hoje em diante. */
  onLimparAgenda?: () => Promise<void>;
}

/** Parada da irrigação em curso → a que o formulário edita (tipo desconhecido vira "sem parar"). */
export const paradaValida = (p?: Parada | { tipo: string } | null): Parada =>
  (p && (p.tipo === 'porAngulo' || p.tipo === 'porGraus' || p.tipo === 'porVoltas' || p.tipo === 'porTempo') ? (p as Parada) : { tipo: 'semParar' });

/** Parado = ligado com água e percentímetro em 0 %: irriga no lugar, sem girar. */
export const ehParado = (c: { semAgua: boolean; percentual: number }) => !c.semAgua && !(c.percentual > 0);

const horaDe = (x: string) => { const [h, m] = x.split(':').map(Number); return (h || 0) + (m || 0) / 60; };
const hTxt = (x: string) => (x.endsWith(':00') ? `${Number(x.slice(0, 2))}h` : x);
const terminoTxt = (fim: Date, horas: number) => {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const dias = Math.floor((new Date(fim).setHours(0, 0, 0, 0) - d0.getTime()) / 86400000);
  const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
  return `Término previsto ${quando} ${fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${fmt(horas, 1)} h`;
};

export function previsao(config: ConfigIrrigacao, parada: Parada, direcao: Direcao, atual: number, tempoVolta100: number, inicio: Date) {
  if (parada.tipo === 'semParar') return { texto: 'Sem previsão de término (sem parada)', fim: null as Date | null };
  if (parada.tipo === 'porTempo') {
    const fim = new Date(inicio.getTime() + parada.minutos * 60000);
    return { texto: terminoTxt(fim, parada.minutos / 60), fim };
  }
  // Parado (0 %) não percorre ângulo nem volta: só para por tempo ou na mão.
  if (ehParado(config)) return { texto: 'Sem previsão de término (parado não chega ao ângulo)', fim: null as Date | null };
  let delta = parada.tipo === 'porVoltas' ? 360 * parada.voltas : parada.tipo === 'porGraus' ? parada.graus : direcao === 'Reverso' ? norm(atual - parada.angulo) : norm(parada.angulo - atual);
  if (delta <= 0) delta += 360;
  const horas = (delta / 360) * tempoVolta100 * (config.semAgua ? 1 : 100 / config.percentual);
  const fim = new Date(inicio.getTime() + horas * 3600000);
  return { texto: terminoTxt(fim, horas), fim };
}

// estilos do mockup
const col = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap });
const rotulo: CSSProperties = { fontSize: 12, color: NX.mudo };
const caixaCampo: CSSProperties = { border: `1px solid ${NX.borda}`, borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 };
const inputGrande: CSSProperties = { width: '100%', minWidth: 0, border: 0, fontSize: 20, fontWeight: 800, color: NX.texto, background: 'transparent', padding: 0 };
const valorCaixa: CSSProperties = { fontSize: 15, fontWeight: 800, color: NX.texto, background: 'transparent', border: 0, padding: 0, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' };
const inputCaixa: CSSProperties = { fontSize: 15, fontWeight: 800, color: NX.texto, background: 'transparent', border: 0, padding: 0, minWidth: 0 };
const linha: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 };
const titulo15: CSSProperties = { fontSize: 15, fontWeight: 700 };
const segBox: CSSProperties = { display: 'flex', padding: 3, borderRadius: 12, background: NX.seg };


/**
 * Planejamento de irrigação — UMA tela (NEXON-98, redesenho): Direção, Água,
 * percentímetro/lâmina, canhão (com as faixas no próprio lugar), início e parada. Parar num
 * ângulo é a Parada "Por ângulo"; parar no fim de um quarto de volta é a "Por segmento" (vai para
 * a API como parada por ângulo). A Agenda usa as opções desta tela em vez de repetir os campos.
 */
export function IrrigacaoAvancada({
  nome, angulo, ultima, lamina100, tempoVolta100, ponta, enviando, semCanhaoMotivo = null, abaInicial = 'simples',
  programacoes, onRemoverProgramacao, onSalvarProgramacao, onEnviar, onClose,
  ligado = false, emCurso = null, onDesligar, desligarOff = false, enviarOff = false, semRegistro = false, notaParada = null, semReinicio,
  podeParado = false, agenda = null, onImportarAgenda, onLimparAgenda,
}: Props) {
  const atual = angulo ?? 0;
  // Ligado: parte da irrigação em curso (o que o operador vê girando), não da última enviada.
  // Sem o ponto Percentímetro o NexON não segura o pivô parado: uma config em 0 % (última
  // enviada, registro antigo) nunca abre como "Parado" — sobe para 100 % (o painel é quem manda).
  // A tela não oferece mais ligar parado: 0 % só aparece quando é a irrigação EM CURSO (e o pivô a sustenta).
  const sanear = (c: ConfigIrrigacao): ConfigIrrigacao => ((!ligado || !podeParado) && !(c.percentual > 0) ? { ...c, percentual: 100, lamina: null } : c);
  const base: ConfigIrrigacao = sanear(ligado && emCurso ? { ...CONFIG_PADRAO, ...emCurso.config, faixasCanhao: emCurso.config.faixasCanhao ?? [] } : ultima);
  const [aba, setAba] = useState<AbaIrrigacao>(abaInicial);
  const [cfg, setCfg] = useState<ConfigIrrigacao>({ ...base, canhao: ligado ? base.canhao : false });
  // Trechos onde NÃO irrigar (o complemento das faixas ligadas que a API guarda).
  const [zonas, setZonasRaw] = useState<FaixaCanhao[]>(() => complementoFaixas(base.faixasCanhao));
  // Sem mexer, vão as faixas como vieram (mesma ordem): o "só o percentímetro mudou" compara o JSON.
  const [zonasTocadas, setZonasTocadas] = useState(false);
  const setZonas = (z: FaixaCanhao[]) => { setZonasTocadas(true); setZonasRaw(z); };
  const [faixasAbertas, setFaixasAbertas] = useState(false);
  // Parada "Por segmento": o pivô para no fim do quarto de volta escolhido (vai como parada por ângulo).
  const [porSegmento, setPorSegmento] = useState(false);
  const [segSel, setSegSel] = useState(0);
  const [inicioTipo, setInicioTipo] = useState<'agora' | 'data'>('agora');
  const [inicioData, setInicioData] = useState('');
  // Ligar novo: 1 volta por padrão. "Sem parar" não se escolhe mais (esquema do pivô, NEXON-98);
  // só aparece quando é a parada da irrigação EM CURSO.
  const [parada, setParada] = useState<Parada>(() => (ligado ? paradaValida(emCurso?.parada) : { tipo: 'porVoltas', voltas: 1 }));
  const [pctTxt, setPctTxt] = useState<string | null>(null);
  const [lamTxt, setLamTxt] = useState<string | null>(null);
  const [minTxt, setMinTxt] = useState<string | null>(null);
  // O operador mexeu na Parada (mesmo voltando ao mesmo valor): vale a nova, do zero.
  const [paradaTocada, setParadaTocada] = useState(false);
  const mudarParada = (p: Parada) => { setParadaTocada(true); setParada(p); };
  const [nova, setNova] = useState<null | { grupo: string; ini: string; fim: string }>(null);
  const [salvandoProg, setSalvandoProg] = useState(false);
  // Planilha: o arquivo lido espera o "Importar"; o erro (do arquivo ou da API) fica na tela.
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<null | { arquivo: string; itens: ItemPlanilha[] }>(null);
  const [planErro, setPlanErro] = useState<string | null>(null);
  const [substituir, setSubstituir] = useState(false);
  const [planEnviando, setPlanEnviando] = useState(false);
  const [confirmaLimpar, setConfirmaLimpar] = useState(false);
  const escolherArquivo = async (f: File | undefined) => {
    if (!f) return;
    setPlanErro(null); setPlan(null);
    const r = await lerPlanilha(f);
    if (r.erro) setPlanErro(r.erro);
    else setPlan({ arquivo: f.name, itens: r.itens });
    if (arquivoRef.current) arquivoRef.current.value = '';   // deixa escolher o mesmo arquivo de novo
  };
  const importar = async () => {
    if (!plan || !onImportarAgenda) return;
    setPlanEnviando(true); setPlanErro(null);
    const erro = await onImportarAgenda(plan.itens, substituir);
    setPlanEnviando(false);
    if (erro) setPlanErro(erro);
    else { setPlan(null); setSubstituir(false); }
  };
  // Percentual para voltar a girar depois de escolher Parado.
  const pctAntes = useRef(base.percentual > 0 ? base.percentual : 100);

  const parado = ehParado(cfg);
  const seco = cfg.semAgua;
  const semCanhao = seco || !!semCanhaoMotivo;
  const canhaoAtivo = cfg.canhao && !semCanhao;
  // Na Agenda o canhão segue a água: nunca no seco, nem em pivô sem o canhão configurado.
  const canhaoAgenda = cfg.canhao && !cfg.semAgua && !semCanhaoMotivo;
  // Trechos marcados cobrindo a volta toda: não sobra onde o canhão ligar. Sem isto o complemento
  // saía vazio e ia "canhão ligado a volta toda" — o contrário do que a tela mostrava.
  const faixasLigadas = zonasTocadas ? complementoFaixas(zonas) : base.faixasCanhao;
  const tudoMarcado = canhaoAtivo && zonasTocadas && zonas.length > 0 && faixasLigadas.length === 0;
  const canhaoEnvio = canhaoAtivo && !tudoMarcado;
  // O que vai para o pivô: "Por segmento" é uma parada por ângulo no fim do segmento escolhido.
  const paradaEf: Parada = porSegmento ? { tipo: 'porAngulo', angulo: fimDoSegmento(segSel, cfg.direcao) } : parada;

  // Parado (0 % com água) não se escolhe mais na tela; se a irrigação em curso é assim, escolher a
  // direção volta a girar com o percentual de antes.
  const girar = (d: Direcao) => {
    setPctTxt(null); setLamTxt(null);
    setCfg((c) => (ehParado(c) ? { ...c, direcao: d, percentual: pctAntes.current, lamina: null } : { ...c, direcao: d }));
  };

  const pct = cfg.percentual;
  const lam = pct > 0 ? (lamina100 * 100) / pct : null;
  // % com 1 casa, de 1 a 100 (0 é o "Parado"). Digitando a lâmina, ela vai junto e o servidor confere.
  const onPct = (v: string) => {
    setPctTxt(v); setLamTxt(null);
    const p = Number(v.replace(',', '.'));
    if (v.trim() !== '' && Number.isFinite(p) && p >= 1) setCfg((c) => ({ ...c, percentual: Math.min(100, Math.round(p * 10) / 10), lamina: null }));
  };
  const onLam = (v: string) => {
    setLamTxt(v); setPctTxt(null);
    const l = Number(v.replace(',', '.'));
    if (!(l > 0) || !(lamina100 > 0)) return;
    if (l < lamina100) { setCfg((c) => ({ ...c, percentual: 100, lamina: null })); return; }   // abaixo do mínimo: fica em 100 % (aviso abaixo)
    setCfg((c) => ({ ...c, percentual: Math.max(1, Math.min(100, Math.round(((lamina100 * 100) / l) * 10) / 10)), lamina: Math.round(l * 100) / 100 }));
  };
  const lamAbaixo = (() => { const l = Number((lamTxt ?? '').replace(',', '.')); return lamTxt != null && l > 0 && lamina100 > 0 && l < lamina100; })();
  const pctAbaixo = (() => { const p = Number((pctTxt ?? '').replace(',', '.')); return pctTxt != null && pctTxt.trim() !== '' && Number.isFinite(p) && p < 1; })();

  const inicio = !ligado && inicioTipo === 'data' && inicioData ? new Date(inicioData) : new Date();
  const prev = previsao(cfg, paradaEf, cfg.direcao, atual, tempoVolta100, inicio);
  const pontaTxt = useMemo(() => {
    if (!ponta) return null;
    const p0 = horaDe(ponta.inicio), p1 = horaDe(ponta.fim);
    let cruza = !prev.fim;
    if (prev.fim) {
      for (let t = inicio.getTime(); t <= prev.fim.getTime(); t += 15 * 60000) {
        const d = new Date(t), h = d.getHours() + d.getMinutes() / 60;
        if (h >= p0 && h < p1) { cruza = true; break; }
      }
    }
    if (!cruza) return null;
    return ponta.ativo
      ? { aviso: false, txt: `Bloqueio de ponta ativo: pausa às ${hTxt(ponta.inicio)} e retoma às ${hTxt(ponta.fim)}` }
      : { aviso: true, txt: `Vai irrigar no horário de ponta (${hTxt(ponta.inicio)} às ${hTxt(ponta.fim)}). Bloqueio desligado.` };
  }, [ponta, prev.fim, inicio.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const paradaInicial = useRef(JSON.stringify(parada));
  const paradaIntacta = !paradaTocada && JSON.stringify(parada) === paradaInicial.current;
  // Parado só para por tempo; qualquer outra parada (ou nenhuma) deixa irrigando no lugar.
  const paradoSemTempo = parado && parada.tipo !== 'porTempo';
  // Parado sem o ponto na TON não sai daqui (o estado inicial já é saneado; isto é a segunda trava).
  const paradoIndisponivel = parado && !podeParado;
  // Ligado, o reinício é sempre agora: agendar início não faz sentido com o pivô girando.
  const montar = (): EnvioIrrigacao => ({
    modo: porSegmento ? 'segmentos' : 'simples', parada: paradaEf, inicio: ligado || inicioTipo === 'agora' ? null : inicio,
    ...(porSegmento ? { segmento: segSel + 1 } : {}),
    ...(ligado ? { manterParada: paradaIntacta } : {}),
    config: { ...cfg, canhao: canhaoEnvio, faixasCanhao: canhaoEnvio ? faixasLigadas : [] },
  });
  const enviar = () => onEnviar(montar());
  // "Editado" = o que seria enviado mudou desde que o diálogo abriu. Fora da conta: o início (é
  // sempre agora) e a lâmina digitada (o que vale é o percentual; redigitar o mesmo não é mudança).
  // No seco o percentual não vale (o servidor usa 100): Molhado → +10 → Seco de novo não é mudança.
  const assinar = (e: EnvioIrrigacao) => JSON.stringify({ ...e, inicio: null, config: { ...e.config, lamina: null, percentual: e.config.semAgua ? null : e.config.percentual } });
  const assinatura = assinar(montar());
  const assinaturaInicial = useRef(assinatura);
  const editado = assinatura !== assinaturaInicial.current;
  const agendar = !ligado && inicioTipo === 'data';
  const rotuloEnviar = enviando ? 'Executando…' : ligado ? 'Salvar e enviar' : agendar ? 'Agendar início' : parado ? 'Ligar parado' : 'Ligar';

  const nProg = programacoes?.length ?? 0;
  const agendaCheia = nProg >= 5;
  const salvarAgendamento = async () => {
    if (!nova || parado) return;
    const g = GRUPOS_DIAS.find((x) => x.v === nova.grupo) ?? GRUPOS_DIAS[0];
    const [h0, m0] = nova.ini.split(':').map(Number), [h1, m1] = nova.fim.split(':').map(Number);
    const dur = ((h1 * 60 + m1) - (h0 * 60 + m0) + 1440) % 1440 || 1440;
    setSalvandoProg(true);
    const ok = await onSalvarProgramacao({
      nome: `${g.label} · ${nova.ini} → ${nova.fim}`, ativo: true, hora_inicio: nova.ini, dias: g.dias, modo: 'tempo',
      duracao_min: dur, sentido: cfg.direcao === 'Avanço' ? 'horario' : 'anti_horario',
      velocidade: cfg.semAgua ? null : cfg.percentual, com_agua: !cfg.semAgua,
      // só vai quando liga: API que ainda não conhece o campo recusa o corpo inteiro (forbidNonWhitelisted)
      ...(canhaoAgenda ? { canhao: true } : {}),
    });
    setSalvandoProg(false);
    if (ok) setNova(null);
  };

  const botaoEnviar = (label: string, onClick: () => void, off: boolean) => (
    <button type="button" disabled={off} onClick={onClick}
      style={{ height: 48, borderRadius: 12, background: off ? NX.acaoOff : NX.acao, color: '#FFFFFF', fontSize: 16, fontWeight: 800, textAlign: 'center' }}>
      {label}
    </button>
  );
  const dica = (texto: string, cor: string = NX.mudo) => <span style={{ fontSize: 12, color: cor }}>{texto}</span>;

  const nZonas = zonas.length;
  const podeAdd = nZonas < 5 && !!faixaNoVao(zonas, atual);
  const tempoInput: CSSProperties = { height: 38, borderRadius: 10, border: `1px solid ${NX.borda}`, padding: '0 10px', fontSize: 15, fontWeight: 700, color: NX.texto, background: NX.card };

  // Tamanho fixo: cabeçalho e rodapé parados, o meio rola. Trocar de aba não muda o diálogo.
  const corpo: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', ...col(14), paddingRight: 4 };
  const rodape: CSSProperties = { ...col(8), flex: 'none' };

  return (
    <div style={{ ...col(12), height: '100%', minHeight: 0 }}>
      <NxDialogHead title="Planejamento de irrigação" sub={`${nome} · ângulo atual ${angulo != null ? `${fmt(angulo, 1)}°` : '—'}`} onClose={onClose} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, padding: 4, borderRadius: 12, background: NX.seg }}>
        {([{ v: 'simples', label: 'Irrigação' }, { v: 'agenda', label: `Agenda${nProg ? ` · ${nProg}` : ''}` }] as const).map((a) => (
          <button key={a.v} type="button" aria-pressed={aba === a.v} onClick={() => setAba(a.v)} style={s.dTab(aba === a.v)}>{a.label}</button>
        ))}
      </div>

      {aba === 'simples' && (
        <>
        <div style={corpo}>
          <div style={col(4)}>
            <div style={linha}>
              <span style={titulo15}>Direção</span>
              <div role="radiogroup" aria-label="Direção" style={segBox}>
                {(['Avanço', 'Reverso'] as const).map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={!parado && cfg.direcao === d}
                    onClick={() => girar(d)} style={s.seg(!parado && cfg.direcao === d)}>
                    {DIRECAO_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
            {parado && dica('Irrigando parado (sem girar). Escolha a direção para voltar a girar.', NX.warn)}
            <button type="button" role="switch" aria-checked={!seco} disabled={parado}
              onClick={() => { setPctTxt(null); setLamTxt(null); setCfg((c) => (c.semAgua ? { ...c, semAgua: false, ...(c.percentual > 0 ? {} : { percentual: pctAntes.current, lamina: null }) } : { ...c, semAgua: true })); }}
              style={{ ...linha, width: '100%', ...(parado ? { opacity: 0.45 } : {}) }}>
              <span style={{ ...col(2), textAlign: 'left' }}>
                <span style={titulo15}>Água</span>
                <span style={rotulo}>{seco ? 'Seco: gira sem água, a bomba não liga' : 'Molhado: irriga'}</span>
              </span>
              <NxSwitch on={!seco} />
            </button>
          </div>

          {!parado && !seco && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label style={caixaCampo}>
                <span style={rotulo}>Percentímetro</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input inputMode="decimal" aria-label="Percentímetro" value={pctTxt ?? fmtPct(pct)} onChange={(e) => onPct(e.target.value)} onBlur={() => setPctTxt(null)} style={inputGrande} />
                  <span style={{ color: NX.mudo }}>%</span>
                </span>
              </label>
              <label style={caixaCampo}>
                <span style={rotulo}>Lâmina</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input inputMode="decimal" aria-label="Lâmina" value={lamTxt ?? (lam != null ? fmt(lam, 2) : '—')} onChange={(e) => onLam(e.target.value)} onBlur={() => setLamTxt(null)} style={inputGrande} />
                  <span style={{ color: NX.mudo }}>mm</span>
                </span>
              </label>
              {lamAbaixo && <span style={{ gridColumn: '1 / -1', fontSize: 12, color: NX.warn }}>Lâmina mínima deste pivô: {fmt(lamina100, 2)} mm (100 %).</span>}
              {pctAbaixo && <span style={{ gridColumn: '1 / -1', fontSize: 12, color: NX.mudo }}>De 1 a 100 %.</span>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: ligado ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {!ligado && (
              <span style={caixaCampo}>
                <span style={rotulo}>Início</span>
                <select aria-label="Início" value={inicioTipo} onChange={(e) => setInicioTipo(e.target.value as 'agora' | 'data')} style={valorCaixa}>
                  <option value="agora">Agora</option><option value="data">Data e hora</option>
                </select>
                {inicioTipo === 'data' && (
                  <input type="datetime-local" aria-label="Data e hora do início" value={inicioData} min={new Date().toISOString().slice(0, 16)} onChange={(e) => setInicioData(e.target.value)} style={inputCaixa} />
                )}
              </span>
            )}
            <span style={caixaCampo}>
              <span style={rotulo}>Parada</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <select aria-label="Parada" value={porSegmento ? 'porSegmento' : parada.tipo} style={valorCaixa}
                  onChange={(e) => {
                    setMinTxt(null);
                    const seg = e.target.value === 'porSegmento';
                    setPorSegmento(seg);
                    if (seg) setSegSel(segmentoDoGiro(atual, cfg.direcao));   // começa no segmento onde o pivô está
                    mudarParada(seg ? { tipo: 'semParar' } : e.target.value === 'porGraus' ? { tipo: 'porGraus', graus: 30 } : e.target.value === 'porAngulo' ? { tipo: 'porAngulo', angulo: 0 } : e.target.value === 'porVoltas' ? { tipo: 'porVoltas', voltas: 1 }
                    : e.target.value === 'porTempo' ? { tipo: 'porTempo', minutos: 60 } : { tipo: 'semParar' }); }}>
                  {parada.tipo === 'semParar' && !porSegmento && <option value="semParar">Sem parar</option>}
                  {/* parado não oferece ângulo/voltas — mas mostra a que já está em curso */}
                  {/* "Andar X°": o valor é o quanto andar a partir de onde está (decisão 12/11) */}
                  {(!parado || parada.tipo === 'porGraus') && <option value="porGraus">Andar X°</option>}
                  {(!parado || parada.tipo === 'porAngulo') && <option value="porAngulo">Parar no ângulo</option>}
                  {!parado && <option value="porSegmento">Por segmento</option>}
                  {(!parado || parada.tipo === 'porVoltas') && <option value="porVoltas">Por voltas</option>}
                  <option value="porTempo">Por tempo</option>
                </select>
                {porSegmento && <span style={{ fontSize: 15, fontWeight: 800 }}>· {segSel + 1}</span>}
                {parada.tipo === 'porAngulo' && (
                  <><span style={{ fontSize: 15, fontWeight: 800 }}>·</span>
                    <input inputMode="numeric" aria-label="Ângulo de parada" value={parada.angulo} style={{ ...inputCaixa, width: 40, textAlign: 'right' }}
                      onChange={(e) => mudarParada({ tipo: 'porAngulo', angulo: Math.min(359, Math.max(0, Number(e.target.value) || 0)) })} />
                    <span style={{ fontSize: 15, fontWeight: 800 }}>°</span></>
                )}
                {parada.tipo === 'porGraus' && (
                  <><span style={{ fontSize: 15, fontWeight: 800 }}>·</span>
                    <input inputMode="numeric" aria-label="Graus a andar" value={parada.graus} style={{ ...inputCaixa, width: 48, textAlign: 'right' }}
                      onChange={(e) => mudarParada({ tipo: 'porGraus', graus: Math.min(3600, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} />
                    <span style={{ fontSize: 15, fontWeight: 800 }}>°</span></>
                )}
                {parada.tipo === 'porVoltas' && (
                  <><span style={{ fontSize: 15, fontWeight: 800 }}>·</span>
                    <input inputMode="numeric" aria-label="Voltas" value={parada.voltas} style={{ ...inputCaixa, width: 28, textAlign: 'right' }}
                      onChange={(e) => mudarParada({ tipo: 'porVoltas', voltas: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} /></>
                )}
                {parada.tipo === 'porTempo' && (
                  <><span style={{ fontSize: 15, fontWeight: 800 }}>·</span>
                    {/* texto livre enquanto digita (dá para apagar); só vale número inteiro de 1 a 10080 */}
                    <input inputMode="numeric" aria-label="Minutos" value={minTxt ?? String(parada.minutos)} style={{ ...inputCaixa, width: 52, textAlign: 'right' }}
                      onBlur={() => setMinTxt(null)}
                      onChange={(e) => { setMinTxt(e.target.value); const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 10080) mudarParada({ tipo: 'porTempo', minutos: n }); }} />
                    <span style={{ fontSize: 15, fontWeight: 800 }}>min</span></>
                )}
              </span>
            </span>
          </div>
          {parada.tipo === 'porAngulo' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <DialAngulo atual={atual} final={parada.angulo} direcao={cfg.direcao} onChange={(g) => mudarParada({ tipo: 'porAngulo', angulo: g })} />
              <span style={{ fontSize: 13, color: NX.mudo }}>Toque no círculo para escolher o ângulo final · {parada.angulo}°</span>
            </div>
          )}
          {porSegmento && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <AnelSegmentos sel={segSel} atual={atual} onSel={(i) => { setParadaTocada(true); setSegSel(i); }} />
              <span style={{ fontSize: 13, color: NX.mudo }}>Toque no segmento · o pivô para no fim do segmento {segSel + 1} ({paradaEf.tipo === 'porAngulo' ? paradaEf.angulo : 0}°)</span>
            </div>
          )}
          {/* Canhão por último (pedido do dono): é o que menos se mexe ao ligar. */}
          <div style={col(8)}>
            <button type="button" role="switch" aria-checked={canhaoAtivo} disabled={semCanhao} onClick={() => setCfg((c) => ({ ...c, canhao: !c.canhao }))}
              style={{ ...linha, width: '100%', ...(semCanhao ? { opacity: 0.45 } : {}) }}>
              <span style={{ ...col(2), textAlign: 'left' }}>
                <span style={titulo15}>Canhão final</span>
                <span style={rotulo}>{semCanhaoMotivo ? semCanhaoMotivo : seco ? 'Indisponível girando sem água' : !cfg.canhao ? 'Começa desligado' : textoZonas(zonas)}</span>
              </span>
              <NxSwitch on={canhaoAtivo} />
            </button>
            {canhaoAtivo && !parado && (
              <button type="button" onClick={() => setFaixasAbertas((v) => !v)} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 800, color: NX.acao }}>
                {faixasAbertas ? 'Fechar' : nZonas ? 'Editar onde não irrigar' : 'Marcar onde não irrigar'}
              </button>
            )}
            {canhaoAtivo && !parado && faixasAbertas && (
              <div style={{ border: `1px solid ${NX.borda}`, borderRadius: 14, padding: 12, ...col(10) }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <DialCanhao atual={atual} faixas={zonas} onChange={setZonas} />
                  <span style={{ fontSize: 13, color: NX.mudo }}>Verde = canhão ligado · toque no círculo para marcar onde não irrigar</span>
                  {dica('O NexON ainda não desliga o canhão sozinho nesses trechos.', NX.warn)}
                  {tudoMarcado && dica('A volta toda está marcada: o canhão vai desligado.', NX.warn)}
                </div>
                {zonas.map((f, i) => (
                  <div key={f.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 32px', gap: 8, alignItems: 'center' }}>
                    {(['liga', 'desliga'] as const).map((al) => (
                      <label key={al} style={{ height: 40, borderRadius: 10, background: NX.seg, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <span style={{ color: NX.mudo }}>{al === 'liga' ? 'De' : 'Até'}</span>
                        <input inputMode="numeric" value={f[al]} aria-label={`Trecho ${i + 1} sem irrigar, ${al === 'liga' ? 'de' : 'até'}`}
                          onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setZonas(moverAlca(zonas, i, al, v)); }}
                          style={{ width: '100%', minWidth: 0, background: 'transparent', border: 0, fontWeight: 800, textAlign: 'right', color: NX.texto, padding: 0 }} />
                        <span style={{ color: NX.mudo }}>°</span>
                      </label>
                    ))}
                    <button type="button" aria-label={`Remover trecho ${i + 1}`} onClick={() => setZonas(zonas.filter((x) => x.id !== f.id))}
                      style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NX.bad} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </div>
                ))}
                <button type="button" disabled={!podeAdd} onClick={() => { const n = faixaNoVao(zonas, atual); if (n) setZonas([...zonas, n]); }}
                  style={{ height: 44, borderRadius: 12, border: `1px dashed ${NX.off}`, fontSize: 14, fontWeight: 800, textAlign: 'center', color: podeAdd ? NX.acao : NX.desab }}>
                  {nZonas >= 5 ? 'Limite de 5 trechos' : '+ Marcar trecho sem irrigar'}
                </button>
                {!nZonas && dica('Nada marcado: canhão ligado a volta toda.')}
              </div>
            )}
          </div>

          <div style={{ background: NX.caixa, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Parada em curso intacta: o término que vale é o dela (o reinício herda o que falta), não um novo do zero. */}
            <span style={{ fontSize: 14, color: NX.caixaTx }}>{ligado && notaParada && paradaIntacta ? notaParada : prev.texto}</span>
            {paradoSemTempo && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: NX.warn }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, flex: 'none', background: NX.warn }} />Parado só para por tempo: sem isso, irriga no mesmo lugar até alguém desligar.
              </span>
            )}
            {pontaTxt && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: pontaTxt.aviso ? NX.warn : NX.caixaTx }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, flex: 'none', background: pontaTxt.aviso ? NX.warn : NX.ok }} />{pontaTxt.txt}
              </span>
            )}
          </div>
        </div>

        <div style={rodape}>
          {/* Rodapé: parado → Ligar; ligado → Desligar e, depois de editar, Salvar e enviar. */}
          {ligado && !editado && !semRegistro && dica('Pivô ligado com esta configuração. Edite qualquer opção para reiniciar com as novas.', NX.mudo)}
          {ligado && !editado && semRegistro && dica('Pivô ligado fora do NexON (painel): não há irrigação registrada. Confira as opções — ao salvar, o pivô desliga e liga de novo com elas.', NX.warn)}
          {ligado && editado && (semReinicio?.(montar())
            ? dica('Só o percentímetro mudou: ao salvar, troca sem desligar o pivô.')
            : dica('Ao salvar, o pivô desliga e liga de novo com as novas opções.', NX.warn))}
          {paradoIndisponivel && dica('Este pivô não tem como ligar parado (sem percentímetro na TON e sem bomba configurada): escolha Direita ou Esquerda.', NX.warn)}
          {(!ligado || editado || semRegistro) && botaoEnviar(rotuloEnviar, enviar, enviando || enviarOff || paradoIndisponivel)}
          {ligado && onDesligar && (
            <button type="button" disabled={desligarOff || enviando} onClick={onDesligar}
              style={{ height: 48, borderRadius: 12, border: `1.5px solid ${desligarOff || enviando ? NX.off : NX.bad}`, background: NX.card, color: desligarOff || enviando ? NX.desab : NX.bad, fontSize: 16, fontWeight: 800, textAlign: 'center' }}>
              Desligar
            </button>
          )}
        </div>
        </>
      )}

      {aba === 'agenda' && (
        <>
        <div style={corpo}>
          <div style={col(8)}>
            <span style={s.label}>TODA SEMANA</span>
            {programacoes == null && <span style={{ fontSize: 14, color: NX.mudo }}>Carregando…</span>}
            {programacoes != null && !nProg && !nova && <span style={{ fontSize: 14, color: NX.mudo }}>Nenhum horário programado.</span>}
            {(programacoes ?? []).map((p) => {
              const t = textoProgramacao(p);
              return (
                <div key={p.id} style={{ background: NX.caixa, borderRadius: 14, padding: '12px 8px 12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 1, ...col(2) }}>
                    <span style={titulo15}>{t.quando}</span>
                    <span style={{ fontSize: 13, color: NX.mudo }}>{t.det}</span>
                  </span>
                  <button type="button" aria-label="Remover agendamento" onClick={() => onRemoverProgramacao(p.id)} style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NX.bad} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                  </button>
                </div>
              );
            })}
            {nova ? (
              <div style={{ border: `1px solid ${NX.borda}`, borderRadius: 14, padding: 12, ...col(10) }}>
                <div style={{ ...segBox, alignSelf: 'flex-start' }}>
                  {GRUPOS_DIAS.map((g) => (
                    <button key={g.v} type="button" aria-pressed={nova.grupo === g.v} onClick={() => setNova({ ...nova, grupo: g.v })} style={s.seg(nova.grupo === g.v)}>{g.label}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['ini', 'fim'] as const).map((k) => (
                    <label key={k} style={{ flex: 1, ...col(4) }}>
                      <span style={rotulo}>{k === 'ini' ? 'Início' : 'Fim'}</span>
                      <input type="time" value={nova[k]} onChange={(e) => setNova({ ...nova, [k]: e.target.value })} style={tempoInput} />
                    </label>
                  ))}
                </div>
                {/* As opções vêm da aba Irrigação: nada de repetir direção, água e percentímetro aqui. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                  <span style={{ color: NX.mudo }}>Vai irrigar com: <b style={{ color: NX.texto }}>{resumoConfig(cfg)}{canhaoAgenda ? ' · canhão' : ''}</b></span>
                  <button type="button" onClick={() => setAba('simples')} style={{ fontWeight: 800, color: NX.acao, whiteSpace: 'nowrap' }}>Mudar</button>
                </div>
                {/* A programação do servidor não liga parado (0 % vira 100 % girando): só com movimento. */}
                {parado && dica('A agenda não liga parado: escolha Direita ou Esquerda em Irrigação.', NX.warn)}
                {!parado && dica(canhaoAgenda ? 'Canhão final: liga junto com o pivô, a volta toda.' : semCanhaoMotivo ? 'Canhão final: este pivô não tem o canhão configurado.' : cfg.semAgua ? 'Canhão final: não liga no seco.' : 'Canhão final: desligado. Para agendar com ele, ligue o Canhão final em Irrigação.')}
                <button type="button" onClick={() => setNova(null)} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: NX.mudo }}>Cancelar</button>
              </div>
            ) : (
              <button type="button" disabled={agendaCheia || programacoes == null} onClick={() => setNova({ grupo: 'uteis', ini: '21:00', fim: '05:00' })}
                style={{ height: 48, borderRadius: 12, border: `1px dashed ${NX.off}`, fontSize: 14, fontWeight: 800, textAlign: 'center', color: agendaCheia ? NX.desab : NX.acao }}>
                {agendaCheia ? 'Limite de 5 horários' : '+ Adicionar horário'}
              </button>
            )}
          </div>

          {/* Agenda por data: a planilha (uma linha por irrigação, do ano todo). */}
          <div style={col(8)}>
            <span style={{ ...s.label, marginTop: 6 }}>POR DATA · PLANILHA{agenda?.length ? ` · ${agenda.length}` : ''}</span>
            <span style={{ fontSize: 13, color: NX.mudo }}>Uma linha por irrigação: dia, início, fim, sentido, percentímetro, água e canhão. Dá para subir o ano todo de uma vez.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <button type="button" onClick={() => void baixarModelo(nome)}
                style={{ height: 44, borderRadius: 12, border: `1px solid ${NX.borda}`, fontSize: 14, fontWeight: 800, textAlign: 'center', color: NX.texto, background: NX.card }}>
                Baixar modelo
              </button>
              <button type="button" disabled={!onImportarAgenda || planEnviando} onClick={() => arquivoRef.current?.click()}
                style={{ height: 44, borderRadius: 12, border: `1px dashed ${NX.off}`, fontSize: 14, fontWeight: 800, textAlign: 'center', color: onImportarAgenda ? NX.acao : NX.desab }}>
                Enviar planilha
              </button>
              <input ref={arquivoRef} type="file" accept=".xlsx,.xls,.csv" aria-label="Planilha da agenda" style={{ display: 'none' }}
                onChange={(e) => void escolherArquivo(e.target.files?.[0])} />
            </div>
            {planErro && <span role="alert" style={{ fontSize: 13, color: NX.bad, whiteSpace: 'pre-wrap' }}>{planErro}</span>}
            {plan && (
              <div style={{ border: `1px solid ${NX.borda}`, borderRadius: 14, padding: 12, ...col(8) }}>
                <span style={titulo15}>{plan.itens.length} {plan.itens.length === 1 ? 'irrigação lida' : 'irrigações lidas'} de {plan.arquivo}</span>
                <span style={{ fontSize: 13, color: NX.mudo }}>Da linha {plan.itens[0].linha} ({plan.itens[0].data}) à linha {plan.itens[plan.itens.length - 1].linha} ({plan.itens[plan.itens.length - 1].data}). Se alguma linha estiver errada, nada é gravado.</span>
                <button type="button" role="switch" aria-checked={substituir} onClick={() => setSubstituir((v) => !v)} style={{ ...linha, width: '100%' }}>
                  <span style={{ ...col(2), textAlign: 'left' }}>
                    <span style={titulo15}>Substituir o que já está agendado</span>
                    <span style={rotulo}>{substituir ? 'Apaga a agenda por data de hoje em diante e grava a planilha' : 'Soma ao que já está agendado (sem sobrepor)'}</span>
                  </span>
                  <NxSwitch on={substituir} />
                </button>
                <button type="button" onClick={() => { setPlan(null); setPlanErro(null); }} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: NX.mudo }}>Cancelar</button>
              </div>
            )}
            {(agenda ?? []).map((a) => {
              const t = textoAgenda(a);
              return (
                <div key={a.id} style={{ background: NX.caixa, borderRadius: 14, padding: '8px 8px 8px 16px', display: 'flex', alignItems: 'center', gap: 12, ...(a.executada ? { opacity: 0.55 } : {}) }}>
                  <span style={{ flex: 1, ...col(2) }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{t.quando}</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>{t.det}{a.executada ? ' · já executada' : ''}</span>
                  </span>
                  <button type="button" aria-label={`Remover ${t.quando}`} onClick={() => onRemoverProgramacao(a.id)} style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NX.bad} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                  </button>
                </div>
              );
            })}
            {!!agenda?.length && onLimparAgenda && (
              // dois toques: apagar a agenda do ano todo não pode ser um clique sem querer
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <button type="button" onClick={() => { if (confirmaLimpar) { setConfirmaLimpar(false); void onLimparAgenda(); } else setConfirmaLimpar(true); }} style={{ fontWeight: 800, color: NX.bad }}>
                  {confirmaLimpar ? 'Confirmar: apagar tudo' : agenda.length === 1 ? 'Apagar a agendada por data' : `Apagar as ${agenda.length} agendadas por data`}
                </button>
                {confirmaLimpar && <button type="button" onClick={() => setConfirmaLimpar(false)} style={{ fontWeight: 700, color: NX.mudo }}>Cancelar</button>}
              </span>
            )}
          </div>
        </div>
        <div style={rodape}>
          {nova && botaoEnviar(salvandoProg ? 'Salvando…' : 'Salvar agendamento', salvarAgendamento, salvandoProg || parado)}
          {!nova && plan && botaoEnviar(planEnviando ? 'Importando…' : `Importar ${plan.itens.length} ${plan.itens.length === 1 ? 'irrigação' : 'irrigações'}`, () => void importar(), planEnviando)}
        </div>
        </>
      )}
    </div>
  );
}

/** "Direita · 60% · Molhado" / "Direita · Seco" / "Parado · Molhado" (liga sem girar). */
export const resumoConfig = (c: ConfigIrrigacao) => (c.semAgua ? `${DIRECAO_LABEL[c.direcao]} · Seco`
  : ehParado(c) ? 'Parado · Molhado' : `${DIRECAO_LABEL[c.direcao]} · ${fmtPct(c.percentual)}% · Molhado`);
