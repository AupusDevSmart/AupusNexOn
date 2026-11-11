import { useState, type CSSProperties } from 'react';
import { fmt } from './sheetParts';
import { NX, s, NxSwitch } from './nxMock';
import { DIRECAO_LABEL, fmtPct, type ConfigIrrigacao, type Direcao, type EnvioIrrigacao, type Parada } from './PivoIrrigacao';

/**
 * Edição rápida da irrigação com o pivô LIGADO, direto na ficha (NEXON-98) — os dois layouts de
 * teste além do modal: `PainelRapido` (formulário) e `AtalhosRapidos` (botões de um toque).
 * Os dois editam o mesmo rascunho; quem envia (e confirma com alerta) é a PivoSheet.
 */

/** O que dá para mudar sem abrir o Planejamento: direção, água, percentímetro/lâmina e parada. */
export interface Rascunho { direcao: Direcao; semAgua: boolean; percentual: number; lamina?: number | null; parada: Parada }

export const rascunhoDe = (c: ConfigIrrigacao, parada: Parada): Rascunho => ({
  direcao: c.direcao, semAgua: c.semAgua, percentual: c.percentual, lamina: c.lamina ?? null, parada,
});

export const mesmaParada = (a: Parada, b: Parada) => a.tipo === b.tipo
  && (a.tipo !== 'porAngulo' || a.angulo === (b as typeof a).angulo)
  && (a.tipo !== 'porVoltas' || a.voltas === (b as typeof a).voltas);

/** Lista do que mudou (rótulo, de → para) — vira o texto do alerta e o contador dos atalhos. */
export function mudancas(de: Rascunho, para: Rascunho): Array<{ campo: 'direcao' | 'agua' | 'percentual' | 'parada'; label: string; de: string; para: string }> {
  const paradaTxt = (p: Parada) => (p.tipo === 'porAngulo' ? `para em ${p.angulo}°` : p.tipo === 'porVoltas' ? `${p.voltas} volta${p.voltas > 1 ? 's' : ''}` : 'sem parar');
  const out: ReturnType<typeof mudancas> = [];
  if (de.direcao !== para.direcao) out.push({ campo: 'direcao', label: 'Direção', de: DIRECAO_LABEL[de.direcao], para: DIRECAO_LABEL[para.direcao] });
  if (de.semAgua !== para.semAgua) out.push({ campo: 'agua', label: 'Água', de: de.semAgua ? 'Seco' : 'Molhado', para: para.semAgua ? 'Seco' : 'Molhado' });
  if (!para.semAgua && !de.semAgua && de.percentual !== para.percentual) out.push({ campo: 'percentual', label: 'Percentímetro', de: `${fmtPct(de.percentual)}%`, para: `${fmtPct(para.percentual)}%` });
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

const col = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap });
const linha: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 };
const rotulo: CSSProperties = { fontSize: 15, fontWeight: 700 };
const segBox: CSSProperties = { display: 'flex', padding: 3, borderRadius: 12, background: NX.seg };

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

function SegDirecao({ valor, onChange, desabilitado }: { valor: Direcao; onChange: (d: Direcao) => void; desabilitado?: boolean }) {
  return (
    <div style={segBox}>
      {(['Avanço', 'Reverso'] as const).map((d) => (
        <button key={d} type="button" disabled={desabilitado} aria-pressed={valor === d} onClick={() => onChange(d)} style={s.seg(valor === d)}>{DIRECAO_LABEL[d]}</button>
      ))}
    </div>
  );
}

