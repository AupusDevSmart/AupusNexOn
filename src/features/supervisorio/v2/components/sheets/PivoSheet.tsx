import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { useUserStore } from '@/store/useUserStore';
import { useDados, getPath, fmt, tsInfo } from './sheetParts';
import { useCustos, linhasPosto, brl, unwrap, useHistorico, janela, bucketize, type Periodo } from './equipUi';
import {
  NX, s, NxShell, NxDialog, NxDialogButtons, NxSwitchRow, NxSeg, IcoChevron, IcoLixo, IcoCheck2, type NxTone,
} from './nxMock';
import {
  IrrigacaoAvancada, CONFIG_PADRAO, arco, tituloEnvio, resumoConfig, previsao, textoProgramacao,
  type ConfigIrrigacao, type EnvioIrrigacao, type FaixaCanhao, type Parada, type Programacao, type NovaProgramacao, type AbaIrrigacao,
} from './PivoIrrigacao';

/**
 * Modal do Pivô — cópia 1:1 do mockup "Web — Modal do Pivô" (NEXON-5), sobre a operação
 * em SEQUÊNCIA com o bombeamento (docs/IOT-PIVO-BOMBEAMENTO.md): "Ligar" faz o backend
 * ligar a bomba, confirmar, esperar a pressurização e só então girar; "Desligar" para o
 * pivô e desliga a bomba se nenhum outro pivô dela estiver girando.
 * Dados reais: /pivos/:id/estado, /acionar, /bombeamento, /config, /programacoes,
 * telemetria (/equipamentos/:id/dados), custos por posto e /logs-mqtt. Sem leitura → "—".
 */

type Bin = 0 | 1 | null;
type Acao = 'girar_direita' | 'girar_esquerda' | 'desligar';
interface Passo { t: string; etapa: string; msg: string; ok: boolean | null }
interface Bombeamento {
  ton_id: string; ton_nome: string | null; ton_removida: boolean; modo: 'pulso' | 'mantido';
  bo_liga: number; bo_desliga?: number | null; bi_confirma?: number | null; confirma_s?: number; pulso_ms?: number;
  ligada: Bin; compartilhada_com: string[];
}
interface Estado {
  pivo: { comandos: { direita: boolean; esquerda: boolean; desligar: boolean }; status: { direita: Bin; esquerda: Bin; desligado: Bin; erro: Bin } };
  bombeamento: null | Bombeamento;
  sequencia_cfg: { pressurizacao_s: number; confirma_giro_s: number };
  sequencia: null | { id: string; acao: string; status: string; passos: Passo[]; erro: string | null; created_at: string; finished_at: string | null; origem?: string };
  /** Automação do servidor (programação, agendamento, parada, ponta). Ausente em API antiga. */
  irrigacao?: {
    ativa: boolean; atual: IrrigacaoSrv | null; parar_em: string | null; ultima: IrrigacaoSrv | null;
    agendada: null | { id: string; acao: string; irrigacao: IrrigacaoSrv | null; inicio_em: string };
    pausada_ponta: null | { retoma_as: string };
    bomba_em_uso_por: string | null;
  };
}
interface IrrigacaoSrv { modo: string; config: ConfigIrrigacao; parada: Parada | { tipo: 'porTempo'; minutos: number }; programacao?: { nome: string } | null }
interface Janela { ativo: boolean; inicio: string; fim: string; dias: number[] }
interface ParametrosPivo {
  pressao_minima: number | null; lamina_100: number | null; tempo_volta_100: number | null; correcao_angulo_zero: number | null;
  direcionamento: 'valvula' | 'fisico'; valvula_ton_id: string | null; valvula_bo: number | null;
}
interface PivoConfig {
  bloqueio_ponta: Janela; reservado: Janela; origem_ponta: { numero_uc?: string; concessionaria?: string } | null;
  parametros?: ParametrosPivo; unidade_nome?: string | null; planta_nome?: string | null; proprietario_nome?: string | null;
}
interface Opcoes {
  tons: Array<{ id: string; nome: string; topico: string | null; unidade: string }>;
  bombeamentos: Array<{ pivo_id: string; nome: string; bombeamento: Partial<Bombeamento> | null }>;
}

/** Resposta da API vem com envelope simples ou duplo ({data:{data}}). */
const corpo = <T,>(r: unknown): T => {
  const d = unwrap<Record<string, unknown>>(r);
  return (d && typeof d === 'object' && 'data' in d && Object.keys(d).length <= 3 ? d.data : d) as T;
};
const erroMsg = (e: unknown): string => {
  const x = e as { response?: { data?: { message?: string; data?: { message?: string } } }; message?: string };
  return x?.response?.data?.message ?? x?.response?.data?.data?.message ?? x?.message ?? 'Falha';
};
const ACAO_LABEL: Record<Acao, string> = { girar_direita: 'Ligar · Avanço', girar_esquerda: 'Ligar · Reverso', desligar: 'Desligar' };
const col = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap });
const VERDE = '#1F7A43';

function usePivoEstado(id: string) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() =>
    api.get(`/pivos/${id}/estado`).then((r) => { setEstado(corpo<Estado>(r)); setErro(null); }).catch((e) => setErro(erroMsg(e))), [id]);
  const executando = estado?.sequencia?.status === 'executando';
  useEffect(() => {
    void carregar();
    const t = setInterval(carregar, executando ? 1500 : 10000);
    return () => clearInterval(t);
  }, [carregar, executando]);
  return { estado, erro, carregar, executando };
}

/** Programação de horários (/pivos/:id/programacoes) — mesma lista na Configuração e na aba Agenda. */
function useProgramacoes(pivoId: string) {
  const [progs, setProgs] = useState<Programacao[] | null>(null);
  const carregar = useCallback(() => {
    api.get(`/pivos/${pivoId}/programacoes`).then((r) => setProgs(corpo<Programacao[]>(r) ?? [])).catch(() => setProgs([]));
  }, [pivoId]);
  useEffect(() => { carregar(); }, [carregar]);
  const remover = async (pid: string) => {
    try { await api.delete(`/pivos/${pivoId}/programacoes/${pid}`); carregar(); toast.success('Horário removido'); }
    catch (e) { toast.error('Não removeu', { description: erroMsg(e) }); }
  };
  const salvar = async (p: NovaProgramacao) => {
    try { await api.post(`/pivos/${pivoId}/programacoes`, p); carregar(); toast.success('Agendamento salvo'); return true; }
    catch (e) { toast.error('Não salvou', { description: erroMsg(e) }); return false; }
  };
  return { progs, remover, salvar };
}

/** Abaixo de 760 px a grade de 2 colunas vira 1. */
function useEstreito(max = 759) {
  const q = `(max-width: ${max}px)`;
  const [v, setV] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setV(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return v;
}

// ------------------------------------------------------------------ mapa
const pt = (cx: number, cy: number, r: number, a: number) => {
  const t = (a * Math.PI) / 180;
  return [Math.round((cx + r * Math.sin(t)) * 10) / 10, Math.round((cy - r * Math.cos(t)) * 10) / 10];
};
const setorD = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const span = (((a1 - a0) % 360) + 360) % 360;
  const p0 = pt(cx, cy, r, a0), p1 = pt(cx, cy, r, a0 + span);
  return `M${cx} ${cy} L${p0[0]} ${p0[1]} A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${p1[0]} ${p1[1]} Z`;
};

