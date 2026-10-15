import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LineChart } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/config/api';
import { equipamentosDadosService } from '@/services/equipamentos-dados.service';
import type { CustosEnergiaResponseDto } from '@/types/dtos/custos-energia-dto';

/**
 * Peças do layout novo das telas de equipamento no web (NEXON-5, mockup
 * "NexON - Equipamentos da instalação": Web — Modal do Pivô / Carregador / Medidor).
 * Casca larga com abas Operação/Configuração, cartões brancos, pílula de status,
 * gráfico recolhível, registros do equipamento e custos por posto tarifário.
 * Cores por token do tema (claro/escuro); verde de ação = #177A3C da marca.
 */

export type Tone = 'ok' | 'warn' | 'bad' | 'off';

export const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-red-600 dark:text-red-400',
  off: 'text-muted-foreground',
};
export const TONE_BG: Record<Tone, string> = {
  ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', off: 'bg-[#8A8FA3]',
};
const TONE_TINT: Record<Tone, string> = {
  ok: 'bg-emerald-500/10', warn: 'bg-amber-500/15', bad: 'bg-red-500/10', off: 'bg-[#EEF0F4] dark:bg-white/10',
};

export const ACAO = 'bg-[#177A3C] hover:bg-[#145f30] text-white';

export const brl = (v: unknown, d = 2): string =>
  v == null || Number.isNaN(Number(v))
    ? '—'
    : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}`;

type Obj = Record<string, unknown>;
/** Tira o envelope { data } / { data: { data } } da resposta. */
export const unwrap = <T = Obj>(r: unknown): T => {
  const o = r as { data?: { data?: unknown } } | null;
  return (o?.data?.data ?? o?.data ?? r) as T;
};

/** Casca do modal de equipamento (820 px, cabeçalho com pílula e abas). */
export function EquipShell({
  title, subtitle, right, tabs, tab, onTab, onClose, children,
}: {
  title: string; subtitle?: ReactNode; right?: ReactNode;
  tabs?: Array<{ key: string; label: string }>; tab?: string; onTab?: (k: string) => void;
  onClose: () => void; children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        // Sheet lateral de altura total (padrão do Dialog do projeto): só a largura muda.
        className="max-w-[820px] w-full p-0 gap-0 overflow-hidden flex flex-col bg-[#F1F2F6] dark:bg-[#0E0E24] sm:rounded-l-2xl"
      >
        <div className="px-6 pt-5 pr-14 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-[22px] font-extrabold leading-tight truncate">{title}</DialogTitle>
              {subtitle && <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>}
            </div>
            {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
          </div>
          {tabs && tabs.length > 1 && (
            <div className="mt-4 grid gap-1 p-1 rounded-[14px] bg-[#EEF0F4] dark:bg-white/10" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={tab === t.key}
                  onClick={() => onTab?.(t.key)}
                  className={`h-[38px] rounded-[11px] text-sm font-extrabold transition-colors ${tab === t.key ? 'bg-background border-[1.5px] border-blue-600 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-px bg-border mt-4 shrink-0" />
        <div className="flex-1 min-h-0 overflow-auto px-6 pt-5 pb-7">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`h-[30px] px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-extrabold whitespace-nowrap ${TONE_TEXT[tone]} ${TONE_TINT[tone]}`}>
      <span className={`w-2 h-2 rounded-full ${TONE_BG[tone]}`} />{children}
    </span>
  );
}

export function NeutralPill({ children }: { children: ReactNode }) {
  return <span className="h-[30px] px-3 rounded-full inline-flex items-center bg-[#EEF0F4] dark:bg-white/10 text-[13px] font-extrabold whitespace-nowrap">{children}</span>;
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-white dark:bg-[#161633] border rounded-[14px] ${className}`}>{children}</div>;
}

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-xs font-extrabold text-muted-foreground tracking-[0.6px] uppercase ${className}`}>{children}</div>;
}

/** Linha de status: bolinha + rótulo colorido + texto. */
export function StatusLine({ tone, label, text, extra }: { tone: Tone; label: string; text?: ReactNode; extra?: ReactNode }) {
  return (
    <Card className="px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TONE_BG[tone]}`} />
        <span className={`text-[15px] font-extrabold ${TONE_TEXT[tone]}`}>{label}</span>
        {text && <span className="text-sm text-muted-foreground truncate">{text}</span>}
      </div>
      {extra && <span className="text-[13px] text-muted-foreground">{extra}</span>}
    </Card>
  );
}

