import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { textoSemComunicacao, type Capacidade } from "../hooks/useCapacidadesInstalacao";

/**
 * Faixa curta de "existe mas não comunica" (NEXON-110): o bloco continua na tela com o
 * estado, em vez de sumir ou mostrar "--" sem explicação.
 */
export function AvisoSemComunicacao({ capacidade, className }: { capacidade: Capacidade | undefined; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300", className)}>
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{textoSemComunicacao(capacidade)}</span>
    </div>
  );
}
