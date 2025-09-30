import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Triangle } from "lucide-react";

interface ReleModalProps {
  open: boolean;
  onClose: () => void;
  nomeComponente: string;
}

export function ReleModal({ open, onClose, nomeComponente }: ReleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Triangle className="h-5 w-5 text-indigo-500" />
            {nomeComponente} - Relé
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <p className="font-medium">Eletromagnético</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado Bobina</p>
              <Badge variant="outline">Energizada</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tensão Bobina</p>
              <p className="font-medium">24 VDC</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contatos</p>
              <p className="font-medium">4NA + 4NF</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
