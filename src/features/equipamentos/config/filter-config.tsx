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
  loadingUnidades = false
): FilterConfig[] => [
  {
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por nome, modelo, fabricante...',
    className: 'lg:min-w-80'
  },
  {
    key: 'proprietarioId',
    type: 'select',
    label: 'Proprietário',
    placeholder: loadingProprietarios ? 'Carregando proprietários...' : 'Todos os Proprietários',
    options: proprietarios,
    className: 'min-w-48',
    disabled: loadingProprietarios
  },
  {
    key: 'plantaId',
    type: 'select',
    label: 'Planta',
    placeholder: loadingPlantas ? 'Carregando plantas...' : 'Todas as Plantas',
    options: plantas,
    className: 'min-w-48',
    disabled: loadingPlantas
  },
  {
    key: 'unidadeId',
    type: 'select',
    label: 'Unidade',
    placeholder: loadingUnidades ? 'Carregando unidades...' : 'Todas as Unidades',
    options: unidades,
    className: 'min-w-48',
    disabled: loadingUnidades
  },
  {
    key: 'classificacao',
    type: 'select',
    label: 'Classificação',
    placeholder: 'Todas as Classificações',
    options: [
      { value: 'all', label: 'Todas as Classificações' },
      { value: 'UC', label: 'UC (Equipamentos)' },
      { value: 'UAR', label: 'UAR (Componentes)' }
    ],
    className: 'min-w-40'
  },
  {
    key: 'criticidade',
    type: 'select',
    label: 'Criticidade',
    placeholder: 'Todas as Criticidades',
    options: [
      { value: 'all', label: 'Todas as Criticidades' },
      { value: '5', label: '5 (Muito Alta)' },
      { value: '4', label: '4 (Alta)' },
      { value: '3', label: '3 (Média)' },
      { value: '2', label: '2 (Baixa)' },
      { value: '1', label: '1 (Muito Baixa)' }
    ],
    className: 'min-w-40'
  }
];