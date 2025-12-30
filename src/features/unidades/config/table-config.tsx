// src/features/unidades/config/table-config.tsx

import {
  Factory,
  MapPin,
  Building2,
  Droplets,
  ExternalLink,
} from 'lucide-react';
import { TableColumn } from '@/types/base';
import type { Unidade } from '../types';

export const unidadesTableColumns: TableColumn<Unidade>[] = [
  {
    key: 'dados_principais',
    label: 'Unidade',
    sortable: true,
    render: (unidade) => (
      <div className="space-y-1 min-w-0">
        <a
          href={`/cadastros/equipamentos?unidadeId=${unidade.id}&unidadeNome=${encodeURIComponent(unidade.nome)}`}
          className="flex items-center gap-2 font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline group"
          title={`Ver equipamentos de ${unidade.nome}`}
        >
          <Factory className="h-4 w-4 shrink-0" />
          <span className="truncate" title={unidade.nome}>
            {unidade.nome}
          </span>
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </a>
        <div className="text-xs text-muted-foreground truncate">
          {unidade.tipo}
          {unidade.potencia && ` • ${unidade.potencia} kW`}
        </div>
      </div>
    )
  },
  {
    key: 'planta',
    label: 'Planta',
    render: (unidade) => (
      <div className="flex items-center gap-2">
        {unidade.planta ? (
          <>
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate" title={unidade.planta.nome}>
              {unidade.planta.nome}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground italic">
            Não informada
          </span>
        )}
      </div>
    )
  },
  {
    key: 'localizacao',
    label: 'Localização',
    hideOnMobile: true,
    render: (unidade) => (
      <div className="space-y-1 min-w-0">
        {unidade.cidade && unidade.estado ? (
          <>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">
                {unidade.cidade}/{unidade.estado}
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {unidade.latitude.toFixed(4)}, {unidade.longitude.toFixed(4)}
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground italic">
            Não informada
          </span>
        )}
      </div>
    )
  },
  {
    key: 'energia',
    label: 'Energia',
    hideOnMobile: true,
    render: (unidade) => (
      <div className="space-y-1 min-w-0">
        {unidade.tipoUnidade ? (
          <div className="text-sm font-medium text-foreground truncate">
            {unidade.tipoUnidade}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">-</div>
        )}
        {(unidade.demandaCarga || unidade.demandaGeracao) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {unidade.demandaCarga && <div>↓ {unidade.demandaCarga} kW</div>}
            {unidade.demandaGeracao && <div>↑ {unidade.demandaGeracao} kW</div>}
          </div>
        )}
        {unidade.grupo && (
          <div className="text-xs text-muted-foreground truncate">
            {unidade.grupo}{unidade.subgrupo && ` • ${unidade.subgrupo}`}
          </div>
        )}
      </div>
    )
  },
  {
    key: 'status',
    label: 'Status',
    hideOnMobile: true,
    render: (unidade) => (
      <div className="space-y-1">
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          unidade.status === 'ativo'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}>
          {unidade.status === 'ativo' ? '✓ Ativo' : '✗ Inativo'}
        </div>
        {unidade.irrigante && (
          <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
            <Droplets className="h-3 w-3" />
            <span>Irrigante</span>
          </div>
        )}
      </div>
    )
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
    empty: 'Nenhuma unidade encontrada',
    loading: 'Carregando unidades...',
    error: 'Erro ao carregar unidades',
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
