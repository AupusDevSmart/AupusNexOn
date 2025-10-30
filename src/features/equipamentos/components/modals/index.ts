// src/features/equipamentos/components/modals/index.ts
export { EquipamentoUCModal } from './EquipamentoUCModal';
export { ComponenteUARModal } from './ComponenteUARModal';
export { GerenciarUARsModal } from './GerenciarUARsModal';

// Tipos para os modais
export interface ModalUCState {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  entity: any | null;
}

export interface ModalUARState {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  entity: any | null;
  equipamentoPai: any | null;
}

export interface ModalGerenciarUARsState {
  isOpen: boolean;
  equipamentoUC: any | null;
}