// src/features/unidades/config/table-config.tsx

import {
  Factory,
  MapPin,
  Calendar,
  Building2,
  Droplets,
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
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Factory className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="truncate" title={unidade.nome}>
            {unidade.nome}
          </span>
        </div>
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
  },
  {
    key: 'informacoes_cadastro',
    label: 'Cadastro',
    hideOnMobile: true,
    render: (unidade) => (
      <div className="space-y-1">
        {unidade.createdAt && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {formatDate(unidade.createdAt)}
            </span>
          </div>
        )}
        {unidade.updatedAt && unidade.updatedAt !== unidade.createdAt && (
          <div className="text-xs text-muted-foreground">
            Atualizada: {formatDate(unidade.updatedAt)}
          </div>
        )}
      </div>
    )
  }
];

// Helper: Formatação de data
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return 'Data inválida';
  }
}

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
