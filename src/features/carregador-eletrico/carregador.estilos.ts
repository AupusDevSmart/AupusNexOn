import type { CSSProperties } from 'react';
import { NX, s, type NxTone } from '@/features/supervisorio/v2/components/sheets/nxMock';

/**
 * Estilos repetidos nas telas do carregador. Mesma régua do kit dos modais de equipamento
 * (nxMock): cor só por variável `--nx-*` ou pelos tons do kit, inline como no mockup.
 */

export const CARD: CSSProperties = { background: NX.card, border: `1px solid ${NX.borda}` };

/**
 * - `.nxc-grid`: grade de 2 colunas do mockup; vira 1 coluna abaixo de ~760 px de largura.
 * - `.nxc-op`: a mesma grade no carregador OCPP, que tem mais medições. Carro ao lado do status
 *   e da curva, medições na largura toda embaixo (4 cartões numa linha). No celular vira uma
 *   coluna na ordem de leitura: carro, status, medições, curva.
 * - `.nxc-med`: cartões de medição, 4 por linha; 2 por linha no celular.
 * - `.nxc-campo`: no celular (e onde o dedo é o ponteiro) o campo fica com 16 px. Abaixo disso
 *   o iOS dá zoom na página ao focar. O `!important` vence o tamanho inline do kit (15 px).
 * - `.nxc-par`: linha de parâmetro. Chave e valor lado a lado; no celular, um embaixo do outro.
 * - `.nxc-caixa`: caixa cinza dos diálogos de confirmação, com um traço entre as linhas.
 * - `.nxc-selo-topo` / `.nxc-selo-sub`: a pílula de estado. Ao lado do título ela só cabe na
 *   tela larga: em 390 px "Sem comunicação" e "Carro conectado" deixam menos de 95 px para o
 *   título e ele passa por cima dela. No celular a pílula desce para baixo do subtítulo.
 */
export const CSS = `
.nxc-grid{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:16px;align-items:stretch}
.nxc-op{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));grid-template-rows:auto 1fr auto;grid-template-areas:"carro status" "carro curva" "medidas medidas";gap:12px 16px;align-items:stretch}
.nxc-op>.nxc-a-carro{grid-area:carro}
.nxc-op>.nxc-a-status{grid-area:status}
.nxc-op>.nxc-a-curva{grid-area:curva}
.nxc-op>.nxc-a-medidas{grid-area:medidas}
.nxc-med{display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:12px}
.nxc-caixa{background:var(--nx-caixa);border-radius:12px;padding:0 14px}
.nxc-caixa>*+*{border-top:1px solid var(--nx-trilho)}
.nxc-par{display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr) auto;grid-template-areas:"k v a";gap:4px 12px;align-items:center}
.nxc-selo-topo{display:flex}
.nxc-selo-sub{display:none}
@media (max-width: 759px){
.nxc-grid{grid-template-columns:minmax(0, 1fr)}
.nxc-op{grid-template-columns:minmax(0, 1fr);grid-template-rows:none;grid-template-areas:"carro" "status" "medidas" "curva"}
.nxc-med{grid-template-columns:repeat(2, minmax(0, 1fr))}
.nxc-par{grid-template-columns:minmax(0, 1fr) auto;grid-template-areas:"k a" "v a"}
.nxc-selo-topo{display:none}
.nxc-selo-sub{display:flex;margin-top:6px}
}
@media (max-width: 759px), (pointer: coarse){.nx-eq .nxc-campo{font-size:16px !important}}
`;

/** Fundo e borda de aviso por tom (os mesmos tons da pílula do kit, mais leves). */
export const TINTA: Record<NxTone, CSSProperties> = {
  ok: { background: 'rgba(46,139,71,0.10)', border: '1px solid rgba(46,139,71,0.30)' },
  warn: { background: 'rgba(183,121,31,0.10)', border: '1px solid rgba(183,121,31,0.35)' },
  bad: { background: 'rgba(197,48,48,0.08)', border: '1px solid rgba(197,48,48,0.30)' },
  off: { background: NX.caixa, border: '1px solid transparent' },
};

/** Botão secundário de linha: 44 px de toque. `perigo` = ação que desfaz algo (texto vermelho). */
export const botaoLinha = (off = false, perigo = false): CSSProperties => ({
  flex: 'none', height: 44, minWidth: 44, padding: '0 16px', borderRadius: 10, border: `1.5px solid ${NX.off}`, background: NX.card,
  fontSize: 14, fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap', color: off ? NX.desab : perigo ? NX.bad : NX.texto,
});

/** Campo de texto na largura toda, 44 px de toque (identidade, busca, valor de parâmetro). */
export const campoLargo = (ro = false, ruim = false): CSSProperties => ({ ...s.campo(ro, ruim), width: '100%', minWidth: 0, height: 44, textAlign: 'left' });

/**
 * Campo numérico do kit com 44 px de toque. 104 px de largura: com a letra de 16 px do celular
 * o texto de apoio "sem limite" mede 79 px e precisa caber nos 82 px úteis (104 − margens − borda).
 */
export const campoNumero = (ro = false, ruim = false, w = 104): CSSProperties => ({ ...s.campo(ro, ruim, w), height: 44, flex: 'none' });

/** Texto técnico (identidade, chave, URL, parâmetro): quebra em qualquer ponto para não estourar a largura. */
export const MONO: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', overflowWrap: 'anywhere', wordBreak: 'break-word' };

/** Linha rótulo/valor dentro da caixa cinza dos diálogos de confirmação. */
export const CAIXA_ROW: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, fontSize: 15, gap: 12 };

/** Rótulo e valor dos cartões de medição. */
export const MEDIDA_ROTULO: CSSProperties = { fontSize: 13, color: NX.mudo };
export const MEDIDA_VALOR: CSSProperties = { fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
