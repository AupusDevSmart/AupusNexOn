import { fmt } from '@/features/supervisorio/v2/components/sheets/sheetParts';
import { NX, s } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { CAIXA_ROW, CARD, MEDIDA_ROTULO, MEDIDA_VALOR, TINTA, campoNumero } from './carregador.estilos';
import {
  FAIXA_ENERGIA, FAIXA_TEMPO, desdeTxt, duracaoTxt, faixaComTeto, lidoTxt, num, numTxt, validarLimite,
  type Falha, type Leitura, type Limites,
} from './carregador.util';

/**
 * Peças da aba Operação do carregador OCPP (NEXON-130): aviso de falha, medições da recarga
 * e os limites opcionais do diálogo "Iniciar recarga?".
 */

/** Falha informada pelo carregador: código do manual (se houver), o que é, como resolver e desde quando. */
export function AvisoFalha({ falha, tecnico }: { falha: Falha; tecnico: boolean }) {
  // O código do protocolo (ex.: OtherError) é jargão: só o analista vê.
  const meta = [desdeTxt(falha.desde), tecnico ? falha.ocpp : null].filter(Boolean).join(' · ');
  return (
    <div role="alert" style={{ ...TINTA.bad, borderRadius: 14, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={s.stDot('bad')} />
        <span style={s.stLabel('bad')}>{falha.codigo ? `Falha ${falha.codigo}` : 'Falha'}</span>
        {meta && <span style={{ fontSize: 13, color: NX.mudo, marginLeft: 'auto' }}>{meta}</span>}
      </div>
      <span style={{ fontSize: 15, fontWeight: 800 }}>{falha.titulo || 'O carregador informou uma falha'}</span>
      {falha.solucao && <span style={{ fontSize: 14, color: NX.caixaTx }}>{falha.solucao}</span>}
    </div>
  );
}

/**
 * Medições da recarga: potência, energia, tempo e valor; embaixo, corrente, tensão e
 * temperatura (só as que o carregador mandou) e o limite da recarga com o que falta.
 * Rótulo em cima do valor: lado a lado não cabe em 390 px. Ocupa a área "medidas" da
 * grade `.nxc-op` (4 cartões por linha; 2 no celular).
 */
export function MedicoesRecarga({ ativa, potenciaKw, energiaKwh, duracaoMin, valor, leitura, limite }: {
  /** Recarga em andamento (não vale para o pedido que ainda espera o carro). */
  ativa: boolean; potenciaKw: number | null; energiaKwh: number | null; duracaoMin: number | null;
  /** Valor estimado já formatado em R$. */
  valor: string; leitura: Leitura | null; limite: { limite: string; falta: string | null } | null;
}) {
  const itens = [
    { k: 'Potência agora', v: !ativa ? `${fmt(0, 1)} kW` : potenciaKw != null ? `${fmt(potenciaKw, 1)} kW` : '—' },
    { k: 'Energia da recarga', v: `${fmt(ativa ? energiaKwh ?? 0 : 0, 1)} kWh` },
    { k: 'Tempo da recarga', v: ativa ? duracaoTxt(duracaoMin) : '—' },
    { k: 'Valor estimado', v: valor },
  ];
  const medidas = [
    num(leitura?.corrente_a) != null ? `Corrente ${fmt(leitura?.corrente_a, 1)} A` : null,
    num(leitura?.tensao_v) != null ? `Tensão ${fmt(leitura?.tensao_v, 0)} V` : null,
    num(leitura?.temperatura_c) != null ? `Temperatura ${fmt(leitura?.temperatura_c, 0)} °C` : null,
  ].filter((x): x is string => !!x);
  const lido = medidas.length ? lidoTxt(leitura?.lido_em) : '';
  return (
    <div className="nxc-a-medidas" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div className="nxc-med">
        {itens.map((i) => (
          <div key={i.k} style={{ ...CARD, borderRadius: 14, padding: '9px 16px', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <span style={MEDIDA_ROTULO}>{i.k}</span>
            <span style={MEDIDA_VALOR}>{i.v}</span>
          </div>
        ))}
      </div>
      {(medidas.length > 0 || limite) && (
        <div style={{ ...CARD, borderRadius: 14, padding: '0 16px' }}>
          {medidas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', padding: '10px 0', fontSize: 13, color: NX.mudo, fontVariantNumeric: 'tabular-nums' }}>
              {medidas.map((m) => <span key={m} style={{ whiteSpace: 'nowrap' }}>{m}</span>)}
              {lido && <span style={{ whiteSpace: 'nowrap', marginLeft: 'auto' }}>{lido}</span>}
            </div>
          )}
          {limite && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 14px', padding: '10px 0', fontSize: 14, ...(medidas.length ? { borderTop: `1px solid ${NX.linha}` } : {}) }}>
              <span><span style={{ color: NX.mudo }}>Limite: </span><b>{limite.limite}</b></span>
              {limite.falta && <span style={{ color: NX.mudo, fontVariantNumeric: 'tabular-nums' }}>{limite.falta}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Limites opcionais do diálogo "Iniciar recarga?" (linhas da caixa cinza). Vêm com o padrão
 * do carregador, que também é o teto; vazio usa o padrão (ou fica sem limite, se não houver).
 */
export function LimitesAoIniciar({ limites, tempo, energia, onTempo, onEnergia }: {
  limites: Limites; tempo: string; energia: string; onTempo: (v: string) => void; onEnergia: (v: string) => void;
}) {
  const campos = [
    { id: 'w-ini-tempo', rotulo: 'Limite de tempo (min)', valor: tempo, onChange: onTempo, modo: 'numeric' as const, teto: num(limites.tempo_min), faixa: faixaComTeto(FAIXA_TEMPO, limites.tempo_min) },
    { id: 'w-ini-energia', rotulo: 'Limite de energia (kWh)', valor: energia, onChange: onEnergia, modo: 'decimal' as const, teto: num(limites.energia_kwh), faixa: faixaComTeto(FAIXA_ENERGIA, limites.energia_kwh) },
  ];
  return (
    <>
      {campos.map((c) => {
        const ruim = !validarLimite(c.valor, c.faixa).ok;
        const faixa = `${numTxt(c.faixa.min)} a ${numTxt(c.faixa.max)}`;
        const dica = ruim ? `Use de ${faixa}` : c.teto != null ? `Opcional · máximo ${numTxt(c.teto)}` : `Opcional · ${faixa}`;
        return (
          <div key={c.id} style={{ ...CAIXA_ROW, padding: '8px 0' }}>
            <label htmlFor={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span>{c.rotulo}</span>
              <span style={{ fontSize: 12, color: ruim ? NX.bad : NX.mudo }}>{dica}</span>
            </label>
            <input id={c.id} className="nxc-campo" inputMode={c.modo} autoComplete="off" value={c.valor} aria-invalid={ruim}
              placeholder={c.teto != null ? numTxt(c.teto) : 'sem limite'} onChange={(e) => c.onChange(e.target.value)} style={campoNumero(false, ruim)} />
          </div>
        );
      })}
    </>
  );
}
