import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { tempoRelativo } from '@/features/supervisorio/sinoptico/utils/tempo';
import { cn } from '@/lib/utils';
import { chavesCameras } from '../../hooks/chaves';
import { useAgentesCameras } from '../../hooks/useConfigCameras';
import { CamerasService } from '../../services/cameras.service';
import type { Agente } from '../../types';
import { mensagemErro } from '../../utils/erros';

/** Agente sem contato há mais que isto aparece como parado. */
const LIMITE_PARADO_MS = 3 * 60_000;

/** Agentes da unidade: criar (mostra o token UMA vez), gerar token novo, remover. */
export function SecaoAgentes({ unidadeId }: { unidadeId: string }) {
  const agentes = useAgentesCameras(unidadeId);
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [tokenNovo, setTokenNovo] = useState<{ agente: string; token: string } | null>(null);
  const [gerarPara, setGerarPara] = useState<Agente | null>(null);
  const [remover, setRemover] = useState<Agente | null>(null);

  const invalidar = () => void queryClient.invalidateQueries({ queryKey: chavesCameras.agentes(unidadeId) });

  const criar = useMutation({
    mutationFn: (nomeAgente: string) => CamerasService.criarAgente({ unidade_id: unidadeId, nome: nomeAgente }),
    onSuccess: (r, nomeAgente) => {
      setTokenNovo({ agente: r.agente?.nome ?? nomeAgente, token: r.token });
      setNome('');
      setCriando(false);
      invalidar();
    },
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível criar o agente')),
  });

  const novoToken = useMutation({
    mutationFn: (a: Agente) => CamerasService.novoTokenAgente(a.id),
    onSuccess: (r, a) => {
      setTokenNovo({ agente: a.nome, token: r.token });
      setGerarPara(null);
      invalidar();
    },
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível gerar o token')),
  });

  const excluir = useMutation({
    mutationFn: (a: Agente) => CamerasService.removerAgente(a.id),
    onSuccess: () => {
      toast.success('Agente removido');
      setRemover(null);
      void queryClient.invalidateQueries({ queryKey: chavesCameras.tudo });
    },
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível remover o agente')),
  });

  const enviarNovo = (e: FormEvent) => {
    e.preventDefault();
    const n = nome.trim();
    if (!n) return;
    criar.mutate(n);
  };

  const lista = agentes.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {tokenNovo && <CaixaToken agente={tokenNovo.agente} token={tokenNovo.token} onFechar={() => setTokenNovo(null)} />}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {lista.length} {lista.length === 1 ? 'agente' : 'agentes'}
        </p>
        {!criando && (
          <Button type="button" size="sm" onClick={() => setCriando(true)}>
            <Plus aria-hidden />
            Novo agente
          </Button>
        )}
      </div>

      {criando && (
        <form onSubmit={enviarNovo} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="agente-nome" className="text-xs font-medium text-muted-foreground">
              Nome do agente
            </label>
            <Input id="agente-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Mini PC da cabine" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCriando(false)} disabled={criar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!nome.trim() || criar.isPending}>
              {criar.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Criar
            </Button>
          </div>
        </form>
      )}

      {agentes.isPending ? (
        <div role="status" aria-label="Carregando agentes" className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : agentes.isError ? (
        <p className="text-[13px] text-muted-foreground">{mensagemErro(agentes.error, 'Não foi possível carregar os agentes.')}</p>
      ) : lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">
          Nenhum agente. Crie um e instale o <code className="font-mono text-xs">nexon-camera-agent</code> na rede das câmeras.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((a) => {
            const contato = a.ultimo_contato_em ? Date.parse(a.ultimo_contato_em) : NaN;
            const vivo = !Number.isNaN(contato) && Date.now() - contato < LIMITE_PARADO_MS;
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span aria-label={vivo ? 'em contato' : 'sem contato'} className={cn('h-2 w-2 shrink-0 rounded-full', vivo ? 'bg-nexon-verde' : 'bg-zinc-500')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.ultimo_contato_em ? `Último contato ${tempoRelativo(a.ultimo_contato_em) ?? ''}` : 'Nunca se conectou'}
                    {a.host ? ` · ${a.host}` : ''}
                    {a.versao ? ` · v${a.versao}` : ''}
                    {` · ${a.cameras ?? 0} ${a.cameras === 1 ? 'câmera' : 'câmeras'}`}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Gerar token novo para ${a.nome}`} title="Token novo" onClick={() => setGerarPara(a)}>
                  <KeyRound aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${a.nome}`} title="Remover" onClick={() => setRemover(a)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!gerarPara} onOpenChange={(o) => !o && setGerarPara(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar token novo para {gerarPara?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O token atual deixa de valer na hora: o agente para de mandar eventos até você trocar o <code>NEXON_AGENTE_TOKEN</code> na máquina dele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={novoToken.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={novoToken.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (gerarPara) novoToken.mutate(gerarPara);
              }}
            >
              Gerar token
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!remover} onOpenChange={(o) => !o && setRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o agente {remover?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>As câmeras dele ficam sem agente (sem vídeo e sem detecção) até serem ligadas a outro.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluir.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (remover) excluir.mutate(remover);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** O token só aparece aqui, uma vez. */
function CaixaToken({ agente, token, onFechar }: { agente: string; token: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie.');
    }
  };
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-sm font-semibold">Token do agente {agente}</p>
      <p className="text-xs text-muted-foreground">
        Guarde agora: ele não aparece de novo. Cole em <code className="font-mono">NEXON_AGENTE_TOKEN</code> no <code className="font-mono">.env</code> do agente.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-md bg-background px-2 py-1.5 font-mono text-xs">{token}</code>
        <Button type="button" size="sm" variant="outline" onClick={() => void copiar()} aria-label="Copiar token">
          {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <Button type="button" size="sm" variant="ghost" className="self-end" onClick={onFechar}>
        Já guardei
      </Button>
    </div>
  );
}
