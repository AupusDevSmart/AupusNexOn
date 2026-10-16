import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { acionarPontoApi } from '@/services/acionar-ponto.services';
import { useDados, getPath, fmt, tsInfo } from './sheetParts';
import { NX, s, COR, NxShell, NxDialog, NxDialogButtons, NxReview, NxSeg, IcoChevron, type NxTone } from './nxMock';
import { Registros, useHistorico, bucketize, type Periodo } from './equipUi';
import { curveMonotoneX } from '@visx/curve';
import { LineChart } from '@/components/charts/line-chart';
import { Line } from '@/components/charts/line';
import { Grid } from '@/components/charts/grid';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR as COR_GRAF, corSerie } from '@/components/graficos/cores';
import { linhasDeBuckets } from '@/components/graficos/linhas-de-buckets';
import { EixoTempo } from '@/components/graficos/eixo-tempo';

/**
 * Modal do Inversor no web — tela "Equipamento · Inversor Solar 2" do app (NEXON-5)
 * adaptada ao padrão dos modais web (Pivô/Medidor): cabeçalho com pílula
 * Normal/Alerta/Falha/Sem comunicação, abas Operação/Configuração, cartões brancos
 * em duas colunas, gráfico recolhível, registros e revisão antes de gravar.
 * Dados: telemetria do próprio equipamento (/equipamentos/:id/dados/atual, catálogo
 * `inversor_solar`: energy.*, power.*, voltage.*, current.*, dc.*, protection.*),
 * comandos Ligar/Desligar vinculados (/iot/equipamento/:id/comandos) e ajustes do
 * modelo (/equipamentos/:id/setpoints). O que o inversor não informa sai "—".
 *
 * Os blocos visuais exportados aqui (Bloco, Rotulo, LinhasNx, FasesNx, GraficoNx…)
 * também são usados pela ficha do disjuntor.
 */

// ------------------------------------------------------------------ blocos visuais

type Telemetria = Record<string, unknown>;

/** Erro de API → status + mensagem legível. */
function erroDe(e: unknown): { st?: number; msg: string } {
  const x = e as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } }; message?: string } | null;
  return { st: x?.response?.status, msg: String(x?.response?.data?.message || x?.response?.data?.error?.message || x?.message || 'falha') };
}

export function Bloco({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...s.card, ...style }}>{children}</div>;
}

/** Rótulo de seção (12/800, maiúsculas). */
export function Rotulo({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...s.label, textTransform: 'uppercase', ...style }}>{children}</span>;
}

/** Cartão de status: bolinha + rótulo colorido + texto (+ linha extra). */
export function StatusNx({ tone, label, text, extra }: { tone: NxTone; label: string; text?: ReactNode; extra?: ReactNode }) {
  return (
    <Bloco style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={s.stDot(tone)} />
        <span style={s.stLabel(tone)}>{label}</span>
        {text && <span style={{ fontSize: 14, color: NX.mudo, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>}
      </div>
      {extra && <span style={{ fontSize: 13, color: NX.mudo }}>{extra}</span>}
    </Bloco>
  );
}

/** Ícone "!" amarelo dos cartões de energia do mockup. */
export function Exclama({ title }: { title?: string }) {
  return (
    <span role={title ? 'img' : undefined} aria-label={title} aria-hidden={!title}
      style={{ width: 28, height: 28, borderRadius: 14, flex: 'none', background: 'rgba(183,121,31,0.14)', color: NX.warn, fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</span>
  );
}

export interface LinhaNx { k: ReactNode; v: ReactNode; sub?: ReactNode; cor?: string; opcional?: boolean }
const vazio = (v: ReactNode) => v == null || (typeof v === 'string' && v.trim().startsWith('—'));

/** Cartão com título e linhas rótulo → valor. Linha `opcional` sem dado não aparece. */
export function LinhasNx({ titulo, right, rows, children }: { titulo?: ReactNode; right?: ReactNode; rows: LinhaNx[]; children?: ReactNode }) {
  const lista = rows.filter((r) => !(r.opcional && vazio(r.v)));
  return (
    <Bloco style={{ padding: '0 16px' }}>
      {titulo && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</span>
          {right}
        </div>
      )}
      {lista.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 48, padding: '6px 0', ...(i || titulo ? { borderTop: `1px solid ${NX.linha}` } : {}) }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{r.k}</span>
            {r.sub && <span style={{ fontSize: 12, color: NX.mudo }}>{r.sub}</span>}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.cor ?? (vazio(r.v) ? NX.mudo : NX.texto) }}>{r.v}</span>
        </div>
      ))}
      {children}
    </Bloco>
  );
}

/** Cartão "Por fase": FASE | TENSÃO | CORRENTE, com o segmentado FF/FN quando há os dois. */
export function FasesNx({ rows, ff, onFF, temToggle, nota }: {
  rows: Array<[string, string, string]>; ff: boolean; onFF: (v: boolean) => void; temToggle: boolean; nota?: string;
}) {
  return (
    <Bloco style={{ padding: '0 16px 4px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', minHeight: 38 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Por fase</span>
        {temToggle && <NxSeg<'FF' | 'FN'> value={ff ? 'FF' : 'FN'} onChange={(v) => onFF(v === 'FF')} options={[{ v: 'FF', label: 'FF' }, { v: 'FN', label: 'FN' }]} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 11, fontWeight: 700, color: NX.mudo, padding: '8px 0', letterSpacing: 0.4, borderTop: `1px solid ${NX.linha2}` }}>
        <span>FASE</span><span style={{ textAlign: 'right' }}>TENSÃO</span><span style={{ textAlign: 'right' }}>CORRENTE</span>
      </div>
      {rows.map((f) => (
        <div key={f[0]} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 14, padding: '9px 0', borderTop: `1px solid ${NX.linha}` }}>
          <span>{f[0]}</span>
          <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f[1]}</span>
          <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f[2]}</span>
        </div>
      ))}
      {nota && <div style={{ fontSize: 12, color: NX.mudo, padding: '6px 0 8px 0', borderTop: `1px solid ${NX.linha}` }}>{nota}</div>}
    </Bloco>
  );
}

