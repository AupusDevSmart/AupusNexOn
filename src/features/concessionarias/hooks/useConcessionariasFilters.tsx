// src/features/concessionarias/hooks/useConcessionariasFilters.tsx
import { useMemo } from 'react';
import { useEstados } from '@/hooks/useIBGE';
import { FilterConfig } from '@/types/base';

export function useConcessionariasFilters() {
  const { estados, loading: loadingEstados } = useEstados();

  const filterConfig: FilterConfig[] = useMemo(() => {
    const estadosOptions = loadingEstados
      ? [{ value: 'all', label: 'Carregando estados...' }]
      : [
          { value: 'all', label: 'Todos os estados' },
          ...estados.map(estado => ({
            value: estado.sigla,
            label: `${estado.sigla} - ${estado.nome}`
          }))
        ];

    return [
      {
        key: 'search',
        type: 'search' as const,
        placeholder: 'Buscar por nome...',
        className: 'lg:min-w-80'
      },
      {
        key: 'estado',
        type: 'select' as const,
        label: 'Estado',
        className: 'min-w-48',
        options: estadosOptions
      }
    ];
  }, [estados, loadingEstados]);

  return { filterConfig, loadingEstados };
}
