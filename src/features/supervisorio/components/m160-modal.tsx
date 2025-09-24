// src/features/supervisorio/components/m160-modal.tsx
import { X } from "lucide-react";
import { M160Multimeter } from "../../../components/equipment/index";
import type { ComponenteDU } from "../../../types/dtos/sinoptico-ativo";

interface M160ModalProps {
  isOpen: boolean;
  onClose: () => void;
  componenteData: ComponenteDU;
}

export function M160Modal({ isOpen, onClose, componenteData }: M160ModalProps) {
  if (!isOpen) return null;

  // Dados simulados para o M160
  const dadosM160 = {
    voltage: { L1: 220.5, L2: 219.8, L3: 221.2, LN: 127.3 },
    current: { L1: 15.2, L2: 14.8, L3: 15.5, N: 2.1 },
    power: {
      active: -8.5, // Negativo = gerando energia
      reactive: 3.2,
      apparent: 9.1,
      import: 0,
      export: 8.5,
    },
    frequency: 60.02,
    powerFactor: 0.95,
    thd: {
      voltage: 2.1,
      current: 4.8,
    },
    energy: {
      activeImport: 1234.56,
      activeExport: 567.89,
      reactiveImport: 234.12,
      reactiveExport: 89.45,
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 relative">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>

        {/* Título */}
        <h2 className="text-white text-lg font-bold mb-4">
          {componenteData.nome}
        </h2>

        {/* Componente M160 */}
        <div className="flex justify-center">
          <M160Multimeter
            id={componenteData.id}
            name={componenteData.nome}
            readings={dadosM160}
            status="online"
            displayMode="all"
            scale={1}
          />
        </div>
      </div>
    </div>
  );
}