/** Grade de 2 colunas do modal web que vira 1 coluna abaixo de ~760 px. */
/** Duas colunas que terminam na mesma linha: o último cartão de cada `Coluna` cresce (sem buraco embaixo). */
export function Duas({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 min-[760px]:grid-cols-2 gap-4 items-stretch">{children}</div>;
}
export function Coluna({ children }: { children: ReactNode }) {
  return (
    <div className="[&>*:last-child]:flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, minHeight: 0 }}>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ gráfico recolhível

export interface GrandezaNx { id: string; label: string; short: string; pick: (d: Telemetria) => number | null }
export interface GrupoGrandezaNx { label: string; unit: string; items: GrandezaNx[] }

/** Unidades cujo eixo começa em zero; as outras (V, Hz, FP) ganham "zoom" no trecho lido. */
const UNIDADES_DO_ZERO = ['kW', 'kvar', 'A'];

/**
 * "Gráfico" recolhível (fechado por padrão, valor atual no cabeçalho, chevron).
 * Aberto: Hoje/Semana/Mês, legenda, escolha de grandezas (até 2 unidades; a 2ª
 * tracejada, no eixo da direita), última leitura e gráfico bklit com crosshair e
 * tooltip. Histórico só é buscado ao abrir. Cores pela sequência `corSerie`, na
 * ordem em que as grandezas foram escolhidas.
 */
export function GraficoNx({ equipamentoId, titulo = 'Gráfico', resumo, catalogo, padrao }: {
  equipamentoId: string | null | undefined; titulo?: string; resumo?: ReactNode; catalogo: GrupoGrandezaNx[]; padrao: string[];
}) {
  const [open, setOpen] = useState(false);
  const [per, setPer] = useState<Periodo>('hoje');
  const [sel, setSel] = useState<string[]>(padrao);
  const [escolher, setEscolher] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const byId = useMemo(() => {
    const m = new Map<string, GrandezaNx & { unit: string }>();
    catalogo.forEach((g) => g.items.forEach((it) => m.set(it.id, { ...it, unit: g.unit })));
    return m;
  }, [catalogo]);
  const ativos = sel.filter((id) => byId.has(id));
  const units: string[] = [];
  ativos.forEach((id) => { const u = byId.get(id)!.unit; if (!units.includes(u)) units.push(u); });

  const [ini, fimEixo, fimBusca] = useMemo(() => {
    const fim = new Date(agora);
    const i = new Date(agora); i.setHours(0, 0, 0, 0);
    if (per === 'semana') i.setDate(i.getDate() - 6);
    if (per === 'mes') i.setDate(1);
    return [i, per === 'hoje' ? new Date(i.getTime() + 86400000) : fim, fim] as const;
  }, [per, agora]);
  const { pts, loading } = useHistorico(equipamentoId, ini, fimBusca, open && !!equipamentoId);

  const N = per === 'hoje' ? 96 : per === 'semana' ? 168 : 180;
  const dados = useMemo(() => {
    if (!pts) return null;
    const vals = ativos.map((id) => bucketize(pts, ini.getTime(), fimEixo.getTime(), N, byId.get(id)!.pick));
    // Base por unidade: o bklit começa o eixo em 0 quando tudo é ≥ 0. Para V/Hz/FP o
    // traço é plotado como (valor − base) e eixo/tooltip somam a base de volta — é o
    // "zoom" no trecho lido que o SVG antigo fazia. kW/kvar/A (e qualquer unidade com
    // valor negativo) ficam com base 0.
    const base: Record<string, number> = {};
    units.forEach((u) => {
      let lo = Infinity, hi = -Infinity;
      ativos.forEach((id, k) => { if (byId.get(id)!.unit !== u) return; vals[k].forEach((v) => { if (v == null) return; lo = Math.min(lo, v); hi = Math.max(hi, v); }); });
      if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
      base[u] = UNIDADES_DO_ZERO.includes(u) || lo < 0 ? 0 : Math.max(0, lo - ((hi - lo) * 0.08 || 1));
    });
    const series: Record<string, Array<number | null>> = {};
    ativos.forEach((id, k) => { const b = base[byId.get(id)!.unit]; series[id] = vals[k].map((v) => (v == null ? null : v - b)); });
    const linhas = linhasDeBuckets(ini.getTime(), fimEixo.getTime(), series);
    return { linhas, base, vazio: linhas.length === 0 };
  }, [pts, ativos.join(','), units.join(','), ini, fimEixo, N, byId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dec = (u: string) => (u === 'FP' || u === 'Hz' ? 2 : u === 'V' ? 0 : 1);
  const uTxt = (u: string) => (u === 'FP' ? '' : ` ${u}`);
  const cor = (id: string) => corSerie(sel.indexOf(id));
  const eixoDe = (id: string) => (units.indexOf(byId.get(id)!.unit) === 1 ? 'right' : 'left');
  /** Valor real (base somada de volta) de uma grandeza numa linha; null sem leitura. */
  const valorEm = (linha: Record<string, unknown> | null, id: string) => {
    const b = linha?.[`${id}Bruto`];
    return typeof b === 'number' && dados ? b + dados.base[byId.get(id)!.unit] : null;
  };
  const valorTxt = (v: number | null, u: string) => (v == null ? '—' : `${fmt(v, dec(u))}${uTxt(u)}`);
  const rotuloEixo = (u: string) => (v: number) => { const x = v + (dados?.base[u] ?? 0); return `${fmt(x, Number.isInteger(x) ? 0 : dec(u))}${uTxt(u)}`; };
  const ultima = dados && !dados.vazio ? dados.linhas[dados.linhas.length - 1] : null;

  const toggle = (id: string) => setSel((s0) => {
    if (s0.includes(id)) return s0.length > 1 ? s0.filter((x) => x !== id) : s0;
    return [...s0, id];
  });

  return (
    <Bloco style={{ padding: '0 16px' }}>
      <button type="button" aria-expanded={open} onClick={() => { if (!open) setAgora(Date.now()); setOpen((v) => !v); }}
        style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={NX.acao} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l5-6 4 3 5-7 4 4" /><path d="M3 21h18" /></svg>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{titulo}</span>
        {resumo && <span style={{ fontSize: 13, color: NX.mudo }}>{resumo}</span>}
        <IcoChevron size={18} style={{ transition: 'transform .15s', transform: `rotate(${open ? 180 : 0}deg)` }} />
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${NX.linha2}`, padding: '12px 0 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <NxSeg<Periodo> value={per} onChange={(v) => { setPer(v); setAgora(Date.now()); }} options={[{ v: 'hoje', label: 'Hoje' }, { v: 'semana', label: 'Semana' }, { v: 'mes', label: 'Mês' }]} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: NX.mudo, flexWrap: 'wrap' }}>
              {ativos.map((id) => (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 0, borderTop: `3px ${eixoDe(id) === 'right' ? 'dashed' : 'solid'} ${cor(id)}`, borderRadius: 2 }} />
                  {byId.get(id)!.short}
                </span>
              ))}
              <button type="button" aria-label="Escolher grandezas do gráfico" aria-expanded={escolher} onClick={() => setEscolher((v) => !v)}
                style={{ width: 32, height: 32, borderRadius: 16, background: escolher ? 'rgba(31,122,67,0.14)' : NX.seg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NX.acao} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
              </button>
            </span>
          </div>
          {escolher && (
            <div style={{ background: NX.caixa, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>Grandezas do gráfico</span>
                <span style={{ fontSize: 12, color: NX.mudo }}>Até 2 unidades · {units.join(' · ')}</span>
              </span>
              {catalogo.filter((g) => g.items.length).map((g) => (
                <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, color: NX.mudo }}>{g.label}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {g.items.map((it) => {
                      const on = ativos.includes(it.id);
                      const off = !on && units.length >= 2 && !units.includes(g.unit);
                      const c = on ? cor(it.id) : NX.mudo;
                      return (
                        <button key={it.id} type="button" aria-pressed={on} disabled={off} onClick={() => toggle(it.id)}
                          style={{ height: 32, padding: '0 12px', borderRadius: 16, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${on ? c : NX.borda}`, background: on ? NX.card : 'transparent', opacity: off ? 0.4 : 1 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 4, background: c }} />{it.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {ultima && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, minHeight: 22 }}>
              <span style={{ fontSize: 13, color: NX.mudo, fontVariantNumeric: 'tabular-nums' }}>
                Última leitura · {ultima.date.toLocaleString('pt-BR', per === 'hoje' ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '2px 14px' }}>
                {ativos.map((id) => (
                  <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: cor(id) }} />
                    <span style={{ color: NX.mudo }}>{byId.get(id)!.short}</span>
                    <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{valorTxt(valorEm(ultima, id), byId.get(id)!.unit)}</span>
                  </span>
                ))}
              </span>
            </div>
          )}
          {dados?.vazio && !loading ? (
            <div style={{ height: 170, display: 'grid', placeItems: 'center', fontSize: 12, color: NX.mudo }}>Sem leituras no período</div>
          ) : (
            <div style={{ height: 170, display: 'flex', flexDirection: 'column' }} role="img" aria-label={titulo}>
              <LineChart data={dados?.linhas ?? []} xDomain={[ini, fimEixo]} aspectRatio="auto" className="min-h-0 flex-1"
                margin={{ top: 8, right: units[1] ? 56 : 12, bottom: 6, left: 56 }} animationDuration={0}
                status={loading || !dados ? 'loading' : 'ready'} loadingLabel="Carregando…">
                <Grid horizontal numTicksRows={4} highlightRowValues={[0]} highlightRowStroke={COR_GRAF.neutro} highlightRowStrokeOpacity={0.6} />
                {ativos.map((id) => (
                  <Line key={id} dataKey={id} yAxisId={eixoDe(id)} stroke={cor(id)} strokeWidth={2} curve={curveMonotoneX} fadeEdges={false} animate={false}
                    {...(eixoDe(id) === 'right' ? { dashFromIndex: 0, dashArray: '4,4' } : {})} />
                ))}
                <YAxis numTicks={4} formatValue={rotuloEixo(units[0] ?? '')} />
                {units[1] ? <YAxis yAxisId="right" orientation="right" numTicks={4} formatValue={rotuloEixo(units[1])} /> : null}
                <ChartTooltip showDots rows={(p) => ativos.map((id) => ({ color: cor(id), label: byId.get(id)!.short, value: valorTxt(valorEm(p, id), byId.get(id)!.unit) }))} />
              </LineChart>
              <EixoTempo ini={ini} fim={fimEixo} margemEsq={56} margemDir={units[1] ? 56 : 12} formato={per === 'hoje' ? 'hora' : 'dia'} />
            </div>
          )}
        </div>
      )}
    </Bloco>
  );
}
// ------------------------------------------------------------------ configuração

