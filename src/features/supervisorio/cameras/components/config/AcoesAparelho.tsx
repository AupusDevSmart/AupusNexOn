import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpCircle, FileText, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { chavesCameras } from '../../hooks/chaves';
import { CamerasService } from '../../services/cameras.service';
import type { Agente, EstadoComandoAparelho } from '../../types';
import { versaoMaior } from '../../utils/agentes';
import { mensagemErro } from '../../utils/erros';

type Tipo = 'atualizar' | 'reiniciar' | 'logs';
const FIM = new Set(['ok', 'erro', 'expirado']);

/**
 * Ações do aparelho pela web (NEXON-108): Atualizar para a versão publicada e Reiniciar (admin), Ver registros
 * (últimas linhas do log). O pedido acorda o aparelho na hora; a tela acompanha até a resposta (ou 3 min).
 */
export function AcoesAparelho({ agente, admin, online }: { agente: Agente; admin: boolean; online: boolean }) {
  const queryClient = useQueryClient();
  const disponivel = useQuery({
    queryKey: [...chavesCameras.tudo, 'atualizacao'],
    queryFn: () => CamerasService.atualizacaoDisponivel(),
    staleTime: 5 * 60_000,
  });
  const [confirmar, setConfirmar] = useState<Tipo | null>(null);
  const [acompanhando, setAcompanhando] = useState<{ id: string; tipo: Tipo } | null>(null);
  const [registros, setRegistros] = useState<string[] | null>(null);

  const pedir = useMutation({
    mutationFn: (tipo: Tipo) => CamerasService.comandoAparelho(agente.id, tipo),
    onSuccess: (r, tipo) => {
      setAcompanhando({ id: r.id, tipo });
      setConfirmar(null);
      if (tipo === 'logs') setRegistros([]);
    },
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível falar com o aparelho')),
  });

  const estado = useQuery<EstadoComandoAparelho>({
    queryKey: [...chavesCameras.tudo, 'comando-aparelho', acompanhando?.id],
    queryFn: () => CamerasService.estadoComandoAparelho(agente.id, acompanhando!.id),
    enabled: !!acompanhando,
    refetchInterval: (q) => (q.state.data && FIM.has(q.state.data.estado) ? false : 1500),
  });

  useEffect(() => {
    const e = estado.data;
    if (!acompanhando || !e || !FIM.has(e.estado)) return;
    const { tipo } = acompanhando;
    setAcompanhando(null);
    if (e.estado === 'expirado') {
      toast.error('O aparelho não respondeu. Ele está ligado e com internet?');
      if (tipo === 'logs') setRegistros(null);
      return;
    }
    if (e.estado === 'erro') {
      toast.error(e.erro || 'O aparelho recusou o pedido');
      if (tipo === 'logs') setRegistros(null);
      return;
    }
    if (tipo === 'logs') setRegistros(e.resultado?.linhas ?? []);
    else if (tipo === 'reiniciar') toast.success('Aparelho reiniciando. Volta em cerca de 30 segundos.');
    else if (e.resultado?.ja_atualizado) toast.success('O aparelho já está na versão mais nova.');
    else toast.success(`Atualizando para a versão ${e.resultado?.para ?? ''}. Volta em cerca de 1 minuto.`);
    if (tipo !== 'logs') window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: chavesCameras.agentes(agente.unidade_id) }), 45_000);
  }, [estado.data, acompanhando, agente.unidade_id, queryClient]);

  const nova = disponivel.data?.versao;
  const temNova = !!nova && (!agente.versao || versaoMaior(nova, agente.versao));
  const ocupado = (t: Tipo) => (pedir.isPending && pedir.variables === t) || acompanhando?.tipo === t;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {admin && temNova && (
        <Button type="button" size="sm" className="h-9 gap-1.5 touch:h-11" disabled={!online || !!acompanhando} onClick={() => setConfirmar('atualizar')}>
          {ocupado('atualizar') ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUpCircle className="h-4 w-4" aria-hidden />}
          Atualizar para {nova}
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5 touch:h-11" disabled={!online || !!acompanhando} onClick={() => pedir.mutate('logs')}>
        {ocupado('logs') ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
        Ver registros
      </Button>
      {admin && (
        <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5 touch:h-11" disabled={!online || !!acompanhando} onClick={() => setConfirmar('reiniciar')}>
          {ocupado('reiniciar') ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
          Reiniciar
        </Button>
      )}
      {!online && <span className="text-xs text-muted-foreground">Ações liberam quando o aparelho estiver online.</span>}

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar === 'atualizar' ? `Atualizar "${agente.nome}" para ${nova}?` : `Reiniciar "${agente.nome}"?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === 'atualizar'
                ? `O aparelho baixa a versão ${nova} e reinicia sozinho (cerca de 1 minuto sem vídeo e sem alertas). Se a versão nova não subir, ele volta para a anterior.`
                : 'O vídeo e os alertas param por cerca de 30 segundos. A gravação do histórico continua de onde parou.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmar) pedir.mutate(confirmar);
              }}
            >
              {confirmar === 'atualizar' ? 'Atualizar' : 'Reiniciar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={registros !== null} onOpenChange={(o) => !o && setRegistros(null)}>
        <DialogContent className="flex max-h-[85dvh] w-[min(920px,calc(100vw-2rem))] max-w-none flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Registros de {agente.nome}</DialogTitle>
            <DialogDescription>Últimas linhas do aparelho{agente.versao ? ` · versão ${agente.versao}` : ''}.</DialogDescription>
          </DialogHeader>
          {acompanhando?.tipo === 'logs' ? (
            <div role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Pedindo ao aparelho…
            </div>
          ) : (
            <>
              <pre className="min-h-[240px] flex-1 overflow-auto rounded-lg bg-black p-3 font-mono text-xs leading-relaxed text-zinc-200">
                {(registros ?? []).length ? (registros ?? []).join('\n') : 'Nada registrado ainda.'}
              </pre>
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => pedir.mutate('logs')} disabled={pedir.isPending}>
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Atualizar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
