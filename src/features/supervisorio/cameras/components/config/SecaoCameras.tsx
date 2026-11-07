import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { chavesCameras } from '../../hooks/chaves';
import { useCamerasUnidade } from '../../hooks/useCamerasUnidade';
import { useAgentesCameras } from '../../hooks/useConfigCameras';
import { useEquipamentosUnidade } from '../../hooks/useEquipamentosPontos';
import { CamerasService } from '../../services/cameras.service';
import type { Camera } from '../../types';
import { mensagemErro } from '../../utils/erros';
import { FormCamera } from './FormCamera';

/** Lista + cadastro/edição/exclusão das câmeras da unidade (`cadastroTecnico`). */
export function SecaoCameras({ unidadeId, abrirNova }: { unidadeId: string; abrirNova?: boolean }) {
  const cameras = useCamerasUnidade(unidadeId);
  const agentes = useAgentesCameras(unidadeId);
  const equipamentos = useEquipamentosUnidade(unidadeId);
  const [editando, setEditando] = useState<Camera | 'nova' | null>(abrirNova ? 'nova' : null);
  const [excluindo, setExcluindo] = useState<Camera | null>(null);
  const queryClient = useQueryClient();

  const excluir = useMutation({
    mutationFn: (id: string) => CamerasService.excluir(id),
    onSuccess: () => {
      toast.success('Câmera excluída');
      setExcluindo(null);
      void queryClient.invalidateQueries({ queryKey: chavesCameras.tudo });
    },
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível excluir a câmera')),
  });

  const lista = cameras.data ?? [];
  const nomeAgente = (id: string | null) => (id ? agentes.data?.find((a) => a.id === id)?.nome : undefined);

  if (editando) {
    return (
      <FormCamera
        unidadeId={unidadeId}
        camera={editando === 'nova' ? null : editando}
        agentes={agentes.data ?? []}
        equipamentos={equipamentos.data ?? []}
        proximaOrdem={lista.reduce((m, c) => Math.max(m, c.ordem ?? 0), 0) + 1}
        onSalvo={() => setEditando(null)}
        onCancelar={() => setEditando(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {lista.length} {lista.length === 1 ? 'câmera' : 'câmeras'}
        </p>
        <Button type="button" size="sm" onClick={() => setEditando('nova')}>
          <Plus aria-hidden />
          Nova câmera
        </Button>
      </div>

      {cameras.isPending ? (
        <div role="status" aria-label="Carregando câmeras" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">
          Nenhuma câmera cadastrada.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <span
                aria-label={c.status === 'online' ? 'online' : 'offline'}
                className={cn('h-2 w-2 shrink-0 rounded-full', c.status === 'online' ? 'bg-nexon-verde' : 'bg-zinc-500')}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.ip}:{c.porta_rtsp} · canal {c.canal} · {nomeAgente(c.agente_id) ?? 'sem agente'}
                  {!c.analise?.ativa && ' · sem detecção'}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${c.nome}`} onClick={() => setEditando(c)}>
                <Pencil aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Excluir ${c.nome}`} onClick={() => setExcluindo(c)}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a câmera {excluindo?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela sai da grade e do agente. Os eventos antigos continuam no histórico da usina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluir.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (excluindo) excluir.mutate(excluindo.id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
