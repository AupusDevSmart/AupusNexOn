import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/config/api';
import { NX, s, NxSeg, NxSwitch, NxDialog, NxDialogHead, NxDialogButtons, type NxTone } from './nxMock';

/**
 * Controle automático pelo MED Concessionária (backend controle-med):
 *  - Configuração: modo de cada controle (desligado · sombra · ativo), limites, UFVs/inversores;
 *  - Operação: o que o último ciclo (1 por minuto do medidor) decidiu, enviou ou enviaria.
 * docs/IOT-CONTROLE-MED-CONCESSIONARIA-IMPLEMENTACAO.md.
 */

type Modo = 'desligado' | 'sombra' | 'ativo';
type Controle = 'fp' | 'demanda_g' | 'demanda_c';
interface Inversor { id: string; nome?: string; pn_kw: number; smax_kva: number; qmax_pct: number; sinal_q: 1 | -1; q_noturno: boolean }
interface Ufv { id: string; nome: string; ordem: number; p_estatico_kw: number; zera_estagio2: boolean; watchdog_nativo: boolean; rota: 'internet' | 'lora'; inversores: Inversor[] }
interface Candidato { id: string; nome: string; modelo: string | null; pn_kw: number | null; limite_p: boolean; reativo_q: boolean }
interface Ciclo {
  ts: string; seg: number | null;
  entradas: { E_imp?: number; E_exp?: number; P_imp?: number; P_exp?: number; Q_ind?: number; Q_cap?: number; janela?: 'ind' | 'cap'; eventos?: string[] };
  portao: { ok: boolean; motivos: string[] };
  pedidos: Partial<Record<Controle, { acao: string; motivo: string; D_proj?: number | null; contrato?: number | null; dQ?: number; fp_hora?: number | null }>>;
  comandos: Array<{ inversor_id: string; nome: string; ufv: string; p_lim_kw: number; p_pct: number; q_kvar: number; q_pct: number; muda_p: boolean; muda_q: boolean; enviado_p?: string; enviado_q?: string; motivo: string[] }>;
  modos: Record<Controle, Modo>;
}
interface Estado {
  params: Record<string, number | string | null>; ufvs: Ufv[]; modos: Record<Controle, Modo>; versao: number;
  validacao: { tetoPlim: number | null; somaEst: number; somaPn: number; tVal: number; avisos: string[]; bloqueios: string[] };
  candidatos: Candidato[]; ultimo_ciclo: Ciclo | null; pode_configurar: boolean; pode_operar: boolean;
}

