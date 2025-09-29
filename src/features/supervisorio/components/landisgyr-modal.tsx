import type { LandisGyrE750Reading } from "@/components/equipment/LandisGyr/LandisGyr.types";
import LandisGyrE750 from "@/components/equipment/LandisGyr/LandisGyrE750";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gauge } from "lucide-react";

interface LandisGyrModalProps {
  open: boolean;
  onClose: () => void;
  dados: LandisGyrE750Reading;
  nomeComponente: string;
}

export function LandisGyrModal({
  open,
  onClose,
  dados,
  nomeComponente,
}: LandisGyrModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-purple-500" />
            {nomeComponente} - Medidor Landis+Gyr E750
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-center items-center py-6">
          <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
            <LandisGyrE750
              id="landisgyr-modal"
              name={nomeComponente}
              readings={dados}
              status="online"
              scale={1.5}
              onConfig={() => console.log("Configurar", nomeComponente)}
            />

            <div className="mt-6 text-center">
              <Badge variant="outline" className="text-xs">
                Medidor Inteligente em Tempo Real
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
