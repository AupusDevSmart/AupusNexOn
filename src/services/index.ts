// Exportar todos os services
export { default as api } from './api';
export { default as unidadesService } from './unidadesService';

// Re-exportar hooks relacionados
export {
  useUnidades,
  useUnidadesCRUD,
  useUnidadesStats,
  useUnidadesImportExport,
} from '../hooks/useUnidades';

// Re-exportar tipos
export * from '../types/unidades';