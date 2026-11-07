import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Rótulo + controle + dica, no espaçamento dos formulários do sheet. */
export function Campo({
  rotulo,
  htmlFor,
  dica,
  children,
  className,
}: {
  rotulo: string;
  htmlFor?: string;
  dica?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {rotulo}
      </Label>
      {children}
      {dica && <p className="text-[11px] leading-snug text-muted-foreground">{dica}</p>}
    </div>
  );
}

/** Título de bloco dentro do formulário. */
export function TituloBloco({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

/** Valor usado nos <Select> para "nenhum" (o Radix não aceita value vazio). */
export const NENHUM = '__nenhum__';
