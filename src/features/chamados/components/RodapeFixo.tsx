import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Rodapé que fica colado embaixo da folha lateral (`DialogContent`, que rola sozinha e
 * tem `p-6`). Ação principal sempre ao alcance do polegar, mesmo com histórico longo.
 */
export function RodapeFixo({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-6 -mb-6 mt-auto border-t border-border bg-background px-6 pt-3',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  );
}
