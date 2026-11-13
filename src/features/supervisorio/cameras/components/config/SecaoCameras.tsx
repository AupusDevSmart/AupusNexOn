import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Radar, Trash2 } from 'lucide-react';
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
import { useAgentesCameras, useDescobertasAgentes } from '../../hooks/useConfigCameras';
import { useEquipamentosUnidade } from '../../hooks/useEquipamentosPontos';
import { CamerasService } from '../../services/cameras.service';
import type { Camera } from '../../types';
import { agenteEmContato } from '../../utils/agentes';
import { mensagemErro } from '../../utils/erros';
import { rotuloFabricante } from '../../utils/sensibilidade';
import { FormCamera, type SugestaoCamera } from './FormCamera';

type Edicao = Camera | 'nova' | { sugestao: SugestaoCamera } | null;

/**
 * Câmeras encontradas na rede pelos aparelhos (NEXON-108) + lista e cadastro/edição/exclusão
 * das câmeras da unidade (`cadastroTecnico`).
 */
export function SecaoCameras({ unidadeId }: { unidadeId: string }) {
  const cameras = useCamerasUnidade(unidadeId);
  const agentes = useAgentesCameras(unidadeId);
  const equipamentos = useEquipamentosUnidade(unidadeId);
  const emContato = (agentes.data ?? []).filter((a) => agenteEmContato(a));
  const descobertas = useDescobertasAgentes(emContato);
  const [editando, setEditando] = useState<Edicao>(null);
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
        camera={editando === 'nova' || 'sugestao' in editando ? null : editando}
        sugestao={editando !== 'nova' && 'sugestao' in editando ? editando.sugestao : undefined}
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
      {descobertas.itens.length > 0 && (
        <section aria-labelledby="cameras-encontradas" className="flex flex-col gap-2">
          <h3 id="cameras-encontradas" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Radar className="h-3.5 w-3.5" aria-hidden />
            Câmeras encontradas
          </h3>
          <ul className="flex flex-col gap-2">
            {descobertas.itens.map(({ agente, descoberta: d }) => {
              const titulo = [rotuloFabricante(d.fabricante) ?? 'Câmera', d.modelo].filter(Boolean).join(' ');
              return (
                <li key={`${agente.id}-${d.ip}`} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {titulo} · {d.ip}
                    </p>
                    {d.inicializada === false ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Crie a senha da câmera em{' '}
                        <a href={`http://${d.ip}`} target="_blank" rel="noreferrer" className="font-mono underline underline-offset-2">
                          http://{d.ip}
                        </a>{' '}
                        antes
                      </p>
                    ) : (
                      <p className="truncate text-xs text-muted-foreground">Na rede do aparelho {agente.nome}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    aria-label={`Adicionar ${titulo} ${d.ip}`}
                    onClick={() => setEditando({ sugestao: { descoberta: d, agente } })}
                  >
                    <Plus aria-hidden />
                    Adicionar
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {lista.length} {lista.length === 1 ? 'câmera cadastrada' : 'câmeras cadastradas'}
        </p>
        <Button type="button" size="sm" variant={descobertas.itens.length > 0 ? 'outline' : 'default'} onClick={() => setEditando('nova')}>
          <Plus aria-hidden />
          Câmera pelo IP
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
          {emContato.length === 0
            ? 'Nenhuma câmera cadastrada. Adicione um aparelho na aba Aparelhos: ele procura as câmeras da rede sozinho.'
            : 'Nenhuma câmera cadastrada. As câmeras que o aparelho achar na rede aparecem aqui em até 5 minutos.'}
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
                  {c.ip}:{c.porta_rtsp} · canal {c.canal} · {nomeAgente(c.agente_id) ?? 'sem aparelho'}
                  {!c.analise?.ativa && ' · sem detecção de movimento'}
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
              Ela sai da grade e do aparelho. Os eventos antigos continuam no histórico da usina.
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
