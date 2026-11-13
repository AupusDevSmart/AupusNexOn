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
import { agenteEmContato } from '../../utils/agentes';
import { DialogAdicionarAparelho } from './DialogAdicionarAparelho';

/**
 * Aparelhos (agentes: Raspberry ou mini-PC) da unidade. O caminho normal é parear pelo
 * código (NEXON-108); criar com token copiado à mão fica em "Instalação manual".
 */
export function SecaoAgentes({ unidadeId, unidadeNome }: { unidadeId: string; unidadeNome?: string }) {
  const agentes = useAgentesCameras(unidadeId);
  const queryClient = useQueryClient();
  const [adicionando, setAdicionando] = useState(false);
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
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível criar o aparelho')),
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
      toast.success('Aparelho removido');
      setRemover(null);
      void queryClient.invalidateQueries({ queryKey: chavesCameras.tudo });
    },
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível remover o aparelho')),
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
          {lista.length} {lista.length === 1 ? 'aparelho' : 'aparelhos'}
        </p>
        <Button type="button" size="sm" onClick={() => setAdicionando(true)}>
          <Plus aria-hidden />
          Adicionar aparelho
        </Button>
      </div>

      {agentes.isPending ? (
        <div role="status" aria-label="Carregando aparelhos" className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : agentes.isError ? (
        <p className="text-[13px] text-muted-foreground">{mensagemErro(agentes.error, 'Não foi possível carregar os aparelhos.')}</p>
      ) : lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">
          Nenhum aparelho. Ligue o Raspberry (ou mini-PC) com a imagem do NexON na rede das câmeras e toque em Adicionar aparelho.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((a) => {
            const vivo = agenteEmContato(a);
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span role="img" aria-label={vivo ? 'online' : 'offline'} className={cn('h-2 w-2 shrink-0 rounded-full', vivo ? 'bg-nexon-verde' : 'bg-zinc-500')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {vivo ? 'Online' : a.ultimo_contato_em ? `Offline · último contato ${tempoRelativo(a.ultimo_contato_em) ?? ''}` : 'Nunca se conectou'}
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

      {criando ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Instalação manual: crie o aparelho, copie o token que aparece uma vez e cole em <code className="font-mono">NEXON_AGENTE_TOKEN</code> no{' '}
            <code className="font-mono">.env</code> do <code className="font-mono">nexon-camera-agent</code>.
          </p>
          <form onSubmit={enviarNovo} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="agente-nome" className="text-xs font-medium text-muted-foreground">
                Nome do aparelho
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
        </div>
      ) : (
        <Button type="button" variant="link" size="sm" className="h-auto self-start px-0 text-xs text-muted-foreground" onClick={() => setCriando(true)}>
          Instalação manual (avançado)
        </Button>
      )}

      <DialogAdicionarAparelho unidadeId={unidadeId} unidadeNome={unidadeNome} aberto={adicionando} onFechar={() => setAdicionando(false)} />

      <AlertDialog open={!!gerarPara} onOpenChange={(o) => !o && setGerarPara(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar token novo para {gerarPara?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O token atual deixa de valer na hora: o aparelho para de mandar eventos até você trocar o <code>NEXON_AGENTE_TOKEN</code> nele.
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
            <AlertDialogTitle>Remover o aparelho {remover?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>As câmeras dele ficam sem aparelho (sem vídeo e sem detecção) até serem ligadas a outro.</AlertDialogDescription>
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
      <p className="text-sm font-semibold">Token do aparelho {agente}</p>
      <p className="text-xs text-muted-foreground">
        Guarde agora: ele não aparece de novo. Cole em <code className="font-mono">NEXON_AGENTE_TOKEN</code> no <code className="font-mono">.env</code> do aparelho.
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
