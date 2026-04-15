// src/features/unidades/config/filter-config.tsx

import { FilterConfig } from '@/types/base';
import { PlantaOption } from '../hooks/usePlantas';
import { Factory, User } from 'lucide-react';

export interface ProprietarioOption {
  id: string;
  nome: string;
}

// Função para gerar opções de plantas
export const generatePlantaOptions = (plantas: PlantaOption[]) => {
  const options = [{ value: 'all', label: 'Todas as plantas' }];

  plantas.forEach((planta) => {
    let label = planta.nome;

    if (planta.localizacao) {
      label += ` - ${planta.localizacao}`;
    }

    options.push({
      value: planta.id?.trim(),
      label: label,
    });
  });

  return options;
};

// Função para gerar opções de proprietários
export const generateProprietarioOptions = (proprietarios: ProprietarioOption[]) => {
  const options = [{ value: 'all', label: 'Todos os proprietários' }];

  proprietarios.forEach((proprietario) => {
    options.push({
      value: proprietario.id?.trim(),
      label: proprietario.nome,
    });
  });

  return options;
};

// Função para criar configuração de filtros com dados dinâmicos
export const createUnidadesFilterConfig = (
  plantas: PlantaOption[] = [],
  loadingPlantas = false,
  proprietarios: ProprietarioOption[] = [],
  loadingProprietarios = false,
  showProprietarioFilter = false // Visível apenas para admin/super_admin
): FilterConfig[] => {
  const filters: FilterConfig[] = [
    {
      key: 'search',
      type: 'search',
      placeholder: 'Buscar por nome da instalação...',
      className: 'lg:col-span-2',
    },
  ];

  // Adicionar filtro de proprietário apenas se o usuário for admin/super_admin
  if (showProprietarioFilter) {
    filters.push({
      key: 'proprietarioId',
      type: 'combobox',
      label: 'Proprietário',
      placeholder: loadingProprietarios ? 'Carregando proprietários...' : 'Todos os proprietários',
      searchPlaceholder: 'Buscar proprietário...',
      emptyText: 'Nenhum proprietário encontrado',
      options: generateProprietarioOptions(proprietarios),
      disabled: loadingProprietarios,
      icon: User,
    } as FilterConfig);
  }

  // Adicionar filtro de planta
  filters.push({
    key: 'plantaId',
    type: 'combobox',
    label: 'Planta',
    placeholder: loadingPlantas ? 'Carregando plantas...' : 'Todas as plantas',
    searchPlaceholder: 'Buscar planta...',
    emptyText: 'Nenhuma planta encontrada',
    options: generatePlantaOptions(plantas),
    disabled: loadingPlantas,
    icon: Factory,
  } as FilterConfig);

  return filters;
};

// Configuração padrão para quando as plantas ainda não foram carregadas
export const unidadesFilterConfig: FilterConfig[] = [
  {
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por nome da instalação...',
    className: 'lg:col-span-2',
  },
  {
    key: 'plantaId',
    type: 'combobox',
    label: 'Planta',
    placeholder: 'Carregando plantas...',
    searchPlaceholder: 'Buscar planta...',
    emptyText: 'Nenhuma planta encontrada',
    options: [{ value: 'all', label: 'Carregando plantas...' }],
    disabled: true,
    icon: Factory,
  } as FilterConfig,
];
