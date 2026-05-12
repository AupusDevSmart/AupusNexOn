// src/features/supervisorio/v2/components/EquipamentoAcionarModal.tsx
// Modal de acionamento de pontos de um equipamento no Unifilar.
//
// Aberto ao clicar em equipamento com `automacao=true` no Unifilar V2.
// Carrega os pontos de tipo 'comando' do equipamento e renderiza um
// botao por ponto. Click pede confirmacao e dispara o acionamento.
//
// Layout: minimalista, dark/light, sem emojis, profissional, responsivo.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Power } from 'lucide-react';
import {
  equipamentoPontosApi,
  type EquipamentoPonto,
} from '@/services/equipamento-pontos.services';
import { acionarPontoApi } from '@/services/acionar-ponto.services';

export interface EquipamentoAcionarModalProps {
  open: boolean;
  onClose: () => void;
  equipamento: {
    id: string;
    nome: string;
  };
}

interface PendingState {
  /** Chave: ponto.id; valor: true enquanto acionamento em andamento. */
  [pontoId: string]: boolean;
}

export const EquipamentoAcionarModal: React.FC<EquipamentoAcionarModalProps> = ({
  open,
  onClose,
  equipamento,
}) => {
  const [loading, setLoading] = useState(false);
  const [pontos, setPontos] = useState<EquipamentoPonto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingState>({});
  const [pontoPendingConfirm, setPontoPendingConfirm] = useState<EquipamentoPonto | null>(
    null,
  );

  const carregar = useCallback(async () => {
    if (!equipamento.id) return;
    setLoading(true);
    setErro(null);
    try {
      const lista = await equipamentoPontosApi.list(equipamento.id);
      // Apenas pontos de tipo comando + ativos
      setPontos(lista.filter((p) => p.tipo === 'comando' && p.ativo));
    } catch (err) {
      setErro(extractMsg(err));
    } finally {
      setLoading(false);
    }
  }, [equipamento.id]);

  useEffect(() => {
    if (open) void carregar();
    else setPontoPendingConfirm(null);
  }, [open, carregar]);

  const handleClick = (ponto: EquipamentoPonto) => {
    setPontoPendingConfirm(ponto);
  };

  const handleConfirmar = useCallback(async () => {
    const ponto = pontoPendingConfirm;
    if (!ponto) return;
    setPontoPendingConfirm(null);
    setPending((s) => ({ ...s, [ponto.id]: true }));
    try {
      const result = await acionarPontoApi.acionar(equipamento.id, ponto.id);
      const subtitle =
        result.status === 'duplicate'
          ? `TON ja havia executado (${result.latency_ms}ms)`
          : `Pulso ${result.pulso_ms}ms · ack ${result.latency_ms}ms`;
      toast.success(`${ponto.nome.toUpperCase()} executado`, {
        description: `${result.comando_semantico} · ${subtitle}`,
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg =
        err?.response?.data?.error?.message ?? err?.response?.data?.message;
      let title = `Falha ao acionar "${ponto.nome}"`;
      let description = apiMsg ?? err?.message ?? 'Erro desconhecido';

      if (status === 504) {
        title = `TON nao respondeu`;
        description = 'Timeout — TON pode estar offline ou sem rede.';
      } else if (status === 502) {
        title = `TON recusou o comando`;
      } else if (status === 503) {
        title = `Broker MQTT desconectado`;
      } else if (status === 400) {
        title = `Configuracao incompleta`;
      } else if (status === 403) {
        title = 'Sem permissao';
        description =
          'Usuario sem permission equipamentos.acionar_ponto (logout/login se foi alterada recentemente).';
      }
      toast.error(title, { description });
    } finally {
      setPending((s) => {
        const next = { ...s };
        delete next[ponto.id];
        return next;
      });
    }
  }, [equipamento.id, pontoPendingConfirm]);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{equipamento.nome}</DialogTitle>
            <DialogDescription className="text-xs">
              Pontos de comando disponiveis. O acionamento dispara o pulso no TON
              mapeado para o ponto (configurado no editor IoT).
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando pontos...
            </div>
          ) : erro ? (
            <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {erro}
            </div>
          ) : pontos.length === 0 ? (
            <div className="rounded border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhum ponto de comando ativo cadastrado para este equipamento.
              <br />
              Configure no cadastro de equipamentos.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pontos.map((ponto) => {
                const isPending = !!pending[ponto.id];
                return (
                  <Button
                    key={ponto.id}
                    type="button"
                    variant="outline"
                    onClick={() => handleClick(ponto)}
                    disabled={isPending}
                    className="h-auto min-h-12 rounded dark:bg-black flex-col gap-0.5 py-2"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    <span className="text-xs font-mono normal-case">
                      {ponto.nome}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-modal de confirmacao */}
      <Dialog
        open={!!pontoPendingConfirm}
        onOpenChange={(v) => !v && setPontoPendingConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar acionamento</DialogTitle>
            <DialogDescription>
              Acionar o ponto{' '}
              <span className="font-mono font-semibold">
                {pontoPendingConfirm?.nome}
              </span>{' '}
              em{' '}
              <span className="font-semibold">{equipamento.nome}</span>?
              <br />
              <span className="text-xs text-muted-foreground">
                O TON mapeado vai executar o pulso no rele correspondente.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPontoPendingConfirm(null)}
              className="rounded dark:bg-black"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmar} className="rounded">
              Acionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

function extractMsg(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as {
      response?: { data?: { message?: string; error?: { message?: string } } };
      message?: string;
    };
    return (
      e.response?.data?.error?.message ??
      e.response?.data?.message ??
      e.message ??
      'Erro desconhecido'
    );
  }
  return 'Erro desconhecido';
}
