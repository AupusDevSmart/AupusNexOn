// src/components/supervisorio/ModalSelecionarUnidade.tsx

import React from 'react';
import { X } from 'lucide-react';
import { SeletorPlantaUnidade } from './SeletorPlantaUnidade';
import type { PlantaResponse } from '@/services/plantas.services';
import type { Unidade } from '@/services/unidades.services';

interface ModalSelecionarUnidadeProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (unidadeId: string, planta: PlantaResponse, unidade: Unidade) => void;
  currentPlantaId?: string;
  currentUnidadeId?: string;
}

export function ModalSelecionarUnidade({
  isOpen,
  onClose,
  onSelect,
  currentPlantaId,
  currentUnidadeId,
}: ModalSelecionarUnidadeProps) {
  if (!isOpen) return null;

  const handleSelect = (unidadeId: string, planta: PlantaResponse, unidade: Unidade) => {
    onSelect(unidadeId, planta, unidade);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Selecionar Planta e Unidade
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <SeletorPlantaUnidade
            onUnidadeSelect={handleSelect}
            selectedPlantaId={currentPlantaId}
            selectedUnidadeId={currentUnidadeId}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
