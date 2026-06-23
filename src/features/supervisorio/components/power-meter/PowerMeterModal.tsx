import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { DadosTab } from "./DadosTab";
import { RelatorioTab } from "./RelatorioTab";
import { TarifariaTab } from "./TarifariaTab";

type Aba = "dados" | "tarifaria" | "relatorio";

interface PowerMeterModalProps {
  open: boolean;
  onClose: () => void;
  componenteData?: any;
  nomeComponente?: string;
  /** Abre a configuracao dos pontos do diagrama (R8). Renderiza o botao se definido. */
  onConfigurarPontos?: () => void;
}

const ABAS: Array<{ value: Aba; label: string }> = [
  { value: "relatorio", label: "Relatório" },
  { value: "dados", label: "Dados" },
  { value: "tarifaria", label: "Tarifária" },
];

export function PowerMeterModal({
  open,
  onClose,
  componenteData,
  nomeComponente,
  onConfigurarPontos,
}: PowerMeterModalProps) {
  const equipamentoId = (
    componenteData?.dados?.equipamento_id || componenteData?.id
  )?.trim();
  const nome = nomeComponente || componenteData?.nome || "Power Meter";
  const tag = componenteData?.tag ?? componenteData?.dados?.tag ?? null;

  const [aba, setAba] = useState<Aba>("relatorio");
  // Reseta pra primeira aba sempre que abre.
  useEffect(() => {
    if (open) setAba("relatorio");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[92dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-8">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold uppercase tracking-wide">{nome}</span>
              </div>
              {tag && (
                <div className="text-xs text-muted-foreground font-mono pl-6">
                  TAG: {tag}
                </div>
              )}
            </div>
            {onConfigurarPontos && (
              <button
                type="button"
                onClick={onConfigurarPontos}
                className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Configurar pontos
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Toggle centralizado das 3 abas. */}
        <div className="flex items-center justify-center gap-1 pt-1 pb-2">
          {ABAS.map((a) => (
            <Button
              key={a.value}
              type="button"
              variant={aba === a.value ? "default" : "outline"}
              size="sm"
              onClick={() => setAba(a.value)}
              className="h-8 px-4 text-xs uppercase tracking-wide"
            >
              {a.label}
            </Button>
          ))}
        </div>

        <div className="mt-2">
          {aba === "dados" && <DadosTab equipamentoId={equipamentoId ?? null} />}
          {aba === "tarifaria" && (
            <TarifariaTab equipamentoId={equipamentoId ?? null} />
          )}
          {aba === "relatorio" && (
            <RelatorioTab equipamentoId={equipamentoId ?? null} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
