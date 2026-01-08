// src/features/unidades/config/table-config.tsx

import {
  Factory,
  MapPin,
  Zap,
  Droplets,
  Building,
  Sprout,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TableColumn } from '@/types/base';
import type { Unidade } from '../types';

export const unidadesTableColumns: TableColumn<Unidade>[] = [
  {
    key: 'instalacao',
    label: 'Instalação',
    sortable: true,
    render: (unidade) => (
      <div className="space-y-0.5 min-w-0">
        <div className="font-medium text-sm truncate" title={unidade.nome}>
          {unidade.nome}
        </div>
        {/* Demanda - mostrar baseado no tipo da unidade */}
        {unidade.tipoUnidade && (
          <div className="text-xs text-muted-foreground">
            {unidade.tipoUnidade === 'Geração' && unidade.demandaGeracao && (
              <div>Demanda de geração: {unidade.demandaGeracao} kW</div>
            )}
            {unidade.tipoUnidade === 'Carga' && unidade.demandaCarga && (
              <div>Demanda: {unidade.demandaCarga} kW</div>
            )}
            {(unidade.tipoUnidade === 'Geração + Carga' || unidade.tipoUnidade === 'Carga e Geração') && (
              <>
                {unidade.demandaGeracao && (
                  <div>Demanda de geração: {unidade.demandaGeracao} kW</div>
                )}
                {unidade.demandaCarga && (
                  <div>Demanda: {unidade.demandaCarga} kW</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  },

  {
    key: 'planta',
    label: 'Planta',
    render: (unidade) => (
      <div className="flex items-center gap-2 min-w-0">
        <Factory className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm truncate" title={unidade.planta?.nome}>
          {unidade.planta?.nome || '-'}
        </span>
      </div>
    )
  },

  {
    key: 'localizacao',
    label: 'Localização',
    render: (unidade) => (
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm truncate" title={unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : '-'}>
          {unidade.cidade && unidade.estado
            ? `${unidade.cidade}/${unidade.estado}`
            : '-'
          }
        </span>
      </div>
    )
  },

  {
    key: 'tipo',
    label: 'Tipo',
    render: (unidade) => (
      <div className="text-sm">
        {unidade.tipoUnidade || '-'}
      </div>
    )
  },

  {
    key: 'tensao',
    label: 'Tensão',
    render: (unidade) => (
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-sm font-medium">
          {unidade.tensaoNominal ? `${unidade.tensaoNominal} V` : '-'}
        </span>
      </div>
    )
  },

  {
    key: 'perfil',
    label: 'Perfil',
    render: (unidade) => (
      <div className="flex flex-wrap gap-1">
        {unidade.irrigante && (
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <Droplets className="h-3 w-3" />
            Irrigante
          </Badge>
        )}
        {unidade.grupo && (
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            {unidade.grupo === 'A' && <Building className="h-3 w-3" />}
            {unidade.grupo === 'B' && <Sprout className="h-3 w-3" />}
            {unidade.grupo}
            {unidade.subgrupo && ` - ${unidade.subgrupo}`}
          </Badge>
        )}
        {!unidade.irrigante && !unidade.grupo && (
          <span className="text-xs text-muted-foreground">-</span>
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
