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

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Só fecha se clicar no overlay, não no conteúdo do modal
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* Overlay com suporte a dark mode */}
      <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" />

      {/* Modal com suporte a dark mode */}
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Selecionar Planta e Unidade
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] bg-white dark:bg-gray-900">
          <SeletorPlantaUnidade
            onUnidadeSelect={handleSelect}
            selectedPlantaId={currentPlantaId}
            selectedUnidadeId={currentUnidadeId}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
