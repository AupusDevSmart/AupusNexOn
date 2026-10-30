import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { fmt } from './sheetParts';
import { NX, s, NxSwitch, NxDialogHead } from './nxMock';

/**
 * Irrigação avançada do pivô no web — mockup "Web — Modal do Pivô" (diálogo de 520 px)
 * com as abas Ângulo, Segmentos e Agenda do app ("Equipamento — Pivô") e a aba Canhão
 * (faixas onde o canhão final liga e desliga). Estilos inline com as variáveis NX.
 */

export type Direcao = 'Avanço' | 'Reverso';
/** Valor gravado (Avanço/Reverso, = girar_direita/girar_esquerda) → o que aparece na tela. */
export const DIRECAO_LABEL: Record<Direcao, string> = { 'Avanço': 'Direita', 'Reverso': 'Esquerda' };
export interface FaixaCanhao { id: string; liga: number; desliga: number }
export interface ConfigIrrigacao { direcao: Direcao; percentual: number; semAgua: boolean; canhao: boolean; faixasCanhao: FaixaCanhao[] }
export type Parada = { tipo: 'semParar' } | { tipo: 'porAngulo'; angulo: number } | { tipo: 'porVoltas'; voltas: number };
export type Modo = 'simples' | 'angulo' | 'segmentos';
export interface EnvioIrrigacao { modo: Modo; config: ConfigIrrigacao; parada: Parada; inicio: Date | null; anguloFinal?: number; segmento?: number }
export type AbaIrrigacao = Modo | 'agenda' | 'canhao';

export interface Programacao {
  id: string; nome: string; ativo: boolean; hora_inicio: string; dias: number[]; modo: 'percurso' | 'tempo';
  duracao_min?: number | null; sentido: 'horario' | 'anti_horario'; velocidade?: number | null; com_agua?: boolean;
}
export type NovaProgramacao = Omit<Programacao, 'id'>;

export const CONFIG_PADRAO: ConfigIrrigacao = { direcao: 'Reverso', percentual: 60, semAgua: false, canhao: false, faixasCanhao: [] };
const MODO_TXT: Record<Modo, string> = { simples: 'simples', angulo: 'por ângulo', segmentos: 'por segmentos' };
const VERDE = '#72BF4A';