export interface KpiCell { k: string; v: ReactNode; s?: ReactNode }

/** Grade de indicadores com divisória vertical (3 × N ou 2 × N). */
export function KpiCells({ items, cols = 3, size = 'md', align = 'center' }: {
  items: KpiCell[]; cols?: number; size?: 'sm' | 'md' | 'lg'; align?: 'center' | 'left';
}) {
  const vCls = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-[15px]' : 'text-[17px]';
  return (
    <div className="grid gap-y-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map((it, i) => (
        <div
          key={i}
          className={`flex flex-col gap-0.5 px-3 min-w-0 ${align === 'center' ? 'items-center text-center' : 'px-[18px]'} ${i % cols ? 'border-l border-border' : ''}`}
        >
          {align === 'left' && <span className="text-xs text-muted-foreground">{it.k}</span>}
          <span className={`${vCls} font-extrabold tabular-nums whitespace-nowrap`}>{it.v}</span>
          {align === 'center' && <span className="text-xs text-muted-foreground">{it.k}</span>}
          {it.s && <span className="text-[11px] text-muted-foreground whitespace-nowrap truncate max-w-full">{it.s}</span>}
        </div>
      ))}
    </div>
  );
}

/** Botão largo de comando (Ligar/Desligar, Iniciar/Parar). */
export function BigButton({ variant = 'primary', disabled, onClick, children }: {
  variant?: 'primary' | 'outline'; disabled?: boolean; onClick?: () => void; children: ReactNode;
}) {
  const cls = disabled
    ? 'bg-[#EEF0F4] dark:bg-white/10 text-muted-foreground cursor-not-allowed'
    : variant === 'primary' ? ACAO : 'bg-white dark:bg-[#161633] border-[1.5px] border-border hover:bg-black/[0.03] dark:hover:bg-white/5';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`w-full h-[52px] rounded-xl text-base font-extrabold text-center ${cls}`}>
      {children}
    </button>
  );
}