interface SetpointDef { id: string; label: string; unidade?: string; escala?: number; min?: number; max?: number; faixas?: Array<[number, number]>; padrao?: number; obs?: string; avancado?: boolean }

const numBr = (x: string) => Number(String(x).replace(',', '.').trim());
const faixaTxt = (sp: SetpointDef) =>
  (sp.faixas ?? [[sp.min ?? 0, sp.max ?? 0]]).map(([a, b]) => `${String(a).replace('.', ',')} a ${String(b).replace('.', ',')}`).join(' ou ');
const dentroFaixa = (sp: SetpointDef, v: number) =>
  (sp.faixas ?? [[sp.min ?? -Infinity, sp.max ?? Infinity]]).some(([a, b]) => v >= a && v <= b);

/** Linha de parâmetro (cartão do mockup): rótulo + faixa, campo e unidade. */
function ParamNx({ id, label, hint, bad, valor, unit, ro, placeholder, onChange, nota, extraNota }: {
  id: string; label: string; hint: string; bad?: boolean; valor: string; unit?: string; ro: boolean; placeholder?: string;
  onChange?: (v: string) => void; nota?: ReactNode; extraNota?: ReactNode;
}) {
  return (
    <Bloco style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label htmlFor={id} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: 12, color: bad ? NX.bad : NX.mudo }}>{hint}</span>
        </label>
        <input id={id} inputMode="decimal" value={valor} placeholder={placeholder} disabled={ro}
          onChange={(e) => onChange?.(e.target.value)} style={{ ...s.campo(ro, bad), fontVariantNumeric: 'tabular-nums' }} />
        <span style={{ fontSize: 14, color: NX.mudo, width: 28 }}>{unit}</span>
      </div>
      {nota && <span style={{ fontSize: 12, color: NX.mudo }}>{nota}</span>}
      {extraNota}
    </Bloco>
  );
}

