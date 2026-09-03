// Provider
export { SharedPagesProvider, useSharedPages } from './context/SharedPagesContext';
export type { SharedPagesProviderProps } from './context/SharedPagesContext';

// Convenience hooks (delegam para o provider)
export * from './context/hooks';

// Types
export * from './types/base';
export * from './types/contracts';

// Lib
export { cn } from './lib/utils';

// Feature Pages
export { EquipamentosPage } from './features/equipamentos/components/EquipamentosPage';
export type { ContextoSlot } from './features/equipamentos/components/modals/EquipamentoUCModal';
export { UsuariosPage } from './features/usuarios/components/UsuariosPage';
export { PlantasPage } from './features/plantas/components/PlantasPage';
export { ConcessionariasPage } from './features/concessionarias/components/ConcessionariasPage';

// Common Components
export { BaseFilters } from './components/common/base-filters/BaseFilters';
export { BaseModal } from './components/common/base-modal/BaseModal';
export { BaseForm } from './components/common/base-modal/BaseForm';
export { BaseTable } from './components/common/base-table/BaseTable';
export { FeatureWrapper } from './components/common/FeatureWrapper';
export { TitleCard } from './components/common/TitleCard';

// UI Components
export { Combobox } from './components/ui/combobox';

// Styles - only component classes, NOT theme variables (consumers provide their own theme)
import './styles/design-minimal-components.css';
