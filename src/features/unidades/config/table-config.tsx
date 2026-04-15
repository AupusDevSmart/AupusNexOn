// src/features/unidades/config/table-config.tsx

import { Badge } from '@/components/ui/badge';
import { TableColumn } from '@/types/base';
import type { Unidade } from '../types';

export const unidadesTableColumns: TableColumn<Unidade>[] = [
  {
    key: 'instalacao',
    label: 'Instalação',
    sortable: true,
    render: (unidade) => (
      <span className="font-medium text-sm truncate block" title={unidade.nome}>
        {unidade.nome}
      </span>
    )
  },

  {
    key: 'planta',
    label: 'Planta',
    render: (unidade) => (
      <span className="text-sm truncate block" title={unidade.planta?.nome}>
        {unidade.planta?.nome || '-'}
      </span>
    )
  },

  {
    key: 'tipo',
    label: 'Tipo',
    render: (unidade) => (
      <span className="text-sm">
        {unidade.industrial ? 'Industrial' : unidade.irrigante ? 'Rural' : '-'}
      </span>
    )
  },

  {
    key: 'tensao',
    label: 'Tensão',
    render: (unidade) => (
      <span className="text-sm">
        {unidade.tensaoNominal || '-'}
      </span>
    )
  },

  {
    key: 'perfil',
    label: 'Perfil',
    render: (unidade) => {
      const labels = [];
      if (unidade.irrigante) labels.push('Irrigante');
      if (unidade.sazonal) labels.push('Sazonal');
      if (unidade.industrial) labels.push('Industrial');
      if (unidade.geracao) labels.push('Geração');

      return (
        <div className="flex flex-wrap gap-1">
          {labels.length > 0 ? labels.map(l => (
            <Badge key={l} variant="outline" className="text-xs">
              {l}
            </Badge>
          )) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      );
    }
  }
];

// Configurações adicionais da tabela
export const unidadesTableConfig = {
  breakpoints: {
    mobile: 640,
    tablet: 768,
    desktop: 1024
  },

  defaultPagination: {
    limit: 10,
    page: 1
  },

  messages: {
    empty: 'Nenhuma instalação encontrada',
    loading: 'Carregando instalações...',
    error: 'Erro ao carregar instalações',
    noResults: 'Nenhum resultado encontrado para os filtros aplicados'
  },

  defaultSort: {
    column: 'nome',
    direction: 'asc' as const
  },

  actions: {
    view: {
      label: 'Visualizar',
      icon: 'eye',
      variant: 'ghost' as const
    },
    edit: {
      label: 'Editar',
      icon: 'edit',
      variant: 'ghost' as const
    },
    delete: {
      label: 'Excluir',
      icon: 'trash',
      variant: 'ghost' as const
    }
  }
} as const;
