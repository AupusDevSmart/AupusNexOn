import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Square } from "lucide-react";

interface ChaveModalProps {
  open: boolean;
  onClose: () => void;
  nomeComponente: string;
}

export function ChaveModal({ open, onClose, nomeComponente }: ChaveModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Square className="h-5 w-5 text-amber-500" />
            {nomeComponente} - Chave Seccionadora
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <p className="font-medium">Tripolar</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant="outline">Fechada</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Corrente Nominal</p>
              <p className="font-medium">630 A</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tensão</p>
              <p className="font-medium">13.8 kV</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
