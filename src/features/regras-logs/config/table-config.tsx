import { TableColumn } from '@/types/base';
import { RegraLog, SEVERIDADE_COLORS } from '../types';
import { Activity, ToggleLeft, ToggleRight } from 'lucide-react';

export const regrasLogsTableColumns: TableColumn<RegraLog>[] = [
  {
    key: 'equipamento',
    label: 'Equipamento',
    render: (regra) => (
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate max-w-40">
          {regra.equipamento?.nome || 'N/A'}
        </span>
      </div>
    ),
  },
  {
    key: 'nome',
    label: 'Regra',
    sortable: true,
    render: (regra) => (
      <span className="text-sm font-medium">{regra.nome}</span>
    ),
  },
  {
    key: 'condicao',
    label: 'Condicao',
    render: (regra) => (
      <code className="text-xs bg-muted px-2 py-1 rounded">
        {regra.campo_json} {regra.operador} {regra.valor}
      </code>
    ),
  },
  {
    key: 'mensagem',
    label: 'Mensagem',
    hideOnMobile: true,
    render: (regra) => (
      <span className="text-sm text-muted-foreground truncate max-w-48 block">
        {regra.mensagem}
      </span>
    ),
  },
  {
    key: 'severidade',
    label: 'Severidade',
    render: (regra) => (
      <span
        className={`text-xs font-medium px-2 py-1 rounded-full ${SEVERIDADE_COLORS[regra.severidade] || ''}`}
      >
        {regra.severidade}
      </span>
    ),
  },
  {
    key: 'cooldown',
    label: 'Cooldown',
    hideOnTablet: true,
    render: (regra) => (
      <span className="text-sm text-muted-foreground">
        {regra.cooldown_minutos} min
      </span>
    ),
  },
  {
    key: 'ativo',
    label: 'Status',
    render: (regra) =>
      regra.ativo ? (
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <ToggleRight className="h-4 w-4" />
          <span className="text-xs">Ativo</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-muted-foreground">
          <ToggleLeft className="h-4 w-4" />
          <span className="text-xs">Inativo</span>
        </div>
      ),
  },
];