interface LinhaCfg { key: string; label: string; faixa: string; unit: string; path: string; sp?: string }

/**
 * Configuração → "Parâmetros do inversor" (mockup: Subtensão, Sobretensão,
 * Subfrequência, Sobrefrequência, Fator de potência, Limite de potência).
 * Linhas com ajuste no catálogo do modelo (setpoints) são editáveis e vão pela
 * revisão "Confirmar alterações" → POST /equipamentos/:id/setpoints/:sp (TON confere
 * a faixa). As demais são só leitura do registrador ("—" enquanto a TON não lê).
 */
function ConfigInversor({ equipamentoId, dados }: { equipamentoId: string; dados: Telemetria | null }) {
  const g = (p: string) => getPath(dados, p);
  const pv = (p: string) => { const x = g(p); return x == null || x === '' ? '' : String(x).replace('.', ','); };
  const [lista, setLista] = useState<SetpointDef[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [aplicado, setAplicado] = useState<Record<string, string>>({});
  const [ultimo, setUltimo] = useState<Record<string, { ok: boolean; txt: string }>>({});
  const [review, setReview] = useState(false);
  const [writing, setWriting] = useState(false);
  const [verAvancado, setVerAvancado] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.get(`/equipamentos/${equipamentoId.trim()}/setpoints`)
      .then((r) => {
        const d = (r?.data?.data ?? r?.data) as { setpoints?: unknown } | null;
        if (vivo) setLista(Array.isArray(d?.setpoints) ? (d.setpoints as SetpointDef[]) : []);
      })
      .catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [equipamentoId]);

  const linhas: LinhaCfg[] = [
    { key: 'sub', label: 'Subtensão', faixa: '0,70 a 0,90', unit: 'pu', path: 'protection.under_voltage' },
    { key: 'sob', label: 'Sobretensão', faixa: '1,05 a 1,20', unit: 'pu', path: 'protection.over_voltage' },
    { key: 'subf', label: 'Subfrequência', faixa: '56,0 a 59,5', unit: 'Hz', path: 'protection.under_frequency' },
    { key: 'sobf', label: 'Sobrefrequência', faixa: '60,5 a 63,0', unit: 'Hz', path: 'protection.over_frequency' },
    { key: 'fp', label: 'Fator de potência', faixa: '0,80 ind a 0,80 cap', unit: '', path: 'regulation.power_factor_setpoint', sp: 'sp_fp' },
    { key: 'lim', label: 'Limite de potência', faixa: '0 a 100', unit: '%', path: 'regulation.active_power_limit', sp: 'sp_limite_pct' },
  ];
  const porId = new Map(lista.map((sp) => [sp.id, sp]));
  const extras = lista.filter((sp) => !sp.avancado && !linhas.some((l) => l.sp === sp.id));
  const avancados = lista.filter((sp) => sp.avancado);
  const pathDe = (sp: SetpointDef) => linhas.find((l) => l.sp === sp.id)?.path ?? (sp.id === 'sp_q_pct' ? 'regulation.reactive_pct' : '');
  // Valor de referência ("antigo"): o último aplicado aqui ou a leitura da TON.
  const base = (sp: SetpointDef) => aplicado[sp.id] ?? (pathDe(sp) ? pv(pathDe(sp)) : '');
  const valorDe = (sp: SetpointDef) => draft[sp.id] ?? base(sp);
  const editaveis = [...linhas.map((l) => (l.sp ? porId.get(l.sp) : undefined)).filter((x): x is SetpointDef => !!x), ...extras, ...avancados];
  const ruim = (sp: SetpointDef) => { const t = valorDe(sp).trim(); if (t === '') return false; const v = numBr(t); return !Number.isFinite(v) || !dentroFaixa(sp, v); };
  const mudou = (sp: SetpointDef) => { const t = valorDe(sp).trim(); return t !== '' && numBr(t) !== numBr(base(sp)); };
  const anyBad = editaveis.some(ruim);
  const changed = editaveis.filter(mudou);
  const saveOff = anyBad || changed.length === 0 || writing;
  const uni = (sp: SetpointDef) => (sp.unidade ? ` ${sp.unidade}` : '');

  const gravar = async () => {
    setWriting(true);
    for (const sp of changed) {
      const raw = valorDe(sp).trim();
      try {
        const r = await api.post(`/equipamentos/${equipamentoId.trim()}/setpoints/${sp.id}`, { valor: numBr(raw) });
        const d = (r?.data?.data ?? r?.data) as { latency_ms?: number; comando_tecnico?: string } | null;
        setUltimo((u) => ({ ...u, [sp.id]: { ok: true, txt: `Aplicado · ack ${d?.latency_ms ?? '?'} ms` } }));
        setAplicado((a) => ({ ...a, [sp.id]: raw }));
        setDraft((x) => { const n = { ...x }; delete n[sp.id]; return n; });
        toast.success(`${sp.label}: aplicado`, { description: d?.comando_tecnico });
      } catch (e) {
        const { st, msg } = erroDe(e);
        const titulo = st === 504 ? 'A TON não respondeu' : st === 502 ? 'O inversor/TON recusou' : st === 403 ? 'Sem permissão' : 'Não aplicado';
        setUltimo((u) => ({ ...u, [sp.id]: { ok: false, txt: `${titulo}: ${msg}` } }));
        toast.error(`${sp.label}: ${titulo}`, { description: msg });
      }
    }
    setWriting(false);
    setReview(false);
  };

  const linhaSp = (sp: SetpointDef, label?: string) => (
    <ParamNx key={sp.id} id={`cfg-${sp.id}`} label={label ?? sp.label} hint={`Faixa ${faixaTxt(sp)}${uni(sp)}`} bad={ruim(sp)}
      valor={valorDe(sp)} unit={sp.unidade} ro={writing} placeholder={sp.padrao != null ? String(sp.padrao).replace('.', ',') : '—'}
      onChange={(v) => setDraft((x) => ({ ...x, [sp.id]: v }))}
      nota={sp.obs}
      extraNota={ultimo[sp.id] && <span style={{ fontSize: 12, fontWeight: 700, color: ultimo[sp.id].ok ? NX.ok : NX.bad }}>{ultimo[sp.id].txt}</span>} />
  );

  const ident: LinhaNx[] = [
    { k: 'Potência nominal', v: g('info.nominal_power') != null ? `${fmt(g('info.nominal_power'), 0)} kW` : '—', opcional: true },
    { k: 'Tipo de dispositivo', v: g('info.device_type') != null ? String(g('info.device_type')) : '—', opcional: true },
    { k: 'Tipo de saída', v: g('info.output_type') != null ? String(g('info.output_type')) : '—', opcional: true },
    { k: 'Potência reativa nominal', v: g('regulation.nominal_reactive_power') != null ? `${fmt(g('regulation.nominal_reactive_power'), 0)} kvar` : '—', opcional: true },
    { k: 'Modo de reativo', v: pv('regulation.reactive_mode_text') || '—', sub: 'FP fixo · Q fixo · Q(V)', opcional: true },
  ];
  const temIdent = ident.some((r) => !vazio(r.v));
  const soLeitura = linhas.filter((l) => !(l.sp && porId.get(l.sp)));

  return (
    <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Rotulo style={{ marginTop: 4 }}>Parâmetros do inversor</Rotulo>
      {linhas.map((l) => {
        const sp = l.sp ? porId.get(l.sp) : undefined;
        if (sp) return linhaSp(sp, l.label);
        return (
          <ParamNx key={l.key} id={`cfg-${l.key}`} label={l.label} hint={`Faixa ${l.faixa}${l.unit ? ` ${l.unit}` : ''}`}
            valor={pv(l.path) || '—'} unit={l.unit} ro />
        );
      })}
      {extras.map((sp) => linhaSp(sp))}
      {avancados.length > 0 && (
        <>
          <button type="button" aria-expanded={verAvancado} onClick={() => setVerAvancado((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, ...s.label }}>
            AVANÇADO ({avancados.length})
            <IcoChevron size={14} style={{ transition: 'transform .15s', transform: `rotate(${verAvancado ? 180 : 0}deg)` }} />
          </button>
          {verAvancado && (
            <>
              <span style={{ fontSize: 13, color: NX.warn, fontWeight: 700 }}>Ajustes por endereço Modbus: confira o manual do fabricante antes de gravar.</span>
              {avancados.map((sp) => linhaSp(sp))}
            </>
          )}
        </>
      )}
      <button type="button" disabled={saveOff} onClick={() => setReview(true)} style={s.save(saveOff)}>
        {anyBad ? 'Valor fora da faixa' : changed.length === 0 ? 'Sem alterações' : `Revisar ${changed.length} ${changed.length > 1 ? 'alterações' : 'alteração'}`}
      </button>
      {soLeitura.length > 0 && (
        <span style={{ fontSize: 12, color: NX.mudo, marginTop: 6 }}>
          {soLeitura.map((l) => l.label).join(', ')}: só leitura — este modelo ainda não tem comando de ajuste pelo NexON ("—" enquanto a TON não lê o registrador).
        </span>
      )}
      <span style={{ fontSize: 12, color: NX.mudo }}>Ajustes enviados ao inversor pela TON (firmware gerado a partir de 09/10/2026). Só fica editável o que este modelo aceita.</span>

      {temIdent && (
        <>
          <Rotulo style={{ marginTop: 10 }}>Identificação</Rotulo>
          <LinhasNx rows={ident} />
        </>
      )}

      <NxReview open={review} onClose={() => { if (!writing) setReview(false); }} writing={writing} onWrite={gravar}
        changes={changed.map((sp) => ({ label: sp.label, de: `${base(sp) || '—'}${uni(sp)}`, para: `${valorDe(sp).trim()}${uni(sp)}` }))}
        nota={changed.some((sp) => sp.avancado)
          ? 'Os valores vão para o equipamento real pela TON. Inclui ajuste avançado (endereço Modbus).'
          : 'Os valores vão para o equipamento real pela TON.'} />
    </div>
  );
}

// ------------------------------------------------------------------ ficha

/**
 * Sheet do Inversor Fotovoltaico. Data-driven pela telemetria do próprio equipamento.
 */
export function InversorSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const { dados, ts } = useDados(equipamentoId);
  const [aba, setAba] = useState('op');
  const [ff, setFf] = useState(true);
  const [mpptOpen, setMpptOpen] = useState(false);

  // Comandos acionáveis (pontos Ligar/Desligar JÁ vinculados a um comando Modbus/TON).
  const [comandos, setComandos] = useState<Array<{ ponto_id: string; ponto: string }>>([]);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<'Ligar' | 'Desligar' | null>(null);
  useEffect(() => {
    let vivo = true;
    api.get(`/iot/equipamento/${equipamentoId.trim()}/comandos`)
      .then((r) => {
        const d = (r?.data?.data ?? r?.data) as unknown;
        const lista = Array.isArray(d) ? d : Array.isArray((d as { data?: unknown })?.data) ? (d as { data: unknown[] }).data : [];
        if (vivo) setComandos(lista as Array<{ ponto_id: string; ponto: string }>);
      })
      .catch(() => { if (vivo) setComandos([]); });
    return () => { vivo = false; };
  }, [equipamentoId]);
  const cmdDesligar = comandos.find((c) => /deslig|parar|stop|off/i.test(c.ponto)) ?? null;
  const cmdLigar = comandos.find((c) => c !== cmdDesligar && /liga|partir|start|on\b/i.test(c.ponto)) ?? null;
  const acionar = async (acao: 'Ligar' | 'Desligar') => {
    const c = acao === 'Ligar' ? cmdLigar : cmdDesligar;
    if (!c) return;
    setEnviando(c.ponto_id);
    try {
      const r = await acionarPontoApi.acionar(equipamentoId, c.ponto_id);
      toast.success(`${acao}: confirmado pela TON`, { description: `${r.comando_tecnico} · ack ${r.latency_ms} ms` });
    } catch (e) {
      const { st, msg } = erroDe(e);
      toast.error(st === 504 ? 'A TON não respondeu a tempo' : st === 502 ? 'O inversor/TON recusou o comando' : 'Comando não enviado', { description: msg });
    } finally { setEnviando(null); setConfirmar(null); }
  };

  const g = (p: string) => getPath(dados, p);
  const num = (p: string) => { const x = g(p); return x == null || x === '' || !Number.isFinite(Number(x)) ? undefined : Number(x); };
  const nomeEq = nome || 'Inversor';
  // Contrato do NexON: power.* e dc.total_power chegam em W/VA/var → exibidos em kW/kVA/kvar.
  const kilo = (p: string) => { const x = num(p); return x == null ? undefined : x / 1000; };
  const pativa = kilo('power.active_total');
  const nominal = num('info.nominal_power');
  const gerando = pativa != null && pativa > 0.01;
  const pct = nominal ? Math.max(0, Math.min(100, ((pativa ?? 0) / nominal) * 100)) : undefined;
  const info = tsInfo(ts);
  const online = info.online;

  // Texto do estado do firmware (tabela Sungrow); "Unknown" de outros fabricantes é ignorado.
  const wsTxt = String(g('status.work_state_text') ?? '').trim();
  const estadoTexto = wsTxt && !/^unknown$/i.test(wsTxt) ? wsTxt : '';
  const minHoje = num('energy.daily_running_time');

  // Tensões FF/FN: o que o inversor MEDE; o que falta sai CALCULADO (×√3 / ÷√3) e marcado "calc.".
  const R3 = Math.sqrt(3);
  const ffMed = [num('voltage.phase_a-b'), num('voltage.phase_b-c'), num('voltage.phase_c-a')];
  const fnMed = [num('voltage.phase_a'), num('voltage.phase_b'), num('voltage.phase_c')];
  const temFF = ffMed.some((v) => v != null);
  const temFN = fnMed.some((v) => v != null);
  const media = (a?: number, b?: number) => (a != null && b != null ? (a + b) / 2 : undefined);
  const ffCalc = [media(fnMed[0], fnMed[1]), media(fnMed[1], fnMed[2]), media(fnMed[2], fnMed[0])].map((v) => (v != null ? v * R3 : undefined));
  const fnCalc = [media(ffMed[0], ffMed[2]), media(ffMed[0], ffMed[1]), media(ffMed[1], ffMed[2])].map((v) => (v != null ? v / R3 : undefined));
  const ffVals = temFF ? ffMed : ffCalc;
  const fnVals = temFN ? fnMed : fnCalc;
  const ffCalculado = !temFF && temFN;
  const fnCalculado = !temFN && temFF;
  const mostraFF = (temFF || !temFN) ? ff : !ff;
  const vTxt = (v: number | undefined, calc: boolean) => (v == null ? '—' : `${fmt(v, 0)} V${calc ? ' (calc.)' : ''}`);
  const aTxt = (p: string) => (num(p) == null ? '—' : `${fmt(num(p), 1)} A`);
  const fases: Array<[string, string, string]> = mostraFF
    ? [['AB', vTxt(ffVals[0], ffCalculado), aTxt('current.phase_a')], ['BC', vTxt(ffVals[1], ffCalculado), aTxt('current.phase_b')], ['CA', vTxt(ffVals[2], ffCalculado), aTxt('current.phase_c')]]
    : [['A', vTxt(fnVals[0], fnCalculado), aTxt('current.phase_a')], ['B', vTxt(fnVals[1], fnCalculado), aTxt('current.phase_b')], ['C', vTxt(fnVals[2], fnCalculado), aTxt('current.phase_c')]];
  const notaTensao = mostraFF
    ? (ffCalculado ? 'Este inversor mede só fase-neutro: entre fases calculado (×√3).' : '')
    : (fnCalculado ? 'Este inversor mede só entre fases: fase-neutro calculado (÷√3).' : '');

  // Falhas (bitfields status.fault_N). 0 = sem falha.
  const falhas = [1, 2, 3, 4, 5].map((n) => ({ n, v: num(`status.fault_${n}`) }));
  const temFalhas = falhas.some((f) => f.v != null);
  const ativas = falhas.filter((f) => f.v != null && f.v !== 0);
  const falhasTxt = ativas.length === 0 ? 'Nenhuma'
    : ativas.map((f) => `F${f.n}=0x${(f.v as number).toString(16).toUpperCase()}`).join(' · ');

  // Aparente e FP: quando o inversor não informa, calcula de P e Q (marcado "calc.").
  const qkvar = kilo('power.reactive_total');
  const sMed = kilo('power.apparent_total');
  const sCalc = sMed == null && pativa != null && qkvar != null ? Math.hypot(pativa, qkvar) : undefined;
  const fpMed = num('power.power_factor');
  const fpCalc = fpMed == null && pativa != null && qkvar != null && Math.hypot(pativa, qkvar) > 0 ? pativa / Math.hypot(pativa, qkvar) : undefined;

  // MPPT (dc.mpptN_voltage) e strings (dc.stringN_current): 1..maior canal ativo.
  const canaisAte = (prefixo: string, sufixo: string, max: number) => {
    const vals: number[] = [];
    for (let n = 1; n <= max; n++) { const v = Number(g(`dc.${prefixo}${n}${sufixo}`)); vals.push(Number.isFinite(v) ? v : 0); }
    let ultimo = 0; vals.forEach((v, i) => { if (v > 0) ultimo = i + 1; });
    return vals.slice(0, ultimo).map((v, i) => ({ n: i + 1, v }));
  };
  const mppts = canaisAte('mppt', '_voltage', 24);
  const strings = canaisAte('string', '_current', 48);
  const dcMed = kilo('dc.total_power');
  const dcCalc = dcMed == null && mppts.length > 0 && mppts.length === strings.length
    ? mppts.reduce((acc, m, i) => acc + m.v * strings[i].v, 0) / 1000 : undefined;

  // String abaixo da média (regra do mockup): < 0,2 A com média > 2 A = falha; < 70% da média = alerta.
  const ord = strings.map((x) => x.v).sort((a, b) => a - b);
  const med = ord.length ? (ord.length % 2 ? ord[(ord.length - 1) / 2] : (ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2) : 0;
  const corString = (a: number) => (med > 2 && a < 0.2 ? NX.bad : med > 1 && a < 0.7 * med ? NX.warn : NX.texto);
  const baixas = online && gerando ? strings.filter((x) => corString(x.v) !== NX.texto) : [];
  const porMppt = mppts.length && strings.length ? Math.max(1, Math.ceil(strings.length / mppts.length)) : 0;

  let tone: NxTone; let stLabel: string; let stText: string;
  if (!online) { tone = 'off'; stLabel = 'Sem comunicação'; stText = info.hasTs ? `Última leitura ${info.idade}` : 'Sem leitura'; }
  else if (ativas.length) { tone = 'bad'; stLabel = 'Falha'; stText = falhasTxt; }
  else if (baixas.length) { tone = 'warn'; stLabel = 'Alerta'; stText = baixas.length === 1 ? `String ${baixas[0].n} abaixo da média` : `${baixas.length} strings abaixo da média`; }
  else { tone = 'ok'; stLabel = 'Normal'; stText = estadoTexto || (gerando ? 'Gerando' : 'Sem geração agora'); }

  const totalYield = num('energy.total_yield');
  const acumulada = totalYield == null ? '—' : totalYield >= 1000 ? `${fmt(totalYield / 1000, 2)} MWh` : `${fmt(totalYield, 1)} kWh`;
  const isol = num('protection.insulation_resistance');

  // Comando principal (mockup: um botão — Desligar quando gera, Ligar quando parado).
  const temCmd = !!(cmdLigar || cmdDesligar);
  const botoes: Array<'Ligar' | 'Desligar'> = gerando ? ['Desligar'] : cmdLigar && cmdDesligar ? ['Desligar', 'Ligar'] : cmdDesligar ? ['Desligar'] : ['Ligar'];
  const consequencia = confirmar === 'Desligar'
    ? `O inversor para de gerar${pativa != null && gerando ? ` (${fmt(pativa, 1)} kW agora)` : ''} e deixa de injetar na rede.`
    : 'O inversor volta a gerar e injetar na rede.';

  const fasesCatalogo: GrandezaNx[] = (temFF
    ? [['AB', 'phase_a-b'], ['BC', 'phase_b-c'], ['CA', 'phase_c-a']]
    : [['A', 'phase_a'], ['B', 'phase_b'], ['C', 'phase_c']]
  ).map(([k, p]) => ({ id: `v${k}`, label: k, short: `V ${k}`, pick: (d: Telemetria) => { const v = Number(getPath(d, `voltage.${p}`)); return Number.isFinite(v) ? v : null; } }));
  const pickN = (p: string, div = 1) => (d: Telemetria) => { const x = getPath(d, p); const v = Number(x); return x == null || x === '' || !Number.isFinite(v) ? null : v / div; };
  const catalogo: GrupoGrandezaNx[] = [
    { label: 'Potência ativa · kW', unit: 'kW', items: [{ id: 'pAt', label: 'Ativa', short: 'Ativa', pick: pickN('power.active_total', 1000) }] },
    { label: 'Corrente CA · A', unit: 'A', items: (['a', 'b', 'c'] as const).map((f) => ({ id: `i${f}`, label: `Fase ${f.toUpperCase()}`, short: `I ${f.toUpperCase()}`, pick: pickN(`current.phase_${f}`) })) },
    { label: 'Tensão CA · V', unit: 'V', items: fasesCatalogo },
    { label: 'Tensão MPPT · V', unit: 'V', items: mppts.map((m) => ({ id: `m${m.n}`, label: String(m.n), short: `MPPT ${m.n}`, pick: pickN(`dc.mppt${m.n}_voltage`) })) },
  ];

  return (
    <NxShell
      title={nomeEq}
      subtitle={info.hasTs ? info.label : 'Sem leitura'}
      right={<span style={s.pill(tone)}><span style={s.pillDot(tone)} />{stLabel}</span>}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'cfg' ? (
        <ConfigInversor equipamentoId={equipamentoId} dados={dados} />
      ) : (
        <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Duas>
            <Coluna>
              <StatusNx tone={tone} label={stLabel} text={stText}
                extra={online && gerando && pct != null ? `${fmt(pativa, 1)} kW · ${Math.round(pct)}% da potência nominal` : undefined} />
              {temCmd ? (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${botoes.length}, minmax(0, 1fr))`, gap: 8 }}>
                  {botoes.map((b) => {
                    const c = b === 'Ligar' ? cmdLigar : cmdDesligar;
                    const busy = !!enviando;
                    return (
                      <button key={b} type="button" disabled={busy || !c} onClick={() => setConfirmar(b)}
                        style={s.cmd(busy || !c ? 'busy' : b === 'Desligar' ? 'outline' : 'primary')}>
                        {busy ? 'Executando…' : b}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <>
                  <button type="button" disabled style={s.cmd('busy')}>{gerando ? 'Desligar' : 'Ligar'}</button>
                  <span style={{ fontSize: 12, color: NX.mudo, textAlign: 'center' }}>Sem ponto Ligar/Desligar vinculado a este inversor (editor IoT → Configurar I/O).</span>
                </>
              )}
              <Bloco style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, color: NX.mudo }}>Energia total · hoje</span>
                  <span style={{ fontSize: 30, lineHeight: '36px', fontWeight: 800, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(num('energy.daily_yield'), 1)}<span style={{ fontSize: 16, fontWeight: 700, color: NX.mudo, marginLeft: 6 }}>kWh</span>
                  </span>
                </span>
                {tone === 'warn' && <Exclama title={stText} />}
              </Bloco>
            </Coluna>
            <Coluna>
              <LinhasNx titulo="Potência" rows={[
                { k: 'Ativa', v: pativa != null ? `${fmt(pativa, 1)} kW` : '—' },
                { k: 'Reativa', v: qkvar != null ? `${fmt(qkvar, 1)} kvar` : '—' },
                { k: 'Entrada CC', v: dcMed != null ? `${fmt(dcMed, 1)} kW` : dcCalc != null ? `${fmt(dcCalc, 1)} kW (calc.)` : '—' },
                { k: 'Energia acumulada', v: acumulada },
                { k: 'Aparente', v: sMed != null ? `${fmt(sMed, 1)} kVA` : sCalc != null ? `${fmt(sCalc, 1)} kVA (calc.)` : '—', opcional: true },
                { k: 'Fator de potência', v: fpMed != null ? fmt(fpMed, 2) : fpCalc != null ? `${fmt(fpCalc, 2)} (calc.)` : '—', opcional: true },
                { k: 'Frequência', v: num('power.frequency') != null ? `${fmt(num('power.frequency'), 2)} Hz` : '—', opcional: true },
              ]} />
            </Coluna>
          </Duas>

          <GraficoNx equipamentoId={equipamentoId} catalogo={catalogo} padrao={['pAt']}
            resumo={pativa != null ? `${fmt(pativa, 1)} kW agora` : undefined} />

          <Duas>
            <FasesNx rows={fases} ff={mostraFF} onFF={(v) => setFf((temFF || !temFN) ? v : !v)} temToggle={temFF || temFN} nota={notaTensao} />
            <Coluna>
              <Bloco style={{ overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px 0 16px' }}><span style={{ fontSize: 15, fontWeight: 800 }}>Corrente contínua</span></div>
                <button type="button" aria-expanded={mpptOpen} disabled={!mppts.length && !strings.length} onClick={() => setMpptOpen((v) => !v)}
                  style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', boxSizing: 'border-box' }}>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>MPPT e strings</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>{mppts.length || strings.length ? `${mppts.length} MPPT · ${strings.length} strings` : '—'}</span>
                  </span>
                  {baixas.length > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: NX.warn }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: NX.warn }} />{baixas.length} em alerta
                    </span>
                  )}
                  {(mppts.length > 0 || strings.length > 0) && <IcoChevron size={18} style={{ flex: 'none', transition: 'transform .15s', transform: `rotate(${mpptOpen ? 180 : 0}deg)` }} />}
                </button>
                {mpptOpen && (
                  <div style={{ padding: '0 16px 8px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', padding: '8px 0', borderTop: `1px solid ${NX.linha}`, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: NX.mudo }}>
                      <span>MPPT · TENSÃO</span><span style={{ textAlign: 'right' }}>STRING · CORRENTE</span>
                    </div>
                    {(mppts.length ? mppts : [{ n: 0, v: 0 }]).map((m, k) => {
                      const sts = mppts.length ? strings.slice(k * porMppt, (k + 1) * porMppt) : strings;
                      return (
                        <div key={m.n} style={{ borderTop: `1px solid ${NX.linha}`, padding: '8px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignItems: 'start' }}>
                          <span style={{ display: 'flex', flexDirection: 'column' }}>
                            {mppts.length > 0 && (<>
                              <span style={{ fontSize: 14, fontWeight: 800 }}>MPPT {m.n}</span>
                              <span style={{ fontSize: 13, color: NX.mudo, fontVariantNumeric: 'tabular-nums' }}>{fmt(m.v, 0)} V</span>
                            </>)}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {sts.map((x) => (
                              <span key={x.n} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, fontSize: 13 }}>
                                <span style={{ color: NX.mudo }}>String {x.n}</span>
                                <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right', color: corString(x.v) }}>{fmt(x.v, 1)} A</span>
                              </span>
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Bloco>
              <LinhasNx titulo="Temperatura e isolamento" rows={[
                { k: 'Temperatura interna', v: num('temperature.internal') != null ? `${fmt(num('temperature.internal'), 1)} °C` : '—' },
                { k: 'Resistência de isolamento', v: isol == null ? '—' : isol >= 1000 ? `${fmt(isol / 1000, 2)} MΩ` : `${fmt(isol, 0)} kΩ` },
                { k: 'Tensão do barramento', v: num('protection.bus_voltage') != null ? `${fmt(num('protection.bus_voltage'), 0)} V` : '—', opcional: true },
                { k: 'Tempo de operação hoje', v: minHoje != null ? `${fmt(minHoje / 60, 1)} h` : '—', opcional: true },
                { k: 'Tempo de operação total', v: num('energy.total_running_time') != null ? `${fmt(num('energy.total_running_time'), 0)} h` : '—', opcional: true },
                ...(temFalhas ? [{ k: 'Falhas', v: falhasTxt, cor: ativas.length ? COR.bad : undefined }] : []),
              ]} />
            </Coluna>
          </Duas>

          <Registros equipamentoId={equipamentoId} />
        </div>
      )}

      <NxDialog open={!!confirmar} onClose={() => { if (!enviando) setConfirmar(null); }} label="Confirmar comando">
        <span style={{ fontSize: 18, fontWeight: 800 }}>{confirmar} {nomeEq}?</span>
        <span style={{ fontSize: 14, color: NX.mudo }}>{consequencia}</span>
        <span style={{ fontSize: 13, color: NX.mudo }}>O comando vai para o equipamento real pela TON.</span>
        <NxDialogButtons onCancel={() => setConfirmar(null)} busy={!!enviando} onConfirm={() => { if (confirmar) void acionar(confirmar); }} />
      </NxDialog>
    </NxShell>
  );
}

export default InversorSheet;
