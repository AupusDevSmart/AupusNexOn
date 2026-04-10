import { FilterConfig } from '@/types/base';

export const regrasLogsFilterConfig: FilterConfig[] = [
  {
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por nome, mensagem ou campo...',
    className: 'lg:col-span-2',
  },
  {
    key: 'severidade',
    type: 'combobox',
    label: 'Severidade',
    placeholder: 'Todas as severidades',
    searchPlaceholder: 'Buscar severidade...',
    emptyText: 'Nenhuma severidade encontrada',
    options: [
      { value: 'all', label: 'Todas as severidades' },
      { value: 'BAIXA', label: 'Baixa' },
      { value: 'MEDIA', label: 'Media' },
      { value: 'ALTA', label: 'Alta' },
      { value: 'CRITICA', label: 'Critica' },
    ],
  },
  {
    key: 'ativo',
    type: 'combobox',
    label: 'Status',
    placeholder: 'Todos os status',
    searchPlaceholder: 'Buscar status...',
    emptyText: 'Nenhum status encontrado',
    options: [
      { value: 'all', label: 'Todos os status' },
      { value: 'true', label: 'Ativo' },
      { value: 'false', label: 'Inativo' },
    ],
  },
];
