// src/features/supervisorio/components/m160-modal.tsx
import { Gauge, X } from "lucide-react";

interface M160ModalProps {
  isOpen: boolean;
  onClose: () => void;
  componenteData: any;
}

// Componente M160 simplificado integrado no modal
const M160Display = ({ componenteData }: { componenteData: any }) => (
  <div className="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 shadow-xl w-64">
    <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
      <h3 className="text-white font-bold text-sm">
        {componenteData?.nome || "M-160"}
      </h3>
      <div className="flex gap-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg" />
          <span className="text-xs text-gray-300">COM</span>
        </div>
      </div>
    </div>

    <div className="flex justify-between items-center mb-2 bg-gray-700 rounded px-2 py-1">
      <span className="text-green-400 text-xs font-mono">TENSÕES (1/5)</span>
    </div>

    <div className="space-y-1 mb-3">
      <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
        <div className="text-xs text-green-400 font-mono">L1</div>
        <div className="text-green-400 font-mono text-lg leading-tight">
          220.5 V
        </div>
      </div>
      <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
        <div className="text-xs text-green-400 font-mono">L2</div>
        <div className="text-green-400 font-mono text-lg leading-tight">
          219.8 V
        </div>
      </div>
      <div className="bg-black border border-gray-600 rounded px-2 py-1 mb-1">
        <div className="text-xs text-green-400 font-mono">L3</div>
        <div className="text-green-400 font-mono text-lg leading-tight">
          221.2 V
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
      <div className="bg-gray-700 rounded px-2 py-1">
        <span className="text-gray-400">Freq:</span>
        <span className="text-white ml-1">60.02 Hz</span>
      </div>
      <div className="bg-gray-700 rounded px-2 py-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-400 text-xs">Q2</span>
        </div>
      </div>
    </div>

    <div className="flex justify-center gap-1 mt-3">
      {[0, 1, 2, 3, 4].map((_, index) => (
        <div
          key={index}
          className={`h-1 w-6 rounded transition-colors duration-200 ${
            index === 0 ? "bg-green-500" : "bg-gray-600"
          }`}
        />
      ))}
    </div>

    <div className="flex justify-center mt-1">
      <span className="text-xs text-green-400">AUTO</span>
    </div>

    <div className="absolute -bottom-1 right-2">
      <div className="bg-blue-600 text-white text-xs px-1 py-0.5 rounded font-mono">
        4Q
      </div>
    </div>
  </div>
);

export function M160Modal({ isOpen, onClose, componenteData }: M160ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
          <Gauge className="text-green-400" />
          {componenteData?.nome || "M160 Multimedidor"}
        </h2>

        <div className="flex justify-center">
          <M160Display componenteData={componenteData} />
        </div>

        <div className="mt-4 text-xs text-gray-400 text-center">
          ID: {componenteData?.id} • Status: {componenteData?.status} • Tipo:
          Multimedidor 4Q
        </div>
      </div>
    </div>
  );
}

export default M160Modal;