/** Layout "Painel": o formulário do planejamento simples aberto na ficha. */
export function PainelRapido({ valor, base, onChange, lamina100, desabilitado, onMaisOpcoes, aviso, notaParada }: Props) {
  const [pctTxt, setPctTxt] = useState<string | null>(null);
  const [lamTxt, setLamTxt] = useState<string | null>(null);
  const seco = valor.semAgua;
  const lam = valor.percentual > 0 ? (lamina100 * 100) / valor.percentual : null;
  const onPct = (v: string) => {
    setPctTxt(v); setLamTxt(null);
    const p = Number(v.replace(',', '.'));
    if (v.trim() !== '' && Number.isFinite(p) && p >= 0) onChange({ ...valor, percentual: Math.min(100, Math.round(p * 10) / 10), lamina: null });
  };
  const onLam = (v: string) => {
    setLamTxt(v); setPctTxt(null);
    const l = Number(v.replace(',', '.'));
    if (!(l > 0) || !(lamina100 > 0)) return;
    if (l < lamina100) { onChange({ ...valor, percentual: 100, lamina: null }); return; }
    onChange({ ...valor, percentual: Math.min(100, Math.round(((lamina100 * 100) / l) * 10) / 10), lamina: Math.round(l * 100) / 100 });
  };
  const p = valor.parada;
  const campo = (ro: boolean) => s.campo(ro, false, 76);
  return (
    <div style={{ ...s.card, padding: '12px 16px', ...col(6) }}>
      <Cabecalho titulo="Planejamento de irrigação" sub="Edite e envie sem sair da ficha" onMaisOpcoes={onMaisOpcoes} />
      {aviso && <span style={{ fontSize: 12, color: NX.warn }}>{aviso}</span>}
      <div style={linha}>
        <span style={rotulo}>Direção</span>
        <SegDirecao valor={valor.direcao} onChange={(direcao) => onChange({ ...valor, direcao })} desabilitado={desabilitado} />
      </div>
      <button type="button" role="switch" aria-checked={seco} disabled={desabilitado} onClick={() => onChange({ ...valor, semAgua: !seco })} style={{ ...linha, width: '100%' }}>
        <span style={{ ...col(2), textAlign: 'left' }}>
          <span style={rotulo}>Girar sem água</span>
          <span style={{ fontSize: 12, color: NX.mudo }}>{seco ? 'Sem água (a bomba não liga)' : 'Com água (molhado)'}</span>
        </span>
        <NxSwitch on={seco} />
      </button>
      <div style={linha}>
        <span style={rotulo}>Percentímetro</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input inputMode="decimal" aria-label="Percentímetro" disabled={desabilitado || seco} value={seco ? '—' : pctTxt ?? fmtPct(valor.percentual)}
            onChange={(e) => onPct(e.target.value)} onBlur={() => setPctTxt(null)} style={campo(!!desabilitado || seco)} />
          <span style={{ fontSize: 14, color: NX.mudo, width: 26 }}>%</span>
        </span>
      </div>
      <div style={linha}>
        <span style={rotulo}>Lâmina</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input inputMode="decimal" aria-label="Lâmina" disabled={desabilitado || seco} value={seco ? '—' : lamTxt ?? (lam != null ? fmt(lam, 2) : '—')}
            onChange={(e) => onLam(e.target.value)} onBlur={() => setLamTxt(null)} style={campo(!!desabilitado || seco)} />
          <span style={{ fontSize: 14, color: NX.mudo, width: 26 }}>mm</span>
        </span>
      </div>
      <div style={linha}>
        <span style={rotulo}>Parada</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select aria-label="Parada" disabled={desabilitado} value={p.tipo} style={s.select}
            onChange={(e) => onChange({ ...valor, parada: e.target.value === 'porAngulo' ? { tipo: 'porAngulo', angulo: 0 } : e.target.value === 'porVoltas' ? { tipo: 'porVoltas', voltas: 1 } : { tipo: 'semParar' } })}>
            <option value="semParar">Sem parar</option><option value="porAngulo">Por ângulo</option><option value="porVoltas">Por voltas</option>
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
        </span>
      </div>
      {notaParada && mesmaParada(valor.parada, base.parada) && <span style={{ fontSize: 12, color: NX.mudo }}>{notaParada}</span>}
    </div>
  );
}

