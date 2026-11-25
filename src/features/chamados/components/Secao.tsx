import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Bloco com título discreto dentro das folhas de chamado (form e detalhe). */
export function Secao({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  );
}
