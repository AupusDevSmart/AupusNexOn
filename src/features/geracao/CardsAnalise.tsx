import type { ReactNode } from 'react';
import { CalendarClock, CloudSun, Gauge, TrendingDown } from 'lucide-react';
import { formatEnergy } from '@/utils/formatEnergy';
import type { AnaliseGeracao, CategoriaPerda } from './api';
import { brl, nf } from './formato';

/**
 * Cards da análise de geração (NEXON-16, seções 5.2–5.5): Resumo, Perdas, Fechamento do mês e
 * Previsão de amanhã. Só geração (inversores). R$ sempre rotulado "estimado".
 */

const kwh = (v: number | null | undefined) => (v == null ? '—' : formatEnergy(v, v >= 1000 ? 2 : 1));

function Card({ icone, titulo, children, className = '' }: { icone: ReactNode; titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icone}
        {titulo}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Estimado() {
  return <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">estimado</span>;
}

function Metrica({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{rotulo}</div>
      <div className="truncate text-lg font-bold tabular-nums">{valor}</div>
      {detalhe && <div className="text-[11px] text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

const ROTULO_PERIODO: Record<AnaliseGeracao['periodo'], string> = { dia: 'no dia', semana: 'na semana', mes: 'no mês', ano: 'no ano', total: 'no total' };

// Colunas do Resumo = nº de métricas visíveis (sem fonte/R$ são só 2 — não reservar 4).
const COLS_RESUMO: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };

/** 5.2 — substitui "Energia total". */
export function CardResumo({ a }: { a: AnaliseGeracao }) {
  const r = a.resumo;
  if (!r) return null;
  const comFonte = a.config.fonte !== 'nenhuma';
  return (
    <Card icone={<Gauge className="h-3.5 w-3.5" />} titulo={`Geração ${ROTULO_PERIODO[a.periodo]}`}>
      <div className={`grid grid-cols-2 gap-3 ${COLS_RESUMO[2 + (comFonte ? 1 : 0) + (a.config.exibir_rs && r.valor_rs != null ? 1 : 0)]}`}>
        <Metrica
          rotulo="Energia gerada"
          valor={kwh(r.energia_kwh)}
          detalhe={a.periodo !== 'dia' ? `${r.dias_com_dados} de ${r.dias_no_periodo} dias com dados` : undefined}
        />
        <Metrica rotulo="kWh/kWp" valor={r.kwh_kwp != null ? nf(r.kwh_kwp, 2) : '—'} detalhe={a.config.kwp_dc ? `${nf(a.config.kwp_dc, 0)} kWp` : 'kWp não cadastrado'} />
        {comFonte && (
          <Metrica
            rotulo="Do esperado"
            valor={r.pct_esperado != null ? `${nf(r.pct_esperado, 1)}%` : '—'}
            detalhe={r.esperado_kwh != null ? `esperado ${kwh(r.esperado_kwh)}` : undefined}
          />
        )}
        {a.config.exibir_rs && r.valor_rs != null && (
          <Metrica rotulo="Valor" valor={<>{brl(r.valor_rs)}<Estimado /></>} detalhe={a.config.tarifa_rs_kwh ? `R$ ${nf(a.config.tarifa_rs_kwh, 2)}/kWh` : undefined} />
        )}
      </div>
    </Card>
  );
}

const COR_PERDA: Record<CategoriaPerda['chave'], string> = {
  indisponibilidade: 'bg-red-500',
  limitacao_externa: 'bg-amber-500',
  limitacao_projeto: 'bg-sky-400',
  outras: 'bg-slate-400',
};

/** 5.3 — só com fonte de irradiância. */
export function CardPerdas({ a }: { a: AnaliseGeracao }) {
  const p = a.perdas;
  if (!p) return null;
  const total = Math.max(p.esperado_kwh, p.real_kwh + p.categorias.reduce((s, c) => s + c.kwh, 0), 1);
  const largura = (v: number) => `${Math.max(0, (v / total) * 100)}%`;
  return (
    <Card icone={<TrendingDown className="h-3.5 w-3.5" />} titulo={`Perdas ${ROTULO_PERIODO[a.periodo]}`}>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>Esperado <b className="tabular-nums">{kwh(p.esperado_kwh)}</b></span>
        <span>Real <b className="tabular-nums">{kwh(p.real_kwh)}</b> <span className="text-muted-foreground">({p.esperado_kwh > 0 ? nf((p.real_kwh / p.esperado_kwh) * 100, 1) : '—'}%)</span></span>
      </div>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10" role="img" aria-label="Energia real e perdas em relação ao esperado">
        <div className="h-full bg-emerald-500" style={{ width: largura(p.real_kwh) }} />
        {p.categorias.map((c) => <div key={c.chave} className={`h-full ${COR_PERDA[c.chave]}`} style={{ width: largura(c.kwh) }} />)}
      </div>
      <ul className="mt-3 divide-y text-sm">
        {p.categorias.map((c) => (
          <li key={c.chave} className="flex items-center gap-2 py-1.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${COR_PERDA[c.chave]}`} />
            <span className="min-w-0 flex-1 truncate">
              {c.rotulo}
              {c.informativo && <span className="ml-1.5 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-700 dark:text-sky-300">informativo</span>}
            </span>
            <span className="tabular-nums">{kwh(c.kwh)}</span>
            <span className="w-14 text-right tabular-nums text-muted-foreground">{nf(c.pct, 1)}%</span>
            {a.config.exibir_rs && <span className="hidden w-24 text-right tabular-nums text-muted-foreground sm:inline">{c.valor_rs != null ? brl(c.valor_rs) : '—'}</span>}
          </li>
        ))}
      </ul>
      {a.config.exibir_rs && <p className="mt-1 text-[11px] text-muted-foreground">Valores em R$ estimados pela tarifa de referência.</p>}
    </Card>
  );
}

/** 5.4 — sempre o mês corrente, sem meta. */
export function CardFechamento({ a }: { a: AnaliseGeracao }) {
  const f = a.fechamento;
  if (!f) return null;
  const [ano, mes] = f.mes.split('-').map(Number);
  const nomeMes = new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  return (
    <Card icone={<CalendarClock className="h-3.5 w-3.5" />} titulo={`Fechamento de ${nomeMes}`}>
      {!f.disponivel || f.estimativa_kwh == null ? (
        <p className="text-sm text-muted-foreground">{f.motivo ?? 'Ainda sem estimativa.'}</p>
      ) : (
        <>
          <div className="text-2xl font-bold tabular-nums">
            {kwh(f.estimativa_kwh)}
            {f.faixa_kwh != null && <span className="ml-1.5 text-sm font-medium text-muted-foreground">± {kwh(f.faixa_kwh)}</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {kwh(f.acumulado_kwh)} em {f.dias_decorridos} de {f.dias_do_mes} dias
            {f.usa_historico ? ' · com o histórico do mesmo mês' : ''}
          </div>
          {a.config.exibir_rs && f.valor_rs != null && <div className="mt-1 text-sm">{brl(f.valor_rs)}<Estimado /></div>}
        </>
      )}
    </Card>
  );
}

/** 5.5 — só com fonte satélite ou solarímetro. */
export function CardPrevisao({ a }: { a: AnaliseGeracao }) {
  const p = a.previsao_amanha;
  if (a.config.fonte === 'nenhuma') return null;
  return (
    <Card icone={<CloudSun className="h-3.5 w-3.5" />} titulo="Previsão de amanhã">
      {!p ? (
        <p className="text-sm text-muted-foreground">Previsão ainda não disponível (atualiza às 18h).</p>
      ) : (
        <>
          <div className="text-2xl font-bold tabular-nums">{kwh(p.energia_kwh)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {p.data.split('-').reverse().join('/')} · previsão do tempo{a.config.kwp_dc ? ` · ${nf(p.energia_kwh / a.config.kwp_dc, 2)} kWh/kWp` : ''}
          </div>
          {a.config.exibir_rs && p.valor_rs != null && <div className="mt-1 text-sm">{brl(p.valor_rs)}<Estimado /></div>}
        </>
      )}
    </Card>
  );
}
