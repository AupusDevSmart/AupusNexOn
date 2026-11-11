import { useState, type CSSProperties } from 'react';
import { fmt } from './sheetParts';
import { NX, s } from './nxMock';
import { DIRECAO_LABEL, ehParado, fmtPct, type ConfigIrrigacao, type Direcao, type EnvioIrrigacao, type Parada } from './PivoIrrigacao';

/**
 * Edição rápida da irrigação com o pivô LIGADO, direto na ficha (NEXON-98) — os dois layouts de
 * teste além do modal: `PainelRapido` (formulário) e `AtalhosRapidos` (botões de um toque).
 * Os dois editam o mesmo rascunho; quem envia (e confirma com alerta) é a PivoSheet.
 */

/** O que dá para mudar sem abrir o Planejamento: movimento, água, percentímetro/lâmina e parada.
 *  Parado = com água e percentual 0 (irriga no lugar, sem girar). */
export interface Rascunho { direcao: Direcao; semAgua: boolean; percentual: number; lamina?: number | null; parada: Parada }
type Movimento = Direcao | 'Parado';

export const rascunhoDe = (c: ConfigIrrigacao, parada: Parada): Rascunho => ({
  direcao: c.direcao, semAgua: c.semAgua, percentual: c.percentual, lamina: c.lamina ?? null, parada,
});

export const mesmaParada = (a: Parada, b: Parada) => a.tipo === b.tipo
  && (a.tipo !== 'porAngulo' || a.angulo === (b as typeof a).angulo)
  && (a.tipo !== 'porVoltas' || a.voltas === (b as typeof a).voltas)
  && (a.tipo !== 'porTempo' || a.minutos === (b as typeof a).minutos);

const paradaTxt = (p: Parada) => (p.tipo === 'porAngulo' ? `para em ${p.angulo}°` : p.tipo === 'porVoltas' ? `${p.voltas} volta${p.voltas > 1 ? 's' : ''}`
  : p.tipo === 'porTempo' ? `${p.minutos} min` : 'sem parar');
const pctTxt = (p: number) => (p > 0 ? `${fmtPct(p)}%` : 'Parado (0%)');

/** Lista do que mudou (rótulo, de → para) — vira o texto do alerta e o contador dos atalhos. */
export function mudancas(de: Rascunho, para: Rascunho): Array<{ campo: 'direcao' | 'agua' | 'percentual' | 'parada'; label: string; de: string; para: string }> {
  const out: ReturnType<typeof mudancas> = [];
  if (de.direcao !== para.direcao) out.push({ campo: 'direcao', label: 'Direção', de: DIRECAO_LABEL[de.direcao], para: DIRECAO_LABEL[para.direcao] });
  if (de.semAgua !== para.semAgua) out.push({ campo: 'agua', label: 'Água', de: de.semAgua ? 'Seco' : 'Molhado', para: para.semAgua ? 'Seco' : 'Molhado' });
  if (!para.semAgua && !de.semAgua && de.percentual !== para.percentual) out.push({ campo: 'percentual', label: 'Percentímetro', de: pctTxt(de.percentual), para: pctTxt(para.percentual) });
  if (!mesmaParada(de.parada, para.parada)) out.push({ campo: 'parada', label: 'Parada', de: paradaTxt(de.parada), para: paradaTxt(para.parada) });
  return out;
}

/** Rascunho → o envio do /acionar (irrigação simples, agora), mantendo canhão e faixas em curso. */
export const envioDoRascunho = (r: Rascunho, emCurso: ConfigIrrigacao): EnvioIrrigacao => {
  const canhao = emCurso.canhao && !r.semAgua;
  return {
    modo: 'simples', parada: r.parada, inicio: null,
    config: { ...emCurso, direcao: r.direcao, semAgua: r.semAgua, percentual: r.percentual, lamina: r.lamina ?? null, canhao, faixasCanhao: canhao ? emCurso.faixasCanhao : [] },
  };
};

const movimentoDe = (r: Rascunho): Movimento => (ehParado(r) ? 'Parado' : r.direcao);
/** Troca o movimento. Parado zera o percentual (com água) e tira parada por ângulo/voltas, que
 *  parado não alcança; voltar a girar retoma o percentual que estava em curso. */
export const comMovimento = (r: Rascunho, m: Movimento, base: Rascunho): Rascunho => {
  if (m === 'Parado') {
    return { ...r, semAgua: false, percentual: 0, lamina: null, parada: r.parada.tipo === 'porAngulo' || r.parada.tipo === 'porVoltas' ? { tipo: 'semParar' } : r.parada };
  }
  if (!ehParado(r)) return { ...r, direcao: m };
  // saindo do Parado: volta o percentual em curso e a parada por ângulo/voltas que o Parado tirou
  const devolveParada = r.parada.tipo === 'semParar' && (base.parada.tipo === 'porAngulo' || base.parada.tipo === 'porVoltas');
  return { ...r, direcao: m, percentual: base.percentual > 0 ? base.percentual : 100, lamina: null, parada: devolveParada ? base.parada : r.parada };
};

