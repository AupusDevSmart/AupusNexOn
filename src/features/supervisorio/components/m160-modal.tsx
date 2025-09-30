import type { M160Reading } from "@/components/equipment/M160/M160.types";
import M160Multimeter from "@/components/equipment/M160/M160Multimeter";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gauge } from "lucide-react";

interface M160ModalProps {
  isOpen: boolean;
  onClose: () => void;
  componenteData: any;
}

export function M160Modal({ isOpen, onClose, componenteData }: M160ModalProps) {
  // Dados mockados realistas para o M160
  const dadosM160: M160Reading = {
    voltage: { L1: 220.5, L2: 219.8, L3: 221.2, LN: 127.3 },
    current: { L1: 15.2, L2: 14.8, L3: 15.5, N: 2.1 },
    power: {
      active: -8.5,
      reactive: 3.2,
      apparent: 9.1,
      import: 0,
      export: 8.5,
    },
    frequency: 60.02,
    powerFactor: 0.95,
    thd: { voltage: 2.1, current: 4.8 },
    energy: {
      activeImport: 1234.56,
      activeExport: 567.89,
      reactiveImport: 234.12,
      reactiveExport: 89.45,
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-green-500" />
            {componenteData?.nome || "M160"} - Multimedidor 4Q
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-center items-center py-6">
          <div className="bg-gray-900 p-8 rounded-lg shadow-lg">
            <M160Multimeter
              id="m160-modal"
              name={componenteData?.nome || "M160"}
              readings={dadosM160}
              status="online"
              scale={1.0}
              navigation={{
                enableManualNavigation: true,
                showDisplayLabel: true,
              }}
              onConfig={() => console.log("Configurar M160")}
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

export default M160Modal;
