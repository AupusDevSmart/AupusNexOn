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
export { RedeConcessionariaIcon } from './RedeConcessionariaIcon';
export { CarregadorEletricoIcon } from './CarregadorEletricoIcon';

// Factory and utilities
export {
  EquipmentIconWrapper,
  getEquipmentIcon,
  getSupportedEquipmentTypes,
  hasEquipmentIcon,
  getIconStats,
} from './EquipmentIconFactory';