export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange?: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-[46px] h-7 rounded-full shrink-0 transition-colors disabled:opacity-60 ${on ? 'bg-[#177A3C]' : 'bg-[#C9CDD8] dark:bg-white/25'}`}
    >
      <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${on ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  );
}

/** Linha de cartão com rótulo/dica à esquerda e controle à direita. */
export function FieldRow({ label, sub, children, first }: { label: ReactNode; sub?: ReactNode; children?: ReactNode; first?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 min-h-[56px] py-2 ${first ? '' : 'border-t border-border'}`}>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[15px] font-bold">{label}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: {
  value: T; options: Array<{ v: NoInfer<T>; label: string }>; onChange: (v: NoInfer<T>) => void; size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex gap-1 p-[3px] rounded-xl bg-[#EEF0F4] dark:bg-white/10">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`${size === 'sm' ? 'h-[30px]' : 'h-8'} px-3 rounded-[9px] text-[13px] font-extrabold whitespace-nowrap ${value === o.v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Diálogo pequeno por cima do modal (confirmação, irrigação avançada, custos…). */
export function SubDialog({ open, onClose, title, subtitle, width = 440, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; width?: number; children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        // Diálogo centralizado por cima da sheet (o Dialog padrão do projeto é lateral).
        className="p-[22px] gap-3 rounded-[18px] border top-1/2 bottom-auto left-1/2 right-auto -translate-x-1/2 -translate-y-1/2 max-h-[90dvh] data-[state=open]:slide-in-from-right-0 data-[state=closed]:slide-out-to-right-0"
        style={{ maxWidth: width, width: '94vw' }}
      >
        <div className="flex flex-col gap-0.5 pr-8">
          <DialogTitle className="text-lg font-extrabold">{title}</DialogTitle>
          {subtitle && <span className="text-[13px] text-muted-foreground">{subtitle}</span>}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function DialogButtons({ onCancel, onConfirm, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', disabled, busy }: {
  onCancel: () => void; onConfirm: () => void; confirmLabel?: string; cancelLabel?: string; disabled?: boolean; busy?: boolean;
}) {
  return (
    <div className="flex gap-2 mt-2">
      <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-xl bg-[#EEF0F4] dark:bg-white/10 font-bold">{cancelLabel}</button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || busy}
        className={`flex-1 h-11 rounded-xl font-extrabold ${disabled || busy ? 'bg-[#EEF0F4] dark:bg-white/10 text-muted-foreground' : ACAO}`}
      >
        {busy ? 'Executando…' : confirmLabel}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- dados */

const num = (v: unknown): number | null => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export interface HistPoint { t: number; d: Obj }

/** Leituras de /equipamentos/:id/dados/historico no intervalo (ordem crescente). */
export function useHistorico(equipamentoId: string | null | undefined, inicio: Date | null, fim: Date | null, enabled = true) {
  const [pts, setPts] = useState<HistPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ini = inicio?.toISOString(); const end = fim?.toISOString();
  useEffect(() => {
    if (!equipamentoId || !ini || !end || !enabled) return;
    let vivo = true;
    setLoading(true);
    equipamentosDadosService.getHistory(equipamentoId, { startDate: ini, endDate: end, limit: 20000 })
      .then((r) => {
        if (!vivo) return;
        const rows = ((r as unknown as { data?: unknown[] })?.data ?? []) as Array<{ timestamp_dados?: string; created_at?: string; timestamp?: string; dados?: Obj }>;
        const out = rows
          .map((x) => ({ t: new Date(x.timestamp_dados ?? x.created_at ?? x.timestamp ?? '').getTime(), d: x.dados ?? {} }))
          .filter((p) => Number.isFinite(p.t))
          .sort((a, b) => a.t - b.t);
        setPts(out);
      })
      .catch(() => { if (vivo) setPts([]); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [equipamentoId, ini, end, enabled]);
  return { pts, loading };
}

export type Periodo = 'hoje' | 'semana' | 'mes';
export function janela(p: Periodo): [Date, Date] {
  const fim = new Date();
  const ini = new Date(); ini.setHours(0, 0, 0, 0);
  if (p === 'semana') ini.setDate(ini.getDate() - 6);
  if (p === 'mes') ini.setDate(1);
  return [ini, fim];
}

export interface Serie { label: string; color: string; pick: (d: Obj) => number | null }

/** Média por balde de tempo (para não desenhar 20 mil pontos). */
export function bucketize(pts: HistPoint[], ini: number, fim: number, n: number, pick: (d: Obj) => number | null) {
  const step = (fim - ini) / n;
  const acc = Array.from({ length: n }, () => ({ s: 0, c: 0 }));
  for (const p of pts) {
    const i = Math.floor((p.t - ini) / step);
    if (i < 0 || i >= n) continue;
    const v = pick(p.d);
    if (v == null || !Number.isFinite(v)) continue;
    acc[i].s += v; acc[i].c += 1;
  }
  return acc.map((a) => (a.c ? a.s / a.c : null));
}

function eixoX(p: Periodo, ini: Date, fim: Date): Array<{ f: number; label: string }> {
  if (p === 'hoje') return [0, 6, 12, 18, 24].map((h) => ({ f: h / 24, label: `${String(h).padStart(2, '0')}h` }));
  const span = fim.getTime() - ini.getTime();
  const n = 4;
  return Array.from({ length: n + 1 }, (_, i) => {
    const d = new Date(ini.getTime() + (span * i) / n);
    return { f: i / n, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) };
  });
}

/** Gráfico de linhas recolhível (fechado por padrão; histórico só é buscado ao abrir). */
export function CollapsibleChart({ equipamentoId, title, summary, series, unit = 'kW' }: {
  equipamentoId: string; title: string; summary?: ReactNode; series: Serie[]; unit?: string;
}) {
  const [open, setOpen] = useState(false);
  const [per, setPer] = useState<Periodo>('hoje');
  const [ini, fim] = useMemo(() => {
    const [a, b] = janela(per);
    if (per === 'hoje') { const e = new Date(a); e.setDate(e.getDate() + 1); return [a, e]; }
    return [a, b];
  }, [per, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pts, loading } = useHistorico(equipamentoId, ini, per === 'hoje' ? new Date() : fim, open);

  const W = 700, TOP = 10, BOT = 140, N = per === 'hoje' ? 96 : per === 'semana' ? 168 : 180;
  const linhas = useMemo(() => {
    if (!pts) return null;
    const vals = series.map((s) => bucketize(pts, ini.getTime(), fim.getTime(), N, s.pick));
    const max = Math.max(1, ...vals.flat().filter((v): v is number => v != null));
    const paths = vals.map((arr) => {
      let d = ''; let pen = false;
      arr.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        const x = ((i + 0.5) / N) * W, y = BOT - (v / max) * (BOT - TOP);
        d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `; pen = true;
      });
      return d;
    });
    return { paths, max, vazio: paths.every((p) => !p) };
  }, [pts, series, ini, fim, N]);

  return (
    <Card className="px-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="w-full min-h-[52px] flex items-center gap-3 text-left">
        <LineChart className="w-5 h-5 text-[#177A3C] dark:text-emerald-400" />
        <span className="flex-1 text-[15px] font-extrabold">{title}</span>
        {summary && <span className="text-[13px] text-muted-foreground">{summary}</span>}
        <ChevronDown className="w-[18px] h-[18px] text-muted-foreground transition-transform" style={{ transform: `rotate(${open ? 180 : 0}deg)` }} />
      </button>
      {open && (
        <div className="border-t border-border pt-3 pb-4 flex flex-col gap-2">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <Segmented<Periodo> size="sm" value={per} onChange={setPer} options={[{ v: 'hoje', label: 'Hoje' }, { v: 'semana', label: 'Semana' }, { v: 'mes', label: 'Mês' }]} />
            <span className="flex items-center gap-3.5 text-[13px] text-muted-foreground">
              {series.map((s) => (
                <span key={s.label} className="flex items-center gap-1.5"><span className="w-2.5 h-[3px] rounded" style={{ background: s.color }} />{s.label}</span>
              ))}
            </span>
          </div>
          {loading || !linhas ? (
            <div className="h-[170px] grid place-items-center text-xs text-muted-foreground">Carregando…</div>
          ) : linhas.vazio ? (
            <div className="h-[170px] grid place-items-center text-xs text-muted-foreground">Sem leituras no período</div>
          ) : (
            <svg viewBox={`0 0 ${W} 170`} width="100%" height="170" role="img" aria-label={title}>
              <line x1="0" x2={W} y1={TOP} y2={TOP} className="stroke-border" />
              <line x1="0" x2={W} y1={BOT} y2={BOT} className="stroke-border" />
              <text x="0" y="24" fontSize="11" className="fill-muted-foreground">{linhas.max.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {unit}</text>
              {linhas.paths.map((d, i) => d && (
                <path key={i} d={d} fill="none" stroke={series[i].color} strokeWidth={i ? 2 : 2.2} strokeLinejoin="round" />
              ))}
              {eixoX(per, ini, fim).map((t, i, a) => (
                <text key={i} x={t.f * W} y="160" fontSize="11" className="fill-muted-foreground" textAnchor={i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}>{t.label}</text>
              ))}
            </svg>
          )}
        </div>
      )}
    </Card>
  );
}

interface LogMqtt { id: string; mensagem?: string | null; severidade?: string | null; created_at?: string; regra?: { nome?: string | null } | null }

export interface RegistroExtra { t: number; txt: string; quem: string; ok?: boolean; ruim?: boolean }

/** Registros do equipamento: eventos das regras de log MQTT + extras (ex.: passos do comando). */
export function Registros({ equipamentoId, limite = 6, extra = [] }: { equipamentoId: string; limite?: number; extra?: RegistroExtra[] }) {
  const [rows, setRows] = useState<LogMqtt[] | null>(null);
  useEffect(() => {
    let vivo = true;
    api.get('/logs-mqtt', { params: { equipamentoId: equipamentoId.trim(), limit: limite, page: 1 } })
      .then((r) => { if (vivo) { const d = unwrap<LogMqtt[] | { data?: LogMqtt[] }>(r); setRows(Array.isArray(d) ? d : d?.data ?? []); } })
      .catch(() => { if (vivo) setRows([]); });
    return () => { vivo = false; };
  }, [equipamentoId, limite]);
  const todos: RegistroExtra[] = useMemo(() => [
    ...extra,
    ...(rows ?? []).map((l) => {
      const sev = String(l.severidade ?? '').toUpperCase();
      return { t: l.created_at ? new Date(l.created_at).getTime() : 0, txt: l.mensagem ?? l.regra?.nome ?? 'Evento', quem: l.regra?.nome ?? 'Sistema', ruim: sev === 'CRITICA' || sev === 'CRÍTICA' || sev === 'ALTA' };
    }),
  ].sort((x, y) => y.t - x.t).slice(0, Math.max(limite, extra.length)), [rows, extra, limite]);
  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3">
        <span className="text-[15px] font-extrabold">Registros</span>
        <Link to={`/logs/logs-mqtt?equipamentoId=${encodeURIComponent(equipamentoId.trim())}`} className="text-[13px] font-bold text-[#177A3C] dark:text-emerald-400 no-underline">Ver todos ›</Link>
      </div>
      <div className="grid grid-cols-[120px_1fr_160px_28px] gap-3 px-4 py-2 text-[11px] font-bold text-muted-foreground tracking-[0.4px] border-t">
        <span>DATA/HORA</span><span>EVENTO</span><span>ORIGEM</span><span />
      </div>
      {rows == null && !extra.length ? (
        <div className="px-4 py-3 border-t text-sm text-muted-foreground">Carregando…</div>
      ) : todos.length === 0 ? (
        <div className="px-4 py-3 border-t text-sm text-muted-foreground">Nenhum registro deste equipamento.</div>
      ) : todos.map((l, i) => (
        <div key={i} className={`grid grid-cols-[120px_1fr_160px_28px] gap-3 items-center px-4 py-2.5 border-t ${l.ruim ? 'bg-red-500/[0.06]' : ''}`}>
          <span className="text-[13px] text-muted-foreground tabular-nums">{l.t ? new Date(l.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—'}</span>
          <span className={`text-sm ${l.ruim ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>{l.txt}</span>
          <span className="text-[13px] text-muted-foreground truncate">{l.quem}</span>
          <span className="flex justify-center">
            {l.ok && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F7A43" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Confirmado pelo equipamento"><path d="M2 13l4 4 8-9" /><path d="M10 15l2 2 8-9" /></svg>
            )}
          </span>
        </div>
      ))}
    </Card>
  );
}

/** A resposta de /custos-energia vem com ou sem envelope. */
export function custosDe(r: unknown): CustosEnergiaResponseDto | null {
  const d = (r as { custos?: unknown })?.custos ? r : unwrap(r);
  return (d as { custos?: unknown })?.custos ? (d as CustosEnergiaResponseDto) : null;
}

/** Custos por posto tarifário (/equipamentos-dados/:id/custos-energia). */
export function useCustos(equipamentoId: string | null | undefined, periodo: 'dia' | 'mes', data?: string, enabled = true) {
  const [res, setRes] = useState<CustosEnergiaResponseDto | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!equipamentoId || !enabled) return;
    let vivo = true;
    setErro(false);
    equipamentosDadosService.getCustosEnergia(equipamentoId, { periodo, ...(data ? { data } : {}) })
      .then((r) => {
        if (!vivo) return;
        setRes(custosDe(r));
      })
      .catch(() => { if (vivo) { setRes(null); setErro(true); } });
    return () => { vivo = false; };
  }, [equipamentoId, periodo, data, enabled]);
  return { res, erro };
}

/** Linhas por posto (Reservado/irrigante · Fora de ponta · Ponta) com kWh, R$/kWh e R$. */
export function linhasPosto(res: CustosEnergiaResponseDto | null) {
  if (!res) return [];
  const c = res.consumo, k = res.custos;
  const t = (kwh: number, rs: number) => (kwh > 0 ? rs / kwh : null);
  const out = [
    { k: 'Reservado irrigante', cor: 'bg-emerald-600', kwh: c.energia_irrigante_kwh, rs: k.custo_irrigante },
    { k: 'Reservado', cor: 'bg-emerald-400', kwh: c.energia_reservado_kwh, rs: k.custo_reservado },
    { k: 'Fora de ponta', cor: 'bg-blue-600', kwh: c.energia_fora_ponta_kwh, rs: k.custo_fora_ponta },
    { k: 'Ponta', cor: 'bg-red-600', kwh: c.energia_ponta_kwh, rs: k.custo_ponta },
  ].filter((r, i) => i !== 0 || (r.kwh ?? 0) > 0 || res.unidade?.irrigante);
  return out.map((r) => ({ ...r, tarifa: t(Number(r.kwh) || 0, Number(r.rs) || 0) }));
}

/** "18" → "18:00", 21.5 → "21:30". */
export const fmtHora = (h: number | null | undefined): string => {
  if (h == null || Number.isNaN(Number(h))) return '—';
  const hh = Math.floor(Number(h)), mm = Math.round((Number(h) - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export interface Horarios { ponta: [number, number]; reservado: [number, number] | null; daConcessionaria: boolean }

/** Janelas de ponta e reservado da concessionária ligada à unidade do equipamento. */
export function useHorarios(equipamentoId: string | null | undefined): Horarios {
  const [h, setH] = useState<Horarios>({ ponta: [18, 21], reservado: null, daConcessionaria: false });
  useEffect(() => {
    if (!equipamentoId) return;
    let vivo = true;
    equipamentosDadosService.getConfiguracaoCusto(equipamentoId)
      .then((r) => {
        type H = { horarios?: Record<string, unknown> };
        const hr = ((r as H)?.horarios ? (r as H) : unwrap<H>(r))?.horarios;
        if (!vivo || !hr) return;
        const p0 = num(hr.hora_inicio_ponta), p1 = num(hr.hora_fim_ponta);
        const r0 = num(hr.hora_inicio_reservado), r1 = num(hr.hora_fim_reservado);
        setH({
          ponta: p0 != null && p1 != null ? [p0, p1] : [18, 21],
          reservado: r0 != null && r1 != null ? [r0, r1] : null,
          daConcessionaria: p0 != null && p1 != null,
        });
      })
      .catch(() => { /* fica no padrão 18–21 */ });
    return () => { vivo = false; };
  }, [equipamentoId]);
  return h;
}

const dentro = (x: number, [a, b]: [number, number]) => (a <= b ? x >= a && x < b : x >= a || x < b);

/** Posto tarifário do horário (dias úteis; fim de semana = fora de ponta). */
export function postoEm(d: Date, h: Horarios): 'Ponta' | 'Reservado' | 'Fora de ponta' {
  const x = d.getHours() + d.getMinutes() / 60;
  const util = d.getDay() !== 0 && d.getDay() !== 6;
  if (util && dentro(x, h.ponta)) return 'Ponta';
  if (h.reservado && dentro(x, h.reservado)) return 'Reservado';
  return 'Fora de ponta';
}

export { num };
