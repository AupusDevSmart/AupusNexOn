import { BaseModal } from '@/components/common/base-modal/BaseModal';
import { FileText } from 'lucide-react';
import { LogMqtt } from '../types';
import { SEVERIDADE_COLORS } from '@/features/regras-logs/types';
import { FormField } from '@/types/base';

interface LogMqttDetailModalProps {
  isOpen: boolean;
  log?: LogMqtt | null;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('pt-BR');
  } catch {
    return dateStr;
  }
}

const logDetailFormFields: FormField[] = [];

export function LogMqttDetailModal({ isOpen, log, onClose }: LogMqttDetailModalProps) {
  if (!log) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      mode="view"
      entity={log as any}
      title="Detalhe do Log"
      icon={<FileText className="h-5 w-5" />}
      formFields={logDetailFormFields}
      onClose={onClose}
      onSubmit={async () => {}}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Data/Hora</p>
            <p className="text-sm font-mono">{formatDate(log.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Severidade</p>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${SEVERIDADE_COLORS[log.severidade] || ''}`}
            >
              {log.severidade}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Equipamento</p>
          <p className="text-sm font-medium">{log.equipamento?.nome || 'N/A'}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Mensagem</p>
          <p className="text-sm">{log.mensagem}</p>
        </div>

        {log.regra && (
          <div className="bg-muted p-3 rounded space-y-2">
            <p className="text-xs text-muted-foreground">Regra</p>
            <p className="text-sm font-medium">{log.regra.nome}</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded">
                {log.regra.campo_json} {log.regra.operador} {log.regra.valor}
              </code>
              <span className="text-xs text-muted-foreground">
                Valor lido: <span className="font-mono">{Number(log.valor_lido)}</span>
              </span>
            </div>
          </div>
        )}

        {log.dados_snapshot && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Snapshot MQTT</p>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40 font-mono">
              {JSON.stringify(log.dados_snapshot, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
