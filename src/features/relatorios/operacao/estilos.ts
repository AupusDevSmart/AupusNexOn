/** Estilos inline compartilhados do documento A4 (padrão de formatação dos relatórios NexON). */
import type { CSSProperties } from 'react';
import { COR } from './tema';

export const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
export const ALERTA: CSSProperties = { color: COR.alerta, fontWeight: 800 };
export const OK: CSSProperties = { color: COR.ok, fontWeight: 800 };
export const VAZIO: CSSProperties = { color: COR.neutro };

// ───────────────────────── Tabelas (§7) ─────────────────────────

export const cabecalhoGrade = (colunas: string): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: colunas,
  background: COR.cabecalhoTabela,
  fontSize: 10,
  fontWeight: 800,
  color: COR.secundario,
  letterSpacing: 0.2,
});

export const linhaGrade = (colunas: string, i: number, fontSize = 11.5, zebra = true): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: colunas,
  fontSize,
  ...NUM,
  borderTop: `1px solid ${COR.linha}`,
  background: zebra && i % 2 ? COR.zebra : undefined,
  alignItems: 'center',
});

export const totalGrade = (colunas: string, fontSize = 11.5, borda = '2px'): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: colunas,
  borderTop: `${borda} solid ${COR.texto}`,
  fontSize,
  fontWeight: 800,
  ...NUM,
});

export const cel = (padding: string, extra?: CSSProperties): CSSProperties => ({ padding, minWidth: 0, ...extra });
export const celD = (padding: string, extra?: CSSProperties): CSSProperties => ({ padding, textAlign: 'right', minWidth: 0, ...extra });
