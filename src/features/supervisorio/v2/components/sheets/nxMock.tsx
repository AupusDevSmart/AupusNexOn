import type { CSSProperties, ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * Kit visual dos modais web de equipamento, copiado do mockup do NEXON-5
 * ("NexON - Equipamentos da instalação": Web — Modal do Pivô / Carregador / Medidor).
 * Mesmas medidas, textos e cores do HTML (fonte Nunito). As cores vêm de variáveis
 * CSS (--nx-*) para o tema escuro trocar a paleta sem mudar a marcação.
 * Os estilos são inline, como no mockup, para a tela ficar igual ao HTML.
 */

export const NX = {
  fundo: 'var(--nx-fundo)',      // #F1F2F6
  card: 'var(--nx-card)',        // #FFFFFF
  texto: 'var(--nx-texto)',      // #1A1D3A
  mudo: 'var(--nx-mudo)',        // #6B6F86
  borda: 'var(--nx-borda)',      // #DCDFE7
  linha: 'var(--nx-linha)',      // #EEF0F4
  linha2: 'var(--nx-linha2)',    // #E8EAF0
  trilho: 'var(--nx-trilho)',    // #E3E5EC (fundo das abas)
  seg: 'var(--nx-seg)',          // #EEF0F4 (fundo do segmentado)
  caixa: 'var(--nx-caixa)',      // #F6F7FA (caixa de aviso)
  caixaTx: 'var(--nx-caixa-tx)', // #3A3D58
  ro: 'var(--nx-ro)',            // #F1F2F6 (campo só leitura)
  off: 'var(--nx-off)',          // #C9CDD8 (switch desligado / borda botão)
  desab: 'var(--nx-desab)',      // #A9ADBC
  acao: '#1F7A43',
  acaoHover: '#165C32',
  acaoOff: 'var(--nx-acao-off)', // #8DBA9A (Salvar sem alteração)
  azul: '#1F5FBF',
  ok: '#2E8B47',
  warn: '#B7791F',
  bad: '#C53030',
  neutro: '#8A8FA3',
} as const;

export const NX_FONT = 'Nunito, system-ui, sans-serif';

/** Variáveis do tema (claro = mockup; escuro = mesma hierarquia na paleta Aupus). */
export const NX_CSS = `
.nx-eq{--nx-fundo:#F1F2F6;--nx-card:#FFFFFF;--nx-texto:#1A1D3A;--nx-mudo:#6B6F86;--nx-borda:#DCDFE7;--nx-linha:#EEF0F4;--nx-linha2:#E8EAF0;--nx-trilho:#E3E5EC;--nx-seg:#EEF0F4;--nx-caixa:#F6F7FA;--nx-caixa-tx:#3A3D58;--nx-ro:#F1F2F6;--nx-off:#C9CDD8;--nx-desab:#A9ADBC;--nx-acao-off:#8DBA9A;font-family:${NX_FONT};color:var(--nx-texto)}
.dark .nx-eq,.nx-eq.dark{--nx-fundo:#0E0E24;--nx-card:#161633;--nx-texto:#FFFFFF;--nx-mudo:#A9ACC4;--nx-borda:#34345A;--nx-linha:#26264A;--nx-linha2:#2A2A52;--nx-trilho:#20203F;--nx-seg:#20203F;--nx-caixa:#20203F;--nx-caixa-tx:#D7D7E8;--nx-ro:#20203F;--nx-off:#4A4A72;--nx-desab:#5E6080;--nx-acao-off:#2E4A3A}
.nx-eq button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:left}
.nx-eq button:disabled{cursor:default}
.nx-eq input,.nx-eq select{font:inherit}
.nx-eq button:focus-visible,.nx-eq input:focus-visible,.nx-eq select:focus-visible{outline:2px solid #1F7A43;outline-offset:2px}
.nx-eq a{color:#1F7A43}.nx-eq a:hover{color:#165C32}
@keyframes nxFlowW{from{background-position:0 0}to{background-position:28px 0}}
@keyframes nxPulseW{0%,100%{opacity:.35}50%{opacity:1}}
.nx-eq .nxw-flow{animation:nxFlowW 1s linear infinite}
.nx-eq .nxw-pulse{animation:nxPulseW 1.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.nx-eq .nxw-flow,.nx-eq .nxw-pulse{animation:none}}
`;
const FONTE = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap';

export function NxStyle() {
  return (
    <>
      <link rel="stylesheet" href={FONTE} />
      <style>{NX_CSS}</style>
    </>
  );
}

// ------------------------------------------------------------- estilos do HTML
export type NxTone = 'ok' | 'warn' | 'bad' | 'off';
export const COR: Record<NxTone, string> = { ok: NX.ok, warn: NX.warn, bad: NX.bad, off: NX.neutro };
const TINT: Record<NxTone, string> = { ok: 'rgba(46,139,71,0.12)', warn: 'rgba(183,121,31,0.14)', bad: 'rgba(197,48,48,0.12)', off: 'rgba(138,143,163,0.14)' };

export const s = {
  /** Pílula de status do cabeçalho. */
  pill: (t: NxTone): CSSProperties => ({ height: 30, padding: '0 12px', borderRadius: 15, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: COR[t], background: TINT[t], whiteSpace: 'nowrap' }),
  pillDot: (t: NxTone): CSSProperties => ({ width: 8, height: 8, borderRadius: 4, background: COR[t] }),
  stDot: (t: NxTone): CSSProperties => ({ width: 10, height: 10, borderRadius: 5, flex: 'none', background: COR[t] }),
  stLabel: (t: NxTone): CSSProperties => ({ fontSize: 15, fontWeight: 800, color: COR[t] }),
  /** Aba Operação/Configuração. */
  tab: (sel: boolean): CSSProperties => ({ height: 38, borderRadius: 11, fontSize: 14, fontWeight: 800, textAlign: 'center', ...(sel ? { background: NX.card, border: `1.5px solid ${NX.azul}`, color: NX.texto } : { color: NX.mudo }) }),
  /** Item do controle segmentado. */
  seg: (sel: boolean): CSSProperties => ({ height: 32, padding: '0 12px', borderRadius: 9, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', ...(sel ? { background: NX.card, color: NX.texto, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { color: NX.mudo }) }),
  /** Aba de diálogo (Irrigação · Mês · Safra). */
  dTab: (sel: boolean): CSSProperties => ({ height: 34, borderRadius: 9, fontSize: 13, fontWeight: 800, textAlign: 'center', ...(sel ? { background: NX.card, color: NX.texto } : { color: NX.mudo, fontWeight: 700 }) }),
  /** Botão largo de comando. */
  cmd: (kind: 'primary' | 'outline' | 'busy'): CSSProperties => ({
    height: 52, borderRadius: 12, fontSize: 16, fontWeight: 800, textAlign: 'center', width: '100%',
    ...(kind === 'busy' ? { background: NX.trilho, color: NX.neutro } : kind === 'outline' ? { background: NX.card, border: `1.5px solid ${NX.off}`, color: NX.texto } : { background: NX.acao, color: '#FFFFFF' }),
  }),
  /** Botão Salvar / Revisar N alterações. */
  save: (off: boolean): CSSProperties => ({ height: 50, borderRadius: 12, marginTop: 10, fontSize: 16, fontWeight: 800, textAlign: 'center', color: '#FFFFFF', background: off ? NX.acaoOff : NX.acao, width: '100%' }),
  card: { background: NX.card, border: `1px solid ${NX.borda}`, borderRadius: 14 } as CSSProperties,
  label: { fontSize: 12, fontWeight: 800, color: NX.mudo, letterSpacing: 0.6 } as CSSProperties,
  campo: (ro: boolean, bad = false, w = 84): CSSProperties => ({ width: w, height: 38, boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${bad ? NX.bad : NX.borda}`, background: ro ? NX.ro : NX.card, color: NX.texto, fontSize: 15, fontWeight: 800, textAlign: 'right', padding: '0 10px' }),
  select: { height: 38, padding: '0 12px', borderRadius: 10, border: `1px solid ${NX.borda}`, background: NX.card, color: NX.texto, fontSize: 14, fontWeight: 700 } as CSSProperties,
};

// ----------------------------------------------------------------- componentes
export function NxSwitch({ on, onChange, disabled, label }: { on: boolean; onChange?: () => void; disabled?: boolean; label?: string }) {
  return (
    <span aria-hidden={!label} style={{ width: 46, height: 28, borderRadius: 14, flex: 'none', position: 'relative', boxSizing: 'border-box', background: on ? NX.acao : NX.off, opacity: disabled ? 0.6 : 1 }}
      role={label ? 'switch' : undefined} aria-checked={label ? on : undefined} aria-label={label}
      onClick={label && !disabled ? onChange : undefined}>
      <span style={{ position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 11, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', left: on ? 21 : 3, transition: 'left .15s' }} />
    </span>
  );
}

/** Linha de switch dentro de cartão (botão inteiro clicável, como no mockup). */
export function NxSwitchRow({ title, sub, on, onToggle, disabled, first, minHeight = 62 }: {
  title: ReactNode; sub?: ReactNode; on: boolean; onToggle?: () => void; disabled?: boolean; first?: boolean; minHeight?: number;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={onToggle}
      style={{ width: '100%', minHeight, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, ...(first ? {} : { borderTop: `1px solid ${NX.linha}` }) }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        {sub && <span style={{ fontSize: 12, color: NX.mudo }}>{sub}</span>}
      </span>
      <NxSwitch on={on} disabled={disabled} />
    </button>
  );
}

export function NxSeg<T extends string>({ value, options, onChange, disabled }: {
  value: T; options: Array<{ v: NoInfer<T>; label: string }>; onChange: (v: NoInfer<T>) => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', padding: 3, borderRadius: 12, background: NX.seg }}>
      {options.map((o) => (
        <button key={o.v} type="button" disabled={disabled} aria-pressed={value === o.v} onClick={() => onChange(o.v)} style={s.seg(value === o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

export const IcoX = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={NX.mudo} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IcoChevron = ({ size = 14, style }: { size?: number; style?: CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={NX.mudo} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d="M6 9l6 6 6-6" /></svg>
);
export const IcoLixo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C53030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const IcoCheck2 = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F7A43" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Confirmado pelo equipamento"><path d="M2 13l4 4 8-9" /><path d="M10 15l2 2 8-9" /></svg>
);

/**
 * Casca do modal: sheet lateral de altura total (padrão do Dialog do projeto), com o
 * cabeçalho, as abas e o divisor exatamente como no mockup.
 */
export function NxShell({ title, subtitle, right, tabs, tab, onTab, onClose, children }: {
  title: string; subtitle?: ReactNode; right?: ReactNode;
  tabs?: Array<{ key: string; label: string }>; tab?: string; onTab?: (k: string) => void;
  onClose: () => void; children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="nx-eq max-w-[820px] w-full p-0 gap-0 overflow-hidden flex flex-col sm:rounded-l-[18px] [&>button:last-child]:hidden"
        style={{ background: NX.fundo }}
      >
        <NxStyle />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 0 24px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <DialogTitle style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NX.texto }}>{title}</DialogTitle>
            {subtitle && <span style={{ fontSize: 14, color: NX.mudo }}>{subtitle}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {right}
            <button type="button" aria-label="Fechar" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcoX />
            </button>
          </div>
        </div>
        {tabs && tabs.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, gap: 4, margin: '16px 24px 0 24px', padding: 4, borderRadius: 14, background: NX.trilho }}>
            {tabs.map((t) => (
              <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => onTab?.(t.key)} style={s.tab(tab === t.key)}>{t.label}</button>
            ))}
          </div>
        )}
        <div style={{ height: 1, background: NX.borda, marginTop: 16, flex: 'none' }} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo por cima do modal (Confirmar comando, Irrigação avançada, Custos, Exportar, Revisão). */
export function NxDialog({ open, onClose, label, width = 380, children }: {
  open: boolean; onClose: () => void; label: string; width?: number; children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        aria-label={label}
        className="nx-eq top-1/2 bottom-auto left-1/2 right-auto -translate-x-1/2 -translate-y-1/2 max-h-[92dvh] p-0 border-0 gap-0 data-[state=open]:slide-in-from-right-0 data-[state=closed]:slide-out-to-right-0 [&>button:last-child]:hidden"
        style={{ width: `min(${width}px, 94vw)`, maxWidth: width, background: NX.card, borderRadius: 18, boxShadow: '0 20px 50px rgba(10,12,30,0.3)' }}
      >
        <NxStyle />
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <div style={{ padding: 22, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: '92dvh' }}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cabeçalho de diálogo com título, subtítulo e X (Irrigação avançada, Custos, Exportar). */
export function NxDialogHead({ title, sub, onClose }: { title: string; sub?: ReactNode; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 19, fontWeight: 800 }}>{title}</span>
        {sub && <span style={{ fontSize: 13, color: NX.mudo }}>{sub}</span>}
      </span>
      <button type="button" aria-label="Fechar" onClick={onClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcoX /></button>
    </div>
  );
}

/** Par Cancelar / Confirmar do mockup. */
export function NxDialogButtons({ onCancel, onConfirm, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', disabled, busy, marginTop = 12 }: {
  onCancel: () => void; onConfirm: () => void; confirmLabel?: string; cancelLabel?: string; disabled?: boolean; busy?: boolean; marginTop?: number;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop }}>
      <button type="button" onClick={onCancel} style={{ flex: 1, height: 44, borderRadius: 12, background: NX.seg, fontWeight: 700, textAlign: 'center' }}>{cancelLabel}</button>
      <button type="button" onClick={onConfirm} disabled={disabled || busy}
        style={{ flex: 1, height: 44, borderRadius: 12, background: disabled || busy ? NX.trilho : NX.acao, color: disabled || busy ? NX.neutro : '#FFFFFF', fontWeight: 800, textAlign: 'center' }}>
        {busy ? 'Executando…' : confirmLabel}
      </button>
    </div>
  );
}

/** Diálogo "Confirmar alterações" (antigo → novo) usado nas abas de Configuração. */
export function NxReview({ open, onClose, changes, writing, onWrite, nota, width = 440 }: {
  open: boolean; onClose: () => void; changes: Array<{ label: string; de: string; para: string }>; writing: boolean; onWrite: () => void; nota?: ReactNode; width?: number;
}) {
  return (
    <NxDialog open={open} onClose={onClose} label="Confirmar alterações" width={width}>
      <span style={{ fontSize: 18, fontWeight: 800 }}>Confirmar alterações</span>
      {changes.map((c) => (
        <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15, padding: '6px 0', borderBottom: `1px solid ${NX.linha}` }}>
          <span>{c.label}</span><span style={{ textAlign: 'right' }}><span style={{ color: NX.mudo }}>{c.de}</span> → <b>{c.para}</b></span>
        </div>
      ))}
      {nota && <span style={{ fontSize: 13, color: NX.mudo }}>{nota}</span>}
      {writing
        ? <span style={{ fontSize: 14, color: NX.mudo, textAlign: 'center', padding: '6px 0' }}>Gravando e aguardando releitura…</span>
        : <NxDialogButtons onCancel={onClose} onConfirm={onWrite} cancelLabel="Voltar" marginTop={8} />}
    </NxDialog>
  );
}
