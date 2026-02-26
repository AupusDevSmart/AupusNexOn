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
      type: 'select',
      label: 'Proprietário',
      placeholder: loadingProprietarios ? 'Carregando proprietários...' : 'Todos os Proprietários',
      options: proprietarios,
      disabled: loadingProprietarios
    });
  }

  // Adicionar planta
  baseFilters.push({
    key: 'plantaId',
    type: 'select',
    label: 'Planta',
    placeholder: loadingPlantas ? 'Carregando plantas...' : 'Todas as Plantas',
    options: plantas,
    disabled: loadingPlantas
  });

  // Adicionar unidade (penúltimo)
  baseFilters.push({
    key: 'unidadeId',
    type: 'select',
    label: 'Unidade',
    placeholder: loadingUnidades ? 'Carregando unidades...' : 'Todas as Unidades',
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