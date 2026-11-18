import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Desenhos do guia "Adicionar Raspberry novo" (NEXON-108): Raspberry Pi 5 visto de cima com o botão de
 * ligar, a entrada USB-C e o cartão SD; teclas; e a janela do Terminal com a frase que a pessoa deve ver.
 * Cores do tema (currentColor e a variável da marca), sem imagem externa.
 */

export type DestaquePi = 'botao' | 'usbc' | 'sd' | 'cabo' | 'rede' | 'fonte';

const VERDE = 'var(--nx-verde)';

/** Raspberry Pi 5 de cima. `destaque` pinta e rotula as partes; `cabo` desenha o cabo USB-C ligado. */
export function DesenhoRaspberry({ destaque = [], dedo = false, className }: { destaque?: DestaquePi[]; dedo?: boolean; className?: string }) {
  const tem = (d: DestaquePi) => destaque.includes(d);
  return (
    <svg viewBox="0 0 320 210" role="img" aria-label="Raspberry Pi visto de cima" className={cn('h-auto w-full max-w-[360px]', className)}>
      {/* placa */}
      <rect x="40" y="20" width="240" height="150" rx="12" fill="#1d5e34" stroke="#2f8a50" strokeWidth="2" />
      {[
        [54, 34],
        [266, 34],
        [54, 156],
        [266, 156],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="#0f2e1b" stroke="#c9b26b" strokeWidth="1.5" />
      ))}
      {/* processador e chips */}
      <rect x="120" y="62" width="46" height="46" rx="4" fill="#cfd3da" />
      <rect x="180" y="70" width="28" height="30" rx="3" fill="#2b2b33" />
      <rect x="84" y="40" width="120" height="10" rx="2" fill="#1a1a20" opacity="0.8" />
      {/* USB e rede no lado direito */}
      <rect x="252" y="40" width="38" height="28" rx="2" fill="#b9bec7" stroke={tem('rede') ? VERDE : 'none'} strokeWidth="3" />
      <rect x="252" y="76" width="38" height="28" rx="2" fill="#b9bec7" />
      <rect x="250" y="112" width="40" height="40" rx="2" fill={tem('rede') ? '#9fdc86' : '#b9bec7'} stroke={tem('rede') ? VERDE : 'none'} strokeWidth="3" />
      {tem('rede') && (
        <text x="300" y="138" fontSize="12" fontWeight="700" fill={VERDE} textAnchor="end" transform="translate(16 30)">
          Rede
        </text>
      )}
      {/* HDMI */}
      <rect x="140" y="160" width="20" height="12" rx="2" fill="#b9bec7" />
      <rect x="172" y="160" width="20" height="12" rx="2" fill="#b9bec7" />
      {/* USB-C */}
      <rect
        x="92"
        y="158"
        width="30"
        height="14"
        rx="6"
        fill={tem('usbc') || tem('cabo') || tem('fonte') ? '#9fdc86' : '#b9bec7'}
        stroke={tem('usbc') || tem('fonte') ? VERDE : 'none'}
        strokeWidth="3"
      />
      {/* botão de ligar */}
      <g>
        {tem('botao') && (
          <circle cx="68" cy="166" r="16" fill="none" stroke={VERDE} strokeWidth="3" className="motion-safe:animate-pulse" />
        )}
        <rect x="61" y="160" width="14" height="12" rx="3" fill={tem('botao') ? VERDE : '#e6e6e6'} stroke="#333" strokeWidth="1" />
      </g>
      {/* cartão SD (fica embaixo da placa, no lado esquerdo) */}
      <rect
        x="26"
        y="80"
        width="22"
        height="32"
        rx="3"
        fill={tem('sd') ? '#9fdc86' : '#3a3a44'}
        stroke={tem('sd') ? VERDE : '#666'}
        strokeWidth={tem('sd') ? 3 : 1}
        strokeDasharray={tem('sd') ? undefined : '3 3'}
      />
      {/* cabo USB-C */}
      {(tem('cabo') || tem('fonte')) && (
        <g>
          <rect x="98" y="172" width="18" height="14" rx="3" fill="#2b2b33" />
          <path d="M107 186 C107 200 107 200 107 210" stroke="#2b2b33" strokeWidth="6" fill="none" />
        </g>
      )}
      {/* dedo segurando o botão */}
      {dedo && (
        <g>
          <ellipse cx="68" cy="186" rx="13" ry="18" fill="#f1c7a3" stroke="#b98a66" strokeWidth="1.5" />
          <ellipse cx="68" cy="174" rx="7" ry="5" fill="#f7dcc5" />
        </g>
      )}
      {/* rótulos */}
      {tem('botao') && (
        <Rotulo x={8} y={150} texto="Botão" />
      )}
      {(tem('usbc') || tem('cabo')) && <Rotulo x={128} y={200} texto={tem('cabo') ? 'Cabo do computador' : 'USB-C'} />}
      {tem('fonte') && <Rotulo x={128} y={200} texto="Fonte" />}
      {tem('sd') && <Rotulo x={4} y={74} texto="Cartão SD" />}
    </svg>
  );
}

