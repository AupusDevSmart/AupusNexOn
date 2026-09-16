import { useEffect, useState } from 'react';
import { Activity, CircleDot, Gauge, Square, Sun, Zap } from 'lucide-react';
import { api } from '@/config/api';

/**
 * Cards-ícone dos equipamentos do unifilar com SCS habilitado, na Visão Geral.
 * Mostra um card pequeno por equipamento (ícone + nome + estado) com 1–2 grandezas
 * curtas conforme o tipo (inversor: Geração dia/Potência; medidor: Potência/FP; os
 * demais: capacidades SCS). Fonte: GET /iot/unidade/:id/elementos-scs (escopado por dono).
 * Auto-esconde quando a unidade não tem elemento com SCS.
 */
interface ElementoScs {
  equipamento_id: string;
  rotulo: string;
  tipo: string | null;
  comando: boolean;
  status: boolean;
  medicao: boolean;
  dados: Record<string, any> | null;
  ts: string | null;
}

const getPath = (obj: any, path: string): any => {
  if (obj == null || !path) return undefined;
  if (obj[path] !== undefined) return obj[path];
  return path.split('.').reduce((o: any, k: string) => (o == null ? undefined : o[k]), obj);
};

const nf = (v: unknown, d = 0): string => {
  const n = Number(v);
  return v == null || v === '' || Number.isNaN(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
};

function IconeDoTipo(tipo: string | null) {
  const t = (tipo ?? '').toLowerCase();
  if (t.includes('inversor')) return Zap;
  if (t.includes('medidor') || t.includes('power meter') || t.includes('multimedidor') || t === 'pm') return Gauge;
  if (t.includes('disjuntor')) return Square;
  if (t.includes('motor')) return CircleDot;
  if (t.includes('piv')) return Sun;
  return Activity;
}

// Grandezas curtas por tipo. Inversor e medidor têm telemetria elétrica garantida;
// os demais caem para as capacidades SCS (Med/Cmd/Sts) até termos os pontos.
function metricas(el: ElementoScs): Array<{ k: string; v: string }> {
  const g = (p: string) => getPath(el.dados, p);
  const t = (el.tipo ?? '').toLowerCase();
  if (t.includes('inversor')) {
    return [
      { k: 'Geração dia', v: `${nf(g('energy.daily_yield'))} kWh` },
      { k: 'Potência', v: `${nf(g('power.active_total'), 1)} kW` },
    ];
  }
  if (t.includes('medidor') || t.includes('power meter') || t.includes('multimedidor') || t === 'pm') {
    const pt = g('Pt');
    return [
      { k: 'Potência', v: pt != null ? `${nf(Number(pt) / 1000, 1)} kW` : '—' },
      { k: 'FP', v: nf(g('FPt'), 2) },
    ];
  }
  const caps = [el.medicao && 'Med', el.comando && 'Cmd', el.status && 'Sts'].filter(Boolean).join(' · ');
  return [{ k: 'SCS', v: caps || '—' }];
}

// Frescor simples (30 min) — alinhado ao alerta de offline.
const online = (ts: string | null): boolean => {
  if (!ts) return false;
  const ms = Date.now() - new Date(ts).getTime();
  return ms >= 0 && ms < 30 * 60 * 1000;
};

export function ElementosScsCards({ unidadeId }: { unidadeId: string }) {
  const [els, setEls] = useState<ElementoScs[] | null>(null);

  useEffect(() => {
    let vivo = true;
    const load = () =>
      api.get(`/iot/unidade/${unidadeId.trim()}/elementos-scs`)
        .then((r) => { if (vivo) setEls(((r?.data?.data ?? r?.data)?.elementos ?? []) as ElementoScs[]); })
        .catch(() => { if (vivo) setEls([]); });
    load();
    const t = setInterval(load, 30_000);
    return () => { vivo = false; clearInterval(t); };
  }, [unidadeId]);

  if (!els || els.length === 0) return null;

  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Equipamentos</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {els.map((el) => {
          const Icone = IconeDoTipo(el.tipo);
          const on = online(el.ts);
          return (
            <div key={el.equipamento_id} className="rounded-lg border bg-card p-2.5">
              <div className="flex items-center gap-1.5">
                <Icone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs font-semibold" title={el.rotulo}>{el.rotulo}</span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                <span className="text-[11px] text-muted-foreground">{on ? 'Normal' : 'Sem comunicação'}</span>
              </div>
              <div className="mt-1.5 space-y-0.5">
                {metricas(el).map((m, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">{m.k}</span>
                    <span className="text-xs font-semibold tabular-nums">{m.v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ElementosScsCards;