/** Seco → Molhado. Um rascunho seco com percentual 0 não pode virar "Parado" por tabela. */
const molhado = (r: Rascunho, base: Rascunho): Rascunho =>
  ({ ...r, semAgua: false, ...(r.percentual > 0 ? {} : { percentual: base.percentual > 0 ? base.percentual : 100, lamina: null }) });

const col = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap });
const linha: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 };
const rotulo: CSSProperties = { fontSize: 15, fontWeight: 700 };
const segBox: CSSProperties = { display: 'flex', padding: 3, borderRadius: 12, background: NX.seg };
/** "Parado" só é mostrado quando a irrigação em curso já é parada: ligar parado saiu da tela (NEXON-98). */
const MOVIMENTOS: Movimento[] = ['Avanço', 'Reverso', 'Parado'];
const movLabel = (m: Movimento) => (m === 'Parado' ? 'Parado' : DIRECAO_LABEL[m]);

interface Props {
  valor: Rascunho;
  /** Irrigação em curso, para marcar o que mudou. */
  base: Rascunho;
  onChange: (r: Rascunho) => void;
  lamina100: number;
  desabilitado?: boolean;
  onMaisOpcoes: () => void;
  /** Aviso no topo: pivô ligado sem irrigação registrada pelo NexON. */
  aviso?: string | null;
  /** Parada automática em curso que o reinício mantém enquanto a Parada não for alterada. */
  notaParada?: string | null;
  /** A TON tem o ponto Percentímetro: dá para deixar PARADO (0 %, irriga no lugar). */
  podeParado?: boolean;
}

function Cabecalho({ titulo, sub, onMaisOpcoes }: { titulo: string; sub: string; onMaisOpcoes: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={col(2)}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</span>
        <span style={{ fontSize: 12, color: NX.mudo }}>{sub}</span>
      </span>
      <button type="button" onClick={onMaisOpcoes} style={{ height: 36, padding: '0 6px', fontSize: 13, fontWeight: 800, color: NX.acao, whiteSpace: 'nowrap' }}>Mais opções ›</button>
    </div>
  );
}

