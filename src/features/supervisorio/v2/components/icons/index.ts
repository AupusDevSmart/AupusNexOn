/**
 * ICONS - Barrel Export
 *
 * Centraliza todos os exports de ícones para imports mais limpos
 */

// Individual icon components
export { InversorIcon } from './InversorIcon';
export { QGBTIcon } from './QGBTIcon';
export { TransformadorIcon } from './TransformadorIcon';
export { MedidorIcon } from './MedidorIcon';
export { DisjuntorIcon } from './DisjuntorIcon';
export { SoftStarterIcon } from './SoftStarterIcon';
export { RedeConcessionariaIcon } from './RedeConcessionariaIcon';
export { CarregadorEletricoIcon } from './CarregadorEletricoIcon';
export { CargaIcon } from './CargaIcon';

// Factory and utilities
export {
  EquipmentIconWrapper,
  getEquipmentIcon,
  getSupportedEquipmentCategories as getSupportedEquipmentTypes,
  hasEquipmentIcon,
  getIconStats,
} from './EquipmentIconFactory';
