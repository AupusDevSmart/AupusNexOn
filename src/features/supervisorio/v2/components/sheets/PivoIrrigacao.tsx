import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Sparkles, Trash2, Undo2, Check } from 'lucide-react';
import { fmt } from './sheetParts';
import { Card, FieldRow, Segmented, Switch, ACAO } from './equipUi';

/**
 * Irrigação avançada do pivô no web — mesmo painel do app NexON (SPEC-NEXON-3 §12.5,
 * IrrigacaoAvancadaSheet.swift / MapaPivo.swift / SemAPI.swift): abas Simples, Ângulo,
 * Segmentos, Agenda e Canhão (faixas onde o canhão final liga e desliga).
 */

export type Direcao = 'Avanço' | 'Reverso';
export interface FaixaCanhao { id: string; liga: number; desliga: number }
export interface ConfigIrrigacao { direcao: Direcao; percentual: number; semAgua: boolean; canhao: boolean; faixasCanhao: FaixaCanhao[] }
export type Parada = { tipo: 'semParar' } | { tipo: 'porAngulo'; angulo: number } | { tipo: 'porVoltas'; voltas: number };
export type Modo = 'simples' | 'angulo' | 'segmentos';
export interface EnvioIrrigacao { modo: Modo; config: ConfigIrrigacao; parada: Parada; inicio: Date | null; anguloFinal?: number; segmento?: number }

export const CONFIG_PADRAO: ConfigIrrigacao = { direcao: 'Reverso', percentual: 60, semAgua: false, canhao: false, faixasCanhao: [] };
const MODO_TXT: Record<Modo, string> = { simples: 'simples', angulo: 'por ângulo', segmentos: 'por segmentos' };
const SUCESSO = '#2E8B47';

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
const anguloDo = (e: RPointerEvent<SVGSVGElement>, cx: number, cy: number, vb: number) => {
  const r = e.currentTarget.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * vb, y = ((e.clientY - r.top) / r.height) * vb;
  return { g: norm((Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI), d: Math.hypot(x - cx, y - cy), x, y };
};
function Rotulos({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      {[0, 90, 180, 270].map((g) => {
        const [x, y] = ponto(cx, cy, r, g);
        return <text key={g} x={x} y={y + 4} fontSize="11" textAnchor="middle" className="fill-muted-foreground">{g}°</text>;
      })}
    </>
  );
}

// ------------------------------------------------------------------ dials
function DialAngulo({ atual, final, direcao, onChange }: { atual: number; final: number; direcao: Direcao; onChange: (g: number) => void }) {
  const VB = 260, cx = 130, cy = 130, r = 106;
  const [ini, len] = direcao === 'Reverso' ? [final, norm(atual - final)] : [atual, norm(final - atual)];
  const [ax, ay] = ponto(cx, cy, r, atual), [fx, fy] = ponto(cx, cy, r, final);
  const set = (e: RPointerEvent<SVGSVGElement>) => onChange(anguloDo(e, cx, cy, VB).g);
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full max-w-[300px] mx-auto block touch-none cursor-crosshair" role="img" aria-label={`Ângulo final ${final} graus`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
      onPointerMove={(e) => { if (e.buttons) set(e); }}>
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-border" strokeWidth="2" />
      <Rotulos cx={cx} cy={cy} r={r + 14} />
      {len > 0 && <path d={arco(cx, cy, r, ini, len, true)} fill={SUCESSO} fillOpacity="0.35" />}
      <line x1={cx} y1={cy} x2={ax} y2={ay} className="stroke-foreground" strokeWidth="3" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={fx} y2={fy} stroke={SUCESSO} strokeWidth="2" strokeDasharray="5 4" />
      <circle cx={fx} cy={fy} r="7" fill={SUCESSO} />
      <circle cx={cx} cy={cy} r="4" className="fill-foreground" />
    </svg>
  );
}