/** Layout "Atalhos": a irrigação em curso em botões grandes, sem digitar. */
export function AtalhosRapidos({ valor, base, onChange, desabilitado, onMaisOpcoes, aviso, notaParada }: Props) {
  const seco = valor.semAgua;
  const passo = (d: number) => onChange({ ...valor, percentual: Math.min(100, Math.max(0, Math.round((valor.percentual + d) * 10) / 10)), lamina: null });
  const mudou = (c: 'direcao' | 'agua' | 'percentual') => mudancas(base, valor).some((m) => m.campo === c);
  const marca = (on: boolean): CSSProperties => (on ? { borderColor: NX.acao, boxShadow: `inset 0 0 0 1px ${NX.acao}` } : {});
  const bloco = (on: boolean): CSSProperties => ({ border: `1px solid ${NX.borda}`, borderRadius: 12, padding: '8px 10px', ...col(6), minWidth: 0, ...marca(on) });
  const titulo: CSSProperties = { fontSize: 11, fontWeight: 800, color: NX.mudo, letterSpacing: 0.5 };
  const opcao = (sel: boolean): CSSProperties => ({
    flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 800, textAlign: 'center',
    ...(sel ? { background: NX.acao, color: '#FFFFFF' } : { background: NX.seg, color: NX.texto }),
  });
  const btPasso = (off: boolean): CSSProperties => ({ width: 48, height: 44, borderRadius: 10, background: NX.seg, fontSize: 15, fontWeight: 800, color: off ? NX.desab : NX.texto, flex: 'none' });
  const offPct = !!desabilitado || seco;
  return (
    <div style={{ ...s.card, padding: '12px 16px', ...col(10) }}>
      <Cabecalho titulo="Irrigação em curso" sub="Toque para mudar e envie" onMaisOpcoes={onMaisOpcoes} />
      {aviso && <span style={{ fontSize: 12, color: NX.warn }}>{aviso}</span>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <div style={bloco(mudou('direcao'))}>
          <span style={titulo}>DIREÇÃO</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['Avanço', 'Reverso'] as const).map((d) => (
              <button key={d} type="button" disabled={desabilitado} aria-pressed={valor.direcao === d} onClick={() => onChange({ ...valor, direcao: d })} style={opcao(valor.direcao === d)}>{DIRECAO_LABEL[d]}</button>
            ))}
          </div>
        </div>
        <div style={bloco(mudou('agua'))}>
          <span style={titulo}>ÁGUA</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" disabled={desabilitado} aria-pressed={!seco} onClick={() => onChange({ ...valor, semAgua: false })} style={opcao(!seco)}>Molhado</button>
            <button type="button" disabled={desabilitado} aria-pressed={seco} onClick={() => onChange({ ...valor, semAgua: true })} style={opcao(seco)}>Seco</button>
          </div>
        </div>
      </div>
      <div style={bloco(mudou('percentual'))}>
        <span style={titulo}>PERCENTÍMETRO</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" aria-label="Menos 10%" disabled={offPct} onClick={() => passo(-10)} style={btPasso(offPct)}>−10</button>
          <button type="button" aria-label="Menos 1%" disabled={offPct} onClick={() => passo(-1)} style={btPasso(offPct)}>−1</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: seco ? NX.desab : NX.texto }}>
            {seco ? '—' : `${fmtPct(valor.percentual)}%`}
          </span>
          <button type="button" aria-label="Mais 1%" disabled={offPct} onClick={() => passo(1)} style={btPasso(offPct)}>+1</button>
          <button type="button" aria-label="Mais 10%" disabled={offPct} onClick={() => passo(10)} style={btPasso(offPct)}>+10</button>
        </div>
      </div>
      {notaParada && <span style={{ fontSize: 12, color: NX.mudo }}>{notaParada}</span>}
    </div>
  );
}
