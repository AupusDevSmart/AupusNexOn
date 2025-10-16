// src/features/usuarios/components/usuarios-filters.tsx
// Removed unused React import
import { BaseFilters } from '@/components/common/base-filters/BaseFilters';
import { UsuariosFilters as UsuariosFiltersType } from '../types';
import { usuariosFilterConfig } from '../config/filter-config';

interface UsuariosFiltersProps {
  filters: UsuariosFiltersType;
  onFilterChange: (filters: Partial<UsuariosFiltersType>) => void;
}

export function UsuariosFilters({ filters, onFilterChange }: UsuariosFiltersProps) {
  return (
    <BaseFilters 
      filters={filters}
      config={usuariosFilterConfig}
      onFilterChange={onFilterChange}
    />
  );
}