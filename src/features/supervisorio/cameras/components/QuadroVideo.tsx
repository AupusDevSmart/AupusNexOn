import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Palco do vídeo: no desktop (`lg:`) ocupa a altura que sobra na coluna e o quadro 16:9
 * fica o maior possível dentro dele (largura = menor entre a largura do palco e a altura
 * × 16/9, por container query). Assim a página não rola: em janela baixa o vídeo encolhe,
 * a lista de eventos não. No celular é 16:9 na largura toda.
 *
 * O `ref` vai no quadro 16:9 (é ele que entra em tela cheia).
 */
export const QuadroVideo = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(function QuadroVideo(
  { children, className },
  ref,
) {
  return (
    <div
      className={cn(
        'relative w-full bg-black lg:flex lg:min-h-[180px] lg:flex-1 lg:items-center lg:justify-center lg:[container-type:size]',
        className,
      )}
    >
      <div ref={ref} className="relative aspect-video w-full overflow-hidden bg-black lg:w-[min(100cqw,calc(100cqh*16/9))]">
        {children}
      </div>
    </div>
  );
});
