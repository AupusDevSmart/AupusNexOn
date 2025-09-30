import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Circle } from "lucide-react";

interface BotoeiraModalProps {
  open: boolean;
  onClose: () => void;
  nomeComponente: string;
}

export function BotoeiraModal({
  open,
  onClose,
  nomeComponente,
}: BotoeiraModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Circle className="h-5 w-5 text-cyan-500" />
            {nomeComponente} - Botoeira
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <p className="font-medium">NA (Normalmente Aberta)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant="outline">Repouso</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cor</p>
              <p className="font-medium">Verde</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Função</p>
              <p className="font-medium">Start</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
