import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpCircle, Cpu, Loader2, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { chavesCameras } from '../hooks/chaves';
import { CamerasService } from '../services/cameras.service';
import type { AgenteGlobal } from '../types';
import { agenteEmContato, versaoMaior } from '../utils/agentes';
import { mensagemErro } from '../utils/erros';
import { AcoesAparelho } from './config/AcoesAparelho';
import { VERDE_TEXTO } from './estilo-filtro';

type Filtro = 'todos' | 'online' | 'offline' | 'desatualizados';

/**
 * Configurações › Aparelhos (NEXON-108): todos os Raspberry de todas as usinas, para o administrador.
 * Versão, contato e câmeras de cada um; atualizar, reiniciar e ver registros pela internet (a API audita
 * cada pedido), e "Atualizar todos" para levar os desatualizados que estão online à versão publicada.
 */
export function AparelhosTodos() {
  const queryClient = useQueryClient();
  const lista = useQuery({
    queryKey: chavesCameras.agentesTodos,
    queryFn: () => CamerasService.todosAgentes(),
    refetchInterval: 30_000,
  });
  const disponivel = useQuery({
    queryKey: [...chavesCameras.tudo, 'atualizacao'],
    queryFn: () => CamerasService.atualizacaoDisponivel(),
    staleTime: 5 * 60_000,
  });
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [confirmar, setConfirmar] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const nova = disponivel.data?.versao ?? null;
  const itens = useMemo(() => {
    const agora = Date.now();
    return (lista.data ?? []).map((a) => ({
      a,
      online: agenteEmContato(a, agora),
      atrasado: !!nova && (!a.versao || versaoMaior(nova, a.versao)),
    }));
  }, [lista.data, nova]);

  const total = itens.length;
  const online = itens.filter((i) => i.online).length;
  const atrasados = itens.filter((i) => i.atrasado);
  const atualizaveis = atrasados.filter((i) => i.online);

  const termo = busca.trim().toLowerCase();
  const visiveis = itens.filter(({ a, online: on, atrasado }) => {
    if (filtro === 'online' && !on) return false;
    if (filtro === 'offline' && on) return false;
    if (filtro === 'desatualizados' && !atrasado) return false;
    if (!termo) return true;
    return [a.nome, a.unidade_nome, a.planta_nome, a.host, a.versao].some((t) => t?.toLowerCase().includes(termo));
  });

  const atualizarTodos = async () => {
    setConfirmar(false);
    setAtualizando(true);
    let ok = 0;
    const falhas: string[] = [];
    for (const { a } of atualizaveis) {
      try {
        await CamerasService.comandoAparelho(a.id, 'atualizar');
        ok++;
      } catch (e) {
        falhas.push(`${a.nome}: ${mensagemErro(e, 'não aceitou')}`);
      }
    }
    setAtualizando(false);
    if (ok) toast.success(`${ok} ${ok === 1 ? 'aparelho atualizando' : 'aparelhos atualizando'} para a versão ${nova}. Voltam em cerca de 1 minuto.`);
    if (falhas.length) toast.error(falhas.join(' · '));
    window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: chavesCameras.agentesTodos }), 60_000);
  };

  const FILTROS: { valor: Filtro; rotulo: string; n: number }[] = [
    { valor: 'todos', rotulo: 'Todos', n: total },
    { valor: 'online', rotulo: 'Online', n: online },
    { valor: 'offline', rotulo: 'Offline', n: total - online },
    { valor: 'desatualizados', rotulo: 'Desatualizados', n: atrasados.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Aparelhos" valor={total} />
        <Numero rotulo="Online" valor={online} destaque={online > 0} />
        <Numero rotulo="Offline" valor={total - online} aviso={total - online > 0} />
        <Numero rotulo={nova ? `Fora da ${nova}` : 'Desatualizados'} valor={atrasados.length} aviso={atrasados.length > 0} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por usina, planta, aparelho ou versão"
            className="h-11 pl-9"
            aria-label="Buscar aparelho"
          />
        </div>
        <div role="radiogroup" aria-label="Filtrar aparelhos" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              role="radio"
              aria-checked={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
              className={cn(
                'min-h-10 rounded-lg px-3 text-sm font-medium transition-colors',
                filtro === f.valor ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground mouse:hover:text-foreground',
              )}
            >
              {f.rotulo} <span className="tabular-nums text-muted-foreground">{f.n}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={() => void lista.refetch()} disabled={lista.isFetching}>
            <RefreshCw className={cn('h-4 w-4', lista.isFetching && 'animate-spin')} aria-hidden />
            Atualizar lista
          </Button>
          {nova && (
            <Button type="button" className="h-11 gap-1.5" disabled={!atualizaveis.length || atualizando} onClick={() => setConfirmar(true)}>
              {atualizando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUpCircle className="h-4 w-4" aria-hidden />}
              Atualizar todos ({atualizaveis.length})
            </Button>
          )}
        </div>
      </div>

      {lista.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : lista.isError ? (
        <div role="alert" className="rounded-xl border border-border p-6 text-sm">
          {mensagemErro(lista.error, 'Não foi possível carregar os aparelhos.')}
        </div>
      ) : !total ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
          <Cpu className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Nenhum aparelho instalado ainda</p>
          <p className="max-w-sm text-xs text-muted-foreground">Instale pela aba Câmeras da usina: Instalar Raspberry.</p>
        </div>
      ) : !visiveis.length ? (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Nenhum aparelho com esse filtro.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card" aria-label="Aparelhos">
          {visiveis.map(({ a, online: on, atrasado }) => (
            <LinhaAparelho key={a.id} a={a} online={on} atrasado={atrasado} />
          ))}
        </ul>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Atualizar {atualizaveis.length} {atualizaveis.length === 1 ? 'aparelho' : 'aparelhos'} para {nova}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cada um baixa a versão nova e reinicia sozinho (cerca de 1 minuto sem vídeo e sem alertas). Se a versão nova não subir,
              ele volta para a anterior. Os que estão offline ficam para depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void atualizarTodos();
              }}
            >
              Atualizar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Numero({ rotulo, valor, destaque = false, aviso = false }: { rotulo: string; valor: number; destaque?: boolean; aviso?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className={cn('text-2xl font-semibold tabular-nums', destaque && VERDE_TEXTO, aviso && 'text-amber-600 dark:text-amber-400')}>{valor}</span>
    </div>
  );
}

function LinhaAparelho({ a, online, atrasado }: { a: AgenteGlobal; online: boolean; atrasado: boolean }) {
  return (
    <li className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', online ? 'bg-nexon-verde' : 'bg-muted-foreground opacity-60')}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-semibold">
            {a.unidade_nome ?? 'Usina não encontrada'}
            {a.unidade_excluida && <span className="font-normal text-muted-foreground"> (usina excluída)</span>}
            <span className="font-normal text-muted-foreground"> · {a.nome}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[a.planta_nome, a.host, `${a.cameras} ${a.cameras === 1 ? 'câmera' : 'câmeras'}`].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs">
            <span className={online ? VERDE_TEXTO : 'text-muted-foreground'}>
              {online ? 'Online' : a.ultimo_contato_em ? `Offline · último contato ${tempoRelativo(a.ultimo_contato_em) ?? ''}` : 'Nunca se conectou'}
            </span>
            <span className="text-muted-foreground"> · versão </span>
            <span className={cn('font-medium tabular-nums', atrasado && 'text-amber-600 dark:text-amber-400')}>{a.versao ?? '?'}</span>
          </p>
        </div>
      </div>
      <div className="lg:shrink-0">
        <AcoesAparelho agente={a} admin online={online} />
      </div>
    </li>
  );
}