const ROTULO: Record<Controle, string> = { demanda_c: 'Demanda de carga', demanda_g: 'Demanda de geração', fp: 'Fator de potência' };
const SUB: Record<Controle, string> = {
  demanda_c: 'Libera geração limitada quando a projeção do intervalo passa do contrato',
  demanda_g: 'Corta geração (UFV mais distante primeiro) antes da projeção passar do contrato',
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

const TOM_ACAO: Record<string, NxTone> = { reduzir: 'warn', aguardar: 'warn', liberar: 'ok', compensar: 'warn', devolver: 'ok', hora_perdida: 'bad', sem_atuador: 'bad' };

/** Card da aba Operação: só aparece com algum controle fora de "desligado". */
export function ControleMedResumo({ medId }: { medId: string }) {
  const { est, carregar } = useControle(medId);
  useEffect(() => { const t = setInterval(() => void carregar(), 30_000); return () => clearInterval(t); }, [carregar]);
  if (!est || ORDEM.every((c) => est.modos[c] === 'desligado')) return null;
  const c = est.ultimo_ciclo;
  const idade = c ? (Date.now() - new Date(c.ts).getTime()) / 1000 : null;
  return (
    <div style={{ ...s.card, padding: '14px 18px', ...col(10) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Controle automático</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ORDEM.filter((k) => est.modos[k] !== 'desligado').map((k) => (
            <span key={k} style={s.pill(est.modos[k] === 'ativo' ? 'ok' : 'off')}>{ROTULO[k]} · {est.modos[k] === 'ativo' ? 'Ativo' : 'Sombra'}</span>
          ))}
        </span>
      </div>
      {!c ? (
        <span style={{ fontSize: 13, color: NX.mudo }}>Aguardando o primeiro minuto do medidor.</span>
      ) : (
        <>
          <span style={{ fontSize: 12, color: idade != null && idade > 180 ? NX.warn : NX.mudo }}>
            Último ciclo {hora(c.ts)}{c.seg != null ? ` · intervalo fecha em ${Math.round(c.seg)} s` : ''}{idade != null && idade > 180 ? ' · sem minuto novo do medidor' : ''}
          </span>
          {!c.portao.ok && <Aviso tom="bad">{c.portao.motivos.join(' · ')}</Aviso>}
          {ORDEM.map((k) => {
            const p = c.pedidos[k];
            if (!p) return null;
            const tom = TOM_ACAO[p.acao] ?? 'ok';
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                <span style={s.stDot(tom)} />
                <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{ROTULO[k]}</span>
                <span style={{ color: NX.mudo }}>{p.motivo}{k === 'fp' && p.fp_hora != null ? ` · FP da hora ${n1(p.fp_hora, 3)}` : ''}</span>
              </div>
            );
          })}
          {c.comandos.some((x) => x.enviado_p || x.enviado_q) && (
            <div style={{ ...col(4), borderTop: `1px solid ${NX.linha}`, paddingTop: 8 }}>
              {c.comandos.filter((x) => x.enviado_p || x.enviado_q).map((x) => (
                <span key={x.inversor_id} style={{ fontSize: 13 }}>
                  <b>{x.nome}</b>{' '}
                  {x.enviado_p && <>limite {n1(x.p_pct, 0)}% ({n1(x.p_lim_kw)} kW) <Envio r={x.enviado_p} /> </>}
                  {x.enviado_q && <>· reativo {n1(x.q_kvar)} kvar <Envio r={x.enviado_q} /></>}
                </span>
              ))}
            </div>
          )}
          {(c.entradas.eventos ?? []).map((e, i) => <Aviso key={i} tom="warn">{e}</Aviso>)}
        </>
      )}
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

interface Campo { k: string; t: string; h?: string; u?: string; tipo?: 'hora' }
const LIMITES: Campo[] = [
  { k: 'd_contr_g_kw', t: 'Contrato de geração', h: 'Vazio = o da unidade consumidora', u: 'kW' },
  { k: 'alvo_g_pct', t: 'Alvo de geração', h: 'Ritmo planejado; a projeção nunca passa do contrato', u: '%' },
  { k: 'd_contr_c_kw', t: 'Contrato de carga', h: 'Fora de ponta (verde: valor único). Vazio = o da unidade', u: 'kW' },
  { k: 'd_contr_c_ponta_kw', t: 'Contrato de carga na ponta', h: 'Só tarifa azul', u: 'kW' },
  { k: 'alvo_c_pct', t: 'Alvo de carga', u: '%' },
  { k: 'fp_lim_ind', t: 'FP limite indutivo', h: 'Regulatório (0,92)' },
  { k: 'fp_alvo_ind', t: 'FP alvo indutivo', h: 'Pelo menos 0,005 acima do limite' },
  { k: 'fp_lim_cap', t: 'FP limite capacitivo' },
  { k: 'fp_alvo_cap', t: 'FP alvo capacitivo' },
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
          Pior caso de perda de comunicação (validade {v.tVal} s): soma dos limites de P até {n1(v.tetoPlim, 0)} kW · Σ P estático {n1(v.somaEst, 0)} kW · Σ Pn {n1(v.somaPn, 0)} kW
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
            <Mini t="Ordem" h="1 = mais perto do medidor" v={u.ordem} ro={ro} onChange={(x) => mudaUfv(i, { ordem: x })} />
            <Mini t="P estático" u="kW" v={u.p_estatico_kw} ro={ro} onChange={(x) => mudaUfv(i, { p_estatico_kw: x })} />
            <NxSeg<'internet' | 'lora'> value={u.rota} disabled={ro} options={[{ v: 'internet', label: 'Internet' }, { v: 'lora', label: 'LoRa' }]} onChange={(r) => mudaUfv(i, { rota: r })} />
            {!ro && <button type="button" onClick={() => { setUfvs((l) => l.filter((_, k) => k !== i)); setSujo(true); }} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: NX.bad }}>Remover UFV</button>}
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <SwitchTxt t="Watchdog nativo validado" h="Sem ele, o limite nunca passa do P estático (R2)" on={u.watchdog_nativo} ro={ro} onChange={() => mudaUfv(i, { watchdog_nativo: !u.watchdog_nativo })} />
            <SwitchTxt t="Zera no estágio 2" h="P = 0 se a comunicação não voltar" on={u.zera_estagio2} ro={ro} onChange={() => mudaUfv(i, { zera_estagio2: !u.zera_estagio2 })} />
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
              mudaUfv(i, { inversores: [...u.inversores, { id: c.id, nome: c.nome, pn_kw: pn, smax_kva: pn ? Math.round(pn * 1.1 * 10) / 10 : 0, qmax_pct: 44, sinal_q: 1, q_noturno: false }] });
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
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input id={`cm-${f.k}`} type={f.tipo === 'hora' ? 'time' : 'text'} inputMode={f.tipo === 'hora' ? undefined : 'decimal'} value={v} disabled={ro}
          onChange={(e) => onChange(f.k, e.target.value)} style={s.campo(ro, f.tipo !== 'hora' && Number.isNaN(numOuNull(v) as number), f.tipo === 'hora' ? 110 : 96)} />
        <span style={{ fontSize: 14, color: NX.mudo, width: 34 }}>{f.u ?? ''}</span>
      </span>
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
