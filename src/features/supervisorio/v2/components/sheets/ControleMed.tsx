import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { NX, COR, s, NxSeg, NxSwitch, NxDialog, NxDialogHead, NxDialogButtons, type NxTone } from './nxMock';

/**
 * Controle automático pelo MED Concessionária (backend controle-med):
 *  - Configuração: modo de cada controle (desligado · sombra · ativo), limites, UFVs/inversores;
 *  - Operação: o que o último ciclo (1 por minuto do medidor) decidiu, enviou ou enviaria.
 * docs/IOT-CONTROLE-MED-CONCESSIONARIA-IMPLEMENTACAO.md.
 */

type Modo = 'desligado' | 'sombra' | 'ativo';
type Controle = 'fp' | 'demanda_g' | 'demanda_c';
interface Inversor { id: string; nome?: string; pn_kw: number; smax_kva: number; qmax_pct: number; sinal_q: 1 | -1; q_noturno: boolean }
interface Ufv { id: string; nome: string; ordem: number; p_estatico_kw: number; zera_estagio2: boolean; watchdog_nativo: boolean; rota: 'internet' | 'lora'; bi_manual?: number; bi_invertida?: boolean; inversores: Inversor[] }
interface Candidato { id: string; nome: string; modelo: string | null; pn_kw: number | null; limite_p: boolean; reativo_q: boolean; sinal_q_padrao?: 1 | -1 }
interface Ciclo {
  ts: string; seg: number | null;
  entradas: { E_imp?: number; E_exp?: number; P_imp?: number; P_exp?: number; Q_ind?: number; Q_cap?: number; janela?: 'ind' | 'cap'; eventos?: string[] };
  portao: { ok: boolean; motivos: string[] };
  pedidos: Partial<Record<Controle, { acao: string; motivo: string; D_proj?: number | null; contrato?: number | null; dQ?: number; fp_hora?: number | null }>>;
  comandos: Array<{ inversor_id: string; nome: string; ufv: string; p_lim_kw: number; p_pct: number; q_kvar: number; q_pct: number; muda_p: boolean; muda_q: boolean; p_por_q?: boolean; enviado_p?: string; enviado_q?: string; motivo: string[] }>;
  modos: Record<Controle, Modo>;
}
interface Estado {
  params: Record<string, number | string | null>; ufvs: Ufv[]; modos: Record<Controle, Modo>; versao: number;
  validacao: { tetoPlim: number | null; somaEst: number; somaPn: number; tVal: number; avisos: string[]; bloqueios: string[] };
  candidatos: Candidato[]; ultimo_ciclo: Ciclo | null; pode_configurar: boolean; pode_operar: boolean;
  tons?: Array<{ ton_id: string; modo: string; texto: string }>;   // modo do controle local em cada TON de UFV
}

const ROTULO: Record<Controle, string> = { demanda_c: 'Demanda de carga', demanda_g: 'Demanda de geração', fp: 'Fator de potência' };
const SUB: Record<Controle, string> = {
  demanda_c: 'Libera geração limitada quando a projeção do intervalo passa do contrato',
  demanda_g: 'Corta geração igual em todos os inversores (nunca abaixo da parte do contrato de cada um) antes da projeção passar do contrato',
  fp: 'Ajusta o reativo das UFVs para fechar a hora acima do FP alvo',
};
const ORDEM: Controle[] = ['demanda_g', 'demanda_c', 'fp'];

const corpo = <T,>(r: unknown): T => { const x = r as { data?: { data?: T } & T }; return (x?.data?.data ?? x?.data) as T; };
const erroMsg = (e: unknown): string => {
  const x = e as { response?: { data?: { message?: string; error?: { message?: string } } }; message?: string };
  return x?.response?.data?.error?.message ?? x?.response?.data?.message ?? x?.message ?? 'Falha';
};
const n1 = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
const hora = (t: string) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const col = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap });

function useControle(medId: string) {
  const [est, setEst] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    try { setEst(corpo<Estado>(await api.get(`/controle-med/${medId.trim()}`))); setErro(null); }
    catch (e) { setErro(erroMsg(e)); }
  }, [medId]);
  useEffect(() => { void carregar(); }, [carregar]);
  return { est, setEst, erro, carregar };
}

// ------------------------------------------------------------------ Operação

type Pedido = NonNullable<Ciclo['pedidos'][Controle]> & { Q_med?: number; Q_perm_alvo?: number; janela?: 'ind' | 'cap'; espera_s?: number; t_rest_hora?: number; P_perm?: number | null; alvo?: number | null };
interface Situacao { tom: NxTone; rotulo: string }

