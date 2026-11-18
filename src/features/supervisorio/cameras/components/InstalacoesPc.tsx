import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileText, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { tempoRelativo } from '@/features/supervisorio/sinoptico/utils/tempo';
import { cn } from '@/lib/utils';
import { chavesCameras } from '../hooks/chaves';
import { CamerasService } from '../services/cameras.service';
import type { InstalacaoPc } from '../types';
import { mensagemErro } from '../utils/erros';
import { VERDE_TEXTO } from './estilo-filtro';

/** Sem relato há 30 min, "em andamento" vira "parou sem avisar" (fechou o Terminal, desligou o computador). */
const PARADO_MS = 30 * 60_000;

/**
 * Configurações › Aparelhos das câmeras (NEXON-108): instalações feitas pelo computador. O instalador manda
 * o passo, o estado e o fim do registro do Terminal; aqui o administrador vê onde parou e lê o registro.
 */
export function InstalacoesPc() {
  const lista = useQuery({ queryKey: chavesCameras.instalacoesPc, queryFn: () => CamerasService.instalacoesPc(), refetchInterval: 15_000 });
  const [aberta, setAberta] = useState<InstalacaoPc | null>(null);
  const registro = useQuery({
    queryKey: [...chavesCameras.instalacoesPc, 'registro', aberta?.id],
    queryFn: () => CamerasService.registroInstalacao(aberta!.id),
    enabled: !!aberta,
  });

  const itens = lista.data ?? [];
  const agora = Date.now();

  return (
    <section aria-labelledby="instalacoes-pc-titulo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="instalacoes-pc-titulo" className="text-base font-semibold">
          Instalações pelo computador
        </h2>
        <p className="text-sm text-muted-foreground">Cada vez que alguém roda o comando do instalador: onde está, onde parou e o registro do Terminal.</p>
      </div>
      {lista.isPending ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : lista.isError ? (
        <p role="alert" className="rounded-xl border border-border p-4 text-sm">
          {mensagemErro(lista.error, 'Não foi possível carregar as instalações.')}
        </p>
      ) : !itens.length ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma instalação relatada ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card" aria-label="Instalações">
          {itens.map((i) => {
            const parada = i.estado === 'andamento' && agora - Date.parse(i.updated_at) > PARADO_MS;
            return (
              <li key={i.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                <Estado estado={i.estado} parada={parada} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-sm font-semibold">
                    {i.unidade_nome ?? 'Sem usina'}
                    <span className="font-normal text-muted-foreground">
                      {' · '}
                      {i.usuario_nome ?? 'alguém'} · {tempoRelativo(i.created_at) ?? ''}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[i.sistema, i.passo ? `passo ${i.passo}` : null].filter(Boolean).join(' · ')}
                  </p>
                  {i.mensagem && (
                    <p className={cn('text-sm', i.estado === 'erro' ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{i.mensagem}</p>
                  )}
                </div>
                {i.estado !== 'andamento' && (
                  <Button type="button" size="sm" variant="outline" className="h-10 shrink-0 gap-1.5 self-start sm:self-center" onClick={() => setAberta(i)}>
                    <FileText className="h-4 w-4" aria-hidden />
                    Ver registro
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="flex max-h-[85dvh] w-[min(920px,calc(100vw-2rem))] max-w-none flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Registro da instalação</DialogTitle>
            <DialogDescription>
              {[aberta?.unidade_nome, aberta?.usuario_nome, aberta?.sistema].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>
          {registro.isPending ? (
            <div role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando…
            </div>
          ) : (
            <pre className="min-h-[240px] flex-1 overflow-auto whitespace-pre-wrap rounded-lg bg-black p-3 font-mono text-xs leading-relaxed text-zinc-200">
              {registro.data || 'Sem registro.'}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Estado({ estado, parada }: { estado: string; parada: boolean }) {
  if (estado === 'ok')
    return (
      <span className={cn('flex w-36 shrink-0 items-center gap-1.5 text-sm font-semibold', VERDE_TEXTO)}>
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Deu certo
      </span>
    );
  if (estado === 'erro')
    return (
      <span className="flex w-36 shrink-0 items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
        <XCircle className="h-4 w-4" aria-hidden />
        Deu erro
      </span>
    );
  return (
    <span className={cn('flex w-36 shrink-0 items-center gap-1.5 text-sm font-semibold', parada ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
      {parada ? <XCircle className="h-4 w-4" aria-hidden /> : <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {parada ? 'Parou sem avisar' : 'Em andamento'}
    </span>
  );
}
