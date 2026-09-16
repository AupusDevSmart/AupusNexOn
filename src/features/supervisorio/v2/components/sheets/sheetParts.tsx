import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { api } from '@/config/api';

/**
 * Primitivos compartilhados dos sheets de equipamento do unifilar (Fase 6 —
 * reestruturação IoT). Reproduzem a linguagem visual dos mockups do chefe
 * (arquivos/nexon-web-*.html) usando os tokens/Tailwind do app. Data-driven:
 * os sheets montam blocos a partir da telemetria de /equipamentos/:id/dados/atual.
 */

export const fmt = (n: unknown, d = 1): string =>
  n == null || n === '' || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Resolve 'energy.daily_yield' de um objeto aninhado OU de chave achatada com ponto. */
export function getPath(obj: any, path: string): any {
  if (obj == null || !path) return undefined;
  if (obj[path] !== undefined) return obj[path]; // chave achatada "a.b"
  return path.split('.').reduce((o: any, k: string) => (o == null ? undefined : o[k]), obj);
}

/** Assina a telemetria ao vivo de um equipamento (refresh periódico). */
export function useDados(equipamentoId?: string | null, intervalMs = 15000) {
  const [dados, setDados] = useState<Record<string, any> | null>(null);
  const [ts, setTs] = useState<string | null>(null);
  useEffect(() => {
    if (!equipamentoId) { setDados(null); return; }
    let vivo = true;
    const load = () =>
      api.get(`/equipamentos/${equipamentoId.trim()}/dados/atual`)
        .then((r) => {
          if (!vivo) return;
          const dado = r?.data?.dado ?? r?.data?.data?.dado ?? null;
          setDados((dado?.dados ?? null) as any);
          setTs((dado?.created_at ?? dado?.timestamp ?? null) as any);
        })
        .catch(() => { if (vivo) setDados(null); });
    load();
    const t = setInterval(load, intervalMs);
    return () => { vivo = false; clearInterval(t); };
  }, [equipamentoId, intervalMs]);
  return { dados, ts };
}