/** Layout "Painel": o formulário do planejamento aberto na ficha. */
export function PainelRapido({ valor, base, onChange, lamina100, desabilitado, onMaisOpcoes, aviso, notaParada, podeParado }: Props) {
  const [pctDig, setPctDig] = useState<string | null>(null);
  const [lamDig, setLamDig] = useState<string | null>(null);
  const [minDig, setMinDig] = useState<string | null>(null);
  const seco = valor.semAgua;
  const parado = ehParado(valor);
  const mov = movimentoDe(valor);
  const lam = valor.percentual > 0 ? (lamina100 * 100) / valor.percentual : null;
  const onPct = (v: string) => {
    setPctDig(v); setLamDig(null);
    const p = Number(v.replace(',', '.'));
    if (v.trim() !== '' && Number.isFinite(p) && p >= 1) onChange({ ...valor, percentual: Math.min(100, Math.round(p * 10) / 10), lamina: null });
  };
  const onLam = (v: string) => {
    setLamDig(v); setPctDig(null);
    const l = Number(v.replace(',', '.'));
    if (!(l > 0) || !(lamina100 > 0)) return;
    if (l < lamina100) { onChange({ ...valor, percentual: 100, lamina: null }); return; }
    onChange({ ...valor, percentual: Math.max(1, Math.min(100, Math.round(((lamina100 * 100) / l) * 10) / 10)), lamina: Math.round(l * 100) / 100 });
  };
  const p = valor.parada;
  const campo = (ro: boolean) => s.campo(ro, false, 76);
  return (
    <div style={{ ...s.card, padding: '12px 16px', ...col(6) }}>
      <Cabecalho titulo="Planejamento de irrigação" sub="Edite e envie sem sair da ficha" onMaisOpcoes={onMaisOpcoes} />
      {aviso && <span style={{ fontSize: 12, color: NX.warn }}>{aviso}</span>}
      <div style={linha}>
        <span style={rotulo}>Movimento</span>
        <div role="radiogroup" aria-label="Movimento" style={segBox}>
          {MOVIMENTOS.filter((m) => m !== 'Parado' || parado).map((m) => {
            const off = !!desabilitado || (m === 'Parado' && !podeParado && !parado);
            return (
              <button key={m} type="button" role="radio" aria-checked={mov === m} disabled={off} title={m === 'Parado' && !podeParado ? 'Precisa do ponto Percentímetro na TON' : undefined}
                onClick={() => { setPctDig(null); setLamDig(null); onChange(comMovimento(valor, m, base)); }}
                style={{ ...s.seg(mov === m), ...(m === 'Parado' && !podeParado && !parado ? { opacity: 0.45 } : {}) }}>{movLabel(m)}</button>
            );
          })}
        </div>
      </div>
      <div style={{ ...linha, ...(parado ? { opacity: 0.45 } : {}) }}>
        <span style={rotulo}>Água</span>
        <div role="radiogroup" aria-label="Água" style={segBox}>
          <button type="button" role="radio" aria-checked={!seco} disabled={desabilitado || parado} onClick={() => onChange(molhado(valor, base))} style={s.seg(!seco)}>Molhado</button>
          <button type="button" role="radio" aria-checked={seco} disabled={desabilitado || parado} onClick={() => onChange({ ...valor, semAgua: true })} style={s.seg(seco)}>Seco</button>
        </div>
      </div>
      {parado && <span style={{ fontSize: 12, color: NX.mudo }}>Parado: a água segue ligada sem girar — irriga no lugar onde está.</span>}
      {!parado && !seco && (
        <div style={linha}>
          <span style={rotulo}>Percentímetro · lâmina</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input inputMode="decimal" aria-label="Percentímetro" disabled={desabilitado} value={pctDig ?? fmtPct(valor.percentual)}
              onChange={(e) => onPct(e.target.value)} onBlur={() => setPctDig(null)} style={campo(!!desabilitado)} />
            <span style={{ fontSize: 14, color: NX.mudo }}>%</span>
            <input inputMode="decimal" aria-label="Lâmina" disabled={desabilitado} value={lamDig ?? (lam != null ? fmt(lam, 2) : '—')}
              onChange={(e) => onLam(e.target.value)} onBlur={() => setLamDig(null)} style={campo(!!desabilitado)} />
            <span style={{ fontSize: 14, color: NX.mudo }}>mm</span>
          </span>
        </div>
      )}
      <div style={linha}>
        <span style={rotulo}>Parada</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select aria-label="Parada" disabled={desabilitado} value={p.tipo} style={s.select}
            onChange={(e) => onChange({ ...valor, parada: e.target.value === 'porAngulo' ? { tipo: 'porAngulo', angulo: 0 } : e.target.value === 'porVoltas' ? { tipo: 'porVoltas', voltas: 1 }
              : e.target.value === 'porTempo' ? { tipo: 'porTempo', minutos: 60 } : { tipo: 'semParar' } })}>
            <option value="semParar">Sem parar</option>
            {(!parado || p.tipo === 'porAngulo') && <option value="porAngulo">Por ângulo</option>}
            {(!parado || p.tipo === 'porVoltas') && <option value="porVoltas">Por voltas</option>}
            <option value="porTempo">Por tempo</option>
          </select>
          {p.tipo === 'porAngulo' && (
            <><input inputMode="numeric" aria-label="Ângulo de parada" disabled={desabilitado} value={p.angulo} style={s.campo(!!desabilitado, false, 60)}
              onChange={(e) => onChange({ ...valor, parada: { tipo: 'porAngulo', angulo: Math.min(359, Math.max(0, Number(e.target.value) || 0)) } })} />
              <span style={{ fontSize: 14, color: NX.mudo }}>°</span></>
          )}
          {p.tipo === 'porVoltas' && (
            <input inputMode="numeric" aria-label="Voltas" disabled={desabilitado} value={p.voltas} style={s.campo(!!desabilitado, false, 52)}
              onChange={(e) => onChange({ ...valor, parada: { tipo: 'porVoltas', voltas: Math.min(10, Math.max(1, Number(e.target.value) || 1)) } })} />
          )}
          {p.tipo === 'porTempo' && (
            <><input inputMode="numeric" aria-label="Minutos" disabled={desabilitado} value={minDig ?? String(p.minutos)} style={s.campo(!!desabilitado, false, 68)}
              onBlur={() => setMinDig(null)}
              onChange={(e) => { setMinDig(e.target.value); const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 10080) onChange({ ...valor, parada: { tipo: 'porTempo', minutos: n } }); }} />
              <span style={{ fontSize: 14, color: NX.mudo }}>min</span></>
          )}
        </span>
      </div>
      {parado && p.tipo !== 'porTempo' && <span style={{ fontSize: 12, color: NX.warn }}>Parado só para por tempo: sem isso, irriga no mesmo lugar até alguém desligar.</span>}
      {notaParada && mesmaParada(valor.parada, base.parada) && <span style={{ fontSize: 12, color: NX.mudo }}>{notaParada}</span>}
    </div>
  );
}

