import type { A966Reading } from "@/components/equipment/A966/A966.types";
import A966Gateway from "@/components/equipment/A966/A966Gateway";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wifi } from "lucide-react";

interface A966ModalProps {
  open: boolean;
  onClose: () => void;
  dados: A966Reading;
  nomeComponente: string;
}

export function A966Modal({
  open,
  onClose,
  dados,
  nomeComponente,
}: A966ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-500" />
            {nomeComponente} - Gateway IoT A-966
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-center items-center py-6">
          <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
            <A966Gateway
              id="a966-modal"
              name={nomeComponente}
              readings={dados}
              status="online"
              displayMode="all"
              scale={1.0}
              onConfig={() => console.log("Configurar", nomeComponente)}
            />

            <div className="mt-6 text-center">
              <Badge variant="outline" className="text-xs">
                Gateway IoT em Tempo Real
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