function AnelSegmentos({ segs, sel, onSel }: { segs: ConfigIrrigacao[]; sel: number; onSel: (i: number) => void }) {
  const VB = 230, cx = 115, cy = 115, r = 100, ri = r * 0.55;
  const seg = (i: number) => {
    const a0 = i * 90 + 2, a1 = i * 90 + 88;
    const [x0, y0] = ponto(cx, cy, r, a0), [x1, y1] = ponto(cx, cy, r, a1);
    const [x2, y2] = ponto(cx, cy, ri, a1), [x3, y3] = ponto(cx, cy, ri, a0);
    return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${ri} ${ri} 0 0 0 ${x3} ${y3} Z`;
  };
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full max-w-[260px] mx-auto block cursor-pointer" role="img" aria-label={`Segmento ${sel + 1} selecionado`}
      onPointerDown={(e) => onSel(Math.floor(anguloDo(e, cx, cy, VB).g / 90))}>
      {segs.map((s, i) => (
        <g key={i}>
          <path d={seg(i)} fill={s.semAgua ? '#8A8CA3' : SUCESSO} fillOpacity={i === sel ? 0.85 : 0.35} />
          {(() => { const [x, y] = ponto(cx, cy, r * 0.78, i * 90 + 45); return <text x={x} y={y + 5} fontSize="15" fontWeight="800" textAnchor="middle" fill="#fff">{i + 1}</text>; })()}
        </g>
      ))}
    </svg>
  );
}

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
    arraste.current = melhor ? { i: (melhor as { i: number }).i, alca: (melhor as { alca: 'liga' | 'desliga' }).alca } : null;
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
    <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full max-w-[320px] mx-auto block touch-none" role="img" aria-label={`Canhão final, ${faixas.length} faixa(s)`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      <circle cx={cx} cy={cy} r={r} fill={SUCESSO} fillOpacity="0.08" className="stroke-border" strokeWidth="2" />
      <Rotulos cx={cx} cy={cy} r={r + 16} />
      {faixas.map((f) => (
        <g key={f.id}>
          <path d={arco(cx, cy, r, f.liga, comp(f), true)} fill={SUCESSO} fillOpacity="0.4" />
          <path d={arco(cx, cy, r, f.liga, comp(f))} fill="none" stroke={SUCESSO} strokeWidth="5" />
        </g>
      ))}
      <line x1={cx} y1={cy} x2={ax} y2={ay} className="stroke-foreground" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" className="fill-foreground" />
      {faixas.map((f, i) => (['liga', 'desliga'] as const).map((alca) => {
        const [hx, hy] = ponto(cx, cy, r, f[alca]);
        return (
          <circle key={`${f.id}-${alca}`} cx={hx} cy={hy} r="12" className={alca === 'liga' ? '' : 'fill-white dark:fill-[#20203F]'}
            fill={alca === 'liga' ? SUCESSO : undefined} stroke={alca === 'liga' ? '#fff' : SUCESSO} strokeWidth="2.5"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))', cursor: 'grab' }}>
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
  agenda: React.ReactNode;
  enviando: boolean;
  onEnviar: (e: EnvioIrrigacao) => void;
}

const fieldBox = 'h-[46px] rounded-xl bg-[#F1F2F6] dark:bg-white/10 px-3 flex items-center gap-1.5';
const horaDe = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) + (m || 0) / 60; };
const hTxt = (s: string) => (s.endsWith(':00') ? `${Number(s.slice(0, 2))}h` : s);

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

export function IrrigacaoAvancada({ nome, angulo, ultima, lamina100, tempoVolta100, ponta, agenda, enviando, onEnviar }: Props) {
  const atual = angulo ?? 0;
  const [aba, setAba] = useState<Modo | 'agenda' | 'canhao'>('simples');
  const [modo, setModo] = useState<Modo>('simples');
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

  useEffect(() => { if (aba === 'simples' || aba === 'angulo' || aba === 'segmentos') setModo(aba); if (aba === 'canhao') { setCanhaoVisto(true); setAviso(false); } }, [aba]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(false), 6000); return () => clearTimeout(t); }, [aviso]);

  const atualCfg = aba === 'segmentos' ? segs[segSel] : cfg;
  const setAtual = (p: Partial<ConfigIrrigacao>) => {
    if (aba === 'segmentos') setSegs((s) => s.map((x, i) => (i === segSel ? { ...x, ...p } : x)));
    else setCfg((c) => ({ ...c, ...p }));
  };
  const efetiva = modo === 'segmentos' ? segs[segSel] : cfg;
  const canhaoAtivo = cfg.canhao && !efetiva.semAgua;

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
    if (aba === 'segmentos') setSegs((s) => s.map((x, i) => (i === segSel ? { ...x, ...base } : x)));
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
      ? { cor: SUCESSO, txt: `Bloqueio de ponta ativo: pausa às ${hTxt(ponta.inicio)} e retoma às ${hTxt(ponta.fim)}` }
      : { cor: '#D48A1F', txt: `Vai irrigar no horário de ponta (${hTxt(ponta.inicio)} às ${hTxt(ponta.fim)}). Bloqueio desligado.` };
  }, [ponta, prev.fim, inicio.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const abas: Array<{ v: Modo | 'agenda' | 'canhao'; label: string }> = [
    { v: 'simples', label: 'Simples' }, { v: 'angulo', label: 'Ângulo' }, { v: 'segmentos', label: 'Segmentos' }, { v: 'agenda', label: 'Agenda' },
    ...(cfg.canhao ? [{ v: 'canhao' as const, label: 'Canhão' }] : []),
  ];

  const enviar = () => onEnviar({
    modo, parada: paradaEf, inicio: modo === 'angulo' || inicioTipo === 'agora' ? null : inicio,
    anguloFinal: modo === 'angulo' ? anguloFinal : undefined, segmento: modo === 'segmentos' ? segSel + 1 : undefined,
    config: { ...efetiva, direcao: cfg.direcao, canhao: canhaoAtivo, faixasCanhao: canhaoAtivo ? faixas : [] },
  });

  const camposComuns = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold">Direção</span>
        <Segmented value={cfg.direcao} onChange={(v) => setCfg((c) => ({ ...c, direcao: v }))} options={[{ v: 'Avanço', label: 'Avanço' }, { v: 'Reverso', label: 'Reverso' }]} />
      </div>
      <Card className="px-4">
        <FieldRow first label="Girar sem água" sub={`${aba === 'segmentos' ? `Segmento ${segSel + 1} · ` : ''}${atualCfg.semAgua ? 'Sem água (seco)' : 'Com água (molhado)'}`}>
          <Switch on={atualCfg.semAgua} onChange={() => setAtual({ semAgua: !atualCfg.semAgua })} label="Girar sem água" />
        </FieldRow>
        <div className={atualCfg.semAgua ? 'opacity-45' : ''}>
          <FieldRow label="Canhão final" sub={atualCfg.semAgua ? 'Indisponível girando sem água' : cfg.canhao ? 'Ligado' : 'Desligado'}>
            <Switch on={cfg.canhao && !atualCfg.semAgua} disabled={atualCfg.semAgua} onChange={toggleCanhao} label="Canhão final" />
          </FieldRow>
        </div>
        {aviso && cfg.canhao && (
          <div className="mb-3 rounded-[10px] border px-3 py-2 flex items-center gap-2 text-[13px]" style={{ background: 'rgba(46,139,71,0.14)', borderColor: 'rgba(46,139,71,0.4)' }}>
            <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="flex-1">Aba Canhão adicionada — marque onde o canhão liga e desliga</span>
            <button type="button" onClick={() => setAba('canhao')} className="font-extrabold text-emerald-700 dark:text-emerald-400">Abrir</button>
          </div>
        )}
      </Card>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">Percentímetro</span>
          <span className={`${fieldBox} ${atualCfg.semAgua ? 'opacity-50' : ''}`}>
            <input inputMode="decimal" disabled={atualCfg.semAgua} value={atualCfg.semAgua ? '—' : pctTxt ?? String(pct)} onChange={(e) => onPct(e.target.value)} onBlur={() => setPctTxt(null)}
              className="w-full min-w-0 bg-transparent border-0 outline-none text-xl font-extrabold" />
            <span className="text-muted-foreground">%</span>
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">Lâmina</span>
          <span className={`${fieldBox} ${atualCfg.semAgua ? 'opacity-50' : ''}`}>
            <input inputMode="decimal" disabled={atualCfg.semAgua} value={atualCfg.semAgua ? '—' : lamTxt ?? (lam != null ? fmt(lam, 2) : '')} onChange={(e) => onLam(e.target.value)} onBlur={() => setLamTxt(null)}
              className="w-full min-w-0 bg-transparent border-0 outline-none text-xl font-extrabold" />
            <span className="text-muted-foreground">mm</span>
          </span>
        </label>
      </div>
    </>
  );

  const inicioParada = (
    <Card className="px-4">
      <FieldRow first label="Início">
        <span className="flex items-center gap-2">
          {inicioTipo === 'data' && <input type="datetime-local" value={inicioData} min={new Date().toISOString().slice(0, 16)} onChange={(e) => setInicioData(e.target.value)} className="h-9 rounded-[10px] border bg-background px-2 text-sm" />}
          <select value={inicioTipo} onChange={(e) => setInicioTipo(e.target.value as 'agora' | 'data')} className="h-9 rounded-[10px] border bg-background px-2 text-sm font-bold">
            <option value="agora">Agora</option><option value="data">Data e hora</option>
          </select>
        </span>
      </FieldRow>
      <FieldRow label="Parada">
        <span className="flex items-center gap-2">
          {parada.tipo === 'porAngulo' && (
            <input type="number" min={0} max={355} step={5} value={parada.angulo} onChange={(e) => setParada({ tipo: 'porAngulo', angulo: Math.min(355, Math.max(0, Number(e.target.value) || 0)) })} className="w-20 h-9 rounded-[10px] border bg-background px-2 text-sm text-right" aria-label="Ângulo de parada" />
          )}
          {parada.tipo === 'porVoltas' && (
            <input type="number" min={1} max={10} value={parada.voltas} onChange={(e) => setParada({ tipo: 'porVoltas', voltas: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} className="w-16 h-9 rounded-[10px] border bg-background px-2 text-sm text-right" aria-label="Voltas" />
          )}
          <select value={parada.tipo} onChange={(e) => setParada(e.target.value === 'porAngulo' ? { tipo: 'porAngulo', angulo: 0 } : e.target.value === 'porVoltas' ? { tipo: 'porVoltas', voltas: 1 } : { tipo: 'semParar' })} className="h-9 rounded-[10px] border bg-background px-2 text-sm font-bold">
            <option value="semParar">Sem parar</option><option value="porAngulo">Por ângulo</option><option value="porVoltas">Por voltas</option>
          </select>
        </span>
      </FieldRow>
    </Card>
  );

  const nFaixas = faixas.length;
  const podeAdd = nFaixas < 5 && !!faixaNoVao(faixas, atual);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-1 p-[2px] rounded-[9px] bg-[#F1F2F6] dark:bg-white/10 overflow-x-auto">
        {abas.map((a) => {
          const destaque = a.v === 'canhao' && !canhaoVisto;
          return (
            <button key={a.v} type="button" aria-pressed={aba === a.v} onClick={() => setAba(a.v)}
              className={`flex-1 min-h-8 px-3.5 rounded-[7px] text-[13px] font-extrabold whitespace-nowrap flex items-center justify-center gap-1.5 transition-colors ${aba === a.v ? 'bg-white dark:bg-[#2A2A52] text-foreground shadow-sm' : destaque ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'} ${destaque && pulso ? 'animate-pulse bg-emerald-500/30' : ''}`}>
              {destaque && <span className="w-[7px] h-[7px] rounded-full bg-emerald-500" />}{a.label}
            </button>
          );
        })}
      </div>

      {aba !== 'agenda' && aba !== 'canhao' && (
        <button type="button" onClick={carregarUltima} className="self-start flex items-center gap-1.5 text-sm font-bold text-[#177A3C] dark:text-emerald-400">
          {carregada ? <><Check className="w-4 h-4" /> Última irrigação carregada</> : <><Undo2 className="w-4 h-4" /> Carregar última irrigação</>}
        </button>
      )}

      {aba === 'angulo' && (
        <Card className="p-3 flex flex-col gap-2">
          <DialAngulo atual={atual} final={anguloFinal} direcao={cfg.direcao} onChange={setAnguloFinal} />
          <span className="text-[13px] text-muted-foreground text-center">Toque no círculo para escolher o ângulo final</span>
          <div className="flex justify-between text-[15px]"><span className="font-bold">Ângulo final</span><b>{anguloFinal}°</b></div>
        </Card>
      )}
      {aba === 'segmentos' && (
        <Card className="p-3 flex flex-col gap-2">
          <AnelSegmentos segs={segs} sel={segSel} onSel={setSegSel} />
          <span className="text-[13px] text-muted-foreground text-center">Toque no segmento para editar · segmento {segSel + 1} selecionado</span>
        </Card>
      )}

      {(aba === 'simples' || aba === 'angulo' || aba === 'segmentos') && camposComuns}
      {(aba === 'simples' || aba === 'segmentos') && inicioParada}

      {aba === 'agenda' && agenda}

      {aba === 'canhao' && (
        <>
          <Card className="p-3 flex flex-col gap-2">
            <DialCanhao atual={atual} faixas={faixas} onChange={setFaixas} />
            <span className="text-[13px] text-muted-foreground text-center">Arraste as alças ou digite os ângulos</span>
            <span className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground"><span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: SUCESSO, opacity: 0.6 }} />Setor verde = canhão ligado</span>
          </Card>
          {faixas.map((f, i) => (
            <Card key={f.id} className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Faixa {i + 1} · liga {f.liga}° · desliga {f.desliga}°</span>
                <button type="button" aria-label={`Remover faixa ${i + 1}`} onClick={() => setFaixas(faixas.filter((x) => x.id !== f.id))} className="w-8 h-8 grid place-items-center rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['liga', 'desliga'] as const).map((al) => (
                  <label key={al} className="h-10 rounded-[10px] bg-[#F1F2F6] dark:bg-[#2A2A52] px-3 flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{al === 'liga' ? 'Liga' : 'Desliga'}</span>
                    <input inputMode="numeric" value={f[al]} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setFaixas(moverAlca(faixas, i, al, v)); }}
                      className="w-full min-w-0 bg-transparent border-0 outline-none font-extrabold text-right" aria-label={`Faixa ${i + 1}, ${al}`} />
                    <span className="text-muted-foreground">°</span>
                  </label>
                ))}
              </div>
            </Card>
          ))}
          <button type="button" disabled={!podeAdd} onClick={() => { const n = faixaNoVao(faixas, atual); if (n) setFaixas([...faixas, n]); }}
            className={`h-[52px] rounded-[14px] border-[1.5px] border-dashed border-border text-sm font-extrabold ${podeAdd ? 'text-[#177A3C] dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {nFaixas >= 5 ? 'Limite de 5 faixas' : '+ Adicionar faixa'}
          </button>
          <p className="text-[13px] text-muted-foreground">
            {nFaixas ? `As faixas vão junto com a irrigação ${MODO_TXT[modo]}.` : `Sem faixas, o canhão fica ligado a volta toda. Vai junto com a irrigação ${MODO_TXT[modo]}.`}
          </p>
        </>
      )}

      {aba !== 'agenda' && (
        <>
          <Card className="p-4 flex flex-col gap-1.5 text-sm font-bold">
            <span>{prev.texto}</span>
            {pontaTxt && <span className="flex items-center gap-2 font-normal"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: pontaTxt.cor }} />{pontaTxt.txt}</span>}
          </Card>
          <button type="button" disabled={enviando} onClick={enviar} className={`h-12 rounded-xl text-base font-extrabold ${enviando ? 'bg-[#F1F2F6] dark:bg-white/10 text-muted-foreground' : ACAO}`}>
            {enviando ? 'Executando…' : 'Enviar comando'}
          </button>
          <p className="text-xs text-muted-foreground">
            A TON do pivô recebe a direção e liga/desliga. Percentímetro, parada, ângulo, segmentos e canhão ficam registrados no NexON até a TON aceitar esses comandos.
          </p>
        </>
      )}
      <span className="sr-only">{nome}</span>
    </div>
  );
}

export const tituloEnvio = (m: Modo) => (m === 'simples' ? 'Iniciar irrigação simples?' : m === 'angulo' ? 'Iniciar irrigação por ângulo?' : 'Iniciar irrigação por segmentos?');
export const resumoConfig = (c: ConfigIrrigacao) => (c.semAgua ? `${c.direcao} · Seco` : `${c.direcao} · ${c.percentual}% · Molhado`);