/** Layout "Atalhos": a irrigação em curso em botões grandes, sem digitar. */
export function AtalhosRapidos({ valor, base, onChange, desabilitado, onMaisOpcoes, aviso, notaParada, podeParado }: Props) {
  const seco = valor.semAgua;
  const parado = ehParado(valor);
  const mov = movimentoDe(valor);
  // de 1 a 100: para não girar existe o "Parado"
  const passo = (d: number) => onChange({ ...valor, percentual: Math.min(100, Math.max(1, Math.round((valor.percentual + d) * 10) / 10)), lamina: null });
  const ms = mudancas(base, valor);
  const mudouMov = ms.some((m) => m.campo === 'direcao') || ehParado(base) !== parado;
  const mudou = (c: 'agua' | 'percentual') => ms.some((m) => m.campo === c);
  const marca = (on: boolean): CSSProperties => (on ? { borderColor: NX.acao, boxShadow: `inset 0 0 0 1px ${NX.acao}` } : {});
  const bloco = (on: boolean): CSSProperties => ({ border: `1px solid ${NX.borda}`, borderRadius: 12, padding: '8px 10px', ...col(6), minWidth: 0, ...marca(on) });
  const titulo: CSSProperties = { fontSize: 11, fontWeight: 800, color: NX.mudo, letterSpacing: 0.5 };
  const opcao = (sel: boolean, off = false): CSSProperties => ({
    flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 800, textAlign: 'center', minWidth: 0,
    ...(sel ? { background: NX.acao, color: '#FFFFFF' } : { background: NX.seg, color: NX.texto }),
    ...(off ? { opacity: 0.45 } : {}),
  });
  const btPasso = (off: boolean): CSSProperties => ({ width: 48, height: 44, borderRadius: 10, background: NX.seg, fontSize: 15, fontWeight: 800, color: off ? NX.desab : NX.texto, flex: 'none' });
  const offPct = !!desabilitado || seco || parado;
  return (
    <div style={{ ...s.card, padding: '12px 16px', ...col(10) }}>
      <Cabecalho titulo="Irrigação em curso" sub="Toque para mudar e envie" onMaisOpcoes={onMaisOpcoes} />
      {aviso && <span style={{ fontSize: 12, color: NX.warn }}>{aviso}</span>}
      <div style={bloco(mudouMov)}>
        <span style={titulo}>MOVIMENTO</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {MOVIMENTOS.filter((m) => m !== 'Parado' || parado).map((m) => {
            const semPonto = m === 'Parado' && !podeParado && !parado;
            return (
              <button key={m} type="button" disabled={desabilitado || semPonto} aria-pressed={mov === m} title={semPonto ? 'Precisa do ponto Percentímetro na TON' : undefined}
                onClick={() => onChange(comMovimento(valor, m, base))} style={opcao(mov === m, semPonto)}>{movLabel(m)}</button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: 8 }}>
        <div style={{ ...bloco(mudou('agua')), ...(parado ? { opacity: 0.45 } : {}) }}>
          <span style={titulo}>ÁGUA</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" disabled={desabilitado || parado} aria-pressed={!seco} onClick={() => onChange(molhado(valor, base))} style={opcao(!seco)}>Molhado</button>
            <button type="button" disabled={desabilitado || parado} aria-pressed={seco} onClick={() => onChange({ ...valor, semAgua: true })} style={opcao(seco)}>Seco</button>
          </div>
        </div>
        <div style={bloco(mudou('percentual') && !parado)}>
          <span style={titulo}>PERCENTÍMETRO</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" aria-label="Menos 10%" disabled={offPct} onClick={() => passo(-10)} style={btPasso(offPct)}>−10</button>
            <button type="button" aria-label="Menos 1%" disabled={offPct} onClick={() => passo(-1)} style={btPasso(offPct)}>−1</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: offPct ? NX.desab : NX.texto, minWidth: 0 }}>
              {seco || parado ? '—' : `${fmtPct(valor.percentual)}%`}
            </span>
            <button type="button" aria-label="Mais 1%" disabled={offPct} onClick={() => passo(1)} style={btPasso(offPct)}>+1</button>
            <button type="button" aria-label="Mais 10%" disabled={offPct} onClick={() => passo(10)} style={btPasso(offPct)}>+10</button>
          </div>
        </div>
      </div>
      {parado && <span style={{ fontSize: 12, color: NX.mudo }}>Parado: a água segue ligada sem girar — irriga no lugar onde está.</span>}
      {notaParada && mesmaParada(valor.parada, base.parada) && <span style={{ fontSize: 12, color: NX.mudo }}>{notaParada}</span>}
    </div>
  );
}