/** Situação de um controle num ciclo: normal · fora do alvo e corrigindo · sem como corrigir. */
function situacao(k: Controle, c: Ciclo): Situacao | null {
  if (!c.portao.ok) return { tom: 'bad', rotulo: 'Medição reprovada — mantém o último comando' };
  const p = c.pedidos[k] as Pedido | undefined;
  if (!p) {
    const ev = (c.entradas.eventos ?? []).find((e) => e.startsWith('Retomada'));
    return ev ? { tom: 'warn', rotulo: 'Retomando após falha' } : null;
  }
  if (k === 'fp') {
    switch (p.acao) {
      case 'nada': return { tom: 'ok', rotulo: 'FP dentro do alvo' };
      case 'compensar': return { tom: 'warn', rotulo: 'FP fora do alvo — corrigindo' };
      case 'devolver': return { tom: 'warn', rotulo: 'Compensação além do necessário — devolvendo' };
      case 'aguardar_ritmo': return { tom: 'warn', rotulo: `FP fora do alvo — aguardando efeito da correção${p.espera_s != null ? ` (novo ajuste em ${p.espera_s} s)` : ''}` };
      case 'hora_perdida': return { tom: 'bad', rotulo: 'Hora perdida — não dá mais para fechar o FP' };
      case 'sem_atuador': return { tom: 'bad', rotulo: 'FP fora do alvo — sem reativo disponível nas UFVs' };
      default: return { tom: 'off', rotulo: p.acao };
    }
  }
  switch (p.acao) {
    case 'nada': return { tom: 'ok', rotulo: 'Dentro do contrato' };
    case 'liberar': return { tom: 'ok', rotulo: 'Com folga — liberando geração' };
    case 'aguardar': return { tom: 'warn', rotulo: 'Projeção acima — aguardando 1 minuto' };
    case 'reduzir': return { tom: 'warn', rotulo: k === 'demanda_g' ? 'Projeção acima do contrato — cortando geração' : 'Projeção acima do contrato — liberando geração' };
    case 'sem_contrato': return { tom: 'bad', rotulo: 'Contrato não cadastrado' };
    default: return { tom: 'off', rotulo: p.acao };
  }
}

/** "Normalizado às HH:MM": o ciclo atual está ok e houve alerta nos últimos ciclos. */
function normalizadoEm(k: Controle, hist: Ciclo[]): string | null {
  const st = hist.map((c) => situacao(k, c)?.tom ?? 'off');
  if (st[0] !== 'ok') return null;
  let i = 0;
  while (i < st.length && st[i] === 'ok') i++;
  if (i >= st.length || i > 15) return null;           // nunca esteve fora, ou faz tempo
  return hora(hist[i - 1].ts);
}

const fpDe = (P: number, Q: number) => { const S = Math.hypot(P, Q); return S > 0.01 ? Math.abs(P) / S : null; };

