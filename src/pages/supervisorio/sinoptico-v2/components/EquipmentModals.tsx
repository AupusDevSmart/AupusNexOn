/**
 * EQUIPMENT MODALS - Gerenciador Centralizado de Modals
 *
 * Responsabilidades:
 * - Mapear tipo de equipamento → modal correto
 * - Renderizar modal apropriado com dados
 * - Gerenciar abertura/fechamento
 *
 * Suporta todos os tipos de equipamentos existentes:
 * - Inversores (Fronius, Growatt, Sungrow)
 * - Medidores (M160, M300, Landis+Gyr)
 * - Transformadores
 * - Disjuntores
 * - Pivôs
 * - Gateway IoT (A966)
 *
 * @author Claude Code
 * @version 2.0.0
 * @date 2026-02-02
 */

import React, { useMemo } from 'react';
import { useDiagramStore } from '@/features/supervisorio/v2/hooks/useDiagramStore';

// Import modals existentes
import { InversorModal } from '@/features/supervisorio/components/inversor-modal';
import { M160Modal } from '@/features/supervisorio/components/m160-modal';
import { M300Modal } from '@/features/supervisorio/components/m300-modal';
import { LandisGyrModal } from '@/features/supervisorio/components/landisgyr-modal';
import { TransformadorModal } from '@/features/supervisorio/components/transformador-modal';
import { DisjuntorModal } from '@/features/supervisorio/components/disjuntor-modal';
import { PivoModal } from '@/features/supervisorio/components/pivo/pivo-modal';
import { A966Modal } from '@/features/supervisorio/components/a966-modal';

interface EquipmentModalsProps {
  selectedEquipmentId: string | null;
  onClose: () => void;
}

/**
 * Mapeia tipo de equipamento para o modal correto
 *
 * Usa pattern matching no tipo (case-insensitive)
 */
function getModalForEquipment(tipo: string): string | null {
  const tipoUpper = tipo.toUpperCase();

  // Inversores
  if (
    tipoUpper.includes('INVERSOR') ||
    tipoUpper.includes('FRONIUS') ||
    tipoUpper.includes('GROWATT') ||
    tipoUpper.includes('SUNGROW')
  ) {
    return 'INVERSOR';
  }

  // Medidores
  if (tipoUpper.includes('M160')) return 'M160';
  if (tipoUpper.includes('M300')) return 'M300';
  if (tipoUpper.includes('LANDIS')) return 'LANDIS';

  // Outros equipamentos
  if (tipoUpper.includes('TRANSFORMADOR')) return 'TRANSFORMADOR';
  if (tipoUpper.includes('DISJUNTOR')) return 'DISJUNTOR';
  if (tipoUpper.includes('PIVO')) return 'PIVO';
  if (tipoUpper.includes('A966') || tipoUpper.includes('GATEWAY')) return 'A966';

  return null;
}

/**
 * Gerenciador centralizado de modals de equipamentos
 *
 * Recebe ID do equipamento selecionado e renderiza o modal correto
 */
export function EquipmentModals({
  selectedEquipmentId,
  onClose,
}: EquipmentModalsProps) {
  const equipamentos = useDiagramStore(state => state.equipamentos);

  // Buscar equipamento selecionado
  const equipment = useMemo(
    () => equipamentos.find(eq => eq.id === selectedEquipmentId),
    [equipamentos, selectedEquipmentId]
  );

  // Se não houver equipamento selecionado, não renderizar nada
  if (!equipment) return null;

  // Determinar qual modal usar
  const modalType = getModalForEquipment(equipment.tipo);

  // Se tipo não suportado, não renderizar
  if (!modalType) {
    console.warn(`Modal não encontrado para tipo: ${equipment.tipo}`);
    return null;
  }

  // Converter dados do V2 para formato esperado pelos modals legados
  const componenteData = {
    id: equipment.id,
    nome: equipment.nome,
    tag: equipment.tag,
    tipo: equipment.tipo,
    status: equipment.status?.toUpperCase() || 'NORMAL',
    posicao: {
      x: equipment.posicaoX,
      y: equipment.posicaoY,
    },
    dados: {}, // Modals buscam dados reais via API
  };

  // Renderizar modal correto
  switch (modalType) {
    case 'INVERSOR':
      return (
        <InversorModal
          isOpen={true}
          onClose={onClose}
          componenteData={componenteData}
        />
      );

    case 'M160':
      return (
        <M160Modal
          isOpen={true}
          onClose={onClose}
          componenteData={componenteData}
        />
      );

    case 'M300':
      return (
        <M300Modal
          isOpen={true}
          onClose={onClose}
          componenteData={componenteData}
        />
      );

    case 'LANDIS':
      return (
        <LandisGyrModal
          isOpen={true}
          onClose={onClose}
          componenteData={componenteData}
        />
      );

    case 'TRANSFORMADOR':
      return (
        <TransformadorModal
          isOpen={true}
          onClose={onClose}
          componenteData={componenteData}
        />
      );

    case 'DISJUNTOR':
      return (
        <DisjuntorModal
          isOpen={true}
          onClose={onClose}
          componenteData={componenteData}
        />
      );

    case 'PIVO':
      return (
        <PivoModal
          isOpen={true}
          onClose={onClose}
          componenteData={componenteData}
        />
      );

    case 'A966':
      return (
        <A966Modal
          isOpen={true}
          onClose={onClose}
          componenteData={componenteData}
        />
      );

    default:
      console.warn(`Modal type não implementado: ${modalType}`);
      return null;
  }
}
