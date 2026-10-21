import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { LinhaFonte } from './fonte';

/**
 * Selo da fonte da geração (NEXON-37): cinza e discreto; âmbar quando TON e nuvem divergem.
 * Detalhe (TON × nuvem do período) no tooltip — abre no hover e no toque (celular).
 */
export function SeloFonte({ texto, divergem = false, linhas, className = '' }: {
  texto: string;
  divergem?: boolean;
  linhas?: LinhaFonte[];
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const cls = divergem
    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    : 'bg-black/5 text-muted-foreground dark:bg-white/10';
  const selo = (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${cls} ${className}`}>
      {divergem && <AlertTriangle className="h-3 w-3" />}
      {texto}
    </span>
  );
  if (!linhas?.length) return selo;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={aberto} onOpenChange={setAberto}>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex" aria-label={`${texto}: detalhes`} onClick={() => setAberto((v) => !v)}>
            {selo}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px]">
          <div className="space-y-0.5">
            {linhas.map((l) => (
              <div key={l.label} className="flex justify-between gap-3">
                <span className="opacity-80">{l.label}</span>
                <span className="font-semibold tabular-nums">{l.value}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SeloFonte;