/** Card da aba Operação: só aparece com algum controle fora de "desligado". */
export function ControleMedResumo({ medId }: { medId: string }) {
  const { est, carregar } = useControle(medId);
  const [hist, setHist] = useState<Ciclo[]>([]);
  const carregarHist = useCallback(async () => {
    try { setHist(corpo<Ciclo[]>(await api.get(`/controle-med/${medId.trim()}/ciclos`, { params: { limite: 30 } })) ?? []); } catch { /* card segue com o último ciclo */ }
  }, [medId]);
  useEffect(() => {
    void carregarHist();
    const t = setInterval(() => { void carregar(); void carregarHist(); }, 15_000);
    return () => clearInterval(t);
  }, [carregar, carregarHist]);
  if (!est || ORDEM.every((c) => est.modos[c] === 'desligado')) return null;
  const c = hist[0] ?? est.ultimo_ciclo;
  const idade = c ? (Date.now() - new Date(c.ts).getTime()) / 1000 : null;
  const ligados = ORDEM.filter((k) => est.modos[k] !== 'desligado');
  return (
    <div style={{ ...s.card, padding: '14px 18px', ...col(12) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Controle automático</span>
        {c && (
          <span style={{ fontSize: 12, color: idade != null && idade > 180 ? NX.warn : NX.mudo }}>
            Último ciclo {hora(c.ts)}{c.seg != null ? ` · intervalo fecha em ${Math.round(c.seg)} s` : ''}{idade != null && idade > 180 ? ' · sem minuto novo do medidor' : ''}
          </span>
        )}
      </div>
      {!c ? (
        <span style={{ fontSize: 13, color: NX.mudo }}>Aguardando o primeiro minuto do medidor.</span>
      ) : (
        <>
          {(est.tons ?? []).filter((t) => t.modo && t.modo !== 'A').map((t) => (
            <Aviso key={t.ton_id} tom={t.modo === 'M' || t.modo.startsWith('S') ? 'bad' : 'warn'}>TON da UFV: {t.texto}</Aviso>
          ))}
          {ligados.map((k) => <BlocoControle key={k} k={k} modo={est.modos[k]} c={c} hist={hist} />)}
          <Inversores c={c} />
          {(c.entradas.eventos ?? []).filter((e) => !e.startsWith('Retomada')).map((e, i) => <Aviso key={i} tom="warn">{e}</Aviso>)}
        </>
      )}
    </div>
  );
}

function BlocoControle({ k, modo, c, hist }: { k: Controle; modo: Modo; c: Ciclo; hist: Ciclo[] }) {
  const sit = situacao(k, c) ?? { tom: 'off' as NxTone, rotulo: 'Sem decisão neste minuto' };
  const norm = normalizadoEm(k, hist);
  const p = c.pedidos[k] as Pedido | undefined;
  const e = c.entradas as Ciclo['entradas'] & { hora?: { E_P?: number; E_ind?: number; E_cap?: number; t_rest?: number }; janela?: 'ind' | 'cap' };
  let medida: ReactNode = null;
  if (k === 'fp') {
    const P = (e.P_imp ?? 0) - (e.P_exp ?? 0);
    const jan = p?.janela ?? e.janela;
    const Qi = e.Q_ind ?? 0, Qc = e.Q_cap ?? 0;
    const Q = Qi >= Qc ? Qi : Qc;
    const tipoQ = Qi >= Qc ? 'ind.' : 'cap.';
    const fp = fpDe(P, Q);
    const h = e.hora;
    const hr = h && h.t_rest != null ? (() => {
      const dec = Math.max(0, 3600 - h.t_rest);
      const ini = new Date(new Date(c.ts).getTime() - dec * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return { dec, ini, E_P: h.E_P ?? 0, E_Q: (jan === 'cap' ? h.E_cap : h.E_ind) ?? 0 };
    })() : null;
    medida = (
      <>
        <span>Agora: <b>{n1(Math.abs(P))} kW</b> {P >= 0 ? 'importando' : 'exportando'} · <b>{n1(Q)} kvar {tipoQ}</b> · FP <b>{n1(fp, 3)}</b> {Q > 0.05 ? tipoQ : ''}
          {Q > 0.05 && jan && (tipoQ === 'ind.') !== (jan === 'ind') && <span style={{ color: NX.warn }}> · {tipoQ === 'ind.' ? 'indutivo' : 'capacitivo'} não é cobrado na janela {jan === 'cap' ? 'capacitiva' : 'indutiva'}</span>}
        </span>
        {hr && hr.dec > 0 && (
          <span>Hora (desde {hr.ini}, {Math.round(hr.dec / 60)} min): P média <b>{n1(hr.E_P / (hr.dec / 3600))} kW</b> · Q média <b>{n1(hr.E_Q / (hr.dec / 3600))} kvar {jan === 'cap' ? 'cap.' : 'ind.'}</b> · {n1(hr.E_P, 2)} kWh / {n1(hr.E_Q, 2)} kvarh</span>
        )}
        {p && <span>FP da hora <b>{n1(p.fp_hora, 3)}</b>{p.t_rest_hora != null ? <> · hora fecha em <b>{Math.floor(p.t_rest_hora / 60)} min {String(Math.round(p.t_rest_hora % 60)).padStart(2, '0')} s</b></> : null} · reativo permitido no resto da hora {n1(p.Q_perm_alvo)} kvar · correção {n1(p.dQ)} kvar · janela {jan === 'cap' ? 'capacitiva' : 'indutiva'}</span>}
      </>
    );
  } else if (p) {
    const pct = p.contrato ? Math.min(130, Math.max(0, ((p.D_proj ?? 0) / p.contrato) * 100)) : 0;
    medida = (
      <>
        <span>Projeção do intervalo <b>{n1(p.D_proj)} kW</b> · limite {n1(p.contrato)} kW{k === 'demanda_c' ? ' (contrato + tolerância)' : ''} · alvo {n1(p.alvo)} kW
          {k === 'demanda_g' && (c.entradas as { teto_queda_kw?: number | null }).teto_queda_kw != null && <> · teto p/ queda de comunicação {n1((c.entradas as { teto_queda_kw?: number }).teto_queda_kw)} kW</>}
        </span>
        <span style={{ position: 'relative', height: 8, borderRadius: 4, background: NX.linha, overflow: 'hidden', maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(pct / 130) * 100}%`, background: COR[sit.tom], borderRadius: 4 }} />
          <span style={{ position: 'absolute', left: `${(100 / 130) * 100}%`, top: -2, bottom: -2, width: 2, background: NX.texto }} title="contrato" />
        </span>
      </>
    );
  }
  return (
    <div style={{ ...col(6), borderTop: `1px solid ${NX.linha}`, paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{ROTULO[k]}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: NX.mudo, textTransform: 'uppercase', letterSpacing: 0.5 }}>{modo === 'ativo' ? 'Ativo' : 'Sombra · só simula'}</span>
      </div>
      <span style={{ ...s.pill(sit.tom), alignSelf: 'flex-start', height: 'auto', minHeight: 30, padding: '4px 12px', whiteSpace: 'normal' }}>
        <span style={s.pillDot(sit.tom)} />{sit.rotulo}{norm ? ` · normalizado às ${norm}` : ''}
      </span>
      <div style={{ ...col(3), fontSize: 13, color: NX.mudo }}>{medida}</div>
      {hist.length > 1 && <Linha30 k={k} hist={hist} />}
    </div>
  );
}

/** Últimos minutos (antigo → recente): um quadrado por ciclo, na cor da situação. */
function Linha30({ k, hist }: { k: Controle; hist: Ciclo[] }) {
  const lista = [...hist].reverse();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: NX.mudo, whiteSpace: 'nowrap' }}>{hora(lista[0].ts)}</span>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }} role="img" aria-label={`Situação de ${ROTULO[k]} nos últimos ${lista.length} minutos`}>
        {lista.map((c) => {
          const st = situacao(k, c);
          return <span key={c.ts} title={`${hora(c.ts)} · ${st?.rotulo ?? '—'}${c.pedidos[k]?.motivo ? ` · ${c.pedidos[k]!.motivo}` : ''}`} style={{ width: 10, height: 14, borderRadius: 2, background: st ? COR[st.tom] : NX.off }} />;
        })}
      </div>
      <span style={{ fontSize: 11, color: NX.mudo, whiteSpace: 'nowrap' }}>agora</span>
    </div>
  );
}

function Inversores({ c }: { c: Ciclo }) {
  if (!c.comandos.length) return null;
  return (
    <div style={{ ...col(4), borderTop: `1px solid ${NX.linha}`, paddingTop: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: NX.mudo, textTransform: 'uppercase', letterSpacing: 0.5 }}>Comando por inversor</span>
      {c.comandos.map((x) => (
        <span key={x.inversor_id} style={{ fontSize: 13, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <b>{x.nome}</b><span style={{ color: NX.mudo }}>{x.ufv}</span>
          <span>· limite {n1(x.p_pct, 0)}% ({n1(x.p_lim_kw)} kW){x.p_por_q ? ' · reduzido p/ caber o reativo' : ''}{x.enviado_p ? <> <Envio r={x.enviado_p} /></> : ''}</span>
          <span>· reativo {n1(x.q_kvar)} kvar ({n1(x.q_pct, 1)}%){x.enviado_q ? <> <Envio r={x.enviado_q} /></> : ''}</span>
        </span>
      ))}
    </div>
  );
}

function Envio({ r }: { r: string }) {
  if (r === 'sombra') return <span style={{ color: NX.mudo }}>(enviaria)</span>;
  if (r === 'ok') return <span style={{ color: NX.ok }}>(enviado)</span>;
  return <span style={{ color: NX.bad }}>(falhou: {r})</span>;
}

function Aviso({ tom, children }: { tom: NxTone; children: ReactNode }) {
  return <span style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, background: NX.caixa, color: tom === 'bad' ? NX.bad : tom === 'warn' ? NX.warn : NX.caixaTx }}>{children}</span>;
}

// ------------------------------------------------------------------ Configuração

interface Campo { k: string; t: string; h?: string; u?: string; tipo?: 'hora' | 'bool' }
const LIMITES: Campo[] = [
  { k: 'd_contr_g_kw', t: 'Contrato de geração', h: 'Vazio = o da unidade consumidora', u: 'kW' },
  { k: 'alvo_g_pct', t: 'Alvo de geração', h: 'Ritmo planejado; a projeção nunca passa do contrato', u: '%' },
  { k: 'd_contr_c_kw', t: 'Contrato de carga', h: 'Fora de ponta (verde: valor único). Vazio = o da unidade', u: 'kW' },
  { k: 'd_contr_c_ponta_kw', t: 'Contrato de carga na ponta', h: 'Só tarifa azul', u: 'kW' },
  { k: 'alvo_c_pct', t: 'Alvo de carga', h: '% do limite (contrato + tolerância)', u: '%' },
  { k: 'tol_c_pct', t: 'Tolerância de ultrapassagem (carga)', h: 'Aneel: multa só acima do contrato + 5 %', u: '%' },
  { k: 'fp_lim_ind', t: 'FP limite indutivo', h: 'Regulatório (0,92)' },
  { k: 'fp_alvo_ind', t: 'FP alvo indutivo', h: 'Pelo menos 0,005 acima do limite' },
  { k: 'fp_lim_cap', t: 'FP limite capacitivo' },
  { k: 'fp_alvo_cap', t: 'FP alvo capacitivo' },
  { k: 'prioridade_q', t: 'Reativo tem prioridade', h: 'Reduz o limite de potência ativa para caber o reativo pedido na carta do inversor (S² = P² + Q²)', tipo: 'bool' },
  { k: 'janela_cap_ini', t: 'Janela capacitiva · início', h: 'Até a TON publicar o posto reativo da SSU', tipo: 'hora' },
  { k: 'janela_cap_fim', t: 'Janela capacitiva · fim', tipo: 'hora' },
];
const AVANCADO: Campo[] = [
  { k: 'banda_pct', t: 'Banda', h: 'Folga antes de devolver Q ou liberar P', u: '%' },
  { k: 'margem_q3_kvar', t: 'Margem de Q exportando', u: 'kvar' },
  { k: 't_min_ajuste_fp_s', t: 'Intervalo mínimo entre ajustes de FP', u: 's' },
  { k: 't_resposta_s', t: 'Tempo de resposta', h: 'Nuvem → TON → inversor + rampa', u: 's' },
  { k: 'degrau_min_pct', t: 'Degrau mínimo de escrita', h: '% de Smax (poupa a EEPROM do inversor)', u: '%' },
  { k: 't_validade_internet_s', t: 'Validade do setpoint · internet', u: 's' },
  { k: 't_validade_lora_s', t: 'Validade do setpoint · LoRa', u: 's' },
  { k: 't_estagio2_s', t: 'Tempo até o estágio 2', h: 'Modo seguro: P = 0 nas UFVs marcadas', u: 's' },
  { k: 'n_retomada', t: 'Ciclos válidos para retomar' },
  { k: 'rampa_pct_min', t: 'Rampa da retomada', h: 'Na TON: subida máxima do limite de P por minuto depois do modo seguro', u: '%/min' },
  { k: 'ssu_err_max_min', t: 'Erros de SSU aceitos por minuto' },
  { k: 'idade_max_ssu_s', t: 'Idade máxima do minuto do medidor', u: 's' },
  { k: 'idade_max_inv_internet_s', t: 'Idade máxima do inversor · internet', u: 's' },
  { k: 'idade_max_inv_lora_s', t: 'Idade máxima do inversor · LoRa', u: 's' },
];

const txt = (v: unknown) => (v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v));
const numOuNull = (v: string) => { const t = v.trim().replace(',', '.'); if (!t) return null; const x = Number(t); return Number.isFinite(x) ? x : NaN; };

/** Aba Configuração do MED: controle automático. */
export function ControleMedConfig({ medId }: { medId: string }) {
  const { est, setEst, erro } = useControle(medId);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [ufvs, setUfvs] = useState<Ufv[]>([]);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [avancado, setAvancado] = useState(false);
  const [confirmar, setConfirmar] = useState<{ c: Controle; m: Modo } | null>(null);
  const [enviandoModo, setEnviandoModo] = useState(false);

  useEffect(() => {
    if (!est || sujo) return;
    setVals(Object.fromEntries([...LIMITES, ...AVANCADO].map((f) => [f.k, txt(est.params[f.k])])));
    setUfvs(est.ufvs);
  }, [est, sujo]);

  // medidor que não é o da concessionária (PM): o controle não se aplica
  if (erro && !est) return /concession/i.test(erro) ? null : <Aviso tom="bad">{erro}</Aviso>;
  if (!est) return <span style={{ fontSize: 14, color: NX.mudo }}>Carregando o controle automático…</span>;
  const ro = !est.pode_configurar;
  const muda = (k: string, v: string) => { setVals((x) => ({ ...x, [k]: v })); setSujo(true); };
  const mudaUfv = (i: number, p: Partial<Ufv>) => { setUfvs((l) => l.map((u, k) => (k === i ? { ...u, ...p } : u))); setSujo(true); };
  const mudaInv = (i: number, j: number, p: Partial<Inversor>) =>
    mudaUfv(i, { inversores: ufvs[i].inversores.map((x, k) => (k === j ? { ...x, ...p } : x)) });
  const usados = new Set(ufvs.flatMap((u) => u.inversores.map((x) => x.id)));
  const livres = est.candidatos.filter((c) => !usados.has(c.id));

  const salvar = async () => {
    const params: Record<string, number | string | null> = {};
    for (const f of [...LIMITES, ...AVANCADO]) {
      if (f.tipo === 'hora') { params[f.k] = vals[f.k]; continue; }
      if (f.tipo === 'bool') { params[f.k] = vals[f.k] === '0' ? 0 : 1; continue; }
      const x = numOuNull(vals[f.k] ?? '');
      if (Number.isNaN(x)) { toast.error(`${f.t}: número inválido`); return; }
      params[f.k] = x;
    }
    setSalvando(true);
    try {
      setEst(corpo<Estado>(await api.put(`/controle-med/${medId.trim()}/config`, { params, ufvs })));
      setSujo(false);
      toast.success('Controle salvo');
    } catch (e) { toast.error('Não salvou', { description: erroMsg(e) }); }
    finally { setSalvando(false); }
  };

  const aplicarModo = async (c: Controle, m: Modo) => {
    setEnviandoModo(true);
    try {
      setEst(corpo<Estado>(await api.put(`/controle-med/${medId.trim()}/modos`, { modos: { [c]: m } })));
      toast.success(`${ROTULO[c]}: ${m === 'ativo' ? 'ativo' : m === 'sombra' ? 'em sombra' : 'desligado'}`);
    } catch (e) { toast.error(`${ROTULO[c]} não mudou`, { description: erroMsg(e) }); }
    finally { setEnviandoModo(false); setConfirmar(null); }
  };
  const pedirModo = (c: Controle, m: Modo) => {
    if (sujo) { toast.error('Salve o cadastro antes de mudar o modo'); return; }
    if (m === 'ativo') setConfirmar({ c, m }); else void aplicarModo(c, m);
  };

  const v = est.validacao;
  return (
    <div style={col(10)}>
      <span style={s.label}>CONTROLE AUTOMÁTICO</span>
      <div style={{ ...s.card, padding: '4px 18px' }}>
        {ORDEM.map((c, i) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 66, flexWrap: 'wrap', ...(i ? { borderTop: `1px solid ${NX.linha}` } : {}) }}>
            <span style={{ ...col(2), flex: '1 1 220px' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ROTULO[c]}</span>
              <span style={{ fontSize: 12, color: NX.mudo }}>{SUB[c]}</span>
            </span>
            <NxSeg<Modo> value={est.modos[c]} disabled={!est.pode_operar || enviandoModo}
              options={[{ v: 'desligado', label: 'Desligado' }, { v: 'sombra', label: 'Sombra' }, { v: 'ativo', label: 'Ativo' }]}
              onChange={(m) => m !== est.modos[c] && pedirModo(c, m)} />
          </div>
        ))}
      </div>
      <span style={{ fontSize: 12, color: NX.mudo }}>
        Sombra: calcula a cada minuto do medidor e registra o que mandaria, sem mexer nos inversores. Ativo: manda o limite de potência e o reativo aos inversores pela TON.
      </span>
      {[...v.bloqueios.map((t) => ({ t, tom: 'bad' as NxTone })), ...v.avisos.map((t) => ({ t, tom: 'warn' as NxTone }))].map((a, i) => <Aviso key={i} tom={a.tom}>{a.t}</Aviso>)}
      {v.tetoPlim != null && (
        <span style={{ fontSize: 12, color: NX.mudo }}>
          Queda de comunicação com consumo zero (validade {v.tVal} s): no início do intervalo a soma dos limites de P pode ir até {n1(v.tetoPlim, 0)} kW — a cada minuto o controle refaz a conta com a energia já exportada · Σ P estático {n1(v.somaEst, 0)} kW · Σ Pn {n1(v.somaPn, 0)} kW
        </span>
      )}

      <span style={{ ...s.label, marginTop: 12 }}>LIMITES</span>
      <div style={{ ...s.card, padding: '0 18px' }}>
        {LIMITES.map((f, i) => <Linha key={f.k} f={f} v={vals[f.k] ?? ''} ro={ro} first={i === 0} onChange={muda} />)}
      </div>

      <span style={{ ...s.label, marginTop: 12 }}>UFVs E INVERSORES</span>
      {ufvs.length === 0 && <span style={{ fontSize: 13, color: NX.mudo }}>Nenhuma UFV no controle. Adicione as usinas cujos inversores o controle pode comandar.</span>}
      {ufvs.map((u, i) => (
        <div key={u.id} style={{ ...s.card, padding: '12px 18px', ...col(8) }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input aria-label="Nome da UFV" value={u.nome} disabled={ro} onChange={(e) => mudaUfv(i, { nome: e.target.value })} style={{ ...s.campo(ro, false, 180), textAlign: 'left' }} />
            <Mini t="Ordem" h="1 = mais perto do medidor (hoje só informativo: o corte de P é igual em todos)" v={u.ordem} ro={ro} onChange={(x) => mudaUfv(i, { ordem: x })} />
            <Mini t="P estático" u="kW" v={u.p_estatico_kw} ro={ro} onChange={(x) => mudaUfv(i, { p_estatico_kw: x })} />
            <NxSeg<'internet' | 'lora'> value={u.rota} disabled={ro} options={[{ v: 'internet', label: 'Internet' }, { v: 'lora', label: 'LoRa' }]} onChange={(r) => mudaUfv(i, { rota: r })} />
            {!ro && <button type="button" onClick={() => { setUfvs((l) => l.filter((_, k) => k !== i)); setSujo(true); }} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: NX.bad }}>Remover UFV</button>}
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <SwitchTxt t="Watchdog nativo validado" h="Sem ele, o limite nunca passa do P estático (R2)" on={u.watchdog_nativo} ro={ro} onChange={() => mudaUfv(i, { watchdog_nativo: !u.watchdog_nativo })} />
            <SwitchTxt t="Zera no estágio 2" h="P = 0 se a comunicação não voltar" on={u.zera_estagio2} ro={ro} onChange={() => mudaUfv(i, { zera_estagio2: !u.zera_estagio2 })} />
            <Mini t="Chave A/M na entrada" h="Entrada (BI 1 a 8) da TON da UFV ligada à chave Automático/Manual. 0 = sem chave. Em manual: inversores a 100 %, FP 1, sem controle." v={u.bi_manual ?? 0} ro={ro} onChange={(x) => mudaUfv(i, { bi_manual: Math.max(0, Math.min(8, Math.round(x))) })} />
            {(u.bi_manual ?? 0) > 0 && (
              <SwitchTxt t="Contato fechado = automático" h="Ligado: a chave FECHA o contato em automático (manual = contato aberto). Desligado: fecha em manual." on={!!u.bi_invertida} ro={ro} onChange={() => mudaUfv(i, { bi_invertida: !u.bi_invertida })} />
            )}
          </div>
          {u.inversores.map((x, j) => {
            const cand = est.candidatos.find((c) => c.id === x.id);
            return (
              <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${NX.linha}`, paddingTop: 8 }}>
                <span style={{ ...col(0), minWidth: 140 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{x.nome ?? x.id}</span>
                  <span style={{ fontSize: 11, color: cand && (!cand.limite_p || !cand.reativo_q) ? NX.warn : NX.mudo }}>
                    {cand ? `${cand.modelo ?? 'sem modelo'}${!cand.limite_p ? ' · sem limite de P' : ''}${!cand.reativo_q ? ' · sem reativo' : ''}` : ''}
                  </span>
                </span>
                <Mini t="Pn" u="kW" v={x.pn_kw} ro={ro} onChange={(y) => mudaInv(i, j, { pn_kw: y })} />
                <Mini t="Smax" u="kVA" v={x.smax_kva} ro={ro} onChange={(y) => mudaInv(i, j, { smax_kva: y })} />
                <Mini t="Q máx" u="%" v={x.qmax_pct} ro={ro} onChange={(y) => mudaInv(i, j, { qmax_pct: y })} />
                <span title="Sinal do percentual de Q que FORNECE reativo (corrige FP indutivo). Sungrow: Q −" style={{ fontSize: 12, color: NX.mudo }}>fornece com</span>
                <NxSeg<'1' | '-1'> value={x.sinal_q === -1 ? '-1' : '1'} disabled={ro} options={[{ v: '1', label: 'Q +' }, { v: '-1', label: 'Q −' }]} onChange={(z) => mudaInv(i, j, { sinal_q: z === '-1' ? -1 : 1 })} />
                <SwitchTxt t="Q à noite" on={x.q_noturno} ro={ro} onChange={() => mudaInv(i, j, { q_noturno: !x.q_noturno })} />
                {!ro && <button type="button" aria-label={`Tirar ${x.nome ?? x.id}`} onClick={() => mudaUfv(i, { inversores: u.inversores.filter((_, k) => k !== j) })} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: NX.mudo }}>Tirar</button>}
              </div>
            );
          })}
          {!ro && livres.length > 0 && (
            <select aria-label="Adicionar inversor" value="" onChange={(e) => {
              const c = est.candidatos.find((k) => k.id === e.target.value);
              if (!c) return;
              const pn = c.pn_kw ?? 0;
              mudaUfv(i, { inversores: [...u.inversores, { id: c.id, nome: c.nome, pn_kw: pn, smax_kva: pn ? Math.round(pn * 1.1 * 10) / 10 : 0, qmax_pct: 44, sinal_q: c.sinal_q_padrao === -1 ? -1 : 1, q_noturno: false }] });
            }} style={{ ...s.campo(false, false, 260), textAlign: 'left' }}>
              <option value="">+ Adicionar inversor…</option>
              {livres.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.modelo ? ` · ${c.modelo}` : ''}</option>)}
            </select>
          )}
        </div>
      ))}
      {!ro && (
        <button type="button" onClick={() => { setUfvs((l) => [...l, { id: `ufv${Date.now()}`, nome: `UFV ${l.length + 1}`, ordem: l.length + 1, p_estatico_kw: 0, zera_estagio2: false, watchdog_nativo: false, rota: 'internet', inversores: [] }]); setSujo(true); }}
          style={{ alignSelf: 'flex-start', height: 36, padding: '0 14px', borderRadius: 10, border: `1px solid ${NX.borda}`, fontSize: 14, fontWeight: 700, background: NX.card }}>
          + Adicionar UFV
        </button>
      )}
      {est.candidatos.length === 0 && !ro && <span style={{ fontSize: 12, color: NX.mudo }}>Nenhum inversor nesta unidade/planta.</span>}

      <button type="button" onClick={() => setAvancado((x) => !x)} style={{ ...s.label, marginTop: 12, textAlign: 'left' }}>{avancado ? '▾' : '▸'} AVANÇADO</button>
      {avancado && (
        <div style={{ ...s.card, padding: '0 18px' }}>
          {AVANCADO.map((f, i) => <Linha key={f.k} f={f} v={vals[f.k] ?? ''} ro={ro} first={i === 0} onChange={muda} />)}
        </div>
      )}

      {!ro && <button type="button" disabled={!sujo || salvando} onClick={() => void salvar()} style={s.save(!sujo || salvando)}>{salvando ? 'Salvando…' : 'Salvar'}</button>}
      {ro && <span style={{ fontSize: 12, color: NX.mudo }}>Somente leitura para este perfil.</span>}

      <NxDialog open={!!confirmar} onClose={() => setConfirmar(null)} label="Ativar controle">
        {confirmar && (
          <>
            <NxDialogHead title={`Ativar ${ROTULO[confirmar.c].toLowerCase()}?`} onClose={() => setConfirmar(null)} />
            <span style={{ fontSize: 14, color: NX.caixaTx, lineHeight: 1.45 }}>
              O NexON passa a mandar setpoints aos inversores das UFVs cadastradas a cada minuto do medidor. Confira antes o modo sombra.
              Ainda não há validade do setpoint na TON: se o NexON parar, o último limite fica no inversor.
            </span>
            <NxDialogButtons onCancel={() => setConfirmar(null)} onConfirm={() => void aplicarModo(confirmar.c, confirmar.m)} confirmLabel="Ativar" busy={enviandoModo} />
          </>
        )}
      </NxDialog>
    </div>
  );
}

