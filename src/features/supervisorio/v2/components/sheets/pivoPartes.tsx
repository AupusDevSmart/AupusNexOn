import type { CSSProperties, ReactNode } from 'react';
import { unwrap } from './equipUi';
import { NX, s } from './nxMock';

/**
 * Peças comuns às abas do modal do pivô (Operação, Configuração e Calibração): saíram da
 * PivoSheet para a aba Calibração (PivoCalibracao.tsx) usar as mesmas, sem import circular.
 */

/** Resposta da API vem com envelope simples ou duplo ({data:{data}}). */
export const corpo = <T,>(r: unknown): T => {
  const d = unwrap<Record<string, unknown>>(r);
  return (d && typeof d === 'object' && 'data' in d && Object.keys(d).length <= 3 ? d.data : d) as T;
};
export const erroMsg = (e: unknown): string => {
  const x = e as { response?: { data?: { message?: string; error?: { message?: string }; data?: { message?: string } } }; message?: string };
  return x?.response?.data?.error?.message ?? x?.response?.data?.message ?? x?.response?.data?.data?.message ?? x?.message ?? 'Falha';
};
export const col = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap });
export const secao = (t: string, mt: number) => <span style={{ ...s.label, marginTop: mt }}>{t}</span>;

export function Linha({ titulo, sub, children, minHeight = 56, first }: { titulo: string; sub?: string; children: ReactNode; minHeight?: number; first?: boolean }) {
  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${NX.linha}`, minHeight, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={col(2)}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</span>
        {sub && <span style={{ fontSize: 12, color: NX.mudo }}>{sub}</span>}
      </span>
      {children}
    </div>
  );
}