/** Idade legível de uma leitura (ms → "agora"/"há 5 min"/"há 3 h"/"há 23 dias"). */
function idadeTexto(ms: number): string {
  if (ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  return `há ${dias} dia${dias > 1 ? 's' : ''}`;
}

/**
 * Frescor da última leitura. Antes os sheets marcavam "Online" só por existir
 * uma última leitura no banco e mostravam SÓ a hora (`toLocaleTimeString`) — uma
 * leitura de dias atrás parecia de agora. Aqui:
 *   - `online`: leitura dentro da janela (default 30 min, igual ao alerta de offline);
 *   - `label`: "Atualizado HH:MM:SS" se é de hoje, senão "Última leitura DD/MM/AAAA HH:MM" (com a DATA);
 *   - `idade`: "há 23 dias" p/ o badge quando offline.
 */
export function tsInfo(ts?: string | null, staleMs = 30 * 60 * 1000): {
  online: boolean; hasTs: boolean; label: string; idade: string;
} {
  if (!ts) return { online: false, hasTs: false, label: 'Sem leitura', idade: '' };
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return { online: false, hasTs: false, label: 'Sem leitura', idade: '' };
  const ms = Date.now() - d.getTime();
  const online = ms >= 0 && ms < staleMs;
  const mesmoDia = d.toDateString() === new Date().toDateString();
  const hora = d.toLocaleTimeString('pt-BR', mesmoDia
    ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' });
  const label = mesmoDia ? `Atualizado ${hora}` : `Última leitura ${d.toLocaleDateString('pt-BR')} ${hora}`;
  return { online, hasTs: true, label, idade: idadeTexto(ms) };
}

/** Badge padrão de frescor (verde Online / cinza Offline·idade / mudo Sem dados). */
export function BadgeFrescor({ info }: { info: ReturnType<typeof tsInfo> }) {
  if (info.online) return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Online</span>;
  if (info.hasTs) return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Offline · {info.idade}</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Sem dados</span>;
}

export interface Tab { key: string; label: string }

/** Casca do sheet: Dialog grande + header fixo + tabs opcionais + corpo rolável. */
export function SheetShell({
  title, subtitle, badge, tabs, activeTab, onTab, onClose, children,
}: {
  title: string; subtitle?: string; badge?: ReactNode;
  tabs?: Tab[]; activeTab?: string; onTab?: (k: string) => void;
  onClose: () => void; children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-2xl w-[94vw] p-0 gap-0 overflow-hidden flex flex-col rounded-l-2xl shadow-2xl"
      >
        <div className="px-5 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold flex-1 truncate">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          {tabs && tabs.length > 0 && (
            <div className="mt-3 flex gap-1 bg-muted/50 rounded-lg p-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onTab?.(t.key)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${activeTab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Corpo rolável: scrollbar visível + fade no rodapé (dica de "tem mais abaixo")
            + tabIndex p/ rolar com as setas do teclado (sem anel de foco). */}
        <div className="relative flex-1 min-h-0">
          <div
            tabIndex={0}
            className="h-full overflow-y-auto overflow-x-hidden px-5 pb-10 pt-2 outline-none [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40"
          >
            {children}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-bl-2xl bg-gradient-to-t from-background via-background/85 to-transparent" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Título de bloco (uppercase, mudo) — igual aos <h4> do mockup. */
export function GrupoTitulo({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-2">
      <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold flex-1">{children}</h4>
      {right}
    </div>
  );
}

/** Hero de estado: bolinha + rótulo + barras de sinal + porcentagem. */
export function EstadoHero({
  label, sub, tone = 'ok', pct, bars,
}: { label: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' | 'off'; pct?: number; bars?: number }) {
  const dot = tone === 'bad' ? 'bg-red-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'off' ? 'bg-muted-foreground/50' : 'bg-emerald-500';
  const fill = tone === 'bad' ? 'bg-red-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-primary';
  const b = bars ?? (pct != null ? 3 : 0);
  return (
    <div className="rounded-lg border p-3.5 flex items-center gap-3">
      <span className={`w-3 h-3 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <b className="text-base">{label}</b>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {b > 0 && (
        <div className="flex gap-1">
          {Array.from({ length: b }).map((_, i) => {
            const f = pct != null ? Math.min(1, Math.max(0, (pct / 100 - i / b) * b)) : 1;
            return (
              <span key={i} className="w-6 h-1.5 rounded-full bg-muted overflow-hidden relative">
                <span className={`absolute inset-0 origin-left ${fill}`} style={{ transform: `scaleX(${f.toFixed(2)})` }} />
              </span>
            );
          })}
        </div>
      )}
      {pct != null && <span className="text-sm font-bold w-10 text-right">{Math.round(pct)}%</span>}
    </div>
  );
}

export interface Kpi { label: string; value: ReactNode; unit?: string; hint?: string }
export function KpiGrid({ items, cols = 2 }: { items: Kpi[]; cols?: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map((k, i) => (
        <div key={i} className="rounded-lg border p-3">
          <div className="text-[11px] text-muted-foreground">{k.label}</div>
          <div className="text-xl font-bold mt-0.5">{k.value} {k.unit && <em className="not-italic text-xs font-medium text-muted-foreground">{k.unit}</em>}</div>
          {k.hint && <div className="text-[11px] text-muted-foreground mt-0.5">{k.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export interface Row { k: ReactNode; sub?: string; v: ReactNode; mute?: boolean }
/** Tabela chave→valor (bloco de dados). */
export function Section({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border divide-y text-sm">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start px-3.5 py-2 gap-3">
          <div className="flex-1 text-muted-foreground">
            {r.k}{r.sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{r.sub}</div>}
          </div>
          <div className={`text-right font-semibold ${r.mute ? 'font-normal text-muted-foreground' : ''}`}>{r.v}</div>
        </div>
      ))}
    </div>
  );
}

/** Tabela de fases: Fase | Tensão | Corrente (usada por inversor/medidor). */
export function FasesTable({
  head, rows,
}: { head: [string, ReactNode, ReactNode]; rows: Array<[string, ReactNode, ReactNode]> }) {
  return (
    <div className="rounded-lg border overflow-hidden text-sm">
      <div className="flex bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground px-3.5 py-2">
        <div className="flex-1">{head[0]}</div><div className="flex-1 text-right">{head[1]}</div><div className="flex-1 text-right">{head[2]}</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex px-3.5 py-2 border-t">
          <div className="flex-1 text-muted-foreground">{r[0]}</div>
          <div className="flex-1 text-right font-medium">{r[1]}</div>
          <div className="flex-1 text-right font-medium">{r[2]}</div>
        </div>
      ))}
    </div>
  );
}

/** Linha expansível (ex.: Tensão por MPPT / Corrente por string). */
export function Expandable({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm bg-muted/30 hover:bg-muted/50">
        <span>{title}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">{right}<span className="inline-block transition-transform" style={{ transform: `rotate(${open ? 180 : 0}deg)` }}>⌄</span></span>
      </button>
      {open && <div className="divide-y">{children}</div>}
    </div>
  );
}

/** Mini gráfico de área (curva do dia). Aceita série de números. */
export function MiniChart({ serie, unit }: { serie: number[]; unit?: string }) {
  const path = useMemo(() => {
    const d = serie.filter((v) => Number.isFinite(v));
    if (d.length < 2) return null;
    const w = 380, h = 96, pad = 6, mn = Math.min(0, ...d), mx = Math.max(...d, 1);
    const pts = d.map((v, i) => [pad + (i * (w - 2 * pad)) / (d.length - 1), h - pad - ((v - mn) / (mx - mn || 1)) * (h - 2 * pad)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
    return { line, area, w, h };
  }, [serie]);
  if (!path) return <div className="h-24 grid place-items-center text-xs text-muted-foreground rounded-lg border">Sem dados de curva {unit ? `(${unit})` : ''}</div>;
  return (
    <div className="rounded-lg border p-3">
      <svg width="100%" viewBox={`0 0 ${path.w} ${path.h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <path d={path.area} fill="currentColor" className="text-primary/15" />
        <path d={path.line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" className="text-primary" />
      </svg>
    </div>
  );
}