// ------------------------------------------------------------- programação
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
    det: `${p.com_agua === false ? `Seco · ${dir}` : `${p.velocidade != null ? `${fmt(p.velocidade, 0)}%` : '—'} · Molhado · ${dir}`}${p.ativo ? '' : ' · pausado'}`,
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
export const textoFaixas = (fs: FaixaCanhao[]) =>
  fs.length ? `Canhão final: ${fs.map((f) => `liga ${f.liga}° · desliga ${f.desliga}°`).join('; ')}` : 'Canhão final ligado a volta toda';

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
function DialAngulo({ atual, final, direcao, onChange }: { atual: number; final: number; direcao: Direcao; onChange: (g: number) => void }) {
  const [ini, len] = direcao === 'Reverso' ? [final, norm(atual - final)] : [atual, norm(final - atual)];
  const [ax, ay] = ponto(110, 110, 100, atual), [fx, fy] = ponto(110, 110, 100, final);
  const set = (e: RPointerEvent<SVGSVGElement>) => onChange(anguloDo(e, 110, 110, 220).g);
  return (
    <svg viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="Ângulo final" style={{ touchAction: 'none', cursor: 'pointer' }}
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

/** Aba Segmentos: 4 segmentos fixos de 90° (anel do app). */
function AnelSegmentos({ segs, sel, atual, onSel }: { segs: ConfigIrrigacao[]; sel: number; atual: number; onSel: (i: number) => void }) {
  const [ax, ay] = ponto(110, 110, 100, atual);
  return (
    <svg viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="Segmentos do pivô">
      <circle cx="110" cy="110" r="100" fill="#26301F" />
      {segs.map((sg, i) => (
        <path key={i} d={anel(110, 110, 50, 100, i * 90 + 2, (i + 1) * 90 - 2)} stroke={NX.card} strokeWidth="3" style={{ cursor: 'pointer' }}
          fill={sg.semAgua ? (i === sel ? '#9A9AB8' : '#4A4A6A') : (i === sel ? VERDE : 'rgba(114,191,74,0.45)')}
          onClick={() => onSel(i)} />
      ))}
      <circle cx="110" cy="110" r="46" fill={NX.card} />
      <line x1="110" y1="110" x2={ax} y2={ay} stroke={NX.texto} strokeWidth="2.5" strokeLinecap="round" />
      {segs.map((_, i) => {
        const [x, y] = ponto(110, 110, 74, i * 90 + 45);
        return <text key={i} x={x} y={y + 4} fontSize="12" fontWeight="700" fill="#FFFFFF" textAnchor="middle" style={{ pointerEvents: 'none' }}>{i + 1}</text>;
      })}
    </svg>
  );
}

/** Aba Canhão: alças de liga/desliga sobre o círculo do pivô. */
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
    <svg viewBox={`0 0 ${VB} ${VB}`} width="260" height="260" role="img" aria-label={`Canhão final, ${faixas.length} faixa(s)`}
      style={{ touchAction: 'none', display: 'block', maxWidth: '100%' }} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      <circle cx={cx} cy={cy} r={r} fill="rgba(46,139,71,0.08)" stroke={NX.borda} strokeWidth="2" />
      {[0, 90, 180, 270].map((g) => {
        const [x, y] = ponto(cx, cy, r + 16, g);
        return <text key={g} x={x} y={y + 4} fontSize="11" textAnchor="middle" fill={NX.mudo}>{g}°</text>;
      })}
      {faixas.map((f) => (
        <g key={f.id}>
          <path d={arco(cx, cy, r, f.liga, comp(f), true)} fill={NX.ok} fillOpacity="0.4" />
          <path d={arco(cx, cy, r, f.liga, comp(f))} fill="none" stroke={NX.ok} strokeWidth="5" />
        </g>
      ))}
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke={NX.texto} strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill={NX.texto} />
      {faixas.map((f, i) => (['liga', 'desliga'] as const).map((alca) => {
        const [hx, hy] = ponto(cx, cy, r, f[alca]);
        return (
          <circle key={`${f.id}-${alca}`} cx={hx} cy={hy} r="12" fill={alca === 'liga' ? NX.ok : NX.card}
            stroke={alca === 'liga' ? '#FFFFFF' : NX.ok} strokeWidth="2.5" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))', cursor: 'grab' }}>
            <title>{`Faixa ${i + 1}, ${alca} em ${f[alca]} graus`}</title>
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
  abaInicial?: AbaIrrigacao;
  programacoes: Programacao[] | null;
  onRemoverProgramacao: (id: string) => void;
  onSalvarProgramacao: (p: NovaProgramacao) => Promise<boolean>;
  onEnviar: (e: EnvioIrrigacao) => void;
  onClose: () => void;
}

const horaDe = (x: string) => { const [h, m] = x.split(':').map(Number); return (h || 0) + (m || 0) / 60; };
const hTxt = (x: string) => (x.endsWith(':00') ? `${Number(x.slice(0, 2))}h` : x);

export function previsao(config: ConfigIrrigacao, parada: Parada, direcao: Direcao, atual: number, tempoVolta100: number, inicio: Date) {
  if (parada.tipo === 'semParar') return { texto: 'Sem previsão de término (sem parada)', fim: null as Date | null };
  let delta = parada.tipo === 'porVoltas' ? 360 * parada.voltas : direcao === 'Reverso' ? norm(atual - parada.angulo) : norm(parada.angulo - atual);
  if (delta <= 0) delta += 360;
  const horas = (delta / 360) * tempoVolta100 * (config.semAgua ? 1 : 100 / Math.max(1, config.percentual));
  const fim = new Date(inicio.getTime() + horas * 3600000);
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const dias = Math.floor((new Date(fim).setHours(0, 0, 0, 0) - d0.getTime()) / 86400000);
  const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
  return { texto: `Término previsto ${quando} ${fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${fmt(horas, 1)} h`, fim };
}

// estilos do mockup
const col = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap });
const rotulo: CSSProperties = { fontSize: 12, color: NX.mudo };
const caixaCampo: CSSProperties = { border: `1px solid ${NX.borda}`, borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 };
const inputGrande: CSSProperties = { width: '100%', minWidth: 0, border: 0, fontSize: 20, fontWeight: 800, color: NX.texto, background: 'transparent', padding: 0 };
const valorCaixa: CSSProperties = { fontSize: 15, fontWeight: 800, color: NX.texto, background: 'transparent', border: 0, padding: 0, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' };
const inputCaixa: CSSProperties = { fontSize: 15, fontWeight: 800, color: NX.texto, background: 'transparent', border: 0, padding: 0, minWidth: 0 };
const linhaSwitch = (off = false): CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, width: '100%', ...(off ? { opacity: 0.45 } : {}) });
const tituloSub = (t: string, sub: string) => (
  <span style={col(2)}><span style={{ fontSize: 15, fontWeight: 700 }}>{t}</span><span style={rotulo}>{sub}</span></span>
);

export function IrrigacaoAvancada({
  nome, angulo, ultima, lamina100, tempoVolta100, ponta, enviando, abaInicial = 'simples',
  programacoes, onRemoverProgramacao, onSalvarProgramacao, onEnviar, onClose,
}: Props) {
  const atual = angulo ?? 0;
  const [aba, setAba] = useState<AbaIrrigacao>(abaInicial);
  const [modo, setModo] = useState<Modo>(abaInicial === 'angulo' || abaInicial === 'segmentos' ? abaInicial : 'simples');
  const [cfg, setCfg] = useState<ConfigIrrigacao>({ ...ultima, canhao: false });
  const [faixas, setFaixas] = useState<FaixaCanhao[]>(ultima.faixasCanhao);
  const [segs, setSegs] = useState<ConfigIrrigacao[]>(() => Array.from({ length: 4 }, () => ({ ...ultima, canhao: false })));
  const [segSel, setSegSel] = useState(0);
  const [anguloFinal, setAnguloFinal] = useState(0);
  const [inicioTipo, setInicioTipo] = useState<'agora' | 'data'>('agora');
  const [inicioData, setInicioData] = useState('');
  const [parada, setParada] = useState<Parada>({ tipo: 'semParar' });
  const [carregada, setCarregada] = useState(false);
  const [aviso, setAviso] = useState(false);
  const [canhaoVisto, setCanhaoVisto] = useState(false);
  const [pulso, setPulso] = useState(false);
  const [pctTxt, setPctTxt] = useState<string | null>(null);
  const [lamTxt, setLamTxt] = useState<string | null>(null);
  const [nova, setNova] = useState<null | { grupo: string; ini: string; fim: string }>(null);
  const [salvandoProg, setSalvandoProg] = useState(false);

  useEffect(() => { if (aba === 'simples' || aba === 'angulo' || aba === 'segmentos') setModo(aba); if (aba === 'canhao') { setCanhaoVisto(true); setAviso(false); } }, [aba]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(false), 6000); return () => clearTimeout(t); }, [aviso]);

  const atualCfg = aba === 'segmentos' ? segs[segSel] : cfg;
  const setAtual = (p: Partial<ConfigIrrigacao>) => {
    if (aba === 'segmentos') setSegs((x) => x.map((y, i) => (i === segSel ? { ...y, ...p } : y)));
    else setCfg((c) => ({ ...c, ...p }));
  };
  const efetiva = modo === 'segmentos' ? segs[segSel] : cfg;
  const canhaoAtivo = cfg.canhao && !efetiva.semAgua;
  const seco = atualCfg.semAgua;

  const toggleCanhao = () => {
    const on = !cfg.canhao;
    setCfg((c) => ({ ...c, canhao: on }));
    if (on) {
      setAviso(true); setCanhaoVisto(false);
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setPulso(true); setTimeout(() => setPulso(false), 1300); }
    } else if (aba === 'canhao') setAba('simples');
  };
  const carregarUltima = () => {
    const base = { direcao: ultima.direcao, semAgua: ultima.semAgua, percentual: ultima.percentual };
    setCfg((c) => ({ ...c, ...base }));
    if (aba === 'segmentos') setSegs((x) => x.map((y, i) => (i === segSel ? { ...y, ...base } : y)));
    setPctTxt(null); setLamTxt(null); setCarregada(true);
  };

  const pct = atualCfg.percentual;
  const lam = pct > 0 ? (lamina100 * 100) / pct : null;
  const onPct = (v: string) => { setPctTxt(v); setLamTxt(null); const p = Number(v.replace(',', '.')); if (p > 0) setAtual({ percentual: Math.min(100, Math.max(1, Math.round(p))) }); };
  const onLam = (v: string) => { setLamTxt(v); setPctTxt(null); const l = Number(v.replace(',', '.')); if (l > 0) setAtual({ percentual: Math.min(100, Math.max(1, Math.round((lamina100 * 100) / l))) }); };

  const paradaEf: Parada = modo === 'angulo' ? { tipo: 'porAngulo', angulo: anguloFinal } : parada;
  const inicio = modo !== 'angulo' && inicioTipo === 'data' && inicioData ? new Date(inicioData) : new Date();
  const prev = previsao(efetiva, paradaEf, cfg.direcao, atual, tempoVolta100, inicio);
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

  const abas: Array<{ v: AbaIrrigacao; label: string }> = [
    { v: 'simples', label: 'Simples' }, { v: 'angulo', label: 'Ângulo' }, { v: 'segmentos', label: 'Segmentos' }, { v: 'agenda', label: 'Agenda' },
    ...(cfg.canhao ? [{ v: 'canhao' as const, label: 'Canhão' }] : []),
  ];

  const enviar = () => onEnviar({
    modo, parada: paradaEf, inicio: modo === 'angulo' || inicioTipo === 'agora' ? null : inicio,
    anguloFinal: modo === 'angulo' ? anguloFinal : undefined, segmento: modo === 'segmentos' ? segSel + 1 : undefined,
    config: { ...efetiva, direcao: cfg.direcao, canhao: canhaoAtivo, faixasCanhao: canhaoAtivo ? faixas : [] },
  });

  const nProg = programacoes?.length ?? 0;
  const agendaCheia = nProg >= 5;
  const salvarAgendamento = async () => {
    if (!nova) return;
    const g = GRUPOS_DIAS.find((x) => x.v === nova.grupo) ?? GRUPOS_DIAS[0];
    const [h0, m0] = nova.ini.split(':').map(Number), [h1, m1] = nova.fim.split(':').map(Number);
    const dur = ((h1 * 60 + m1) - (h0 * 60 + m0) + 1440) % 1440 || 1440;
    setSalvandoProg(true);
    const ok = await onSalvarProgramacao({
      nome: `${g.label} · ${nova.ini} → ${nova.fim}`, ativo: true, hora_inicio: nova.ini, dias: g.dias, modo: 'tempo',
      duracao_min: dur, sentido: cfg.direcao === 'Avanço' ? 'horario' : 'anti_horario',
      velocidade: cfg.semAgua ? null : cfg.percentual, com_agua: !cfg.semAgua,
    });
    setSalvandoProg(false);
    if (ok) setNova(null);
  };

  const direcaoRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>Direção</span>
      <div style={{ display: 'flex', padding: 3, borderRadius: 12, background: NX.seg }}>
        {(['Avanço', 'Reverso'] as const).map((d) => (
          <button key={d} type="button" aria-pressed={cfg.direcao === d} onClick={() => setCfg((c) => ({ ...c, direcao: d }))} style={s.seg(cfg.direcao === d)}>{DIRECAO_LABEL[d]}</button>
        ))}
      </div>
    </div>
  );
  const secoRow = (
    <button type="button" role="switch" aria-checked={seco} onClick={() => setAtual({ semAgua: !seco })} style={linhaSwitch()}>
      {tituloSub('Girar sem água', `${aba === 'segmentos' ? `Segmento ${segSel + 1} · ` : ''}${seco ? 'Sem água (a bomba não liga)' : 'Com água (molhado)'}`)}
      <NxSwitch on={seco} />
    </button>
  );
  const canhaoRow = (
    <button type="button" role="switch" aria-checked={cfg.canhao && !seco} disabled={seco} onClick={toggleCanhao} style={linhaSwitch(seco)}>
      {tituloSub('Canhão final', seco ? 'Indisponível girando sem água' : cfg.canhao ? 'Ligado' : 'Desligado')}
      <NxSwitch on={cfg.canhao && !seco} />
    </button>
  );
  const avisoCanhao = aviso && cfg.canhao && (
    <div style={{ borderRadius: 10, border: '1px solid rgba(46,139,71,0.4)', background: 'rgba(46,139,71,0.12)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ flex: 1 }}>Aba Canhão adicionada — marque onde o canhão liga e desliga</span>
      <button type="button" onClick={() => setAba('canhao')} style={{ fontWeight: 800, color: NX.acao }}>Abrir</button>
    </div>
  );
  const pctLam = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      <label style={caixaCampo}>
        <span style={rotulo}>Percentímetro</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input inputMode="decimal" disabled={seco} value={seco ? '—' : pctTxt ?? String(pct)} onChange={(e) => onPct(e.target.value)} onBlur={() => setPctTxt(null)} style={inputGrande} />
          <span style={{ color: NX.mudo }}>%</span>
        </span>
      </label>
      <label style={caixaCampo}>
        <span style={rotulo}>Lâmina</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input inputMode="decimal" disabled={seco} value={seco ? '—' : lamTxt ?? (lam != null ? fmt(lam, 2) : '')} onChange={(e) => onLam(e.target.value)} onBlur={() => setLamTxt(null)} style={inputGrande} />
          <span style={{ color: NX.mudo }}>mm</span>
        </span>
      </label>
    </div>
  );
  const inicioParada = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      <span style={caixaCampo}>
        <span style={rotulo}>Início</span>
        <select aria-label="Início" value={inicioTipo} onChange={(e) => setInicioTipo(e.target.value as 'agora' | 'data')} style={valorCaixa}>
          <option value="agora">Agora</option><option value="data">Data e hora</option>
        </select>
        {inicioTipo === 'data' && (
          <input type="datetime-local" aria-label="Data e hora do início" value={inicioData} min={new Date().toISOString().slice(0, 16)} onChange={(e) => setInicioData(e.target.value)} style={inputCaixa} />
        )}
      </span>
      <span style={caixaCampo}>
        <span style={rotulo}>Parada</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select aria-label="Parada" value={parada.tipo} style={valorCaixa}
            onChange={(e) => setParada(e.target.value === 'porAngulo' ? { tipo: 'porAngulo', angulo: 0 } : e.target.value === 'porVoltas' ? { tipo: 'porVoltas', voltas: 1 } : { tipo: 'semParar' })}>
            <option value="semParar">Sem parar</option><option value="porAngulo">Por ângulo</option><option value="porVoltas">Por voltas</option>
          </select>
          {parada.tipo === 'porAngulo' && (
            <><span style={{ fontSize: 15, fontWeight: 800 }}>·</span>
              <input inputMode="numeric" aria-label="Ângulo de parada" value={parada.angulo} style={{ ...inputCaixa, width: 40, textAlign: 'right' }}
                onChange={(e) => setParada({ tipo: 'porAngulo', angulo: Math.min(359, Math.max(0, Number(e.target.value) || 0)) })} />
              <span style={{ fontSize: 15, fontWeight: 800 }}>°</span></>
          )}
          {parada.tipo === 'porVoltas' && (
            <><span style={{ fontSize: 15, fontWeight: 800 }}>·</span>
              <input inputMode="numeric" aria-label="Voltas" value={parada.voltas} style={{ ...inputCaixa, width: 28, textAlign: 'right' }}
                onChange={(e) => setParada({ tipo: 'porVoltas', voltas: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} /></>
          )}
        </span>
      </span>
    </div>
  );
  const caixaPrevisao = (texto: string, comPonta: boolean) => (
    <div style={{ background: NX.caixa, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 14, color: NX.caixaTx }}>{texto}</span>
      {comPonta && pontaTxt && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: pontaTxt.aviso ? NX.warn : NX.caixaTx }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, flex: 'none', background: pontaTxt.aviso ? NX.warn : NX.ok }} />{pontaTxt.txt}
        </span>
      )}
    </div>
  );
  const botaoEnviar = (label: string, onClick: () => void, off: boolean) => (
    <button type="button" disabled={off} onClick={onClick}
      style={{ height: 48, borderRadius: 12, background: off ? NX.acaoOff : NX.acao, color: '#FFFFFF', fontSize: 16, fontWeight: 800, textAlign: 'center' }}>
      {label}
    </button>
  );

  const nFaixas = faixas.length;
  const podeAdd = nFaixas < 5 && !!faixaNoVao(faixas, atual);
  const tempoInput: CSSProperties = { height: 38, borderRadius: 10, border: `1px solid ${NX.borda}`, padding: '0 10px', fontSize: 15, fontWeight: 700, color: NX.texto, background: NX.card };

  return (
    <div style={col(14)}>
      <NxDialogHead title="Irrigação avançada" sub={`${nome} · ângulo atual ${angulo != null ? `${fmt(angulo, 1)}°` : '—'}`} onClose={onClose} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))`, gap: 4, padding: 4, borderRadius: 12, background: NX.seg }}>
        {abas.map((a) => {
          const destaque = a.v === 'canhao' && !canhaoVisto && aba !== 'canhao';
          const sel = aba === a.v;
          return (
            <button key={a.v} type="button" aria-pressed={sel} onClick={() => setAba(a.v)}
              style={{
                height: 34, borderRadius: 9, fontSize: 13, fontWeight: 800, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background .3s',
                ...(sel ? { background: NX.card, color: NX.texto } : { color: destaque ? NX.acao : NX.mudo }),
                ...(destaque && pulso ? { background: 'rgba(46,139,71,0.25)' } : {}),
              }}>
              {destaque && <span style={{ width: 7, height: 7, borderRadius: 4, background: NX.ok }} />}{a.label}
            </button>
          );
        })}
      </div>

      {aba !== 'agenda' && aba !== 'canhao' && (
        <button type="button" onClick={carregarUltima} style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: 700, color: NX.acao }}>
          {carregada ? '✓ Última irrigação carregada' : '↺ Carregar última irrigação'}
        </button>
      )}

      {aba === 'angulo' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <DialAngulo atual={atual} final={anguloFinal} direcao={cfg.direcao} onChange={setAnguloFinal} />
          <span style={{ fontSize: 13, color: NX.mudo }}>Toque no círculo para escolher o ângulo final</span>
        </div>
      )}
      {aba === 'segmentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <AnelSegmentos segs={segs} sel={segSel} atual={atual} onSel={setSegSel} />
          <span style={{ fontSize: 13, color: NX.mudo }}>Toque no segmento para editar · segmento {segSel + 1} selecionado</span>
        </div>
      )}

      {(aba === 'simples' || aba === 'angulo' || aba === 'segmentos') && (
        <>
          {direcaoRow}
          {secoRow}
          {canhaoRow}
          {avisoCanhao}
          {pctLam}
          {(aba === 'simples' || aba === 'segmentos') && inicioParada}
          {aba === 'angulo' && (
            <div style={{ ...caixaCampo, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, boxSizing: 'border-box' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Ângulo final</span>
              <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{anguloFinal}°</span>
            </div>
          )}
          {caixaPrevisao(prev.texto, true)}
          {botaoEnviar(enviando ? 'Executando…' : 'Enviar comando', enviar, enviando)}
        </>
      )}

      {aba === 'agenda' && (
        <>
          <div style={col(8)}>
            {programacoes == null && <span style={{ fontSize: 14, color: NX.mudo }}>Carregando…</span>}
            {(programacoes ?? []).map((p) => {
              const t = textoProgramacao(p);
              return (
                <div key={p.id} style={{ background: NX.caixa, borderRadius: 14, padding: '12px 8px 12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 1, ...col(2) }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{t.quando}</span>
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
                <div style={{ display: 'flex', padding: 3, borderRadius: 12, background: NX.seg, alignSelf: 'flex-start' }}>
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
                {direcaoRow}
                <button type="button" onClick={() => setNova(null)} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: NX.mudo }}>Cancelar</button>
              </div>
            ) : (
              <button type="button" disabled={agendaCheia || programacoes == null} onClick={() => setNova({ grupo: 'uteis', ini: '21:00', fim: '05:00' })}
                style={{ height: 48, borderRadius: 12, border: `1px dashed ${NX.off}`, fontSize: 14, fontWeight: 800, textAlign: 'center', color: agendaCheia ? NX.desab : NX.acao }}>
                {agendaCheia ? 'Limite de 5 horários' : '+ Adicionar horário'}
              </button>
            )}
          </div>
          {nova && <>{secoRow}{pctLam}</>}
          {caixaPrevisao(`${nProg} horário(s) programado(s)`, false)}
          {botaoEnviar(salvandoProg ? 'Salvando…' : 'Salvar agendamento', salvarAgendamento, !nova || salvandoProg)}
        </>
      )}

      {aba === 'canhao' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <DialCanhao atual={atual} faixas={faixas} onChange={setFaixas} />
            <span style={{ fontSize: 13, color: NX.mudo }}>Arraste as alças ou digite os ângulos</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: NX.mudo }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: NX.ok, opacity: 0.6 }} />Setor verde = canhão ligado
            </span>
          </div>
          {faixas.map((f, i) => (
            <div key={f.id} style={{ ...s.card, padding: '12px 16px', ...col(8) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Faixa {i + 1} · liga {f.liga}° · desliga {f.desliga}°</span>
                <button type="button" aria-label={`Remover faixa ${i + 1}`} onClick={() => setFaixas(faixas.filter((x) => x.id !== f.id))}
                  style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NX.bad} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {(['liga', 'desliga'] as const).map((al) => (
                  <label key={al} style={{ height: 40, borderRadius: 10, background: NX.seg, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <span style={{ color: NX.mudo }}>{al === 'liga' ? 'Liga' : 'Desliga'}</span>
                    <input inputMode="numeric" value={f[al]} aria-label={`Faixa ${i + 1}, ${al}`}
                      onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setFaixas(moverAlca(faixas, i, al, v)); }}
                      style={{ width: '100%', minWidth: 0, background: 'transparent', border: 0, fontWeight: 800, textAlign: 'right', color: NX.texto, padding: 0 }} />
                    <span style={{ color: NX.mudo }}>°</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button type="button" disabled={!podeAdd} onClick={() => { const n = faixaNoVao(faixas, atual); if (n) setFaixas([...faixas, n]); }}
            style={{ height: 48, borderRadius: 12, border: `1px dashed ${NX.off}`, fontSize: 14, fontWeight: 800, textAlign: 'center', color: podeAdd ? NX.acao : NX.desab }}>
            {nFaixas >= 5 ? 'Limite de 5 faixas' : '+ Adicionar faixa'}
          </button>
          <span style={{ fontSize: 13, color: NX.mudo }}>
            {nFaixas ? `As faixas vão junto com a irrigação ${MODO_TXT[modo]}.` : `Sem faixas, o canhão fica ligado a volta toda. Vai junto com a irrigação ${MODO_TXT[modo]}.`}
          </span>
          {caixaPrevisao(prev.texto, true)}
          {botaoEnviar(enviando ? 'Executando…' : 'Enviar comando', enviar, enviando)}
        </>
      )}
    </div>
  );
}

export const tituloEnvio = (m: Modo) => (m === 'simples' ? 'Iniciar irrigação simples?' : m === 'angulo' ? 'Iniciar irrigação por ângulo?' : 'Iniciar irrigação por segmentos?');
export const resumoConfig = (c: ConfigIrrigacao) => (c.semAgua ? `${DIRECAO_LABEL[c.direcao]} · Seco` : `${DIRECAO_LABEL[c.direcao]} · ${c.percentual}% · Molhado`);
