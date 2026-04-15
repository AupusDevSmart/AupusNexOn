// src/features/equipamentos/config/table-config.tsx
import { Badge } from '@/components/ui/badge';
import { TableColumn } from '@/types/base';
import { Equipamento } from '../types';

export const getEquipamentosTableColumns = (): TableColumn<Equipamento>[] => [
  {
    key: 'nome',
    label: 'Nome',
    sortable: true,
    render: (equipamento) => (
      <span className="font-medium text-sm truncate block" title={equipamento.nome}>
        {equipamento.nome}
      </span>
    )
  },

  {
    key: 'tag',
    label: 'TAG',
    render: (equipamento) => (
      <span className="text-sm text-muted-foreground">
        {equipamento.tag || '-'}
      </span>
    )
  },

  {
    key: 'classificacao',
    label: 'Status',
    render: (equipamento) => (
      <Badge
        variant="outline"
        className="text-xs"
      >
        {equipamento.classificacao}
      </Badge>
    )
  },

  {
    key: 'em_operacao',
    label: 'Em operação',
    render: (equipamento) => (
      <span className={`text-sm ${equipamento.emOperacao === 'sim' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
        {equipamento.emOperacao === 'sim' ? 'Sim' : equipamento.emOperacao === 'nao' ? 'Não' : '-'}
      </span>
    )
  },

  {
    key: 'unidade',
    label: 'Unidade',
    render: (equipamento) => (
      <span className="text-sm truncate block max-w-40" title={equipamento.unidade?.nome}>
        {equipamento.unidade?.nome || '-'}
      </span>
    )
  },

  {
    key: 'criticidade',
    label: 'Criticidade',
    render: (equipamento) => (
      <Badge variant="outline" className="text-xs">
        Crit. {equipamento.criticidade}
      </Badge>
    )
  },

  {
    key: 'fabricante',
    label: 'Fabricante',
    render: (equipamento) => (
      <span className="text-sm truncate block max-w-36" title={equipamento.fabricante}>
        {equipamento.fabricante || '-'}
      </span>
    )
  }
];

// Manter a exportação antiga para compatibilidade
export const equipamentosTableColumns = getEquipamentosTableColumns();
