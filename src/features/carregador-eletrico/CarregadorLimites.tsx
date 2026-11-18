import type { CSSProperties } from 'react';
import { NX, s, NxSwitchRow } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { Linha, col, secao } from '@/features/supervisorio/v2/components/sheets/pivoPartes';
import { campoNumero } from './carregador.estilos';
import { Aviso } from './carregadorUi';
import { FAIXA_ENERGIA, FAIXA_TEMPO, faixaCorrente, num, numTxt, type Limites, type RascunhoConfig, type RevisaoConfig } from './carregador.util';

/**
 * Configuração › Limites de uso e Corrente máxima (carregador OCPP, NEXON-130).
 * Só desenha: o rascunho, a revisão "de → para" e o PUT :id/config ficam no modal, junto com
 * o valor do kWh (um Salvar só na aba). Quem não pode editar vê o valor em leitura.
 */

const VALOR: CSSProperties = { fontSize: 15, color: NX.mudo, textAlign: 'right' };
const semLimite = (v: unknown, unidade: string) => (num(v) == null ? 'Sem limite' : `${numTxt(v)} ${unidade}`);

function CampoLimite({ id, titulo, dica, ruim, valor, onChange, unidade, inteiro, first }: {
  id: string; titulo: string; dica: string; ruim: boolean; valor: string; onChange: (v: string) => void; unidade: string; inteiro?: boolean; first?: boolean;
}) {
  return (
    <div style={{ ...(first ? {} : { borderTop: `1px solid ${NX.linha}` }), padding: '10px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
      <label htmlFor={id} style={{ flex: 1, minWidth: 0, ...col(2) }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</span>
        <span style={{ fontSize: 12, color: ruim ? NX.bad : NX.mudo }}>{dica}</span>
      </label>
      <input id={id} className="nxc-campo" inputMode={inteiro ? 'numeric' : 'decimal'} autoComplete="off" placeholder="sem limite" aria-invalid={ruim}
        value={valor} onChange={(e) => onChange(e.target.value)} style={campoNumero(false, ruim)} />
      <span style={{ fontSize: 14, color: NX.mudo, width: 32, flex: 'none' }}>{unidade}</span>
    </div>
  );
}

export function CarregadorLimites({ limites, rascunho, ruins, onRascunho, podeLimites, podeCorrente }: {
  limites: Limites; rascunho: RascunhoConfig; ruins: RevisaoConfig['ruins'];
  onRascunho: (p: Partial<RascunhoConfig>) => void;
  /** Limites padrão e início automático: analista e proprietário. */
  podeLimites: boolean;
  /** Corrente máxima: só o analista. */
  podeCorrente: boolean;
}) {
  const auto = rascunho.auto ?? !!limites.inicio_automatico;
  const fc = faixaCorrente(limites);
  return (
    <>
      {secao('LIMITES DE USO', 10)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        {podeLimites ? (
          <>
            <CampoLimite first id="w-lim-tempo" titulo="Tempo padrão por recarga" unidade="min" inteiro
              dica={`${FAIXA_TEMPO.min} a ${FAIXA_TEMPO.max} min · vazio = sem limite`} ruim={ruins.tempo}
              valor={rascunho.tempo ?? numTxt(limites.tempo_min)} onChange={(v) => onRascunho({ tempo: v })} />
            <CampoLimite id="w-lim-energia" titulo="Energia padrão por recarga" unidade="kWh"
              dica={`${FAIXA_ENERGIA.min} a ${FAIXA_ENERGIA.max} kWh · vazio = sem limite`} ruim={ruins.energia}
              valor={rascunho.energia ?? numTxt(limites.energia_kwh)} onChange={(v) => onRascunho({ energia: v })} />
          </>
        ) : (
          <>
            <Linha first titulo="Tempo padrão por recarga" minHeight={50}><span style={VALOR}>{semLimite(limites.tempo_min, 'min')}</span></Linha>
            <Linha titulo="Energia padrão por recarga" minHeight={50}><span style={VALOR}>{semLimite(limites.energia_kwh, 'kWh')}</span></Linha>
          </>
        )}
        <NxSwitchRow title="Iniciar sozinho ao conectar o carro" sub="A recarga começa sem morador e não entra na cobrança por morador."
          on={auto} disabled={!podeLimites} onToggle={() => onRascunho({ auto: !auto })} />
      </div>

      {secao('CORRENTE MÁXIMA', 10)}
      <div style={{ ...s.card, padding: '0 16px' }}>
        {podeCorrente ? (
          <CampoLimite first id="w-lim-corrente" titulo="Limite de corrente" unidade="A" inteiro
            dica={`${fc.min} a ${fc.max} A · vazio = sem limite`} ruim={ruins.corrente}
            valor={rascunho.corrente ?? numTxt(limites.corrente_a)} onChange={(v) => onRascunho({ corrente: v })} />
        ) : (
          <Linha first titulo="Limite de corrente" sub="Definido pelo analista" minHeight={50}><span style={VALOR}>{semLimite(limites.corrente_a, 'A')}</span></Linha>
        )}
      </div>
      {limites.corrente_suportada === false && (
        <Aviso tom="warn" role="status"><span>Este carregador recusou o limite de corrente.</span></Aviso>
      )}
    </>
  );
}
