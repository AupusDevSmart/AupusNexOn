import type { M300Reading } from "@/components/equipment/M300/M300.types";
import M300Multimeter from "@/components/equipment/M300/M300Multimeter";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity } from "lucide-react";

interface M300ModalProps {
  open: boolean;
  onClose: () => void;
  dados: M300Reading;
  nomeComponente: string;
}

export function M300Modal({
  open,
  onClose,
  dados,
  nomeComponente,
}: M300ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            {nomeComponente} - Multímetro M-300
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-center items-center py-6">
          <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
            <M300Multimeter
              id="m300-modal"
              name={nomeComponente}
              readings={dados}
              status="online"
              displayMode="all"
              scale={1.0}
              onConfig={() => console.log("Configurar", nomeComponente)}
            />

            <div className="mt-6 text-center">
              <Badge variant="outline" className="text-xs">
                Display Interativo com Navegação
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
