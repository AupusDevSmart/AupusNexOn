// src/features/equipamentos/config/filter-config.tsx - COM FILTROS DINÂMICOS
import { FilterConfig } from '@/types/base';
import { FilterOption } from '../hooks/useEquipamentoFilters';

// Função para criar configuração de filtros com dados dinâmicos
export const createEquipamentosFilterConfig = (
  proprietarios: FilterOption[] = [{ value: 'all', label: 'Todos os Proprietários' }],
  plantas: FilterOption[] = [{ value: 'all', label: 'Todas as Plantas' }],
  loadingProprietarios = false,
  loadingPlantas = false,
  unidades: FilterOption[] = [{ value: 'all', label: 'Todas as Unidades' }],
  loadingUnidades = false,
  showProprietarioFilter = true
): FilterConfig[] => {
  const baseFilters: FilterConfig[] = [];

  // Adicionar filtro de proprietário apenas para admins
  if (showProprietarioFilter) {
    baseFilters.push({
      key: 'proprietarioId',
      type: 'combobox',
      label: 'Proprietário',
      placeholder: loadingProprietarios ? 'Carregando proprietários...' : 'Todos os Proprietários',
      searchPlaceholder: 'Buscar proprietário...',
      emptyText: 'Nenhum proprietário encontrado',
      options: proprietarios,
      disabled: loadingProprietarios
    });
  }

  // Adicionar planta
  baseFilters.push({
    key: 'plantaId',
    type: 'combobox',
    label: 'Planta',
    placeholder: loadingPlantas ? 'Carregando plantas...' : 'Todas as Plantas',
    searchPlaceholder: 'Buscar planta...',
    emptyText: 'Nenhuma planta encontrada',
    options: plantas,
    disabled: loadingPlantas
  });

  // Adicionar unidade (penúltimo)
  baseFilters.push({
    key: 'unidadeId',
    type: 'combobox',
    label: 'Unidade',
    placeholder: loadingUnidades ? 'Carregando unidades...' : 'Todas as Unidades',
    searchPlaceholder: 'Buscar unidade...',
    emptyText: 'Nenhuma unidade encontrada',
    options: unidades,
    disabled: loadingUnidades
  });

  // Adicionar busca por último
  baseFilters.push({
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por nome, modelo, fabricante...',
    className: 'lg:col-span-2'
  });

  return baseFilters;
};