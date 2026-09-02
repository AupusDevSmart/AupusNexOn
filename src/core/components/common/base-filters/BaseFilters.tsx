// src/components/common/base-filters/BaseFilters.tsx - ATUALIZADO
import React from 'react';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/core/components/ui/select';
import { Combobox } from '@/core/components/ui/combobox';
import { Search } from 'lucide-react';
import { FilterConfig, type BaseFilters as BaseFiltersType } from '@/core/types/base';

interface BaseFiltersProps<T extends BaseFiltersType> {
  filters: T;
  config: FilterConfig[];
  onFilterChange: (filters: Partial<T>) => void;
}

/**
 * Tira as classes de largura minima que a pagina declarar.
 *
 * Os filtros ficam num GRID. Um item de grid com `min-width` maior que a coluna
 * nao encolhe nem quebra: ele transborda a propria celula e e desenhado por
 * cima do vizinho — foi assim que o campo de busca cobria o select de status.
 *
 * As classes eram `lg:min-w-80`, `min-w-44` e parentes, escritas quando estes
 * filtros viviam num flex e faziam sentido ali. Sao 65 espalhadas pelas
 * configuracoes das telas, e cacar uma a uma deixaria a proxima voltar.
 *
 * O breakpoint piora: `lg:min-w-80` olha a largura da JANELA, enquanto a coluna
 * e medida pelo container — que costuma ser bem menor, porque divide a linha com
 * o botao de acao. Numa janela larga com container estreito, o minimo entra em
 * vigor justamente onde nao cabe.
 *
 * O resto da className passa intacto: cor, margem, o que a pagina quiser.
 */
const semLarguraMinima = (classes?: string) =>
  (classes ?? '')
    .split(/\s+/)
    .filter((c) => c && !/(^|:)min-w-/.test(c))
    .join(' ');

export function BaseFilters<T extends BaseFiltersType>({
  filters,
  config,
  onFilterChange
}: BaseFiltersProps<T>) {
  const handleFilterChange = (key: string, value: any) => {
    onFilterChange({ [key]: value } as Partial<T>);
  };

  return (
    /* Colunas que se acomodam ao CONTAINER, e nao a janela.
       `auto-fit` com `minmax` cria quantas colunas couberem com pelo menos
       14rem cada, e quebra a linha quando nao cabe mais — em vez de espremer
       quatro colunas fixas num espaco que so comporta duas. */
    <div className="grid w-full gap-3 grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
      {/* Todos os filtros na mesma linha responsiva */}
      {config.map((filterConfig) => {
        const IconComponent = (filterConfig as any).icon;

        // Renderizar filtro de busca/text
        if (filterConfig.type === 'search' || filterConfig.type === 'text') {
          return (
            <div key={filterConfig.key} className={`w-full min-w-0 ${semLarguraMinima(filterConfig.className)}`}>
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
          const currentValue = String(filters[filterConfig.key as keyof T] || 'all');
          const selectedOption = filterConfig.options?.find(opt => String(opt.value) === currentValue);

          return (
            <div key={filterConfig.key} className={`w-full min-w-0 ${semLarguraMinima(filterConfig.className)}`}>
              <Select
                value={currentValue}
                onValueChange={(value) => handleFilterChange(filterConfig.key, value === 'all' ? 'all' : value)}
                disabled={filterConfig.disabled}
              >
                <SelectTrigger className="w-full">
                  {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
                  <SelectValue>
                    {selectedOption?.label || filterConfig.placeholder || filterConfig.label}
                  </SelectValue>
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

        // Renderizar filtro combobox (select com busca)
        if (filterConfig.type === 'combobox') {
          return (
            <div key={filterConfig.key} className={`w-full min-w-0 ${semLarguraMinima(filterConfig.className)}`}>
              <Combobox
                options={(filterConfig.options || []).map(o => ({ ...o, value: String(o.value) }))}
                value={String(filters[filterConfig.key as keyof T] || 'all')}
                onValueChange={(value) => handleFilterChange(filterConfig.key, value || 'all')}
                placeholder={filterConfig.placeholder || filterConfig.label}
                searchPlaceholder={filterConfig.searchPlaceholder || `Buscar ${filterConfig.label?.toLowerCase()}...`}
                emptyText={filterConfig.emptyText || "Nenhum resultado encontrado"}
                disabled={filterConfig.disabled}
              />
            </div>
          );
        }

        // Renderizar filtro custom
        if (filterConfig.type === 'custom') {
          if (!filterConfig.render) {
            return null;
          }

          return (
            <div key={filterConfig.key} className={`w-full min-w-0 ${semLarguraMinima(filterConfig.className)}`}>
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
          <div key={filterConfig.key} className={`w-full min-w-0 ${semLarguraMinima(filterConfig.className)}`}>
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