function MapaPivo({ angulo, girando, falha, sentido, direcao, faixas }: {
  angulo: number | null; girando: boolean; falha: boolean; sentido: 'direita' | 'esquerda' | null; direcao: string; faixas: FaixaCanhao[];
}) {
  const a = angulo ?? 0;
  const arm = pt(179, 150, 118, a);
  const setor = sentido === 'esquerda' ? setorD(179, 150, 118, a - 47, a) : setorD(179, 150, 118, a, a + 47);
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', position: 'relative', height: 300, background: '#26301F' }}>
      <svg viewBox="0 0 358 300" width="100%" height="300" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }} role="img"
        aria-label={angulo != null ? `Mapa do pivô, ângulo atual ${fmt(angulo, 1)} graus` : 'Mapa do pivô, ângulo não informado'}>
        <rect x="0" y="0" width="358" height="300" fill="#2B3523" />
        <path d="M0 230 C60 210 90 270 150 300 L0 300 Z" fill="#1F2A1A" />
        <path d="M250 0 C270 40 320 50 358 40 L358 0 Z" fill="#5A4E35" opacity="0.6" />
        <circle cx="-10" cy="50" r="90" fill="#3A4730" />
        <circle cx="365" cy="230" r="100" fill="#3E4B33" />
        <circle cx="179" cy="150" r="118" fill="#5B5A3C" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        <path d={(girando || falha) && angulo != null ? setor : 'M0 0'} fill={falha ? 'rgba(229,88,79,0.45)' : 'rgba(114,191,74,0.5)'} />
        {faixas.map((f) => <path key={f.id} d={arco(179, 150, 125, f.liga, ((f.desliga - f.liga) % 360 + 360) % 360)} fill="none" stroke="#70C04B" strokeWidth="3" strokeLinecap="round" />)}
        {angulo != null && <line x1="179" y1="150" x2={arm[0]} y2={arm[1]} stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />}
        <circle cx="179" cy="150" r="4" fill="#FFFFFF" />
        <path d="M173 22 L185 22 L179 32 Z" fill="#FFFFFF" />
      </svg>
      <div style={{ position: 'absolute', top: 12, left: 12, height: 30, padding: '0 12px', borderRadius: 15, background: 'rgba(14,14,34,0.75)', color: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700 }}>
        {angulo != null ? `${fmt(angulo, 1)}°` : '—°'} · {direcao}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- gráfico
const kw = (v: unknown) => { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) ? null : Math.abs(n) > 1000 ? n / 1000 : n; };
const SERIES = [
  { label: 'Total', color: VERDE, pick: (d: Record<string, unknown>) => kw(d?.Pt ?? d?.['power.active_total']) },
  { label: 'Bomba', color: '#3B6FD6', pick: (d: Record<string, unknown>) => kw(getPath(d, 'bomba.Pt') ?? d?.bomba_Pt ?? getPath(d, 'bomba.potencia') ?? d?.bomba_potencia) },
];
function eixoX(p: Periodo, ini: Date, fim: Date) {
  if (p === 'hoje') return [0, 6, 12, 18, 24].map((h) => ({ f: h / 24, label: `${String(h).padStart(2, '0')}h` }));
  const span = fim.getTime() - ini.getTime();
  return Array.from({ length: 5 }, (_, i) => ({ f: i / 4, label: new Date(ini.getTime() + (span * i) / 4).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }));
}

