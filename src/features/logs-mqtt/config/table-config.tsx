import { TableColumn } from '@/types/base';
import { LogMqtt } from '../types';
import { SEVERIDADE_COLORS } from '@/features/regras-logs/types';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export const logsMqttTableColumns: TableColumn<LogMqtt>[] = [
  {
    key: 'created_at',
    label: 'Data/Hora',
    sortable: true,
    render: (log) => (
      <span className="text-sm font-mono">{formatDate(log.created_at)}</span>
    ),
  },
  {
    key: 'equipamento',
    label: 'Equipamento',
    render: (log) => (
      <span className="text-sm font-medium truncate max-w-40 block">
        {log.equipamento?.nome || 'N/A'}
      </span>
    ),
  },
  {
    key: 'regra',
    label: 'Regra',
    hideOnMobile: true,
    render: (log) => (
      <span className="text-sm">{log.regra?.nome || 'N/A'}</span>
    ),
  },
  {
    key: 'condicao',
    label: 'Condicao',
    hideOnMobile: true,
    render: (log) => (
      <code className="text-xs bg-muted px-2 py-1 rounded">
        {log.regra?.campo_json} {log.regra?.operador} {log.regra?.valor}
      </code>
    ),
  },
  {
    key: 'valor_lido',
    label: 'Valor Lido',
    render: (log) => (
      <span className="text-sm font-mono">{Number(log.valor_lido)}</span>
    ),
  },
  {
    key: 'mensagem',
    label: 'Mensagem',
    render: (log) => (
      <span className="text-sm truncate max-w-48 block">{log.mensagem}</span>
    ),
  },
  {
    key: 'severidade',
    label: 'Severidade',
    render: (log) => (
      <span
        className={`text-xs font-medium px-2 py-1 rounded-full ${SEVERIDADE_COLORS[log.severidade] || ''}`}
      >
        {log.severidade}
      </span>
    ),
  },
];
