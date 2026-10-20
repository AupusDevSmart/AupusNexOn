import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { A4 } from './tema';

/**
 * Mostra as folhas A4 (794 px) reduzidas para caber na largura do contêiner
 * (celular 390 px ou desktop), ajustando a altura do invólucro ao tamanho reduzido.
 */
export function EscalaA4({ children }: { children: ReactNode }) {
  const fora = useRef<HTMLDivElement>(null);
  const dentro = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [altura, setAltura] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const f = fora.current, d = dentro.current;
    if (!f || !d) return;
    const medir = () => {
      const s = Math.min(1, f.clientWidth / A4.largura);
      setEscala(s > 0 ? s : 1);
      setAltura(d.scrollHeight * (s > 0 ? s : 1));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(f);
    ro.observe(d);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={fora} style={{ width: '100%', height: altura, overflow: 'hidden', position: 'relative' }}>
      <div
        ref={dentro}
        className="rel-op-folhas"
        style={{
          width: A4.largura,
          transform: `scale(${escala})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'absolute',
          left: escala < 1 ? 0 : `calc(50% - ${A4.largura / 2}px)`,
          top: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
