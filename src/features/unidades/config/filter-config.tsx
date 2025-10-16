// src/features/unidades/config/filter-config.tsx

import { FilterConfig } from '@/types/base';
import { PlantaOption } from '../hooks/usePlantas';
import { Factory } from 'lucide-react';

// Função para gerar opções de plantas
export const generatePlantaOptions = (plantas: PlantaOption[]) => {
  const options = [{ value: 'all', label: 'Todas as plantas' }];

  plantas.forEach((planta) => {
    let label = planta.nome;

    if (planta.localizacao) {
      label += ` - ${planta.localizacao}`;
    }

    options.push({
      value: planta.id,
      label: label,
    });
  });

  return options;
};

// Função para criar configuração de filtros com dados dinâmicos
export const createUnidadesFilterConfig = (
  plantas: PlantaOption[] = [],
  loadingPlantas = false
): FilterConfig[] => [
  {
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por nome da unidade...',
    className: 'lg:min-w-80',
  },
  {
    key: 'plantaId',
    type: 'select',
    label: 'Planta',
    placeholder: loadingPlantas ? 'Carregando plantas...' : 'Todas as plantas',
    options: generatePlantaOptions(plantas),
    className: 'min-w-48',
    disabled: loadingPlantas,
    icon: Factory,
  } as FilterConfig,
  {
    key: 'orderBy',
    type: 'select',
    label: 'Ordenar por',
    placeholder: 'Padrão (Nome)',
    options: [
      { value: 'nome', label: 'Nome' },
      { value: 'created_at', label: 'Data de Criação' },
      { value: 'updated_at', label: 'Última Atualização' },
    ],
    className: 'min-w-40',
  },
  {
    key: 'orderDirection',
    type: 'select',
    label: 'Ordem',
    placeholder: 'Padrão (A-Z)',
    options: [
      { value: 'asc', label: 'Crescente (A-Z)' },
      { value: 'desc', label: 'Decrescente (Z-A)' },
    ],
    className: 'min-w-40',
  },
];

// Configuração padrão para quando as plantas ainda não foram carregadas
export const unidadesFilterConfig: FilterConfig[] = [
  {
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por nome da unidade...',
    className: 'lg:min-w-80',
  },
  {
    key: 'plantaId',
    type: 'select',
    label: 'Planta',
    placeholder: 'Carregando plantas...',
    options: [{ value: 'all', label: 'Carregando plantas...' }],
    className: 'min-w-48',
    disabled: true,
    icon: Factory,
  } as FilterConfig,
  {
    key: 'orderBy',
    type: 'select',
    label: 'Ordenar por',
    placeholder: 'Padrão (Nome)',
    options: [
      { value: 'nome', label: 'Nome' },
      { value: 'created_at', label: 'Data de Criação' },
      { value: 'updated_at', label: 'Última Atualização' },
    ],
    className: 'min-w-40',
  },
  {
    key: 'orderDirection',
    type: 'select',
    label: 'Ordem',
    placeholder: 'Padrão (A-Z)',
    options: [
      { value: 'asc', label: 'Crescente (A-Z)' },
      { value: 'desc', label: 'Decrescente (Z-A)' },
    ],
    className: 'min-w-40',
  },
];