function Linha({ f, v, ro, first, onChange }: { f: Campo; v: string; ro: boolean; first: boolean; onChange: (k: string, v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 62, ...(first ? {} : { borderTop: `1px solid ${NX.linha}` }) }}>
      <label htmlFor={`cm-${f.k}`} style={col(2)}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{f.t}</span>
        {f.h && <span style={{ fontSize: 12, color: NX.mudo }}>{f.h}</span>}
      </label>
      {f.tipo === 'bool' ? (
        <button type="button" id={`cm-${f.k}`} disabled={ro} onClick={() => onChange(f.k, v === '0' ? '1' : '0')} aria-pressed={v !== '0'}>
          <NxSwitch on={v !== '0'} disabled={ro} />
        </button>
      ) : (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input id={`cm-${f.k}`} type={f.tipo === 'hora' ? 'time' : 'text'} inputMode={f.tipo === 'hora' ? undefined : 'decimal'} value={v} disabled={ro}
          onChange={(e) => onChange(f.k, e.target.value)} style={s.campo(ro, f.tipo !== 'hora' && Number.isNaN(numOuNull(v) as number), f.tipo === 'hora' ? 110 : 96)} />
        <span style={{ fontSize: 14, color: NX.mudo, width: 34 }}>{f.u ?? ''}</span>
      </span>
      )}
    </div>
  );
}

function Mini({ t, h, u, v, ro, onChange }: { t: string; h?: string; u?: string; v: number; ro: boolean; onChange: (x: number) => void }) {
  const [s1, setS1] = useState(txt(v));
  useEffect(() => { setS1(txt(v)); }, [v]);
  return (
    <label title={h} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: NX.mudo }}>
      {t}
      <input inputMode="decimal" value={s1} disabled={ro} aria-label={t}
        onChange={(e) => setS1(e.target.value)}
        onBlur={() => { const x = numOuNull(s1); if (x != null && !Number.isNaN(x)) onChange(x); else setS1(txt(v)); }}
        style={s.campo(ro, false, 72)} />
      {u}
    </label>
  );
}

function SwitchTxt({ t, h, on, ro, onChange }: { t: string; h?: string; on: boolean; ro: boolean; onChange: () => void }) {
  return (
    <button type="button" disabled={ro} onClick={onChange} title={h} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
      <NxSwitch on={on} disabled={ro} />{t}
    </button>
  );
}
