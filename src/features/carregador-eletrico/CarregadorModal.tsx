import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '@/config/api';
import { fmt } from '@/features/supervisorio/v2/components/sheets/sheetParts';
import { useHistorico, bucketize, brl, unwrap } from '@/features/supervisorio/v2/components/sheets/equipUi';
import { NX, s, NxShell, NxDialog, NxDialogHead, NxDialogButtons, NxSeg } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { curveMonotoneX } from '@visx/curve';
import { ComposedChart } from '@/components/charts/composed-chart';
import { Area } from '@/components/charts/area-chart';
import { Line } from '@/components/charts/line';
import { Grid } from '@/components/charts/grid';
import { XAxis } from '@/components/charts/x-axis';
import { YAxis } from '@/components/charts/y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { COR } from '@/components/graficos/cores';
import { TooltipDestaque } from '@/components/graficos/tooltip-destaque';
import { LINHA_SO_DOMINIO, linhasDeBuckets } from '@/components/graficos/linhas-de-buckets';

/**
 * Modal do Carregador (condomínio) — porte 1:1 do mockup "Web — Modal do Carregador" (NEXON-5).
 * Operação: carro + bateria, status, energia e valor estimado, curva de potência da recarga,
 * Iniciar recarga (POST :id/liberar no nome de um morador) / Parar recarga (POST :id/parar),
 * pedido de vaga (POST :id/pedir-vaga), recargas de todos os moradores e exportação.
 * Configuração: valor do kWh (analista edita: PUT :id/config, vale para recargas novas),
 * dados do carregador e moradores autorizados com validade (vence sozinho; aviso 1 dia antes).
 * Perfis vêm da API (estado.papel): analista, proprietário e morador (só as próprias recargas).
 */

interface Carregador { id: string; nome: string; unidade_nome?: string; planta_id?: string }
interface CarregadorInfo extends Carregador { potencia_kw?: number | string | null; tarifa_kwh?: number | string | null }
interface Morador {
  id: string; nome: string; apartamento?: string | null; tag_uid?: string | null; email?: string | null;
  validade?: string | null; ativo?: boolean; em_recarga?: boolean; aviso_validade_em?: string | null;
}
interface Sessao {
  id: string; equipamento_id?: string; planta_id?: string | null; morador_nome?: string | null; morador_id?: string | null; status?: string;
  kwh_total?: number | string | null; inicio?: string | null; fim?: string | null; inicio_iso?: string | null; fim_iso?: string | null;
  tarifa_kwh?: number | string | null; ocioso_inicio?: string | null; ocioso_por_nome?: string | null;
}
type Papel = 'analista' | 'proprietario' | 'morador';
interface Estado {
  estado?: string; fonte_kwh?: string; tarifa_kwh?: number | string | null; soc?: number | string | null;
  potencia_kw?: number | string | null; capacidade_bateria_kwh?: number | string | null;
  papel?: Papel; meu_morador?: { id: string; nome: string; apartamento?: string | null } | null;
  sessao_ativa?: Sessao | null; sessoes?: Sessao[];
}
interface LinhaExport { apartamento?: string | null; morador?: string | null; recargas?: number; kwh: number | string; ocioso_min: number | string; valor_reais: number | string }
interface DetalheExport {
  apartamento?: string | null; morador?: string | null; vaga?: string | null; inicio?: string; fim?: string;
  duracao_min?: number; kwh: number | string; tarifa_kwh?: number | string | null; valor_reais: number | string;
}
type Modal = null | 'iniciar' | 'parar' | 'vaga' | 'export' | 'review';

const erroMsg = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || padrao;

/** Grade de 2 colunas do mockup; vira 1 coluna abaixo de ~760 px de largura. */
const CSS = `
.nxc-grid{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:16px;align-items:stretch}
@media (max-width: 759px){.nxc-grid{grid-template-columns:minmax(0, 1fr)}}
`;

