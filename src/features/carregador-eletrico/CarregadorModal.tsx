import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/config/api';
import { fmt } from '@/features/supervisorio/v2/components/sheets/sheetParts';
import {
  EquipShell, Pill, Card, SectionLabel, StatusLine, BigButton, FieldRow, Segmented, SubDialog, DialogButtons,
  useHistorico, bucketize, brl, unwrap, ACAO,
} from '@/features/supervisorio/v2/components/sheets/equipUi';

/**
 * Modal do Carregador (condomínio) — mockup "Web — Modal do Carregador" (NEXON-5).
 * Operação: herói com carro e bateria, status, energia e valor estimado da recarga,
 * curva de potência, Iniciar recarga (libera no nome do morador) / Pedir a vaga,
 * histórico de recargas e exportação para a contabilidade.
 * Configuração: valor do kWh, dados do carregador e moradores autorizados.
 *
 * Parar recarga: POST /carregador-eletrico/:id/parar (corta o contator e fecha a sessão).
 * A API não lê a bateria do carro nem edita o valor do kWh pela tela: ficam como leitura/"—".
 */

interface Carregador { id: string; nome: string; unidade_nome?: string; planta_id?: string }
interface CarregadorInfo extends Carregador { potencia_kw?: number | string | null; tarifa_kwh?: number | string | null }
interface Morador { id: string; nome: string; apartamento?: string | null; tag_uid?: string | null }
interface Sessao {
  id: string; morador_nome?: string | null; status?: string; kwh_total?: number | string | null;
  inicio?: string | null; fim?: string | null; ocioso_inicio?: string | null; ocioso_por_nome?: string | null;
}
interface Estado {
  estado?: string; fonte_kwh?: string; tarifa_kwh?: number | string | null; soc?: number | string | null;
  sessao_ativa?: Sessao | null; sessoes?: Sessao[];
}
interface LinhaExport { morador?: string | null; kwh: number | string; ocioso_min: number | string; valor_reais: number | string }
const erroMsg = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || padrao;

const STYLE = `
@keyframes nxFlowW{from{background-position:0 0}to{background-position:28px 0}}
.nxw-flow{animation:nxFlowW 1s linear infinite}
@media (prefers-reduced-motion: reduce){.nxw-flow,.nxw-pulse{animation:none}}
`;

/** "09/10 18:40" → Date (ano corrente; se cair no futuro, ano anterior). */
function parseDm(s?: string | null): Date | null {
  const m = /^(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]));
  if (d.getTime() - now.getTime() > 86400000) d.setFullYear(d.getFullYear() - 1);
  return d;
}
const dur = (a: Date | null, b: Date | null) => {
  if (!a || !b) return '—';
  const min = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function Heroi({ carregando, soc, eta }: { carregando: boolean; soc: number | null; eta: string }) {
  const led = carregando ? '#2E8B47' : '#B9BDCB';
  const w = soc != null ? Math.max(4, soc) : carregando ? 100 : 4;
  return (
    <Card className="rounded-2xl p-5 flex flex-col items-center gap-3.5">
      <svg viewBox="0 0 300 110" width="300" height="110" role="img" aria-label={carregando ? 'Carro conectado, carregando' : 'Carregador disponível'} className="max-w-full">
        <rect x="250" y="24" width="34" height="70" rx="8" fill="#E3E5EC" stroke="#B9BDCB" />
        <rect x="258" y="34" width="18" height="12" rx="3" fill={led} />
        <path d="M267 94 C267 104 236 104 222 86" fill="none" stroke="#B9BDCB" strokeWidth="4" strokeLinecap="round" />
        <path d="M22 78 L30 56 C34 46 42 40 54 38 L96 32 C110 30 124 30 136 36 L170 54 L206 60 C216 62 224 70 224 80 L224 84 L22 84 Z" fill="#E3E5EC" stroke="#9A9EB0" strokeWidth="1.5" />
        <path d="M58 44 L98 38 C108 37 118 38 126 42 L150 54 L58 54 Z" fill="#FFFFFF" opacity="0.9" />
        <circle cx="62" cy="86" r="16" fill="#FFFFFF" stroke="#6B6F86" strokeWidth="3" />
        <circle cx="186" cy="86" r="16" fill="#FFFFFF" stroke="#6B6F86" strokeWidth="3" />
        <circle cx="62" cy="86" r="5" fill="#6B6F86" />
        <circle cx="186" cy="86" r="5" fill="#6B6F86" />
        {carregando && <path className="animate-pulse" d="M126 58 L116 72 L124 72 L118 84 L132 68 L124 68 Z" fill="#2E8B47" />}
      </svg>
      <div className="w-full flex items-center gap-2">
        <div className="flex-1 h-9 rounded-xl border-2 border-[#B9BDCB] p-[3px] overflow-hidden">
          <div
            className={carregando ? 'nxw-flow h-full rounded-lg' : 'h-full rounded-lg'}
            style={carregando
              ? { width: `${w}%`, backgroundColor: '#2E8B47', backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.25) 0 7px, transparent 7px 14px)', backgroundSize: '28px 100%' }
              : { width: `${w}%`, background: '#C9CDD8' }}
          />
        </div>
        <div className="w-1.5 h-3.5 rounded-r bg-[#B9BDCB]" />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[46px] leading-[50px] font-extrabold tabular-nums tracking-tight">{soc != null ? `${Math.round(soc)}%` : '—'}</span>
        <span className="text-sm text-muted-foreground text-center">{eta}</span>
      </div>
    </Card>
  );
}