function Rotulo({ x, y, texto }: { x: number; y: number; texto: string }) {
  return (
    <text x={x} y={y} fontSize="13" fontWeight="700" fill={VERDE}>
      {texto}
    </text>
  );
}

/** Teclas para apertar, em sequência: [Cmd] + [Espaço]. */
export function Teclas({ teclas }: { teclas: (string | '+' | 'depois')[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" aria-hidden>
      {teclas.map((t, i) =>
        t === '+' ? (
          <span key={i} className="text-xl font-bold text-muted-foreground">
            +
          </span>
        ) : t === 'depois' ? (
          <span key={i} className="px-1 text-sm text-muted-foreground">
            depois
          </span>
        ) : (
          <kbd
            key={i}
            className="flex h-14 min-w-14 items-center justify-center rounded-xl border-2 border-b-4 border-border bg-background px-4 font-sans text-lg font-semibold shadow-sm"
          >
            {t}
          </kbd>
        ),
      )}
    </div>
  );
}

/**
 * Janela do Terminal como ela é em cada sistema: Mac (Terminal, botões coloridos à esquerda), Linux
 * (Terminal do Ubuntu, roxo, botões à direita) e Windows (PowerShell, azul, botões à direita).
 * A linha `destaque` fica em verde: é a que a pessoa deve procurar.
 */
export function TelaTerminal({
  linhas,
  destaque,
  titulo = 'Terminal',
  sistema = 'mac',
}: {
  linhas: string[];
  destaque?: string;
  titulo?: string;
  sistema?: 'mac' | 'linux' | 'windows';
}) {
  const estilo =
    sistema === 'windows'
      ? { fundo: '#012456', barra: '#ffffff', textoBarra: 'text-zinc-700', texto: 'text-zinc-100', verde: 'text-[#7CFC00]', fonte: "font-['Consolas',monospace]" }
      : sistema === 'linux'
        ? { fundo: '#300a24', barra: '#2c2c2c', textoBarra: 'text-zinc-200', texto: 'text-zinc-100', verde: 'text-[#8ae234]', fonte: "font-['Ubuntu_Mono',monospace]" }
        : { fundo: '#0d0d12', barra: '#26262b', textoBarra: 'text-zinc-400', texto: 'text-zinc-300', verde: 'text-[#9fdc86]', fonte: 'font-mono' };
  const nomeJanela = sistema === 'windows' ? 'Administrador: Windows PowerShell' : sistema === 'linux' ? 'usuario@computador: ~' : titulo;
  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-lg border border-border text-left shadow-md" style={{ background: estilo.fundo }} aria-hidden>
      <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: estilo.barra }}>
        {sistema === 'mac' && (
          <>
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </>
        )}
        <span className={cn('flex-1 truncate text-xs', estilo.textoBarra, sistema === 'mac' ? 'ml-2' : sistema === 'linux' ? 'text-center font-semibold' : '')}>
          {nomeJanela}
        </span>
        {sistema === 'linux' && (
          <span className="flex gap-1.5">
            <span className="h-3.5 w-3.5 rounded-full bg-zinc-500" />
            <span className="h-3.5 w-3.5 rounded-full bg-zinc-500" />
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#e95420] text-[9px] leading-none text-white">×</span>
          </span>
        )}
        {sistema === 'windows' && <span className="flex gap-3 text-xs text-zinc-600">{'─  □  ✕'}</span>}
      </div>
      <pre className={cn('whitespace-pre-wrap break-words px-3 py-3 text-[13px] leading-relaxed', estilo.texto, estilo.fonte)}>
        {sistema === 'windows' && <span className="block text-zinc-300">PS C:\Users\usuario&gt;</span>}
        {linhas.map((l, i) => (
          <span key={i} className={cn('block', l === destaque && cn('font-bold', estilo.verde))}>
            {l}
          </span>
        ))}
        {destaque && !linhas.includes(destaque) && <span className={cn('block font-bold', estilo.verde)}>{destaque}</span>}
        <span className="inline-block h-4 w-2 translate-y-0.5 bg-zinc-300 motion-safe:animate-pulse" />
      </pre>
    </div>
  );
}

/** "Conte até 3 e solte": conta junto com a pessoa. */
export function ContarAteTres() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (n === null || n === 0) return;
    const t = window.setTimeout(() => setN(n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [n]);
  return (
    <div className="flex flex-col items-center gap-3">
      <span
        aria-live="polite"
        className={cn('text-6xl font-bold tabular-nums', n === 0 ? 'text-[var(--nx-verde)]' : 'text-foreground')}
      >
        {n === null ? '3' : n === 0 ? 'Solte!' : n}
      </span>
      <Button type="button" variant="outline" className="h-11 px-5" onClick={() => setN(3)}>
        {n === null ? 'Contar comigo' : 'Contar de novo'}
      </Button>
    </div>
  );
}

/** Moldura da ilustração de cada passo. */
export function Quadro({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[200px] items-center justify-center rounded-2xl bg-muted px-4 py-6">{children}</div>;
}