/** "09/10 18:40" → Date (ano corrente; se cair no futuro, ano anterior). */
function parseDm(v?: string | null): Date | null {
  const m = /^(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]));
  if (d.getTime() - now.getTime() > 86400000) d.setFullYear(d.getFullYear() - 1);
  return d;
}
const isoDate = (v?: string | null) => (v ? new Date(v) : null);
const hojeYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const amanhaYmd = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dataBR = (ymd?: string | null) => (ymd ? ymd.slice(0, 10).split('-').reverse().join('/') : 'Sem validade');
const durTxt = (a: Date | null, b: Date | null) => {
  if (!a || !b) return '—';
  const min = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const kwDe = (d: Record<string, unknown> | null | undefined): number | null => {
  const v = Number(d?.Pt ?? d?.potencia_kw ?? d?.potencia ?? d?.power);
  return Number.isFinite(v) ? (Math.abs(v) > 100 ? v / 1000 : v) : null;
};

// Estilos repetidos do mockup
const CARD: CSSProperties = { background: NX.card, border: `1px solid ${NX.borda}` };
const HIST_COLS = '160px 60px 1fr 90px 90px 120px';
const MOR_COLS = '90px 1fr 150px 170px';
const EXP_COLS = '1.6fr 0.8fr 1fr 1fr';
const CAIXA_ROW: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, fontSize: 15, gap: 12 };
const SELECT_ROW: CSSProperties = { fontSize: 15, fontWeight: 700, color: NX.texto, background: 'transparent', border: 0, textAlign: 'right', maxWidth: '62%', cursor: 'pointer' };
const ENTRADA: CSSProperties = { width: '100%', height: 34, boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${NX.borda}`, background: NX.card, color: NX.texto, fontSize: 14, padding: '0 10px' };

export function CarregadorModal({ carregador, open, onOpenChange }: { carregador: Carregador | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [aba, setAba] = useState('op');
  const [estado, setEstado] = useState<Estado | null>(null);
  const [carregadores, setCarregadores] = useState<CarregadorInfo[]>([]);
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [todas, setTodas] = useState<Sessao[]>([]);
  const [verTodas, setVerTodas] = useState(false);
  const [plantaId, setPlantaId] = useState<string | undefined>(carregador?.planta_id);
  const [lidoEm, setLidoEm] = useState(() => Date.now());
  const [modal, setModal] = useState<Modal>(null);
  const [moradorSel, setMoradorSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [erroCfg, setErroCfg] = useState('');
  const [novo, setNovo] = useState<null | { nome: string; apartamento: string; tag_uid: string; email: string; validade: string }>(null);
  const [tarifaDraft, setTarifaDraft] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Exportação
  const mesesOpc = useMemo(() => {
    const h = new Date();
    return [2, 1, 0].map((k) => new Date(h.getFullYear(), h.getMonth() - k, 1));
  }, []);
  const [mesExp, setMesExp] = useState(() => ymd(mesesOpc[1]));
  const [formato, setFormato] = useState<'xlsx' | 'csv'>('xlsx');
  const [exp, setExp] = useState<{ csv?: string; linhas: LinhaExport[]; detalhe: DetalheExport[] } | null>(null);
  const [baixado, setBaixado] = useState('');

  const id = carregador?.id;

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const [e, cs, ss] = await Promise.all([
        api.get(`/carregador-eletrico/${id}/estado`),
        api.get('/carregador-eletrico/carregadores'),
        api.get('/carregador-eletrico/sessoes', { params: { carregadorId: id, limite: 500 } }).catch(() => null),
      ]);
      setEstado(unwrap<Estado>(e));
      const lista = unwrap<CarregadorInfo[]>(cs) ?? [];
      setCarregadores(Array.isArray(lista) ? lista : []);
      if (ss) { const l = unwrap<Sessao[]>(ss); setTodas(Array.isArray(l) ? l : []); }
      const meu = (Array.isArray(lista) ? lista : []).find((c) => String(c.id).trim() === String(id).trim());
      const pid = meu?.planta_id ? String(meu.planta_id).trim() : carregador?.planta_id;
      if (pid) setPlantaId(pid);
      const m = await api.get('/carregador-eletrico/moradores', { params: pid ? { plantaId: pid } : undefined });
      const ml = unwrap<Morador[]>(m);
      setMoradores(Array.isArray(ml) ? ml : []);
    } catch { /* mantém o que tinha */ } finally { setLidoEm(Date.now()); }
  }, [id, carregador?.planta_id]);

  useEffect(() => { if (open) { setAba('op'); setErro(''); setErroCfg(''); setVerTodas(false); carregar(); } }, [open, carregar]);
  useEffect(() => {
    if (!open || !id) return;
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [open, id, carregar]);

  // Curva de potência: leituras do equipamento desde o início da recarga em andamento.
  const sa = estado?.sessao_ativa ?? null;
  const carregando = !!sa;
  const inicioMs = (isoDate(sa?.inicio_iso) ?? parseDm(sa?.inicio))?.getTime() ?? null;
  const [curvaIni, curvaFim] = useMemo<[Date | null, Date | null]>(
    () => (inicioMs == null ? [null, null] : [new Date(inicioMs), new Date(Math.max(lidoEm, inicioMs + 60000))]),
    [inicioMs, lidoEm],
  );
  const { pts } = useHistorico(id, curvaIni, curvaFim, open && carregando);

  useEffect(() => {
    if (modal !== 'export') return;
    let vivo = true;
    setExp(null); setBaixado('');
    api.get('/carregador-eletrico/export', { params: { mes: mesExp, plantaId } })
      .then((r) => {
        if (!vivo) return;
        const d = unwrap<{ csv?: string; linhas?: LinhaExport[]; detalhe?: DetalheExport[] }>(r);
        setExp({ csv: d?.csv, linhas: d?.linhas ?? [], detalhe: d?.detalhe ?? [] });
      })
      .catch((e) => { if (vivo) { setExp({ linhas: [], detalhe: [] }); setErro(erroMsg(e, 'Falha ao montar a planilha')); } });
    return () => { vivo = false; };
  }, [modal, mesExp, plantaId]);

  if (!open || !carregador) return null;

  const info = carregadores.find((c) => String(c.id).trim() === String(carregador.id).trim()) ?? null;
  const papel: Papel = estado?.papel ?? 'analista';
  const ehMorador = papel === 'morador';
  const tarifaCfg = estado?.tarifa_kwh != null ? Number(estado.tarifa_kwh) : info?.tarifa_kwh != null ? Number(info.tarifa_kwh) : null;
  // A recarga em andamento usa o valor do kWh gravado quando começou.
  const tarifa = sa?.tarifa_kwh != null ? Number(sa.tarifa_kwh) : tarifaCfg;
  const kwhAtual = sa?.kwh_total != null ? Number(sa.kwh_total) : null;
  const inicioSa = inicioMs != null ? new Date(inicioMs) : null;
  const potencia = info?.potencia_kw != null ? Number(info.potencia_kw) : estado?.potencia_kw != null ? Number(estado.potencia_kw) : null;
  const soc = carregando && estado?.soc != null && Number.isFinite(Number(estado.soc)) ? Math.max(0, Math.min(100, Number(estado.soc))) : null;
  const capacidade = estado?.capacidade_bateria_kwh != null ? Number(estado.capacidade_bateria_kwh) : null;
  // Previsão até 100%: só com bateria lida + capacidade + potência.
  const falta = soc != null && capacidade && potencia ? { kwh: ((100 - soc) / 100) * capacidade, h: ((100 - soc) / 100) * capacidade / potencia + 0.25 } : null;
  const fimPrev = falta ? new Date(Date.now() + falta.h * 3600000) : null;
  const unidade = info?.unidade_nome ?? carregador.unidade_nome ?? null;
  const vagaNum = /vaga\s*([\w-]+)/i.exec(carregador.nome ?? '')?.[1] ?? null;

  const aptoDe = (nome?: string | null) => (nome ? moradores.find((m) => m.nome === nome)?.apartamento ?? null : null);
  const morLabel = (nome?: string | null) => (nome ? `${aptoDe(nome) ? `${aptoDe(nome)} · ` : ''}${nome}` : '—');

  // ------------------------------------------------------------------ ações
  const abrir = (m: Modal) => {
    setErro('');
    setMoradorSel(ehMorador && estado?.meu_morador ? estado.meu_morador.id : moradores.filter((x) => x.ativo !== false).length === 1 ? moradores.filter((x) => x.ativo !== false)[0].id : '');
    setModal(m);
  };
  const fechar = () => { setModal(null); };
  const comando = async (fn: () => Promise<unknown>, falha: string) => {
    setModal(null); setBusy(true); setErro('');
    try { await fn(); await carregar(); }
    catch (e) { setErro(erroMsg(e, falha)); }
    finally { setBusy(false); }
  };
  const iniciar = () => { const mid = moradorSel; if (mid) comando(() => api.post(`/carregador-eletrico/${id}/liberar`, { morador_id: mid }), 'Falha ao iniciar a recarga'); };
  const parar = () => comando(() => api.post(`/carregador-eletrico/${id}/parar`), 'Falha ao parar a recarga');
  const pedirVaga = () => { const mid = moradorSel; if (mid) comando(() => api.post(`/carregador-eletrico/${id}/pedir-vaga`, { morador_id: mid }), 'Falha ao pedir a vaga'); };

  const addMorador = async () => {
    if (!novo?.nome.trim()) return;
    setSalvando(true); setErroCfg('');
    try {
      await api.post('/carregador-eletrico/moradores', {
        nome: novo.nome.trim(), apartamento: novo.apartamento.trim() || null, tag_uid: novo.tag_uid.trim().toUpperCase() || null, planta_id: plantaId,
        email: novo.email.trim() || null, validade: novo.validade || null,
      });
      setNovo(null); await carregar();
    } catch (e) { setErroCfg(erroMsg(e, 'Falha ao cadastrar o morador')); }
    finally { setSalvando(false); }
  };
  const delMorador = async (mid: string) => {
    setErroCfg('');
    try { await api.delete(`/carregador-eletrico/moradores/${mid}`); await carregar(); }
    catch (e) { setErroCfg(erroMsg(e, 'Falha ao remover o morador')); }
  };

  const tarifaTxtEdit = tarifaDraft ?? (tarifaCfg != null ? fmt(tarifaCfg, 2) : '');
  const tarifaNum = Number(String(tarifaTxtEdit).replace(',', '.'));
  const tarifaRuim = tarifaTxtEdit === '' || !Number.isFinite(tarifaNum) || tarifaNum < 0.3 || tarifaNum > 5;
  const tarifaMudou = !tarifaRuim && (tarifaCfg == null || Math.abs(tarifaNum - tarifaCfg) > 0.00001);
  const salvarTarifa = async () => {
    setSalvando(true); setErroCfg('');
    try { await api.put(`/carregador-eletrico/${id}/config`, { tarifa_kwh: tarifaNum }); setTarifaDraft(null); setModal(null); await carregar(); }
    catch (e) { setErroCfg(erroMsg(e, 'Falha ao salvar o valor do kWh')); setModal(null); }
    finally { setSalvando(false); }
  };

  // ------------------------------------------------------------------ operação
  const w = soc != null ? Math.max(4, soc) : carregando ? 100 : 4;
  const fillStyle: CSSProperties = {
    height: '100%', borderRadius: 8, width: `${w}%`,
    ...(carregando
      ? { backgroundColor: '#2E8B47', backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.25) 0 7px, transparent 7px 14px)', backgroundSize: '28px 100%' }
      : { background: NX.off }),
  };

  // Curva de potência da recarga (bklit): buckets do início da sessão até agora;
  // `teto` (série invisível) leva o eixo até a potência nominal do carregador.
  const N = 80;
  const t0 = curvaIni?.getTime() ?? 0, t1 = curvaFim?.getTime() ?? 1;
  const vals = carregando && pts && curvaIni ? bucketize(pts, t0, t1, N, kwDe) : [];
  const curva = linhasDeBuckets(t0, t1, { potencia: vals });
  const maxLido = Math.max(0, ...curva.map((p) => Number(p.potencia)));
  const MAXP = Math.ceil((Math.max(potencia ?? 0, maxLido, 1) + 1) / 2) * 2;
  curva.forEach((p) => { p.teto = MAXP; });
  const kwAgora = curva.length ? Number(curva[curva.length - 1].potencia) : null;

  const pillText = carregando ? 'Carregando' : 'Disponível';
  const stText = carregando
    ? `Carregando${kwAgora != null ? ` · ${fmt(kwAgora, 1)} kW` : ''}${sa?.ocioso_inicio ? ` · vaga pedida por ${sa.ocioso_por_nome ?? '—'}` : ''}`
    : 'Disponível';
  const desde = inicioSa ? hm(inicioSa) : sa?.inicio ?? '—';
  const etaTxt = carregando
    ? falta && fimPrev
      ? `Faltam ${Math.floor(falta.h)} h ${String(Math.round((falta.h % 1) * 60)).padStart(2, '0')} min para 100% · término ~${hm(fimPrev)}`
      : soc != null
        ? `${morLabel(sa?.morador_nome)} · carregando desde ${desde}`
        : `Bateria do carro não informada · ${morLabel(sa?.morador_nome)} · desde ${desde}`
    : 'Conecte o carro e inicie a recarga';
  const previsto = carregando && kwhAtual != null && tarifa != null ? brl((kwhAtual + (falta?.kwh ?? 0)) * tarifa) : 'R$ 0,00';

  // Histórico
  const agora = new Date();
  const linhaHist = (x: Sessao) => {
    const a = isoDate(x.inicio_iso) ?? parseDm(x.inicio), b = isoDate(x.fim_iso) ?? parseDm(x.fim);
    const kwh = x.kwh_total != null ? Number(x.kwh_total) : null;
    const t = x.tarifa_kwh != null ? Number(x.tarifa_kwh) : tarifa;
    const ativa = x.status === 'ativa';
    return {
      id: x.id,
      mor: morLabel(x.morador_nome),
      data: a ? (a.toDateString() === agora.toDateString() ? 'Hoje' : dm(a)) : '—',
      per: `${a ? hm(a) : '—'} → ${ativa ? 'em andamento' : b ? hm(b) : '—'}`,
      dur: durTxt(a, ativa ? agora : b),
      kwh: kwh != null ? `${fmt(kwh, 1)} kWh` : '—',
      rs: kwh != null && t != null ? brl(kwh * t) : '—',
    };
  };
  const recentes = estado?.sessoes ?? [];
  const hist = (verTodas && todas.length > recentes.length ? todas : recentes).map(linhaHist);
  const doMes = (todas.length ? todas : recentes).filter((x) => {
    const a = isoDate(x.inicio_iso) ?? parseDm(x.inicio);
    return a && a.getMonth() === agora.getMonth() && a.getFullYear() === agora.getFullYear();
  });
  const kwhMes = doMes.reduce((acc, x) => acc + Number(x.kwh_total || 0), 0);
  const rsMes = doMes.reduce((acc, x) => acc + Number(x.kwh_total || 0) * Number(x.tarifa_kwh ?? tarifa ?? 0), 0);
  const histTotal = `${MES_LONGO[agora.getMonth()]} · ${fmt(kwhMes, 1)} kWh${!ehMorador && tarifa != null ? ` · ${brl(rsMes)} (estimado)` : ''}`;
  const histCols = ehMorador ? '70px 1fr 100px 100px 140px' : HIST_COLS;

  // ------------------------------------------------------------------ exportação
  const mesSel = mesesOpc.find((d) => ymd(d) === mesExp) ?? mesesOpc[1];
  const mesIdx = mesesOpc.indexOf(mesSel);
  const monthLabel = `${MES_LONGO[mesSel.getMonth()]}/${mesSel.getFullYear()}${mesIdx === 2 ? ' (parcial)' : ''}`;
  const sumRows = (exp?.linhas ?? []).map((r) => ({
    apto: `${r.apartamento ? `${r.apartamento} · ` : ''}${r.morador ?? '—'}`, n: r.recargas ?? null, kwh: Number(r.kwh || 0), rs: Number(r.valor_reais || 0),
  }));
  const sessCount = exp ? sumRows.reduce((a, r) => a + (r.n ?? 0), 0) : null;
  const totKwh = sumRows.reduce((a, r) => a + r.kwh, 0);
  const totRs = sumRows.reduce((a, r) => a + r.rs, 0);
  const slug = vagaNum ? `vaga${vagaNum}`.toLowerCase()
    : (carregador.nome || 'carregador').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nomeArq = `recargas-${slug}-${MES[mesSel.getMonth()].toLowerCase()}-${mesSel.getFullYear()}`;

  const baixar = async () => {
    if (!exp) return;
    try {
      if (formato === 'csv') {
        const blob = new Blob([exp.csv ?? ''], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `${nomeArq}.csv`; a.click(); URL.revokeObjectURL(url);
        setBaixado(`${nomeArq}.csv`);
      } else {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const resumo = exp.linhas.map((r) => ({
          Apartamento: r.apartamento ?? '', Morador: r.morador ?? '—', Recargas: r.recargas ?? '',
          'Energia (kWh)': Number(r.kwh), 'Ocioso (min)': Number(r.ocioso_min), 'Valor estimado (R$)': Number(r.valor_reais),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo por apartamento');
        const detalhe = exp.detalhe.map((x) => {
          const min = Number(x.duracao_min ?? 0);
          return {
            Apto: x.apartamento ?? '', Morador: x.morador ?? '—', Vaga: x.vaga ?? '',
            'Início': x.inicio ?? '', Fim: x.fim ?? '', 'Duração': `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`,
            kWh: Number(x.kwh), 'R$/kWh': x.tarifa_kwh != null ? Number(x.tarifa_kwh) : '', 'Valor (R$)': Number(x.valor_reais),
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhe), 'Detalhe por recarga');
        XLSX.writeFile(wb, `${nomeArq}.xlsx`);
        setBaixado(`${nomeArq}.xlsx`);
      }
    } catch (e) { setErro(erroMsg(e, 'Falha ao gerar a planilha')); }
  };

  // ------------------------------------------------------------------ configuração

  const selectMorador = (
    <div style={CAIXA_ROW}>
      <span>Morador</span>
      <select aria-label="Morador" value={moradorSel} onChange={(e) => setMoradorSel(e.target.value)} style={SELECT_ROW}>
        <option value="">{moradores.length ? 'Escolha…' : 'Nenhum morador cadastrado'}</option>
        {moradores.filter((m) => m.ativo !== false).map((m) => <option key={m.id} value={m.id}>{morLabel(m.nome)}</option>)}
      </select>
    </div>
  );
  const erroDlg = erro ? <span style={{ fontSize: 13, color: NX.bad }}>{erro}</span> : null;

  return (
    <NxShell
      title={carregador.nome || 'Carregador'}
      subtitle={[unidade, potencia != null ? `${fmt(potencia, 0)} kW` : null].filter(Boolean).join(' · ') || undefined}
      right={<span style={s.pill('ok')}><span style={s.pillDot('ok')} />{pillText}</span>}
      tabs={ehMorador ? undefined : [{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={ehMorador ? 'op' : aba}
      onTab={setAba}
      onClose={() => onOpenChange(false)}
    >
      <style>{CSS}</style>

      {aba === 'op' || ehMorador ? (
        <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="nxc-grid">
            <div style={{ ...CARD, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <svg viewBox="0 0 300 110" width="300" height="110" role="img" aria-label="Carro conectado ao carregador" style={{ maxWidth: '100%' }}>
                <rect x="250" y="24" width="34" height="70" rx="8" fill={NX.trilho} stroke="#B9BDCB" />
                <rect x="258" y="34" width="18" height="12" rx="3" fill={carregando ? '#2E8B47' : '#B9BDCB'} />
                <path d="M267 94 C267 104 236 104 222 86" fill="none" stroke="#B9BDCB" strokeWidth="4" strokeLinecap="round" />
                <path d="M22 78 L30 56 C34 46 42 40 54 38 L96 32 C110 30 124 30 136 36 L170 54 L206 60 C216 62 224 70 224 80 L224 84 L22 84 Z" fill={NX.trilho} stroke="#9A9EB0" strokeWidth="1.5" />
                <path d="M58 44 L98 38 C108 37 118 38 126 42 L150 54 L58 54 Z" fill={NX.card} opacity="0.9" />
                <circle cx="62" cy="86" r="16" fill={NX.card} stroke={NX.mudo} strokeWidth="3" />
                <circle cx="186" cy="86" r="16" fill={NX.card} stroke={NX.mudo} strokeWidth="3" />
                <circle cx="62" cy="86" r="5" fill={NX.mudo} />
                <circle cx="186" cy="86" r="5" fill={NX.mudo} />
                {carregando && <path className="nxw-pulse" d="M126 58 L116 72 L124 72 L118 84 L132 68 L124 68 Z" fill="#2E8B47" />}
              </svg>
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 36, borderRadius: 12, border: '2px solid #B9BDCB', padding: 3, boxSizing: 'border-box', overflow: 'hidden' }}>
                  <div className={carregando ? 'nxw-flow' : ''} style={fillStyle} />
                </div>
                <div style={{ width: 6, height: 14, borderRadius: '0 3px 3px 0', background: '#B9BDCB' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 46, lineHeight: '50px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>{soc != null ? `${Math.round(soc)}%` : '—'}</span>
                <span style={{ fontSize: 14, color: NX.mudo, textAlign: 'center' }}>{etaTxt}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...CARD, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={s.stDot('ok')} />
                <span style={s.stLabel('ok')}>Normal</span>
                <span style={{ fontSize: 14, color: NX.mudo }}>{stText}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div style={{ ...CARD, borderRadius: 14, height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Energia</span>
                  <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(carregando ? kwhAtual ?? 0 : 0, 1)} kWh</span>
                </div>
                <div style={{ ...CARD, borderRadius: 14, height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Previsto</span>
                  <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{previsto}</span>
                </div>
              </div>
              <div style={{ ...CARD, borderRadius: 14, padding: '14px 16px 10px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>Curva de potência</span>
                <div style={{ height: 150, marginTop: 8 }} role="img" aria-label="Curva de potência da recarga">
                  <ComposedChart data={curva} aspectRatio="auto" className="h-full"
                    margin={{ top: 8, right: 8, bottom: 24, left: 48 }} animationDuration={0}>
                    <Grid horizontal numTicksRows={3} />
                    <Area dataKey="potencia" fill={COR.potencia} fillOpacity={0.25} gradientToOpacity={0.04} strokeWidth={2.2} curve={curveMonotoneX} animate={false} />
                    <Line dataKey="teto" {...LINHA_SO_DOMINIO} />
                    <XAxis numTicks={2} />
                    <YAxis numTicks={3} formatValue={(x) => `${fmt(x, Number.isInteger(x) ? 0 : 1)} kW`} />
                    <ChartTooltip showDots content={({ point }) => {
                      const p = point as { date: Date; potencia: number };
                      return <TooltipDestaque titulo={hm(p.date)} valor={fmt(p.potencia, 1)} unidade="kW" rotulo="Potência" />;
                    }} />
                  </ComposedChart>
                </div>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => abrir(carregando ? 'parar' : 'iniciar')} disabled={busy} style={s.cmd(busy ? 'busy' : carregando ? 'outline' : 'primary')}>
            {busy ? 'Executando…' : carregando ? 'Parar recarga' : 'Iniciar recarga'}
          </button>
          {(carregando || erro) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: -8 }}>
              {carregando && !ehMorador && (
                <button type="button" onClick={() => abrir('vaga')} disabled={busy} style={{ height: 30, padding: '0 8px', fontSize: 13, fontWeight: 700, color: NX.mudo, textAlign: 'center' }}>
                  Outro morador quer a vaga?
                </button>
              )}
              {erro && modal == null && <span style={{ fontSize: 13, color: NX.bad, textAlign: 'center' }}>{erro}</span>}
            </div>
          )}

          <div style={{ ...CARD, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{ehMorador ? 'Minhas recargas' : 'Recargas de todos os moradores'}</span>
                <span style={{ fontSize: 13, color: NX.mudo }}>{histTotal}</span>
              </span>
              {!ehMorador && <button type="button" onClick={() => { setErro(''); setModal('export'); }} style={{ height: 38, padding: '0 14px', borderRadius: 10, background: NX.acao, color: '#FFFFFF', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></svg>
                Exportar planilha
              </button>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: ehMorador ? 480 : 660 }}>
                <div style={{ display: 'grid', gridTemplateColumns: histCols, gap: 12, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, borderTop: `1px solid ${NX.linha2}` }}>
                  {!ehMorador && <span>MORADOR</span>}<span>DATA</span><span>INÍCIO → FIM</span><span>DURAÇÃO</span><span style={{ textAlign: 'right' }}>ENERGIA</span><span style={{ textAlign: 'right' }}>VALOR (ESTIMADO)</span>
                </div>
                {hist.length === 0 && (
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>Sem recargas ainda.</div>
                )}
                {hist.map((h) => (
                  <div key={h.id} style={{ display: 'grid', gridTemplateColumns: histCols, gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14 }}>
                    {!ehMorador && <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.mor}>{h.mor}</span>}
                    <span>{h.data}</span>
                    <span style={{ color: NX.mudo, fontVariantNumeric: 'tabular-nums' }}>{h.per}</span>
                    <span style={{ color: NX.mudo }}>{h.dur}</span>
                    <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{h.kwh}</span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{h.rs}</span>
                  </div>
                ))}
              </div>
            </div>
            {todas.length > recentes.length && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderTop: `1px solid ${NX.linha}` }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setVerTodas((v) => !v); }} style={{ fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
                  {verTodas ? 'Ver menos ‹' : 'Ver todas ›'}
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px 24px 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={s.label}>TARIFA</span>
          <div style={{ ...CARD, borderRadius: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <label htmlFor="w-kwh" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Valor do kWh</span>
              <span style={{ fontSize: 12, color: papel === 'analista' && tarifaDraft != null && tarifaRuim ? NX.bad : NX.mudo }}>
                {papel === 'analista' ? (tarifaDraft != null && tarifaRuim ? 'Faixa R$ 0,30 a R$ 5,00' : 'Faixa R$ 0,30 a R$ 5,00 · valores em R$ são estimados') : 'Pré-cadastrado pelo analista · valores em R$ são estimados'}
              </span>
            </label>
            <span style={{ fontSize: 14, color: NX.mudo }}>R$</span>
            <input id="w-kwh" inputMode="decimal" value={papel === 'analista' ? tarifaTxtEdit : tarifaCfg != null ? fmt(tarifaCfg, 2) : '—'}
              onChange={(e) => setTarifaDraft(e.target.value)} readOnly={papel !== 'analista'} disabled={papel !== 'analista'}
              style={s.campo(papel !== 'analista', papel === 'analista' && tarifaDraft != null && tarifaRuim, 90)} />
          </div>

          <span style={{ ...s.label, marginTop: 10 }}>CARREGADOR</span>
          <div style={{ ...CARD, borderRadius: 14, padding: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Potência nominal</span>
              <span style={{ fontSize: 15, color: NX.mudo }}>{potencia != null ? `${fmt(potencia, 0)} kW` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, gap: 12, borderTop: `1px solid ${NX.linha}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Vaga</span>
              <span style={{ fontSize: 15, color: NX.mudo, textAlign: 'right' }}>{[vagaNum ?? carregador.nome, unidade].filter(Boolean).join(' · ') || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, gap: 12, borderTop: `1px solid ${NX.linha}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Leitura da bateria do carro</span>
              <span style={{ fontSize: 15, color: NX.mudo, textAlign: 'right' }}>{estado?.soc != null ? 'Pelo carregador, ao conectar' : 'Não informada pelo carregador'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 12 }}>
            <span style={s.label}>MORADORES AUTORIZADOS · {moradores.length}</span>
            <button type="button" onClick={() => { setErroCfg(''); setNovo(novo ? null : { nome: '', apartamento: '', tag_uid: '', email: '', validade: '' }); }}
              style={{ height: 32, padding: '0 12px', borderRadius: 10, fontSize: 13, fontWeight: 800, color: NX.acao, background: 'rgba(31,122,67,0.1)', flex: 'none' }}>
              + Adicionar morador
            </button>
          </div>
          <div style={{ ...CARD, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 560 }}>
                <div style={{ display: 'grid', gridTemplateColumns: MOR_COLS, gap: 12, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4 }}>
                  <span>APTO</span><span>MORADOR</span><span>VALIDADE</span><span />
                </div>
                {novo && (
                  <div style={{ display: 'grid', gridTemplateColumns: MOR_COLS, gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14 }}>
                    <input aria-label="Apartamento" placeholder="Apto 302" value={novo.apartamento} onChange={(e) => setNovo({ ...novo, apartamento: e.target.value })} style={ENTRADA} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input aria-label="Nome do morador" placeholder="Nome do morador" autoFocus value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={ENTRADA} />
                      <input aria-label="E-mail (aviso de vencimento)" placeholder="E-mail (aviso de vencimento)" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} style={ENTRADA} />
                      <input aria-label="Tag (opcional)" placeholder="Tag (opcional)" value={novo.tag_uid} onChange={(e) => setNovo({ ...novo, tag_uid: e.target.value })} style={ENTRADA} />
                    </span>
                    <input aria-label="Validade (vazio = sem validade)" title="Vazio = sem validade" type="date" min={hojeYmd()} value={novo.validade} onChange={(e) => setNovo({ ...novo, validade: e.target.value })} style={ENTRADA} />
                    <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button type="button" onClick={() => setNovo(null)} style={{ height: 34, padding: '0 10px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: NX.seg }}>Cancelar</button>
                      <button type="button" onClick={addMorador} disabled={!novo.nome.trim() || salvando}
                        style={{ height: 34, padding: '0 10px', borderRadius: 10, fontSize: 13, fontWeight: 800, ...(novo.nome.trim() && !salvando ? { color: '#FFFFFF', background: NX.acao } : { color: NX.desab, background: NX.ro }) }}>
                        {salvando ? 'Salvando…' : 'Salvar'}
                      </button>
                    </span>
                  </div>
                )}
                {moradores.length === 0 && !novo && (
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>Nenhum morador cadastrado.</div>
                )}
                {moradores.map((m) => {
                  const lock = !!m.em_recarga || (!!sa?.morador_id && String(sa.morador_id).trim() === String(m.id).trim());
                  const vence = !!m.validade && m.validade.slice(0, 10) <= amanhaYmd() && m.validade.slice(0, 10) >= hojeYmd();
                  const vencido = m.ativo === false || (!!m.validade && m.validade.slice(0, 10) < hojeYmd());
                  const tag = lock ? 'Recarga em andamento' : vencido ? 'Acesso vencido' : vence ? (m.aviso_validade_em ? 'Vence amanhã · aviso enviado' : 'Vence amanhã') : '';
                  return (
                    <div key={m.id} style={{ display: 'grid', gridTemplateColumns: MOR_COLS, gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14 }}>
                      <span style={{ fontWeight: 700 }}>{m.apartamento || '—'}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }} title={m.tag_uid ? `Tag ${m.tag_uid}` : undefined}>
                        <span>{m.nome}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: lock ? '#2E8B47' : vencido ? NX.bad : '#B7791F' }}>{tag}</span>
                      </span>
                      <span style={{ color: vence || vencido ? '#B7791F' : NX.mudo, fontVariantNumeric: 'tabular-nums' }}>{dataBR(m.validade)}</span>
                      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => { if (!lock) delMorador(m.id); }} disabled={lock} title={lock ? 'Não é possível remover com recarga em andamento' : ''}
                          style={{ height: 34, padding: '0 12px', borderRadius: 10, fontSize: 13, fontWeight: 800, ...(lock ? { color: NX.desab, background: NX.ro } : { color: NX.bad, background: 'rgba(197,48,48,0.08)' }) }}>
                          {lock ? 'Remoção bloqueada' : 'Remover'}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {erroCfg && <span style={{ fontSize: 13, color: NX.bad }}>{erroCfg}</span>}
          <span style={{ fontSize: 12, color: NX.mudo }}>Não é possível remover, desativar ou deixar vencer o acesso de um morador com recarga em andamento: o acesso expira logo após o fim da recarga. Aviso de vencimento: 1 dia antes, para o morador e para o proprietário.</span>
          {papel === 'analista' && (
            <button type="button" disabled={!tarifaMudou} onClick={() => setModal('review')} style={s.save(!tarifaMudou)}>
              {tarifaDraft != null && tarifaRuim ? 'Valor fora da faixa' : tarifaMudou ? 'Revisar 1 alteração' : 'Salvar'}
            </button>
          )}
        </div>
      )}

      {/* Iniciar recarga? */}
      <NxDialog open={modal === 'iniciar'} onClose={fechar} label="Confirmar comando" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Iniciar recarga?</span>
          <div style={{ background: NX.caixa, borderRadius: 12, padding: '0 14px' }}>
            {!ehMorador && selectMorador}
            <div style={{ ...CAIXA_ROW, ...(ehMorador ? {} : { borderTop: `1px solid ${NX.trilho}` }) }}><span>Bateria do carro</span><b>{estado?.soc != null ? `${Math.round(Number(estado.soc))}%` : '—'}</b></div>
            <div style={{ ...CAIXA_ROW, borderTop: `1px solid ${NX.trilho}` }}><span>Valor do kWh</span><b>{tarifa != null ? `${brl(tarifa)} (estimado)` : '—'}</b></div>
          </div>
          {erroDlg}
          <NxDialogButtons onCancel={fechar} onConfirm={iniciar} confirmLabel="Iniciar" disabled={!moradorSel} marginTop={8} />
          {ehMorador && !estado?.meu_morador && <span style={{ fontSize: 13, color: NX.bad }}>Seu usuário não está ligado a um morador autorizado.</span>}
        </div>
      </NxDialog>

      {/* Parar recarga? */}
      <NxDialog open={modal === 'parar'} onClose={fechar} label="Confirmar comando" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Parar recarga?</span>
          <span style={{ fontSize: 14, color: NX.mudo }}>
            Recarregado até agora: {fmt(kwhAtual ?? 0, 1)} kWh{tarifa != null ? ` · ${brl((kwhAtual ?? 0) * tarifa)} (estimado)` : ''}
          </span>
          {erroDlg}
          <NxDialogButtons onCancel={fechar} onConfirm={parar} confirmLabel="Parar" marginTop={8} />
        </div>
      </NxDialog>

      {/* Pedir a vaga (fora do mockup: mantido como ação discreta) */}
      <NxDialog open={modal === 'vaga'} onClose={fechar} label="Confirmar comando" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Pedir a vaga?</span>
          <div style={{ background: NX.caixa, borderRadius: 12, padding: '0 14px' }}>
            {selectMorador}
            <div style={{ ...CAIXA_ROW, borderTop: `1px solid ${NX.trilho}` }}><span>Em recarga</span><b style={{ textAlign: 'right' }}>{morLabel(sa?.morador_nome)}</b></div>
          </div>
          <span style={{ fontSize: 14, color: NX.mudo }}>Avisa quem está carregando e começa a contar o tempo ocioso da vaga.</span>
          {erroDlg}
          <NxDialogButtons onCancel={fechar} onConfirm={pedirVaga} confirmLabel="Pedir a vaga" disabled={!moradorSel} marginTop={8} />
        </div>
      </NxDialog>

      {/* Confirmar alterações (valor do kWh) */}
      <NxDialog open={modal === 'review'} onClose={fechar} label="Confirmar alterações" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Confirmar alterações</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '6px 0', borderBottom: `1px solid ${NX.linha}` }}>
            <span>Valor do kWh</span><span><span style={{ color: NX.mudo }}>{tarifaCfg != null ? brl(tarifaCfg) : '—'}</span> → <b>{brl(tarifaNum)}</b></span>
          </div>
          <span style={{ fontSize: 13, color: NX.mudo }}>O novo valor vale a partir de agora. Recargas já fechadas não são recalculadas.</span>
          <NxDialogButtons onCancel={fechar} onConfirm={salvarTarifa} cancelLabel="Voltar" disabled={salvando} marginTop={8} />
        </div>
      </NxDialog>

      {/* Exportar recargas */}
      <NxDialog open={modal === 'export'} onClose={fechar} label="Exportar recargas" width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <NxDialogHead title="Exportar recargas" sub="Para a contabilidade cobrar no boleto do condomínio" onClose={fechar} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Mês de referência</span>
            <NxSeg value={mesExp} onChange={(v) => { setMesExp(v); setBaixado(''); }}
              options={mesesOpc.map((d, i) => ({ v: ymd(d), label: `${MES[d.getMonth()]}${i === 2 ? ' (parcial)' : ''}` }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Formato</span>
            <NxSeg value={formato} onChange={(v) => { setFormato(v); setBaixado(''); }} options={[{ v: 'xlsx', label: 'Excel (.xlsx)' }, { v: 'csv', label: 'CSV' }]} />
          </div>
          <div style={{ border: `1px solid ${NX.borda}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: NX.caixa, gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>Resumo por apartamento · {monthLabel}</span>
              <span style={{ fontSize: 12, color: NX.mudo, whiteSpace: 'nowrap' }}>{exp ? `${sessCount ?? '—'} recargas` : '…'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: EXP_COLS, gap: 10, padding: '8px 14px', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, borderTop: `1px solid ${NX.linha2}` }}>
              <span>APARTAMENTO</span><span style={{ textAlign: 'right' }}>RECARGAS</span><span style={{ textAlign: 'right' }}>ENERGIA</span><span style={{ textAlign: 'right' }}>VALOR</span>
            </div>
            {!exp && <div style={{ padding: '8px 14px', fontSize: 14, color: NX.mudo, borderTop: `1px solid ${NX.linha}` }}>Carregando…</div>}
            {exp && sumRows.length === 0 && <div style={{ padding: '8px 14px', fontSize: 14, color: NX.mudo, borderTop: `1px solid ${NX.linha}` }}>Sem recargas encerradas no mês.</div>}
            {sumRows.map((r, i) => (
              <div key={`${r.apto}-${i}`} style={{ display: 'grid', gridTemplateColumns: EXP_COLS, gap: 10, padding: '8px 14px', fontSize: 14, borderTop: `1px solid ${NX.linha}` }}>
                <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.apto}>{r.apto}</span>
                <span style={{ textAlign: 'right' }}>{r.n ?? '—'}</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.kwh, 1)} kWh</span>
                <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(r.rs)}</span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: EXP_COLS, gap: 10, padding: '10px 14px', fontSize: 14, fontWeight: 800, borderTop: `2px solid ${NX.texto}` }}>
              <span>Total</span><span style={{ textAlign: 'right' }}>{sessCount ?? '—'}</span><span style={{ textAlign: 'right' }}>{fmt(totKwh, 1)} kWh</span><span style={{ textAlign: 'right' }}>{brl(totRs)}</span>
            </div>
          </div>
          <div style={{ background: NX.caixa, borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: NX.caixaTx }}>
            <span><b>A planilha tem 2 abas:</b> Resumo por apartamento e Detalhe por recarga (apto, morador, vaga, início, fim, duração, kWh, R$/kWh, valor).</span>
            <span>Valores estimados: kWh medido × {tarifa != null ? `${brl(tarifa)}/kWh` : 'valor do kWh'} cadastrado no carregador.</span>
            <span>Recarga é atribuída ao mês em que <b>começou</b>. Recargas em andamento ficam para o mês seguinte.</span>
          </div>
          {erroDlg}
          <button type="button" onClick={baixar} disabled={!exp}
            style={{ height: 48, borderRadius: 12, fontSize: 16, fontWeight: 800, textAlign: 'center', color: '#FFFFFF', background: baixado ? '#2E8B47' : NX.acao, opacity: exp ? 1 : 0.6 }}>
            {baixado ? `✓ Download iniciado: ${baixado}` : 'Baixar planilha'}
          </button>
        </div>
      </NxDialog>
    </NxShell>
  );
}

export default CarregadorModal;