function Curva({ equipamentoId, inicio }: { equipamentoId: string; inicio: Date | null }) {
  const [ini, fim] = useMemo(() => {
    const a = inicio ?? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    return [a, new Date()];
  }, [inicio]);
  const { pts } = useHistorico(equipamentoId, ini, fim);
  const N = 60, W = 330, TOP = 20, BOT = 118;
  const vals = pts ? bucketize(pts, ini.getTime(), fim.getTime(), N, (d) => {
    const v = Number(d?.Pt ?? d?.potencia ?? d?.power); return Number.isFinite(v) ? (Math.abs(v) > 100 ? v / 1000 : v) : null;
  }) : [];
  const max = Math.max(1, ...vals.filter((v): v is number => v != null));
  let line = ''; let first: number | null = null; let last: number | null = null;
  vals.forEach((v, i) => {
    if (v == null) return;
    const x = ((i + 0.5) / N) * W, y = BOT - (v / max) * (BOT - TOP);
    line += `${first == null ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
    if (first == null) first = x; last = x;
  });
  const hm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <Card className="px-4 pt-3.5 pb-2.5 flex-1 flex flex-col">
      <span className="text-[15px] font-extrabold">Curva de potência</span>
      {pts == null ? <div className="h-[150px] grid place-items-center text-xs text-muted-foreground">Carregando…</div>
        : !line ? <div className="h-[150px] grid place-items-center text-xs text-muted-foreground text-center">Sem leitura de potência {inicio ? 'nesta recarga' : 'hoje'}</div>
          : (
            <svg viewBox={`0 0 ${W} 150`} width="100%" height="150" className="block mt-2" role="img" aria-label="Curva de potência da recarga">
              <text x="0" y="12" fontSize="11" className="fill-muted-foreground">{fmt(max, 1)} kW</text>
              <line x1="0" x2={W} y1={TOP} y2={TOP} className="stroke-border" />
              <line x1="0" x2={W} y1={BOT} y2={BOT} className="stroke-border" />
              <path d={`${line}L${last} ${BOT} L${first} ${BOT} Z`} fill="rgba(46,139,71,0.18)" />
              <path d={line} fill="none" stroke="#2E8B47" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <text x="0" y="140" fontSize="11" className="fill-muted-foreground">{hm(ini)}</text>
              <text x={W} y="140" fontSize="11" className="fill-muted-foreground" textAnchor="end">agora</text>
            </svg>
          )}
    </Card>
  );
}

export function CarregadorModal({ carregador, open, onOpenChange }: { carregador: Carregador | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [aba, setAba] = useState('op');
  const [estado, setEstado] = useState<Estado | null>(null);
  const [info, setInfo] = useState<CarregadorInfo | null>(null);
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [plantaId, setPlantaId] = useState<string | undefined>(carregador?.planta_id);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [modal, setModal] = useState<null | 'iniciar' | 'vaga' | 'parar' | 'export'>(null);
  const [moradorSel, setMoradorSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [novo, setNovo] = useState<null | { nome: string; apartamento: string; tag_uid: string }>(null);
  // Exportação
  const mesesOpc = useMemo(() => {
    const h = new Date();
    return [2, 1, 0].map((k) => new Date(h.getFullYear(), h.getMonth() - k, 1));
  }, []);
  const [mesExp, setMesExp] = useState(ymd(mesesOpc[1]));
  const [formato, setFormato] = useState<'xlsx' | 'csv'>('xlsx');
  const [exp, setExp] = useState<{ csv?: string; linhas: LinhaExport[] } | null>(null);
  const [baixado, setBaixado] = useState('');

  const id = carregador?.id;

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [e, cs] = await Promise.all([
        api.get(`/carregador-eletrico/${id}/estado`),
        api.get('/carregador-eletrico/carregadores'),
      ]);
      setEstado(unwrap<Estado>(e));
      const meu = (unwrap<CarregadorInfo[]>(cs) ?? []).find((c) => String(c.id).trim() === String(id).trim());
      setInfo(meu ?? null);
      const pid = meu?.planta_id ? String(meu.planta_id).trim() : carregador?.planta_id;
      if (pid) setPlantaId(pid);
      const m = await api.get('/carregador-eletrico/moradores', { params: pid ? { plantaId: pid } : undefined });
      setMoradores(unwrap<Morador[]>(m) ?? []);
    } catch { /* mantém o que tinha */ } finally { setLoading(false); }
  }, [id, carregador?.planta_id]);

  useEffect(() => { if (open) { setAba('op'); carregar(); } }, [open, carregar]);
  useEffect(() => {
    if (!open || !id) return;
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [open, id, carregar]);

  useEffect(() => {
    if (modal !== 'export') return;
    let vivo = true;
    setExp(null); setBaixado('');
    api.get('/carregador-eletrico/export', { params: { mes: mesExp, plantaId } })
      .then((r) => { if (vivo) { const d = unwrap<{ csv?: string; linhas?: LinhaExport[] }>(r); setExp({ csv: d?.csv, linhas: d?.linhas ?? [] }); } })
      .catch((e) => { if (vivo) { setExp({ linhas: [] }); setMsg(erroMsg(e, 'Falha ao montar a planilha')); } });
    return () => { vivo = false; };
  }, [modal, mesExp, plantaId]);

  if (!open || !carregador) return null;

  const sa = estado?.sessao_ativa;
  const carregando = !!sa;
  const sessoes: Sessao[] = estado?.sessoes ?? [];
  const tarifa = estado?.tarifa_kwh != null ? Number(estado.tarifa_kwh) : null;
  const kwhAtual = sa?.kwh_total != null ? Number(sa.kwh_total) : null;
  const inicioSa = parseDm(sa?.inicio);
  const potencia = info?.potencia_kw != null ? Number(info.potencia_kw) : null;
  const soc = estado?.soc != null ? Number(estado.soc) : null;

  const nomeEsc = (m: Morador) => `${m.apartamento ? `${m.apartamento} · ` : ''}${m.nome}`;
  const aptoDe = (nome?: string | null) => moradores.find((m) => m.nome === nome)?.apartamento;

  const fechar = () => { setModal(null); setMoradorSel(''); setBusy(false); };
  const executar = async () => {
    if (!moradorSel) { setMsg('Escolha o morador.'); return; }
    setBusy(true); setMsg('');
    try {
      if (modal === 'iniciar') {
        await api.post(`/carregador-eletrico/${id}/liberar`, { morador_id: moradorSel });
        setMsg('Recarga liberada.');
      } else {
        const r = await api.post(`/carregador-eletrico/${id}/pedir-vaga`, { morador_id: moradorSel });
        setMsg(unwrap<{ ocioso_iniciado?: boolean }>(r)?.ocioso_iniciado ? 'Vaga solicitada — tempo ocioso iniciado.' : 'Pedido registrado.');
      }
      fechar(); await carregar();
    } catch (e) { setMsg(erroMsg(e, 'Falha ao enviar')); setBusy(false); }
  };

  const parar = async () => {
    setBusy(true); setMsg('');
    try { await api.post(`/carregador-eletrico/${id}/parar`); setMsg('Recarga parada.'); fechar(); await carregar(); }
    catch (e) { setMsg(erroMsg(e, 'Falha ao parar a recarga')); setBusy(false); }
  };
  const addMorador = async () => {
    if (!novo?.nome.trim()) return;
    setMsg('');
    try {
      await api.post('/carregador-eletrico/moradores', { ...novo, tag_uid: novo.tag_uid.trim().toUpperCase() || null, planta_id: plantaId });
      setNovo(null); await carregar(); setMsg('Morador cadastrado.');
    } catch (e) { setMsg(erroMsg(e, 'Falha ao cadastrar')); }
  };
  const delMorador = async (mid: string) => {
    setMsg('');
    try { await api.delete(`/carregador-eletrico/moradores/${mid}`); await carregar(); }
    catch (e) { setMsg(erroMsg(e, 'Falha ao remover')); }
  };

  const baixar = async () => {
    if (!exp) return;
    const nomeArq = `recargas-${(carregador.nome || 'carregador').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${mesExp}`;
    if (formato === 'csv') {
      const blob = new Blob([exp.csv ?? ''], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `${nomeArq}.csv`; a.click(); URL.revokeObjectURL(url);
      setBaixado(`${nomeArq}.csv`);
    } else {
      const XLSX = await import('xlsx');
      const resumo = exp.linhas.map((r) => ({
        Morador: r.morador ?? '—', Apartamento: aptoDe(r.morador) ?? '', 'Energia (kWh)': Number(r.kwh), 'Ocioso (min)': Number(r.ocioso_min), 'Valor estimado (R$)': Number(r.valor_reais),
      }));
      const ws = XLSX.utils.json_to_sheet(resumo);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Resumo por morador');
      XLSX.writeFile(wb, `${nomeArq}.xlsx`);
      setBaixado(`${nomeArq}.xlsx`);
    }
  };

  const totKwh = (exp?.linhas ?? []).reduce((a, r) => a + Number(r.kwh || 0), 0);
  const totRs = (exp?.linhas ?? []).reduce((a, r) => a + Number(r.valor_reais || 0), 0);
  const mesLabel = (d: Date, i: number) => `${MES[d.getMonth()]}${i === 2 ? ' (parcial)' : ''}`;

  const hist = sessoes.map((s) => {
    const a = parseDm(s.inicio), b = parseDm(s.fim);
    const kwh = s.kwh_total != null ? Number(s.kwh_total) : null;
    const ativa = s.status === 'ativa';
    return {
      id: s.id,
      mor: s.morador_nome ? `${aptoDe(s.morador_nome) ? `${aptoDe(s.morador_nome)} · ` : ''}${s.morador_nome}` : '—',
      data: a ? (a.toDateString() === new Date().toDateString() ? 'Hoje' : a.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })) : '—',
      per: `${a ? a.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'} → ${ativa ? 'em andamento' : b ? b.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}`,
      dur: dur(a, ativa ? new Date() : b),
      kwh: kwh != null ? `${fmt(kwh, 1)} kWh` : '—',
      rs: kwh != null && tarifa != null ? brl(kwh * tarifa) : '—',
    };
  });
  const histKwh = sessoes.reduce((a, s) => a + Number(s.kwh_total || 0), 0);

  const eta = carregando
    ? `${sa.morador_nome ? `${aptoDe(sa.morador_nome) ? `${aptoDe(sa.morador_nome)} · ` : ''}${sa.morador_nome}` : 'Recarga'} · desde ${inicioSa ? inicioSa.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : sa.inicio}${soc == null ? ' · bateria do carro não informada' : ''}`
    : 'Conecte o carro e inicie a recarga';
  const stText = carregando
    ? `Carregando${sa.ocioso_inicio ? ` · vaga pedida por ${sa.ocioso_por_nome ?? '—'}` : ''}`
    : estado?.estado && estado.estado !== 'desconhecido' ? `Disponível · ${estado.estado}` : 'Disponível';

  return (
    <EquipShell
      title={carregador.nome || 'Carregador'}
      subtitle={[info?.unidade_nome ?? carregador.unidade_nome, potencia != null ? `${fmt(potencia, 0)} kW` : null].filter(Boolean).join(' · ') || undefined}
      right={<>
        <button type="button" onClick={carregar} title="Atualizar" aria-label="Atualizar" className="w-8 h-8 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-muted-foreground" />}
        </button>
        <Pill tone={carregando ? 'ok' : 'off'}>{carregando ? 'Carregando' : 'Disponível'}</Pill>
      </>}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={aba}
      onTab={setAba}
      onClose={() => onOpenChange(false)}
    >
      <style>{STYLE}</style>
      {msg && <div className="mb-3 rounded-xl bg-[#EEF0F4] dark:bg-white/10 px-3 py-2 text-[13px] text-muted-foreground">{msg}</div>}

      {aba === 'op' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            <Heroi carregando={carregando} soc={soc} eta={eta} />
            <div className="flex flex-col gap-3">
              <StatusLine tone="ok" label="Normal" text={stText} />
              <div className="grid grid-cols-2 gap-3">
                <Card className="h-14 px-4 flex items-center justify-between gap-2">
                  <span className="text-[13px] text-muted-foreground">Energia</span>
                  <span className="text-lg font-extrabold tabular-nums whitespace-nowrap">{fmt(carregando ? kwhAtual ?? 0 : 0, 1)} kWh</span>
                </Card>
                <Card className="h-14 px-4 flex items-center justify-between gap-2">
                  <span className="text-[13px] text-muted-foreground">Estimado</span>
                  <span className="text-lg font-extrabold tabular-nums whitespace-nowrap">{carregando && kwhAtual != null && tarifa != null ? brl(kwhAtual * tarifa) : 'R$ 0,00'}</span>
                </Card>
              </div>
              <Curva equipamentoId={carregador.id} inicio={carregando ? inicioSa : null} />
            </div>
          </div>

          <BigButton variant={carregando ? 'outline' : 'primary'} disabled={busy || (!carregando && moradores.length === 0)} onClick={() => setModal(carregando ? 'parar' : 'iniciar')}>
            {busy ? 'Executando…' : carregando ? 'Parar recarga' : 'Iniciar recarga'}
          </BigButton>
          {carregando && (
            <button type="button" onClick={() => setModal('vaga')} className="self-center -mt-2 h-9 px-2.5 text-sm font-bold text-muted-foreground hover:text-foreground">
              Outro morador quer a vaga?
            </button>
          )}
          {moradores.length === 0 && <p className="text-[12px] text-amber-600 dark:text-amber-400 -mt-2 text-center">Cadastre um morador na aba Configuração para liberar recargas.</p>}

          <Card className="overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-extrabold">Recargas de todos os moradores</span>
                <span className="text-[13px] text-muted-foreground">Últimas {sessoes.length} · {fmt(histKwh, 1)} kWh{tarifa != null ? ` · ${brl(histKwh * tarifa)} (estimado)` : ''}</span>
              </span>
              <button type="button" onClick={() => setModal('export')} className={`h-[38px] px-3.5 rounded-[10px] text-sm font-extrabold flex items-center gap-2 ${ACAO}`}>
                <Download className="w-4 h-4" /> Exportar planilha
              </button>
            </div>
            <div className="grid grid-cols-[minmax(0,1.3fr)_60px_minmax(0,1fr)_90px_90px_110px] gap-3 px-4 py-2 text-[11px] font-bold text-muted-foreground tracking-[0.4px] border-t">
              <span>MORADOR</span><span>DATA</span><span>INÍCIO → FIM</span><span>DURAÇÃO</span><span className="text-right">ENERGIA</span><span className="text-right">VALOR (ESTIMADO)</span>
            </div>
            {hist.length === 0 && <div className="px-4 py-3 border-t text-sm text-muted-foreground">Sem recargas ainda.</div>}
            {hist.map((h) => (
              <div key={h.id} className="grid grid-cols-[minmax(0,1.3fr)_60px_minmax(0,1fr)_90px_90px_110px] gap-3 items-center px-4 py-2.5 border-t text-sm">
                <span className="font-bold truncate">{h.mor}</span>
                <span>{h.data}</span>
                <span className="text-muted-foreground tabular-nums">{h.per}</span>
                <span className="text-muted-foreground">{h.dur}</span>
                <span className="text-right font-extrabold tabular-nums">{h.kwh}</span>
                <span className="text-right tabular-nums">{h.rs}</span>
              </div>
            ))}
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <SectionLabel>Tarifa</SectionLabel>
          <Card className="px-4 py-2.5 flex items-center gap-3">
            <span className="flex-1 flex flex-col gap-0.5">
              <span className="text-[15px] font-bold">Valor do kWh</span>
              <span className="text-xs text-muted-foreground">Pré-cadastrado no carregador · valores em R$ são estimados</span>
            </span>
            <span className="text-sm text-muted-foreground">R$</span>
            <input readOnly aria-label="Valor do kWh" value={tarifa != null ? fmt(tarifa, 2) : '—'} className="w-[90px] h-[38px] rounded-[10px] border bg-[#EEF0F4] dark:bg-white/10 text-[15px] font-extrabold text-right px-2.5" />
          </Card>

          <SectionLabel className="mt-2.5">Carregador</SectionLabel>
          <Card className="px-4">
            <FieldRow first label="Potência nominal"><span className="text-[15px] text-muted-foreground">{potencia != null ? `${fmt(potencia, 0)} kW` : '—'}</span></FieldRow>
            <FieldRow label="Unidade"><span className="text-[15px] text-muted-foreground">{info?.unidade_nome ?? carregador.unidade_nome ?? '—'}</span></FieldRow>
            <FieldRow label="Fonte do kWh"><span className="text-[15px] text-muted-foreground">{estado?.fonte_kwh === 'carregador' ? 'Carregador (broker)' : 'Medidor (TON)'}</span></FieldRow>
            <FieldRow label="Leitura da bateria do carro"><span className="text-[15px] text-muted-foreground">{soc != null ? 'Pelo carregador, ao conectar' : 'Não informada'}</span></FieldRow>
          </Card>

          <div className="flex justify-between items-center mt-2.5">
            <SectionLabel>Moradores autorizados · {moradores.length}</SectionLabel>
            <button type="button" onClick={() => setNovo(novo ? null : { nome: '', apartamento: '', tag_uid: '' })} className="h-8 px-3 rounded-[10px] text-[13px] font-extrabold text-[#177A3C] dark:text-emerald-400 bg-emerald-600/10">
              {novo ? 'Cancelar' : '+ Adicionar morador'}
            </button>
          </div>
          {novo && (
            <Card className="p-3 flex flex-wrap items-end gap-2">
              <input placeholder="Apartamento" value={novo.apartamento} onChange={(e) => setNovo({ ...novo, apartamento: e.target.value })} className="h-[38px] w-[120px] rounded-[10px] border bg-background px-2.5 text-sm" />
              <input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="h-[38px] flex-1 min-w-[160px] rounded-[10px] border bg-background px-2.5 text-sm" />
              <input placeholder="Tag (opcional)" value={novo.tag_uid} onChange={(e) => setNovo({ ...novo, tag_uid: e.target.value })} className="h-[38px] w-[140px] rounded-[10px] border bg-background px-2.5 text-sm" />
              <button type="button" onClick={addMorador} disabled={!novo.nome.trim()} className={`h-[38px] px-4 rounded-[10px] text-sm font-extrabold ${novo.nome.trim() ? ACAO : 'bg-[#EEF0F4] dark:bg-white/10 text-muted-foreground'}`}>Cadastrar</button>
            </Card>
          )}
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[110px_1fr_150px_170px] gap-3 px-4 py-2 text-[11px] font-bold text-muted-foreground tracking-[0.4px]">
              <span>APTO</span><span>MORADOR</span><span>TAG</span><span />
            </div>
            {moradores.length === 0 && <div className="px-4 py-3 border-t text-sm text-muted-foreground">Nenhum morador cadastrado.</div>}
            {moradores.map((m) => {
              const ativo = carregando && sa?.morador_nome === m.nome;
              return (
                <div key={m.id} className="grid grid-cols-[110px_1fr_150px_170px] gap-3 items-center px-4 py-2.5 border-t text-sm">
                  <span className="font-bold">{m.apartamento ?? '—'}</span>
                  <span className="flex flex-col gap-0.5">
                    <span>{m.nome}</span>
                    {ativo && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Recarga em andamento</span>}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{m.tag_uid ?? '—'}</span>
                  <span className="flex justify-end">
                    <button
                      type="button"
                      disabled={ativo}
                      title={ativo ? 'Não é possível remover com recarga em andamento' : ''}
                      onClick={() => delMorador(m.id)}
                      className={`h-[34px] px-3 rounded-[10px] text-[13px] font-extrabold ${ativo ? 'text-muted-foreground bg-[#EEF0F4] dark:bg-white/10' : 'text-red-600 bg-red-500/10'}`}
                    >
                      {ativo ? 'Remoção bloqueada' : 'Remover'}
                    </button>
                  </span>
                </div>
              );
            })}
          </Card>
          <p className="text-xs text-muted-foreground">Não é possível remover o morador com recarga em andamento. A recarga fica no nome de quem foi liberado (base da cobrança do condomínio).</p>
        </div>
      )}

      <SubDialog open={modal === 'parar'} onClose={fechar} title="Parar recarga?" width={400}>
        <p className="text-sm text-muted-foreground">
          Recarregado até agora: {fmt(kwhAtual ?? 0, 1)} kWh{tarifa != null && kwhAtual != null ? ` · ${brl(kwhAtual * tarifa)} (estimado)` : ''}{sa?.morador_nome ? ` · ${sa.morador_nome}` : ''}
        </p>
        <DialogButtons onCancel={fechar} onConfirm={parar} confirmLabel="Parar" busy={busy} />
      </SubDialog>

      <SubDialog
        open={modal === 'iniciar' || modal === 'vaga'}
        onClose={fechar}
        title={modal === 'vaga' ? 'Pedir a vaga?' : 'Iniciar recarga?'}
        subtitle={modal === 'vaga'
          ? `Em recarga: ${sa?.morador_nome ?? '—'} · ${fmt(kwhAtual ?? 0, 1)} kWh${tarifa != null && kwhAtual != null ? ` · ${brl(kwhAtual * tarifa)} (estimado)` : ''}`
          : `${carregador.nome}${tarifa != null ? ` · tarifa ${brl(tarifa)}/kWh` : ''}`}
        width={420}
      >
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">{modal === 'vaga' ? 'Quem está pedindo a vaga' : 'Recarga no nome de'}</span>
          <select value={moradorSel} onChange={(e) => setMoradorSel(e.target.value)} className="h-11 rounded-xl border bg-background px-3 text-[15px]">
            <option value="">Escolha o morador…</option>
            {moradores.map((m) => <option key={m.id} value={m.id}>{nomeEsc(m)}</option>)}
          </select>
        </label>
        {modal === 'iniciar' && (
          <div className="bg-[#EEF0F4] dark:bg-white/10 rounded-xl px-3.5">
            <div className="flex justify-between items-center min-h-[44px] text-[15px]"><span>Bateria do carro</span><b>{soc != null ? `${Math.round(soc)}%` : '—'}</b></div>
            <div className="flex justify-between items-center min-h-[44px] text-[15px] border-t border-border"><span>Valor do kWh</span><b>{tarifa != null ? `${brl(tarifa)} (estimado)` : '—'}</b></div>
          </div>
        )}
        {modal === 'vaga' && <p className="text-sm text-muted-foreground">Avisa quem está carregando e começa a contar o tempo ocioso da vaga.</p>}
        <DialogButtons onCancel={fechar} onConfirm={executar} confirmLabel={modal === 'vaga' ? 'Pedir a vaga' : 'Iniciar'} disabled={!moradorSel} busy={busy} />
      </SubDialog>

      <SubDialog open={modal === 'export'} onClose={fechar} title="Exportar recargas" subtitle="Para a contabilidade cobrar no boleto do condomínio" width={560}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-bold">Mês de referência</span>
          <Segmented value={mesExp} onChange={setMesExp} options={mesesOpc.map((d, i) => ({ v: ymd(d), label: mesLabel(d, i) }))} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-bold">Formato</span>
          <Segmented value={formato} onChange={(v) => { setFormato(v); setBaixado(''); }} options={[{ v: 'xlsx', label: 'Excel (.xlsx)' }, { v: 'csv', label: 'CSV' }]} />
        </div>
        <div className="border rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-3.5 py-2.5 bg-[#EEF0F4] dark:bg-white/10">
            <span className="text-[13px] font-extrabold">Resumo por morador</span>
            <span className="text-xs text-muted-foreground">{exp ? `${exp.linhas.length} morador${exp.linhas.length === 1 ? '' : 'es'}` : '…'}</span>
          </div>
          <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2.5 px-3.5 py-2 text-[11px] font-bold text-muted-foreground tracking-[0.4px] border-t">
            <span>MORADOR</span><span className="text-right">ENERGIA</span><span className="text-right">VALOR</span>
          </div>
          {!exp ? <div className="px-3.5 py-2 border-t text-sm text-muted-foreground">Carregando…</div>
            : exp.linhas.length === 0 ? <div className="px-3.5 py-2 border-t text-sm text-muted-foreground">Sem recargas encerradas no mês.</div>
              : exp.linhas.map((r, i) => (
                <div key={i} className="grid grid-cols-[1.6fr_1fr_1fr] gap-2.5 px-3.5 py-2 text-sm border-t">
                  <span className="font-bold truncate">{aptoDe(r.morador) ? `${aptoDe(r.morador)} · ` : ''}{r.morador ?? '—'}</span>
                  <span className="text-right tabular-nums">{fmt(r.kwh, 1)} kWh</span>
                  <span className="text-right font-extrabold tabular-nums">{brl(r.valor_reais)}</span>
                </div>
              ))}
          {exp && exp.linhas.length > 0 && (
            <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2.5 px-3.5 py-2.5 text-sm font-extrabold border-t-2 border-foreground">
              <span>Total</span><span className="text-right">{fmt(totKwh, 1)} kWh</span><span className="text-right">{brl(totRs)}</span>
            </div>
          )}
        </div>
        <div className="bg-[#EEF0F4] dark:bg-white/10 rounded-xl px-3.5 py-2.5 flex flex-col gap-1 text-[13px]">
          <span>Valores estimados: kWh medido × {tarifa != null ? `${brl(tarifa)}/kWh` : 'valor do kWh'} cadastrado no carregador.</span>
          <span>A recarga entra no mês em que <b>terminou</b>. Recargas em andamento ficam de fora.</span>
        </div>
        <button type="button" onClick={baixar} disabled={!exp || exp.linhas.length === 0} className={`h-12 rounded-xl text-base font-extrabold ${!exp || exp.linhas.length === 0 ? 'bg-[#EEF0F4] dark:bg-white/10 text-muted-foreground' : baixado ? 'bg-emerald-600 text-white' : ACAO}`}>
          {baixado ? `✓ Download iniciado: ${baixado}` : 'Baixar planilha'}
        </button>
      </SubDialog>
    </EquipShell>
  );
}

export default CarregadorModal;
