import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DESABILITADO, FOCO, ITEM_ATIVO, ITEM_INATIVO } from './estilo-filtro';

/** Chip de filtro liga/desliga: 40 px no mouse, 44 px no toque, texto 14 px. */
export function ChipFiltro({
  ativo,
  onClick,
  disabled,
  className,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors touch:h-11 touch:px-4',
        ativo ? ITEM_ATIVO : ITEM_INATIVO,
        DESABILITADO,
        FOCO,
        className,
      )}
    >
      {children}
    </button>
  );
}
