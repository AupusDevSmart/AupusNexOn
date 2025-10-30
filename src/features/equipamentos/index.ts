// src/features/equipamentos/index.ts

// Exportar página
export { EquipamentosPage } from './components/EquipamentosPage';

// Exportar hook e tipos
export { useEquipamentos } from './hooks/useEquipamentos';
export type {
  Equipamento,
  Planta,
  EquipamentosFilters,
  ModalMode
} from './types';