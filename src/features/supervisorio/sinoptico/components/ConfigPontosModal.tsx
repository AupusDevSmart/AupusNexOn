import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserStore } from "@/store/useUserStore";
import { ConfigPontosDiagrama } from "./ConfigPontosDiagrama";

interface ConfigPontosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeId: string;
  equipamentoId: string;
  nome?: string;
  categoria?: string;
}

/**
 * Modal das caixas de dados do diagrama (R8) — usado ao clicar em nos de
 * Transformador/Disjuntor (que nao tem telemetria propria). A configuracao dos
 * pontos so aparece para quem pode editar (isAdmin).
 */
export function ConfigPontosModal({
  open,
  onOpenChange,
  unidadeId,
  equipamentoId,
  nome,
  categoria,
}: ConfigPontosModalProps) {
  const { isAdmin } = useUserStore();
  const podeEditar = isAdmin();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{nome || "Equipamento"}</DialogTitle>
          <DialogDescription>
            {categoria || ""}
            {podeEditar ? " — pontos do diagrama" : ""}
          </DialogDescription>
        </DialogHeader>

        {podeEditar ? (
          <ConfigPontosDiagrama
            unidadeId={unidadeId}
            equipamentoId={equipamentoId}
            categoria={categoria}
          />
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            Você não tem permissão para configurar os pontos do diagrama.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
