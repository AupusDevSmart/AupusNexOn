// src/components/common/base-filters/BaseFilters.tsx - ATUALIZADO
import React from 'react';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { FilterConfig, type BaseFilters as BaseFiltersType } from '@/types/base';

interface BaseFiltersProps<T extends BaseFiltersType> {
  filters: T;
  config: FilterConfig[];
  onFilterChange: (filters: Partial<T>) => void;
}

export function BaseFilters<T extends BaseFiltersType>({
  filters,
  config,
  onFilterChange
}: BaseFiltersProps<T>) {
  const handleFilterChange = (key: string, value: any) => {
    onFilterChange({ [key]: value } as Partial<T>);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
      {/* Todos os filtros na mesma linha responsiva */}
      {config.map((filterConfig) => {
        const IconComponent = (filterConfig as any).icon;

        // Renderizar filtro de busca/text
        if (filterConfig.type === 'search' || filterConfig.type === 'text') {
          return (
            <div key={filterConfig.key} className={`w-full ${filterConfig.className || ''}`}>
              <div className="relative">
                <Input
                  placeholder={filterConfig.placeholder || `Filtrar por ${filterConfig.label?.toLowerCase()}...`}
                  className="pl-9"
                  value={String(filters[filterConfig.key as keyof T] || '')}
                  onChange={(e) => handleFilterChange(filterConfig.key, e.target.value)}
                  disabled={filterConfig.disabled}
                />
                {IconComponent ? (
                  <IconComponent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                ) : (
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          );
        }

        // Renderizar filtro select
        if (filterConfig.type === 'select') {
          return (
            <div key={filterConfig.key} className={`w-full ${filterConfig.className || ''}`}>
              <Select
                value={String(filters[filterConfig.key as keyof T] || 'all')}
                onValueChange={(value) => handleFilterChange(filterConfig.key, value === 'all' ? 'all' : value)}
                disabled={filterConfig.disabled}
              >
                <SelectTrigger className="w-full">
                  {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
                  <SelectValue placeholder={filterConfig.placeholder || filterConfig.label} />
                </SelectTrigger>
                <SelectContent>
                  {filterConfig.options?.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        // Renderizar filtro custom
        if (filterConfig.type === 'custom') {
          if (!filterConfig.render) {
            return null;
          }

          return (
            <div key={filterConfig.key} className={`w-full ${filterConfig.className || ''}`}>
              {filterConfig.render({
                value: filters[filterConfig.key as keyof T],
                onChange: (value) => handleFilterChange(filterConfig.key, value),
                disabled: filterConfig.disabled || false
              })}
            </div>
          );
        }

        // Renderizar outros tipos (date, etc.)
        return (
          <div key={filterConfig.key} className={`w-full ${filterConfig.className || ''}`}>
            <div className="relative">
              <Input
                type={filterConfig.type === 'date' ? 'date' : 'text'}
                placeholder={filterConfig.placeholder || `Filtrar por ${filterConfig.label?.toLowerCase()}...`}
                className={IconComponent ? "pl-9" : ""}
                value={String(filters[filterConfig.key as keyof T] || '')}
                onChange={(e) => handleFilterChange(filterConfig.key, e.target.value)}
              />
              {IconComponent && (
                <IconComponent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}