import type { ReactNode } from 'react';
import { NX, s, type NxTone } from '@/features/supervisorio/v2/components/sheets/nxMock';
import { TINTA } from './carregador.estilos';

/** Caixa de aviso no tom do kit (neutro = a caixa cinza dos diálogos). */
export function Aviso({ tom = 'off', role, children }: { tom?: NxTone; role?: 'alert' | 'status'; children: ReactNode }) {
  return (
    <div role={role} style={{ ...TINTA[tom], borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: NX.caixaTx }}>
      {children}
    </div>
  );
}

/** Resultado de um comando, na própria tela: ponto verde e a resposta, ou o erro em vermelho. */
export function Resultado({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div role={ok ? 'status' : 'alert'} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, fontWeight: 700, color: ok ? NX.texto : NX.bad }}>
      <span style={{ ...s.stDot(ok ? 'ok' : 'bad'), marginTop: 4 }} />
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}
