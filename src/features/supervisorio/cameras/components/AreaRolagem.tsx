import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { forwardRef, type ReactNode } from 'react';
import { ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AreaRolagemProps {
  children: ReactNode;
  className?: string;
  /** Classes do viewport (ex.: `max-h-[50dvh]` para lista que cresce até um teto). */
  classeViewport?: string;
  /** `ambas` liga a barra horizontal também (faixa de miniaturas no celular). */
  orientacao?: 'vertical' | 'ambas';
}

/**
 * ScrollArea do shadcn com dois ajustes para as listas das câmeras:
 * - o filho do viewport vira `block` (o Radix põe `display: table`, que estica a
 *   largura pelo conteúdo e quebra `truncate` e grade `auto-fill`);
 * - aceita teto de altura no viewport (`classeViewport`), para lista em diálogo.
 */
export const AreaRolagem = forwardRef<HTMLDivElement, AreaRolagemProps>(function AreaRolagem(
  { children, className, classeViewport, orientacao = 'vertical' },
  ref,
) {
  return (
    <ScrollAreaPrimitive.Root type="hover" className={cn('relative overflow-hidden', className)}>
      <ScrollAreaPrimitive.Viewport
        ref={ref}
        className={cn('h-full w-full rounded-[inherit] [&>div]:!block', classeViewport)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      {orientacao === 'ambas' && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
