import { cn } from '@/lib/utils';
import { STATUS_ROTULO, type StatusChamado } from '../types';

export function SeloStatus({ status }: { status: StatusChamado }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        status === 'ABERTO' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        status === 'ENCAMINHADO' && 'bg-nexon-verde/15 text-nexon-link-claro dark:text-nexon-verde',
        status === 'FECHADO' && 'bg-muted text-muted-foreground',
      )}
    >
      {STATUS_ROTULO[status]}
    </span>
  );
}
