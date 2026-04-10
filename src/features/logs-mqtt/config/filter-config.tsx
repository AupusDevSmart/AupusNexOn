import { FilterConfig } from '@/types/base';

export const logsMqttFilterConfig: FilterConfig[] = [
  {
    key: 'search',
    type: 'search',
    placeholder: 'Buscar por mensagem...',
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
];
