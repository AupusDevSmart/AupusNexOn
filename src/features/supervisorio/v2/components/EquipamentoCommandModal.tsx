/**
 * EQUIPAMENTO COMMAND MODAL
 *
 * Modal generico de envio de comandos MQTT a um equipamento.
 * Renderizacao dirigida pelo `commandRegistry` por categoria — o mesmo
 * componente serve TONs (relés/transistores), e qualquer categoria futura
 * que ganhe entradas no registry.
 *
 * Para PR2 esse modal eh primariamente "modal de bancada" para teste de
 * relés do TON3 local. A estrutura ja prepara terreno para o operador
 * comandar inversores/disjuntores no Unifilar quando esses ganharem
 * comandos no registry.
 */

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  equipamentosApi,
  type CommandResult,
  type EquipamentoCommand,
} from '@/services/equipamentos.services';
import {
  getCommandsForCategoria,
  type CommandButton,
} from '../utils/commandRegistry';

export interface EquipamentoCommandModalProps {
  open: boolean;
  onClose: () => void;
  equipamento: {
    id: string;
    nome: string;
    topico_mqtt?: string | null;
    categoria?: string | null;
  };
}

interface PendingState {
  /** Index do botao em pending — chave: `${groupTitle}:${buttonLabel}` */
  [key: string]: boolean;
}

const buttonKey = (groupTitle: string, button: CommandButton): string =>
  `${groupTitle}:${button.label}`;

const variantClass: Record<NonNullable<CommandButton['variant']>, string> = {
  default: '',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  destructive: 'bg-red-600 hover:bg-red-700 text-white',
  outline: '',
};

export const EquipamentoCommandModal: React.FC<EquipamentoCommandModalProps> = ({
  open,
  onClose,
  equipamento,
}) => {
  const [pending, setPending] = useState<PendingState>({});

  const commands = getCommandsForCategoria(equipamento.categoria);

  const handleSend = useCallback(
    async (groupTitle: string, button: CommandButton) => {
      const key = buttonKey(groupTitle, button);
      if (pending[key]) return;

      setPending((s) => ({ ...s, [key]: true }));
      const cmd: EquipamentoCommand = button.cmd;

      try {
        const result: CommandResult = await equipamentosApi.sendCommand(
          equipamento.id,
          cmd,
        );

        const summary =
          result.status === 'duplicate'
            ? `${button.label} · TON ja havia executado`
            : `${button.label} · ${result.msg || 'ok'}`;
        toast.success(summary, {
          description: `Latencia: ${result.latency_ms}ms`,
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const apiMsg =
          err?.response?.data?.error?.message ?? err?.response?.data?.message;
        let title = `Falha em ${button.label}`;
        let description = apiMsg ?? err?.message ?? 'Erro desconhecido';

        if (status === 504) {
          title = `${button.label} · TON nao respondeu`;
          description = 'Timeout — TON pode estar offline ou sem rede.';
        } else if (status === 502) {
          title = `${button.label} · TON recusou`;
        } else if (status === 403) {
          title = 'Sem permissao';
          description = 'Usuario sem permission equipamentos.comandar (logout/login resolve apos atualizacao recente).';
        } else if (status === 400) {
          title = `${button.label} · configuracao inconsistente`;
        }

        toast.error(title, { description });
      } finally {
        setPending((s) => ({ ...s, [key]: false }));
      }
    },
    [equipamento.id, pending],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{equipamento.nome}</DialogTitle>
          <DialogDescription>
            {equipamento.topico_mqtt ? (
              <span className="font-mono text-xs">
                topico_mqtt: {equipamento.topico_mqtt}
              </span>
            ) : (
              <span className="text-amber-600">
                Sem topico_mqtt configurado — comandos nao funcionarao.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!commands && (
          <div className="py-6 text-sm text-muted-foreground">
            Nao ha comandos cadastrados para a categoria{' '}
            <code className="font-mono">{equipamento.categoria ?? '(sem categoria)'}</code>.
            Adicione entradas em{' '}
            <code className="font-mono">commandRegistry.ts</code> para habilitar
            o envio de comandos para essa categoria.
          </div>
        )}

        {commands?.groups.map((group) => (
          <section key={group.title} className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold">{group.title}</h3>
              {group.description && (
                <p className="text-xs text-muted-foreground">{group.description}</p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {group.buttons.map((button) => {
                const key = buttonKey(group.title, button);
                const isPending = !!pending[key];
                const variant = button.variant ?? 'default';
                const useShadcnVariant =
                  variant === 'default' || variant === 'outline';

                return (
                  <Button
                    key={key}
                    type="button"
                    variant={useShadcnVariant ? variant : undefined}
                    size="sm"
                    disabled={isPending || !equipamento.topico_mqtt}
                    onClick={() => handleSend(group.title, button)}
                    title={button.hint}
                    className={
                      useShadcnVariant ? '' : variantClass[variant]
                    }
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                        {button.label}
                      </>
                    ) : (
                      button.label
                    )}
                  </Button>
                );
              })}
            </div>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
};