function GraficoPotencia({ equipamentoId, resumo }: { equipamentoId: string; resumo: string }) {
  const [open, setOpen] = useState(false);
  const [per, setPer] = useState<Periodo>('hoje');
  const [ini, fim] = useMemo(() => {
    const [a, b] = janela(per);
    if (per === 'hoje') { const e = new Date(a); e.setDate(e.getDate() + 1); return [a, e]; }
    return [a, b];
  }, [per, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pts, loading } = useHistorico(equipamentoId, ini, per === 'hoje' ? new Date() : fim, open);
  const N = per === 'hoje' ? 96 : per === 'semana' ? 168 : 180;
  const linhas = useMemo(() => {
    if (!pts) return null;
    const vals = SERIES.map((x) => bucketize(pts, ini.getTime(), fim.getTime(), N, x.pick));
    const max = Math.max(1, ...vals.flat().filter((v): v is number => v != null));
    const paths = vals.map((arr) => {
      let d = ''; let pen = false;
      arr.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${(((i + 0.5) / N) * 700).toFixed(1)} ${Math.round(140 - (v / max) * 130)} `; pen = true;
      });
      return d;
    });
    return { paths, max, vazio: paths.every((p) => !p) };
  }, [pts, ini, fim, N]);
  const aba = (sel: boolean): CSSProperties => ({ height: 30, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', ...(sel ? { background: NX.card } : { color: NX.mudo }) });

  return (
    <div style={{ ...s.card, padding: '0 16px' }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={VERDE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l5-6 4 3 5-7 4 4" /><path d="M3 21h18" /></svg>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>Gráfico de potência</span>
        <span style={{ fontSize: 13, color: NX.mudo }}>{resumo}</span>
        <IcoChevron size={18} style={{ transition: 'transform .15s', transform: `rotate(${open ? 180 : 0}deg)` }} />
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${NX.linha2}`, padding: '12px 0 16px 0', ...col(8) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: NX.seg }}>
              {(['hoje', 'semana', 'mes'] as const).map((p) => (
                <button key={p} type="button" aria-pressed={per === p} onClick={() => setPer(p)} style={aba(per === p)}>{p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : 'Mês'}</button>
              ))}
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: NX.mudo }}>
              {SERIES.map((x) => (
                <span key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 3, background: x.color, borderRadius: 2 }} />{x.label}</span>
              ))}
              <button type="button" aria-label="Escolher grandezas do gráfico" style={{ width: 32, height: 32, borderRadius: 16, background: NX.seg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={VERDE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
              </button>
            </span>
          </div>
          {loading || !linhas ? (
            <div style={{ height: 170, display: 'grid', placeItems: 'center', fontSize: 13, color: NX.mudo }}>Carregando…</div>
          ) : linhas.vazio ? (
            <div style={{ height: 170, display: 'grid', placeItems: 'center', fontSize: 13, color: NX.mudo }}>Sem leituras no período</div>
          ) : (
            <svg viewBox="0 0 700 170" width="100%" height="170" role="img" aria-label="Potência do pivô e da bomba">
              <line x1="0" x2="700" y1="10" y2="10" stroke={NX.linha} />
              <line x1="0" x2="700" y1="140" y2="140" stroke={NX.borda} />
              <text x="0" y="24" fontSize="11" fill={NX.mudo}>{fmt(linhas.max, 0)} kW</text>
              {linhas.paths.map((d, i) => d && <path key={i} d={d} fill="none" stroke={SERIES[i].color} strokeWidth={i ? 2 : 2.2} strokeLinejoin="round" />)}
              {eixoX(per, ini, fim).map((t, i, a) => (
                <text key={i} x={t.f * 700} y="160" fontSize="11" fill={NX.mudo} textAnchor={i === 0 ? undefined : i === a.length - 1 ? 'end' : 'middle'}>{t.label}</text>
              ))}
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- registros
interface LogMqtt { id: string; mensagem?: string | null; severidade?: string | null; created_at?: string; regra?: { nome?: string | null } | null }
interface Reg { t: number; txt: string; quem: string; ok?: boolean; ruim?: boolean }

function RegistrosPivo({ equipamentoId, extra, estreito }: { equipamentoId: string; extra: Reg[]; estreito: boolean }) {
  const [rows, setRows] = useState<LogMqtt[] | null>(null);
  useEffect(() => {
    let vivo = true;
    api.get('/logs-mqtt', { params: { equipamentoId, limit: 6, page: 1 } })
      .then((r) => { if (vivo) { const d = unwrap<LogMqtt[] | { data?: LogMqtt[] }>(r); setRows(Array.isArray(d) ? d : d?.data ?? []); } })
      .catch(() => { if (vivo) setRows([]); });
    return () => { vivo = false; };
  }, [equipamentoId]);
  const todos: Reg[] = useMemo(() => [
    ...extra,
    ...(rows ?? []).map((l) => {
      const sev = String(l.severidade ?? '').toUpperCase();
      return { t: l.created_at ? new Date(l.created_at).getTime() : 0, txt: l.mensagem ?? l.regra?.nome ?? 'Evento', quem: l.regra?.nome ?? 'Sistema', ruim: sev === 'CRITICA' || sev === 'CRÍTICA' || sev === 'ALTA' };
    }),
  ].sort((x, y) => y.t - x.t).slice(0, Math.max(6, extra.length)), [rows, extra]);
  const grade = estreito ? '84px 1fr 96px 24px' : '120px 1fr 160px 28px';
  const gap = estreito ? 8 : 12;
  return (
    <div style={{ ...s.card, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Registros</span>
        <Link to={`/logs/logs-mqtt?equipamentoId=${encodeURIComponent(equipamentoId)}`} style={{ fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Ver todos ›</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: grade, gap, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, borderTop: `1px solid ${NX.linha2}` }}>
        <span>DATA/HORA</span><span>EVENTO</span><span>ORIGEM</span><span />
      </div>
      {rows == null && !extra.length ? (
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>Carregando…</div>
      ) : todos.length === 0 ? (
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, fontSize: 14, color: NX.mudo }}>Nenhum registro deste equipamento.</div>
      ) : todos.map((l, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: grade, gap, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${NX.linha}`, ...(l.ruim ? { background: 'rgba(197,48,48,0.06)' } : {}) }}>
          <span style={{ fontSize: 13, color: NX.mudo, fontVariantNumeric: 'tabular-nums' }}>
            {l.t ? new Date(l.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—'}
          </span>
          <span style={{ fontSize: 14, color: l.ruim ? NX.bad : NX.texto, ...(l.ruim ? { fontWeight: 700 } : {}) }}>{l.txt}</span>
          <span style={{ fontSize: 13, color: NX.mudo, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.quem}</span>
          <span style={{ display: 'flex', justifyContent: 'center' }}>{l.ok && <IcoCheck2 />}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ modal
const kpiCel = (i: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, ...(i % 3 ? { borderLeft: `1px solid ${NX.linha}` } : {}) });
const chaveParada = (id: string) => `nexon:pivo:ultima-parada:${id}`;

/**
 * Perfis do mockup: Admin/Analista mexem em tudo; Proprietário só no horário de ponta e
 * na programação; Operador (e demais) só leem a Configuração. A API confere de novo.
 */
function usePerfilPivo() {
  const { getUserRole, hasPermission } = useUserStore();
  const role = getUserRole();
  const tecnico = ['super_admin', 'admin', 'analista', 'gerente'].includes(role) || hasPermission('equipamentos.manage');
  const prop = tecnico || role === 'proprietario' || hasPermission('equipamentos.acionar_ponto');
  return { tecnico, prop };
}

export function PivoSheet({ equipamentoId, nome, onClose }: { equipamentoId: string; nome?: string; onClose: () => void }) {
  const id = equipamentoId.trim();
  const titulo = nome || 'Pivô';
  const estreito = useEstreito();
  const perfil = usePerfilPivo();
  const { dados, ts } = useDados(id);
  const { estado, erro, carregar, executando } = usePivoEstado(id);
  const prog = useProgramacoes(id);
  const [aba, setAba] = useState('op');
  const [modal, setModal] = useState<null | 'cost' | 'irr'>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'quick' | 'stop' | 'start'>('quick');
  const [irrAba, setIrrAba] = useState<AbaIrrigacao>('simples');
  const [envio, setEnvio] = useState<EnvioIrrigacao | null>(null);
  // Última irrigação enviada por este navegador (a TON só recebe direção e liga/desliga).
  const chaveUltima = `nexon:pivo:ultima:${id}`;
  const [ultima, setUltima] = useState<ConfigIrrigacao>(() => {
    try { const v = localStorage.getItem(chaveUltima); return v ? { ...CONFIG_PADRAO, ...JSON.parse(v) } : CONFIG_PADRAO; } catch { return CONFIG_PADRAO; }
  });
  const [ultimaParada, setUltimaParada] = useState<Parada>(() => {
    try { const v = localStorage.getItem(chaveParada(id)); return v ? JSON.parse(v) : { tipo: 'semParar' }; } catch { return { tipo: 'semParar' }; }
  });
  // A última irrigação gravada no servidor vale para qualquer navegador/app.
  const ultimaSrv = estado?.irrigacao?.ultima;
  useEffect(() => {
    if (!ultimaSrv?.config) return;
    setUltima({ ...CONFIG_PADRAO, ...ultimaSrv.config, faixasCanhao: ultimaSrv.config.faixasCanhao ?? [] });
    const p = ultimaSrv.parada;
    if (p && p.tipo !== 'porTempo') setUltimaParada(p);
  }, [ultimaSrv]);
  const [cfgPivo, setCfgPivo] = useState<PivoConfig | null>(null);
  const carregarCfg = useCallback(() => {
    api.get(`/pivos/${id}/config`).then((r) => setCfgPivo(corpo<PivoConfig>(r) ?? null)).catch(() => setCfgPivo(null));
  }, [id]);
  useEffect(() => { carregarCfg(); }, [carregarCfg]);
  const ponta = cfgPivo?.bloqueio_ponta ?? null;
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [custoPer, setCustoPer] = useState<'dia' | 'mes'>('dia');

  const g = (p: string) => getPath(dados, p);
  const num = (...ps: string[]) => { for (const p of ps) { const v = g(p); if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v); } return null; };
  const info = tsInfo(ts);
  const ptKw = kw(g('Pt') ?? g('power.active_total'));

  const st = estado?.pivo.status;
  const b = estado?.bombeamento ?? null;
  const seq = estado?.sequencia ?? null;
  const irrSrv = estado?.irrigacao;
  const semStatus = st?.direita == null && st?.esquerda == null && st?.desligado == null;
  // Sem BI de status na TON: vale o que o servidor comandou (sequência concluída e não desligada).
  const girando = st?.direita === 1 || st?.esquerda === 1 || (semStatus && !!irrSrv?.ativa && seq?.status !== 'executando');
  const cfgAtual = irrSrv?.atual?.config ?? null;
  const sentido: 'direita' | 'esquerda' | null = st?.direita === 1 ? 'direita' : st?.esquerda === 1 ? 'esquerda'
    : girando && cfgAtual ? (cfgAtual.direcao === 'Avanço' ? 'direita' : 'esquerda') : null;
  const emUsoPor = !girando ? irrSrv?.bomba_em_uso_por ?? null : null;
  const agendada = irrSrv?.agendada ?? null;
  const pausaPonta = irrSrv?.pausada_ponta ?? null;
  const direcaoAtual = sentido === 'direita' ? 'Avanço' : sentido === 'esquerda' ? 'Reverso' : ultima.direcao;
  const cfgGiro = cfgAtual ?? ultima;
  const angulo = num('angulo', 'posicao');
  const angTxt = angulo != null ? `${fmt(angulo, 1)}°` : '—';
  const ligando = executando && seq?.acao !== 'desligar';
  const on = girando || ligando;
  // Última partida que falhou (nas últimas 6 h) e o pivô parado: falha.
  const falhaSeq = !!seq?.erro && !executando && !girando && Date.now() - new Date(seq.finished_at ?? seq.created_at).getTime() < 6 * 3600000;
  const falhaPressao = falhaSeq && /press/i.test(seq?.erro ?? '');
  const falha = st?.erro === 1 || falhaSeq;

  const { tone, label, texto } = ((): { tone: NxTone; label: string; texto: string } => {
    if (executando && seq?.acao === 'desligar') return { tone: 'ok', label: 'Normal', texto: 'Desligando…' };
    if (ligando) return { tone: 'ok', label: 'Normal', texto: b ? 'Esperando pressurização · bomba ligada' : 'Ligando…' };
    if (falha) return { tone: 'bad', label: 'Falha', texto: falhaPressao ? 'Falha de pressão · Parado' : st?.erro === 1 ? 'Falha no painel · Parado' : 'Falha na partida · Parado' };
    if (girando) return { tone: 'ok', label: 'Normal', texto: cfgGiro.semAgua ? `Girando · ${direcaoAtual} · Seco` : `Irrigando · ${cfgGiro.percentual}% · ${direcaoAtual} · Molhado` };
    if (pausaPonta) return { tone: 'ok', label: 'Normal', texto: `Pausado pelo horário de ponta · retoma às ${pausaPonta.retoma_as}` };
    if (emUsoPor) return { tone: 'ok', label: 'Normal', texto: `Parado · Bomba em uso pelo ${emUsoPor}` };
    if (st?.desligado === 1 || st?.direita === 0 || st?.esquerda === 0) return { tone: 'ok', label: 'Normal', texto: 'Parado · Painel energizado' };
    if (semStatus && estado) return { tone: 'ok', label: 'Normal', texto: 'Parado' };
    if (!estado && !info.online) return { tone: 'off', label: 'Sem comunicação', texto: info.hasTs ? `Última leitura ${info.idade}` : 'Sem leitura' };
    return { tone: 'warn', label: 'Alerta', texto: 'Status do pivô não lido da TON' };
  })();

  // "Término previsto hoje 22:10 · ângulo final 0°" (parada por ângulo da última irrigação).
  const eta = useMemo(() => {
    if (girando && irrSrv?.parar_em) {
      const f = new Date(irrSrv.parar_em);
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const dias = Math.floor((new Date(f).setHours(0, 0, 0, 0) - d0.getTime()) / 86400000);
      const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
      const p = irrSrv.atual?.parada;
      return `Término previsto ${quando} ${f.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p?.tipo === 'porAngulo' ? ` · ângulo final ${p.angulo}°` : ''}${irrSrv.atual?.programacao ? ` · ${irrSrv.atual.programacao.nome}` : ''}`;
    }
    if (!girando || ultimaParada.tipo !== 'porAngulo' || angulo == null) return null;
    const p = previsao(ultima, ultimaParada, direcaoAtual as ConfigIrrigacao['direcao'], angulo, 21, new Date());
    if (!p.fim) return null;
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const dias = Math.floor((new Date(p.fim).setHours(0, 0, 0, 0) - d0.getTime()) / 86400000);
    const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
    return `Término previsto ${quando} ${p.fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ângulo final ${ultimaParada.angulo}°`;
  }, [girando, ultimaParada, angulo, ultima, direcaoAtual, irrSrv]);
  const agendadaTxt = agendada
    ? `Início agendado ${new Date(agendada.inicio_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${agendada.irrigacao ? ` · ${resumoConfig({ ...CONFIG_PADRAO, ...agendada.irrigacao.config })}` : ''}`
    : null;

  const acaoDe = (c: ConfigIrrigacao): Acao => (c.direcao === 'Avanço' ? 'girar_direita' : 'girar_esquerda');
  const acionar = async (acao: Acao, irrigacao?: EnvioIrrigacao) => {
    setModal(null); setConfirmOpen(false);
    setEnviando(acao);
    try {
      const r = await api.post(`/pivos/${id}/acionar`, irrigacao ? { acao, irrigacao } : { acao });
      const res = corpo<{ status?: string; inicio_em?: string }>(r);
      if (irrigacao) {
        setUltima(irrigacao.config); setUltimaParada(irrigacao.parada);
        try {
          localStorage.setItem(chaveUltima, JSON.stringify(irrigacao.config));
          localStorage.setItem(chaveParada(id), JSON.stringify(irrigacao.parada));
        } catch { /* sem storage */ }
      }
      if (res?.status === 'agendada' && res.inicio_em) {
        toast.success(`Irrigação agendada para ${new Date(res.inicio_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`, { description: 'O servidor liga o pivô na hora — acompanhe em Registros.' });
      } else {
        toast.success(`${ACAO_LABEL[acao]}: sequência iniciada`, { description: irrigacao?.config.semAgua ? 'Girando sem água: a bomba não liga.' : b ? 'Bomba, pressurização e giro — acompanhe em Registros.' : undefined });
      }
      setEnvio(null);
      await carregar();
    } catch (e) {
      toast.error(`${ACAO_LABEL[acao]}: não iniciou`, { description: erroMsg(e) });
    } finally {
      setEnviando(null);
    }
  };

  const media = (...ks: string[]) => { const v = ks.map((k) => num(k)).filter((x): x is number => x != null); return v.length ? v.reduce((a, c) => a + c, 0) / v.length : null; };
  const tensao = media('Vab', 'Vbc', 'Vca') ?? media('Va', 'Vb', 'Vc');
  const corrente = media('Ia', 'Ib', 'Ic');
  const kpis = [
    { k: 'Ângulo', v: angTxt },
    { k: 'Pressão', v: num('pressao') != null ? `${fmt(num('pressao'), 1)} bar` : '—' },
    { k: 'Tensão', v: tensao != null ? `${fmt(tensao, 0)} V` : '—' },
    { k: 'Potência total', v: ptKw != null ? `${fmt(ptKw, 1)} kW` : '—' },
    { k: 'Corrente pivô', v: corrente != null ? `${fmt(corrente, 1)} A` : '—' },
    { k: 'Horímetro', v: num('horimetro') != null ? `${fmt(num('horimetro'), 0)} h` : '—' },
  ];
  const bNum = (...ks: string[]) => num(...ks.map((k) => `bomba.${k}`), ...ks.map((k) => `bomba_${k}`));
  const bKpis = [
    { k: 'Pressão recalque', v: bNum('pressao') != null ? `${fmt(bNum('pressao'), 1)} bar` : '—' },
    { k: 'Potência', v: bNum('Pt', 'potencia') != null ? `${fmt(kw(bNum('Pt', 'potencia')), 1)} kW` : '—' },
    { k: 'FP', v: bNum('FPt', 'fp') != null ? fmt(bNum('FPt', 'fp'), 2) : '—' },
    { k: 'Temp. motor', v: bNum('temperatura') != null ? `${fmt(bNum('temperatura'), 0)} °C` : '—' },
    { k: 'Horímetro', v: bNum('horimetro') != null ? `${fmt(bNum('horimetro'), 0)} h` : '—' },
    { k: 'Partidas', v: bNum('partidas') != null ? fmt(bNum('partidas'), 0) : '—' },
  ];
  const fases: Array<[string, string, string]> = (['a', 'b', 'c'] as const).map((f) => {
    const ff = { a: 'Vab', b: 'Vbc', c: 'Vca' }[f];
    const v = bNum(ff) ?? num(ff) ?? num(`V${f}`), i = bNum(`I${f}`) ?? num(`I${f}`);
    return [ff.slice(1).toUpperCase(), v != null ? `${fmt(v, 0)} V` : '—', i != null ? `${fmt(i, 1)} A` : '—'];
  });
  const bStatus = !b ? '—' : falhaPressao ? 'Desligada · falha de pressão' : emUsoPor ? `Em uso pelo ${emUsoPor}` : b.ligada === 1 ? 'Ligada'
    : b.ligada === 0 ? 'Desligada' : girando && !cfgGiro.semAgua ? 'Ligada' : girando ? 'Desligada · girando sem água' : 'Sem retorno';
  const bCor = !b ? NX.neutro : falhaPressao ? NX.bad : emUsoPor || b.ligada === 1 || (b.ligada == null && girando && !cfgGiro.semAgua) ? NX.ok : NX.neutro;
  const bSub = !b ? 'Não configurado' : `${b.ton_nome ?? 'TON'}${b.ton_removida ? ' (removida!)' : ''} · ${b.compartilhada_com.length ? 'sistema conjugado' : 'ligada junto com o pivô'}`;

  // Passos da última sequência entram em Registros (✓✓ = confirmado pelo equipamento).
  const regSeq: Reg[] = useMemo(() => (seq?.passos ?? []).map((p) => ({
    t: new Date(p.t).getTime(), txt: p.msg, quem: p.etapa === 'comando' ? 'Comando' : 'Sistema', ok: p.ok === true, ruim: p.ok === false,
  })), [seq?.passos]);

  const { res: custoDia } = useCustos(id, 'dia');
  const { res: custoSel } = useCustos(id, custoPer, undefined, modal === 'cost');

  // Botão principal
  const cmdOff = on ? !estado?.pivo.comandos.desligar && !b : !estado?.pivo.comandos[ultima.direcao === 'Avanço' ? 'direita' : 'esquerda'];
  const busy = !!enviando || (executando && seq?.acao === 'desligar');
  const desligaAgenda = !on && !!agendada;
  const cmdLabel = emUsoPor && !on ? `Bomba em uso pelo ${emUsoPor}` : busy ? 'Executando…' : on || desligaAgenda ? (desligaAgenda ? 'Cancelar agendamento' : 'Desligar') : 'Ligar';
  const cmdBloq = (!!emUsoPor && !on) || (cmdOff && !desligaAgenda);
  const cmdStyle = s.cmd(busy || cmdBloq ? 'busy' : on || desligaAgenda ? 'outline' : 'primary');

  const confirmQ = confirmKind === 'stop' ? (desligaAgenda ? 'Cancelar o início agendado?' : `Desligar ${titulo}?`) : confirmKind === 'start' && envio ? tituloEnvio(envio.modo) : `Ligar ${titulo}?`;
  const paradaTxt = (p: Parada, e?: EnvioIrrigacao | null) => (e?.modo === 'angulo' ? `ângulo final ${e.anguloFinal ?? 0}°`
    : p.tipo === 'porAngulo' ? `para em ${p.angulo}°` : p.tipo === 'porVoltas' ? `${p.voltas} volta${p.voltas > 1 ? 's' : ''}` : 'sem parada');
  const partida = b ? ' A bomba liga e o pivô gira após a pressurização.' : '';
  const confirmNote = confirmKind === 'stop'
    ? desligaAgenda ? `${agendadaTxt}. O pivô não vai ligar sozinho.` : `O pivô para na posição atual (${angTxt})${b ? ' e a bomba desliga' : ''}.`
    : confirmKind === 'start' && envio
      ? `Com esta configuração: ${resumoConfig(envio.config)} · ${paradaTxt(envio.parada, envio)}${envio.inicio ? ` · início ${envio.inicio.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}.${partida}`
      : `Com a última configuração: ${resumoConfig(ultima)} · sem parada.${partida}`;
  const doConfirm = () => {
    if (confirmKind === 'stop') void acionar('desligar');
    else if (confirmKind === 'start' && envio) void acionar(acaoDe(envio.config), envio);
    else void acionar(acaoDe(ultima), { modo: 'simples', config: ultima, parada: { tipo: 'semParar' }, inicio: null });
  };
  const cancelConfirm = () => setConfirmOpen(false);
  const abrirIrr = (a: AbaIrrigacao = 'simples') => { setIrrAba(a); setModal('irr'); };

  const custoGrid: CSSProperties = estreito
    ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', rowGap: 8, padding: '12px 0' }
    : { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' };
  const linhasCusto = linhasPosto(custoSel);
  const corPosto = (k: string) => (k === 'Ponta' ? NX.bad : k === 'Fora de ponta' ? '#3B6FD6' : NX.ok);

  return (
    <NxShell
      title={titulo}
      subtitle={[cfgPivo?.unidade_nome ?? custoDia?.unidade?.nome, cfgPivo?.planta_nome, cfgPivo?.proprietario_nome].filter(Boolean).join(' · ') || (info.hasTs ? info.label : 'Sem leitura de energia')}
      right={<span style={s.pill(tone)}><span style={s.pillDot(tone)} />{label}</span>}
      tabs={[{ key: 'op', label: 'Operação' }, { key: 'cfg', label: 'Configuração' }]}
      tab={aba}
      onTab={setAba}
      onClose={onClose}
    >
      {aba === 'op' ? (
        <div style={{ padding: '20px 24px 28px 24px', ...col(16) }}>
          <div style={{ display: 'grid', gridTemplateColumns: estreito ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
            <div style={col(12)}>
              <MapaPivo angulo={angulo} girando={girando} falha={falha} sentido={sentido} direcao={direcaoAtual} faixas={ultima.canhao ? ultima.faixasCanhao : []} />
              <div style={{ ...s.card, padding: '12px 16px', ...col(4) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={s.stDot(tone)} />
                  <span style={s.stLabel(tone)}>{label}</span>
                  <span style={{ fontSize: 14, color: NX.mudo }}>{texto}</span>
                </div>
                {eta && <span style={{ fontSize: 13, color: NX.mudo }}>{eta}</span>}
                {agendadaTxt && <span style={{ fontSize: 13, color: NX.mudo }}>{agendadaTxt}</span>}
                {erro && <span style={{ fontSize: 13, color: NX.warn }}>{erro}</span>}
              </div>
              <button type="button" disabled={busy || cmdBloq} style={cmdStyle}
                onClick={() => { setConfirmKind(on || desligaAgenda ? 'stop' : 'quick'); setConfirmOpen(true); }}>{cmdLabel}</button>
              <button type="button" onClick={() => abrirIrr('simples')}
                style={{ alignSelf: 'center', height: 36, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: NX.mudo }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NX.mudo} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
                Irrigação avançada
              </button>
            </div>
            <div style={col(12)}>
              <div style={{ ...s.card, padding: '14px 0', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', rowGap: 14 }}>
                {kpis.map((k, i) => (
                  <div key={k.k} style={kpiCel(i)}>
                    <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{k.v}</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>{k.k}</span>
                  </div>
                ))}
              </div>
              <div style={{ ...s.card, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${NX.linha2}`, gap: 12 }}>
                  <span style={{ ...col(2), minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>Bombeamento</span>
                    <span style={{ fontSize: 12, color: NX.mudo }}>{bSub}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: bCor, textAlign: 'right' }}>{bStatus}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', rowGap: 12, padding: '12px 0' }}>
                  {bKpis.map((k, i) => (
                    <div key={k.k} style={kpiCel(i)}>
                      <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{k.v}</span>
                      <span style={{ fontSize: 11, color: NX.mudo, textAlign: 'center' }}>{k.k}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: `1px solid ${NX.linha2}`, padding: '0 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 11, fontWeight: 700, color: NX.mudo, padding: '8px 0', letterSpacing: 0.4 }}>
                    <span>FASE</span><span style={{ textAlign: 'right' }}>TENSÃO</span><span style={{ textAlign: 'right' }}>CORRENTE</span>
                  </div>
                  {fases.map((f) => (
                    <div key={f[0]} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 14, padding: '7px 0', borderTop: `1px solid ${NX.linha}` }}>
                      <span>{f[0]}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f[1]}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f[2]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => setModal('cost')}
            style={{ width: '100%', boxSizing: 'border-box', ...s.card, display: 'grid', alignItems: 'center', minHeight: 76, ...custoGrid }}>
            <span style={{ ...col(2), padding: '0 20px', minWidth: 0 }}>
              <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Custo desta irrigação</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{brl(custoDia?.custos.custo_total)}</span>
            </span>
            <span style={{ ...col(2), padding: '0 20px', borderLeft: `1px solid ${NX.linha}`, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: NX.mudo, whiteSpace: 'nowrap' }}>Energia do pivô</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{custoDia ? `${fmt(custoDia.consumo.energia_total_kwh, 0)} kWh` : '—'}</span>
            </span>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 20px', height: 44, fontSize: 14, fontWeight: 800, color: VERDE, whiteSpace: 'nowrap',
              ...(estreito ? { gridColumn: '1 / -1', borderTop: `1px solid ${NX.linha}` } : { borderLeft: `1px solid ${NX.linha}` }),
            }}>
              <span>Custos por horário</span><span>›</span>
            </span>
          </button>

          <GraficoPotencia equipamentoId={id} resumo={ptKw != null ? `${fmt(ptKw, 1)} kW agora` : '—'} />

          <RegistrosPivo equipamentoId={id} extra={regSeq} estreito={estreito} />
        </div>
      ) : (
        <ConfigPivo pivoId={id} estado={estado} cfg={cfgPivo} perfil={perfil} onSalvo={() => { void carregar(); carregarCfg(); }}
          progs={prog.progs} onRemoverProg={prog.remover} onAdicionarHorario={() => abrirIrr('agenda')} />
      )}

      {/* Confirmar comando */}
      <NxDialog open={confirmOpen} onClose={cancelConfirm} label="Confirmar comando" width={380}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{confirmQ}</span>
        <span style={{ fontSize: 14, color: NX.mudo }}>{confirmNote}</span>
        <NxDialogButtons onCancel={cancelConfirm} onConfirm={doConfirm} />
      </NxDialog>

      {/* Irrigação avançada */}
      <NxDialog open={modal === 'irr'} onClose={() => setModal(null)} label="Irrigação avançada" width={520}>
        {modal === 'irr' && (
          <IrrigacaoAvancada
            key={irrAba}
            nome={titulo} angulo={angulo} ultima={ultima} lamina100={cfgPivo?.parametros?.lamina_100 ?? 7.15} tempoVolta100={cfgPivo?.parametros?.tempo_volta_100 ?? 21} ponta={ponta}
            enviando={!!enviando} abaInicial={irrAba}
            programacoes={prog.progs} onRemoverProgramacao={prog.remover} onSalvarProgramacao={prog.salvar}
            onEnviar={(e) => { setEnvio(e); setConfirmKind('start'); setConfirmOpen(true); }}
            onClose={() => setModal(null)}
          />
        )}
      </NxDialog>

      {/* Custos por horário */}
      <NxDialog open={modal === 'cost'} onClose={() => setModal(null)} label="Custos por horário" width={520}>
        <div style={col(12)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={col(2)}>
              <span style={{ fontSize: 19, fontWeight: 800 }}>Custos por horário</span>
              <span style={{ fontSize: 13, color: NX.mudo }}>{titulo} · tarifa com impostos · {custoPer === 'mes' ? 'mês até hoje' : girando ? 'irrigação em andamento' : 'hoje'}</span>
            </span>
            <button type="button" aria-label="Fechar" onClick={() => setModal(null)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NX.mudo} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, padding: 4, borderRadius: 12, background: NX.seg }}>
            <button type="button" aria-pressed={custoPer === 'dia'} onClick={() => setCustoPer('dia')} style={s.dTab(custoPer === 'dia')}>Irrigação</button>
            <button type="button" aria-pressed={custoPer === 'mes'} onClick={() => setCustoPer('mes')} style={s.dTab(custoPer === 'mes')}>Mês</button>
            <button type="button" disabled aria-pressed={false} title="Sem dados por safra" style={{ ...s.dTab(false), color: NX.desab }}>Safra</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', fontSize: 11, fontWeight: 700, color: NX.mudo, letterSpacing: 0.4, padding: '4px 0' }}>
            <span>POSTO</span><span style={{ textAlign: 'right' }}>kWh</span><span style={{ textAlign: 'right' }}>R$/kWh</span><span style={{ textAlign: 'right' }}>R$</span>
          </div>
          {!custoSel ? (
            <div style={{ fontSize: 14, color: NX.mudo, padding: '8px 0', borderTop: `1px solid ${NX.linha}` }}>Sem custo calculado para o período (confira a unidade e a tarifa do equipamento).</div>
          ) : (
            <>
              {linhasCusto.map((r) => (
                <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', fontSize: 14, padding: '8px 0', borderTop: `1px solid ${NX.linha}` }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: corPosto(r.k) }} />{r.k}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.kwh, 0)}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.tarifa != null ? fmt(r.tarifa, 2) : '—'}</span>
                  <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(r.rs)}</span>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', fontSize: 14, padding: '8px 0', borderTop: `1px solid ${NX.linha}`, color: NX.mudo }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: NX.neutro }} />Demanda</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>—</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>—</span>
                <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{custoPer === 'mes' && Number(custoSel.custos.custo_demanda) > 0 ? brl(custoSel.custos.custo_demanda) : 'a apurar'}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, borderTop: `2px solid ${NX.texto}`, paddingTop: 10 }}>
            <span>Total</span><span>{brl(custoSel?.custos.custo_total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: NX.mudo }}>
            <span>Pivô {custoSel ? fmt(custoSel.consumo.energia_total_kwh, 0) : '—'} kWh · {brl(custoSel?.custos.custo_total)} &nbsp;|&nbsp; Bombeamento —</span>
            <span style={{ whiteSpace: 'nowrap' }}>R$/mm/ha: —</span>
          </div>
        </div>
      </NxDialog>
    </NxShell>
  );
}

// ---------------------------------------------------------------------------
// Configuração: bombeamento + partida + ponta + programação
// ---------------------------------------------------------------------------
interface FormBomba { ton_id: string; modo: 'pulso' | 'mantido'; bo_liga: string; bo_desliga: string; bi_confirma: string; confirma_s: string; pulso_ms: string }
const formDe = (o?: Partial<Bombeamento> | null): FormBomba => ({
  ton_id: o?.ton_id ?? '', modo: o?.modo ?? 'pulso', bo_liga: String(o?.bo_liga ?? 1), bo_desliga: String(o?.bo_desliga ?? ''),
  bi_confirma: String(o?.bi_confirma ?? ''), confirma_s: String(o?.confirma_s ?? 30), pulso_ms: String(o?.pulso_ms ?? 1000),
});
const numOk = (v: string, min: number, max: number) => { const n = Number(String(v).replace(',', '.')); return v !== '' && Number.isFinite(n) && n >= min && n <= max; };
const secao = (t: string, mt: number) => <span style={{ ...s.label, marginTop: mt }}>{t}</span>;

/** Select nativo com a cara do chip do mockup ("Bomba 01 · TON 112 · Casa de bombas ⌄"). */
function ChipSelect({ value, onChange, label, height = 38, disabled, children }: {
  value: string; onChange: (v: string) => void; label: string; height?: number; disabled?: boolean; children: ReactNode;
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '60%' }}>
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        style={{ height, padding: '0 34px 0 12px', borderRadius: 10, border: `1px solid ${NX.borda}`, fontSize: 14, fontWeight: 700, color: NX.texto, background: NX.card, appearance: 'none', WebkitAppearance: 'none', maxWidth: '100%', textOverflow: 'ellipsis', cursor: disabled ? 'default' : 'pointer' }}>
        {children}
      </select>
      <IcoChevron style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} />
    </span>
  );
}
function Linha({ titulo, sub, children, minHeight = 56 }: { titulo: string; sub?: string; children: ReactNode; minHeight?: number }) {
  return (
    <div style={{ borderTop: `1px solid ${NX.linha}`, minHeight, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={col(2)}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</span>
        {sub && <span style={{ fontSize: 12, color: NX.mudo }}>{sub}</span>}
      </span>
      {children}
    </div>
  );
}

const PARAMS = [
  { key: 'pressurizacao_s', label: 'Tempo para pressurizar', hint: 'Espera entre a bomba ligar e o pivô girar · faixa 10 a 600 s', unit: 's', min: 10, max: 600, real: true, d: 0 },
  { key: 'confirma_giro_s', label: 'Confirmação do giro', hint: 'Tempo para o status "Irrigando" aparecer · faixa 5 a 120 s', unit: 's', min: 5, max: 120, real: true, d: 0 },
  { key: 'pressao_minima', label: 'Pressão mínima', hint: 'Abaixo dela: falha de pressão · faixa 0,5 a 6,0 bar', unit: 'bar', min: 0.5, max: 6, real: true, d: 1 },
  { key: 'lamina_100', label: 'Lâmina d’água a 100%', hint: 'Faixa 2,00 a 20,00 mm', unit: 'mm', min: 2, max: 20, real: true, d: 2 },
  { key: 'tempo_volta_100', label: 'Tempo de volta a 100%', hint: 'Base da previsão de término · faixa 6 a 72 h', unit: 'h', min: 6, max: 72, real: true, d: 1 },
  { key: 'correcao_angulo_zero', label: 'Correção do ângulo zero', hint: 'Faixa −180 a 180°', unit: '°', min: -180, max: 180, real: true, d: 0 },
] as const;

function ConfigPivo({ pivoId, estado, cfg, perfil, onSalvo, progs, onRemoverProg, onAdicionarHorario }: {
  pivoId: string; estado: Estado | null; cfg: PivoConfig | null; perfil: { tecnico: boolean; prop: boolean }; onSalvo: () => void;
  progs: Programacao[] | null; onRemoverProg: (id: string) => void; onAdicionarHorario: () => void;
}) {
  const [op, setOp] = useState<Opcoes | null>(null);
  // Base (gravado) × rascunho
  const [base, setBase] = useState<{ ativo: boolean; f: FormBomba; seq: { pressurizacao_s: number; confirma_giro_s: number } } | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [f, setF] = useState<FormBomba>(formDe());
  const [seq, setSeq] = useState({ pressurizacao_s: '120', confirma_giro_s: '30' });
  const [conj, setConj] = useState(false);
  const [conjPivo, setConjPivo] = useState('');
  const [ponta, setPonta] = useState<Janela | null>(null);
  // Parâmetros de irrigação e válvula (pivo_config.parametros) — texto do campo × gravado.
  const fmtPar = (v: number | null | undefined, d: number) => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const [par, setPar] = useState<Record<string, string>>({});
  const [agua, setAgua] = useState<{ direcionamento: 'valvula' | 'fisico'; valvula: string }>({ direcionamento: 'valvula', valvula: '' });
  useEffect(() => {
    const pp = cfg?.parametros;
    setPar({
      pressao_minima: fmtPar(pp?.pressao_minima, 1), lamina_100: fmtPar(pp?.lamina_100, 2),
      tempo_volta_100: fmtPar(pp?.tempo_volta_100, 1), correcao_angulo_zero: fmtPar(pp?.correcao_angulo_zero, 0),
    });
    setAgua({ direcionamento: pp?.direcionamento ?? 'valvula', valvula: pp?.valvula_ton_id && pp?.valvula_bo ? `${pp.valvula_ton_id}|${pp.valvula_bo}` : '' });
  }, [cfg]);  
  const parNum = (k: string) => { const t = (par[k] ?? '').trim(); return t === '' ? null : Number(t.replace(',', '.')); };
  const [revisar, setRevisar] = useState(false);
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    api.get(`/pivos/${pivoId}/bombeamento/opcoes`).then((r) => setOp(corpo<Opcoes>(r))).catch(() => setOp({ tons: [], bombeamentos: [] }));
  }, [pivoId]);
  useEffect(() => { setPonta(cfg?.bloqueio_ponta ?? null); }, [cfg]);
  useEffect(() => {
    if (!estado || base) return;
    const b = estado.bombeamento;
    const fb = formDe(b);
    setBase({ ativo: !!b, f: fb, seq: estado.sequencia_cfg });
    setAtivo(!!b); setF(fb); setConj(!!b?.compartilhada_com.length);
    setSeq({ pressurizacao_s: String(estado.sequencia_cfg.pressurizacao_s), confirma_giro_s: String(estado.sequencia_cfg.confirma_giro_s) });
  }, [estado, base]);
  useEffect(() => {
    if (conjPivo || !op || !f.ton_id) return;
    const o = op.bombeamentos.find((x) => x.pivo_id !== pivoId && x.bombeamento?.ton_id === f.ton_id);
    if (o) setConjPivo(o.pivo_id);
  }, [op, f.ton_id, conjPivo, pivoId]);

  const set = (k: keyof FormBomba, v: string) => setF((x) => ({ ...x, [k]: v }));
  const copiarDe = (pid: string) => {
    setConjPivo(pid);
    const o = op?.bombeamentos.find((x) => x.pivo_id === pid)?.bombeamento;
    if (!o) return;
    setAtivo(true); setF(formDe(o));
    toast.info('Bomba do outro pivô copiada — os dois vão dividir a bomba (um por vez). Revise e salve.');
  };

  const tonNome = (tid: string) => op?.tons.find((t) => t.id === tid)?.nome ?? (tid || '—');
  const mudancas = useMemo(() => {
    if (!base) return [];
    const out: Array<{ label: string; de: string; para: string }> = [];
    const add = (label: string, de: string, para: string) => { if (de !== para) out.push({ label, de, para }); };
    add('Este pivô tem bombeamento', base.ativo ? 'Sim' : 'Não', ativo ? 'Sim' : 'Não');
    if (ativo) {
      add('Bomba', base.ativo ? tonNome(base.f.ton_id) : '—', tonNome(f.ton_id));
    }
    add('Tempo para pressurizar', `${base.seq.pressurizacao_s} s`, `${Number(seq.pressurizacao_s)} s`);
    add('Confirmação do giro', `${base.seq.confirma_giro_s} s`, `${Number(seq.confirma_giro_s)} s`);
    for (const p of PARAMS.slice(2)) {
      const antes = cfg?.parametros?.[p.key as keyof ParametrosPivo] as number | null | undefined;
      const agora = parNum(p.key);
      if ((antes ?? null) !== agora) add(p.label, antes == null ? '—' : `${fmtPar(antes, p.d)} ${p.unit}`, agora == null ? '—' : `${fmtPar(agora, p.d)} ${p.unit}`);
    }
    if (conj) {
      const pp = cfg?.parametros;
      add('Direcionamento da água', (pp?.direcionamento ?? 'valvula') === 'valvula' ? 'Válvula pelo NexON' : 'Intertravamento físico', agua.direcionamento === 'valvula' ? 'Válvula pelo NexON' : 'Intertravamento físico');
      const vAntes = pp?.valvula_ton_id && pp?.valvula_bo ? `${pp.valvula_ton_id}|${pp.valvula_bo}` : '';
      const vTxt = (v: string) => { if (!v) return '—'; const [t, bo] = v.split('|'); return `${tonNome(t)} · BO${bo}`; };
      if (agua.direcionamento === 'valvula') add('Saída que comanda a válvula', vTxt(vAntes), vTxt(agua.valvula));
    }
    if (cfg && ponta) {
      const a = cfg.bloqueio_ponta;
      add('Bloquear no horário de ponta', a.ativo ? 'Sim' : 'Não', ponta.ativo ? 'Sim' : 'Não');
      add('Horário de ponta · início', a.inicio, ponta.inicio);
      add('Horário de ponta · fim', a.fim, ponta.fim);
    }
    return out;
  }, [base, ativo, f, seq, cfg, ponta, par, agua, conj]); // eslint-disable-line react-hooks/exhaustive-deps

  const bombaRuim = ativo && (!f.ton_id || !numOk(f.bo_liga, 1, 16) || !numOk(f.confirma_s, 5, 300)
    || (f.modo === 'pulso' && (!numOk(f.bo_desliga, 1, 16) || !numOk(f.pulso_ms, 100, 10000)))
    || (f.bi_confirma !== '' && !numOk(f.bi_confirma, 1, 16)));
  const seqRuim = !numOk(seq.pressurizacao_s, 10, 600) || !numOk(seq.confirma_giro_s, 5, 120);
  const pontaRuim = !!ponta && !(/^\d{2}:\d{2}$/.test(ponta.inicio) && /^\d{2}:\d{2}$/.test(ponta.fim));
  const parRuim = PARAMS.slice(2).some((p) => { const v = parNum(p.key); return v != null && (Number.isNaN(v) || v < p.min || v > p.max); });
  const invalido = bombaRuim || seqRuim || pontaRuim || parRuim;
  const n = mudancas.length;
  const saveOff = invalido || n === 0;

  const gravar = async () => {
    setGravando(true);
    try {
      const daConfig = new Set(['Bloquear no horário de ponta', 'Horário de ponta · início', 'Horário de ponta · fim', 'Direcionamento da água', 'Saída que comanda a válvula', ...PARAMS.slice(2).map((p) => p.label)]);
      const bombaMudou = mudancas.some((m) => !daConfig.has(m.label));
      if (bombaMudou) {
        await api.put(`/pivos/${pivoId}/bombeamento`, {
          bombeamento: ativo ? {
            ton_id: f.ton_id, modo: f.modo, bo_liga: Number(f.bo_liga),
            bo_desliga: f.bo_desliga === '' ? null : Number(f.bo_desliga),
            bi_confirma: f.bi_confirma === '' ? null : Number(f.bi_confirma),
            confirma_s: Number(f.confirma_s), pulso_ms: Number(f.pulso_ms), ativo: true,
          } : null,
          sequencia: { pressurizacao_s: Number(seq.pressurizacao_s), confirma_giro_s: Number(seq.confirma_giro_s) },
        });
      }
      const pontaMudou = cfg && ponta && (cfg.bloqueio_ponta.ativo !== ponta.ativo || cfg.bloqueio_ponta.inicio !== ponta.inicio || cfg.bloqueio_ponta.fim !== ponta.fim);
      const parMudou = mudancas.some((m) => PARAMS.slice(2).some((p) => p.label === m.label) || m.label === 'Direcionamento da água' || m.label === 'Saída que comanda a válvula');
      if (pontaMudou || parMudou) {
        const [vt, vb] = agua.valvula ? agua.valvula.split('|') : [null, null];
        await api.put(`/pivos/${pivoId}/config`, {
          ...(pontaMudou ? { bloqueio_ponta: ponta } : {}),
          ...(parMudou ? {
            parametros: {
              pressao_minima: parNum('pressao_minima'), lamina_100: parNum('lamina_100'),
              tempo_volta_100: parNum('tempo_volta_100'), correcao_angulo_zero: parNum('correcao_angulo_zero'),
              direcionamento: agua.direcionamento, valvula_ton_id: vt, valvula_bo: vb ? Number(vb) : null,
            },
          } : {}),
        });
      }
      toast.success('Configuração do pivô salva');
      // O gravado passa a ser o rascunho (não espera o refresh do estado).
      setBase({ ativo, f, seq: { pressurizacao_s: Number(seq.pressurizacao_s), confirma_giro_s: Number(seq.confirma_giro_s) } });
      setRevisar(false); onSalvo();
    } catch (e) {
      toast.error('Não salvou', { description: erroMsg(e) });
    } finally {
      setGravando(false);
    }
  };

  const timeStyle: CSSProperties = { height: 38, borderRadius: 10, border: `1px solid ${NX.borda}`, padding: '0 10px', fontSize: 15, fontWeight: 700, color: NX.texto, background: NX.card };
  const nProg = progs?.length ?? 0;
  const agFull = nProg >= 5;
  const roTec = !perfil.tecnico;
  const roProp = !perfil.prop;

  return (
    <div style={{ padding: '20px 24px 28px 24px', ...col(10) }}>
      {secao('BOMBEAMENTO', 4)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        <NxSwitchRow first title="Este pivô tem bombeamento" sub="Ligar o pivô com água liga a bomba; desligar o pivô desliga a bomba" on={ativo} disabled={roTec} onToggle={() => setAtivo((v) => !v)} />
        {ativo && (
          <>
            <Linha titulo="Bomba" sub="TON e medidor de energia da bomba">
              <ChipSelect label="Bomba" disabled={roTec} value={f.ton_id} onChange={(v) => set('ton_id', v)}>
                <option value="">Escolha a TON…</option>
                {(op?.tons ?? []).map((t) => <option key={t.id} value={t.id}>{t.nome} · {t.unidade}</option>)}
              </ChipSelect>
            </Linha>
            <NxSwitchRow title="Sistema conjugado" sub="A bomba atende outro pivô · um pivô por vez" on={conj} disabled={roTec} onToggle={() => setConj((v) => !v)} />
            {conj && (
              <div style={{ borderTop: `1px solid ${NX.linha}`, padding: '12px 0', ...col(10) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Outro pivô</span>
                  <ChipSelect label="Outro pivô" height={36} disabled={roTec} value={conjPivo} onChange={copiarDe}>
                    <option value="">—</option>
                    {(op?.bombeamentos ?? []).filter((x) => x.pivo_id !== pivoId).map((x) => <option key={x.pivo_id} value={x.pivo_id}>{x.nome}</option>)}
                  </ChipSelect>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Direcionamento da água</span>
                  <NxSeg<'valvula' | 'fisico'> disabled={roTec} value={agua.direcionamento} onChange={(v) => setAgua((a) => ({ ...a, direcionamento: v }))} options={[{ v: 'valvula', label: 'Válvula pelo NexON' }, { v: 'fisico', label: 'Intertravamento físico' }]} />
                </div>
                {agua.direcionamento === 'valvula' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={col(2)}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Saída que comanda a válvula</span>
                      <span style={{ fontSize: 12, color: NX.mudo }}>Válvula solenoide na adutora, junto ao pivô mais próximo</span>
                    </span>
                    <ChipSelect label="Saída que comanda a válvula" height={36} disabled={roTec} value={agua.valvula} onChange={(v) => setAgua((a) => ({ ...a, valvula: v }))}>
                      <option value="">—</option>
                      {(op?.tons ?? []).flatMap((t) => Array.from({ length: 8 }, (_, i) => (
                        <option key={`${t.id}|${i + 1}`} value={`${t.id}|${i + 1}`}>{t.nome} · BO{i + 1}</option>
                      )))}
                    </ChipSelect>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {secao('PARTIDA E IRRIGAÇÃO', 10)}
      {PARAMS.map((p) => {
        const ehSeq = p.key === 'pressurizacao_s' || p.key === 'confirma_giro_s';
        const val = ehSeq ? seq[p.key as 'pressurizacao_s' | 'confirma_giro_s'] : (par[p.key] ?? '');
        const nv = Number(String(val).replace(',', '.'));
        const ruim = ehSeq ? !numOk(val, p.min, p.max) : val !== '' && (Number.isNaN(nv) || nv < p.min || nv > p.max);
        return (
          <div key={p.key} style={{ ...s.card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <label htmlFor={`w-${p.key}`} style={{ flex: 1, ...col(2) }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{p.label}</span>
              <span style={{ fontSize: 12, color: ruim ? NX.bad : NX.mudo }}>{p.hint}</span>
            </label>
            <input id={`w-${p.key}`} inputMode="decimal" value={val} disabled={roTec} style={s.campo(roTec, ruim)}
              onChange={(e) => { if (ehSeq) setSeq((x) => ({ ...x, [p.key]: e.target.value })); else setPar((x) => ({ ...x, [p.key]: e.target.value })); }} />
            <span style={{ fontSize: 14, color: NX.mudo, width: 28 }}>{p.unit}</span>
          </div>
        );
      })}

      {secao('HORÁRIO DE PONTA', 10)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        <NxSwitchRow first title="Bloquear no horário de ponta" sub="Pausa a irrigação e retoma ao fim da ponta" on={!!ponta?.ativo} disabled={!ponta || roProp}
          onToggle={() => setPonta((p) => (p ? { ...p, ativo: !p.ativo } : p))} />
        <div style={{ borderTop: `1px solid ${NX.linha}`, padding: '12px 0', display: 'flex', gap: 12 }}>
          {(['inicio', 'fim'] as const).map((k) => (
            <label key={k} style={{ flex: 1, ...col(4) }}>
              <span style={{ fontSize: 12, color: NX.mudo }}>{k === 'inicio' ? 'Início' : 'Fim'}</span>
              <input type="time" disabled={!ponta || roProp} value={ponta?.[k] ?? ''} onChange={(e) => setPonta((p) => (p ? { ...p, [k]: e.target.value } : p))} style={timeStyle} />
            </label>
          ))}
        </div>
      </div>

      {secao(`PROGRAMAÇÃO DE HORÁRIOS · ${nProg}/5`, 10)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        {progs == null && <div style={{ minHeight: 58, display: 'flex', alignItems: 'center', fontSize: 14, color: NX.mudo }}>Carregando…</div>}
        {(progs ?? []).map((p, i) => {
          const t = textoProgramacao(p);
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, ...(i > 0 ? { borderTop: `1px solid ${NX.linha}` } : {}) }}>
              <span style={{ flex: 1, ...col(2) }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{t.quando}</span>
                <span style={{ fontSize: 12, color: NX.mudo }}>{t.det}</span>
              </span>
              <button type="button" aria-label="Remover horário" disabled={roProp} onClick={() => onRemoverProg(p.id)} style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IcoLixo />
              </button>
            </div>
          );
        })}
        <button type="button" disabled={agFull || progs == null || roProp} onClick={onAdicionarHorario}
          style={{ width: '100%', height: 46, ...(nProg > 0 || progs == null ? { borderTop: `1px solid ${NX.linha}` } : {}), fontSize: 14, fontWeight: 800, textAlign: 'center', color: agFull || roProp ? NX.desab : VERDE }}>
          {agFull ? 'Limite de 5 horários' : '+ Adicionar horário'}
        </button>
      </div>

      {!roProp && (
        <button type="button" disabled={saveOff} onClick={() => setRevisar(true)} style={s.save(saveOff)}>
          {invalido ? 'Valor fora da faixa' : n === 0 ? 'Salvar' : `Revisar ${n} ${n > 1 ? 'alterações' : 'alteração'}`}
        </button>
      )}
      {roProp && <span style={{ textAlign: 'center', fontSize: 13, color: NX.mudo, marginTop: 6 }}>Somente leitura para este perfil</span>}
      <span style={{ fontSize: 12, color: NX.mudo, marginTop: 6 }}>
        Os comandos do pivô (ligar, desligar, direção, sem água, canhão) e os status vêm dos pontos ligados às BO/BI da TON do pivô (editor IoT → TON → Configurar BOs/BIs).
      </span>

      <NxDialog open={revisar} onClose={() => { if (!gravando) setRevisar(false); }} label="Confirmar alterações" width={440}>
        <div style={col(10)}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Confirmar alterações</span>
          {mudancas.map((c) => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15, padding: '6px 0', borderBottom: `1px solid ${NX.linha}` }}>
              <span>{c.label}</span><span style={{ textAlign: 'right' }}><span style={{ color: NX.mudo }}>{c.de}</span> → <b>{c.para}</b></span>
            </div>
          ))}
          {gravando
            ? <span style={{ fontSize: 14, color: NX.mudo, textAlign: 'center', padding: '6px 0' }}>Gravando e aguardando releitura da TON…</span>
            : <NxDialogButtons onCancel={() => setRevisar(false)} onConfirm={gravar} cancelLabel="Voltar" marginTop={8} />}
        </div>
      </NxDialog>
    </div>
  );
}

export default PivoSheet;
