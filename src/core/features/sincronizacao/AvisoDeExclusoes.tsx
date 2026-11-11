import { useCallback, useEffect, useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/core/components/ui/sheet';
import { api } from '@/config/api';
import { toast } from '@/hooks/use-toast';
import { formatApiError } from '@/utils/api-error';
import { useUserStore } from '@/store/useUserStore';
import { OUTRO_PRODUTO } from './useSincronizacao';
import { descreverCompartilhados, nomeConfere, type AlcanceDoAviso } from './exclusao-compartilhada';

/** Um aviso de exclusão feita no outro produto (GET /sincronizacao/exclusoes) */
export interface AvisoDeExclusao {
  id: string;
  recurso: 'usuarios' | 'plantas' | 'unidades' | 'equipamentos';
  registro_id: string;
  nome: string | null;
  origem: string;
  apagado_em: string | null;
  apagado_por: string | null;
  recebido_em: string;
  /** Avisos do que fica debaixo deste (a decisão leva junto) */
  abaixo: number;
}

/** A resposta da lista: só os avisos de cima; `total` diz quantos há */
interface ListaDeAvisos {
  total: number;
  avisos: AvisoDeExclusao[];
}

const COMO_CHAMAR: Record<AvisoDeExclusao['recurso'], string> = {
  usuarios: 'Usuário',
  plantas: 'Planta',
  unidades: 'Instalação',
  equipamentos: 'Equipamento',
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** De 5 em 5 minutos: um aviso novo não é urgente, mas não pode esperar o F5 do dia seguinte */
const INTERVALO_MS = 5 * 60_000;

/** O corpo pode vir embrulhado pelo interceptor da API (`{ data: ... }`) */
const corpoDe = (data: unknown): unknown => (data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data);

function lerLista(data: unknown): ListaDeAvisos | null {
  const corpo = corpoDe(data) as Partial<ListaDeAvisos> | null;
  if (!corpo || !Array.isArray(corpo.avisos)) return null;
  return { total: typeof corpo.total === 'number' ? corpo.total : corpo.avisos.length, avisos: corpo.avisos };
}

function lerAlcance(data: unknown): AlcanceDoAviso | null {
  const corpo = corpoDe(data) as Partial<AlcanceDoAviso> | null;
  if (!corpo || typeof corpo.unidades !== 'number' || typeof corpo.equipamentos !== 'number' || !corpo.naoApagadosLa) return null;
  return corpo as AlcanceDoAviso;
}

/**
 * As exclusões feitas no outro produto, esperando decisão aqui (10/11/2026).
 *
 * A exclusão não atravessa sozinha: o registro fica aqui, deixa de ser
 * compartilhado, e este aviso pede a alguém que decida. Uma faixa no alto de
 * toda página para quem gerencia o compartilhamento; some quando não há nada.
 * Antes, a exclusão do Service chegava ao NexON como exclusão (em 26/10, 12 dias
 * depois), e usinas com TON ativa sumiram sem ninguém de lá ter decidido.
 *
 * Só os avisos de cima: a planta apagada lá manda um aviso para cada instalação
 * e equipamento dela, e a decisão sobre a planta vale para eles.
 */
export function AvisoDeExclusoes() {
  const podeDecidir = useUserStore((s) => s.hasPermission('sincronizacao.gerenciar'));
  const queryClient = useQueryClient();
  const [lista, setLista] = useState<ListaDeAvisos | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState(false);

  const buscar = useCallback(async () => {
    try {
      const { data } = await api.get('/sincronizacao/exclusoes');
      const lida = lerLista(data);
      if (!lida) throw new Error('a lista de avisos veio fora do formato');
      setLista(lida);
      setFalhou(false);
    } catch (error) {
      // A faixa diz que não conseguiu conferir. Antes o catch era vazio: com a rota fora do ar,
      // os avisos ficavam pendentes sem ninguém ver. Não derruba a página; a próxima rodada tenta de novo
      console.error('[AvisoDeExclusoes] não foi possível buscar os avisos de exclusão', error);
      setFalhou(true);
    }
  }, []);

  useEffect(() => {
    if (!podeDecidir) return;
    void buscar();
    const timer = window.setInterval(() => void buscar(), INTERVALO_MS);
    return () => window.clearInterval(timer);
  }, [podeDecidir, buscar]);

  const aposDecidir = useCallback(async () => {
    await buscar();
    // O que foi apagado sai das listas abertas agora, não daqui a 5 minutos (o staleTime)
    await queryClient.invalidateQueries();
  }, [buscar, queryClient]);

  if (!podeDecidir) return null;

  if (falhou && !lista?.total) {
    return (
      <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground" role="status">
        <span>Não foi possível conferir as exclusões feitas no {OUTRO_PRODUTO}.</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void buscar()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!lista || lista.total === 0) return null;

  const n = lista.total;
  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-4 py-2 text-sm" role="status">
        <span>
          {n === 1 ? `1 exclusão feita no ${OUTRO_PRODUTO} espera sua decisão.` : `${n} exclusões feitas no ${OUTRO_PRODUTO} esperam sua decisão.`}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={() => setAberto(true)}>
          Ver
        </Button>
      </div>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Exclusões no {OUTRO_PRODUTO}</SheetTitle>
            <SheetDescription>
              Estes registros foram apagados no {OUTRO_PRODUTO}. Aqui eles continuam e deixaram de ser compartilhados. Decida se apaga
              aqui também ou mantém só aqui; a decisão vale também para o que fica debaixo de cada um.
            </SheetDescription>
          </SheetHeader>
          {lista.avisos.length < n && (
            <p className="mt-4 text-xs text-muted-foreground">
              Os {lista.avisos.length} mais recentes de {n}.
            </p>
          )}
          <ul className="mt-4 divide-y divide-border">
            {lista.avisos.map((aviso) => (
              <LinhaDoAviso key={aviso.id} aviso={aviso} onDecidido={aposDecidir} />
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

interface LinhaDoAvisoProps {
  aviso: AvisoDeExclusao;
  onDecidido: () => Promise<void>;
}

/**
 * Um aviso. "Apagar aqui também" leva dois passos: o primeiro consulta o que vai
 * junto (instalações e equipamentos daqui, e quais deles não foram apagados lá), e
 * com algo debaixo pede o nome digitado, como excluir pela tela.
 */
function LinhaDoAviso({ aviso, onDecidido }: LinhaDoAvisoProps) {
  const idCampo = useId();
  const nome = aviso.nome ?? aviso.registro_id;
  const [confirmando, setConfirmando] = useState(false);
  const [alcance, setAlcance] = useState<AlcanceDoAviso | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [falhouAlcance, setFalhouAlcance] = useState(false);
  const [digitado, setDigitado] = useState('');
  const [decidindo, setDecidindo] = useState(false);

  const abrirConfirmacao = async () => {
    setConfirmando(true);
    setConferindo(true);
    setFalhouAlcance(false);
    setDigitado('');
    try {
      const { data } = await api.get(`/sincronizacao/exclusoes/${aviso.id}/alcance`);
      const lido = lerAlcance(data);
      if (!lido) throw new Error('o alcance veio fora do formato');
      setAlcance(lido);
    } catch (error) {
      // Sem saber o que vai junto, a confirmação pede o nome (o pior caso)
      console.error('[AvisoDeExclusoes] não foi possível conferir o que vai junto', error);
      setAlcance(null);
      setFalhouAlcance(true);
    } finally {
      setConferindo(false);
    }
  };

  const decidir = async (decisao: 'apagar' | 'manter') => {
    setDecidindo(true);
    try {
      const { data } = await api.post(`/sincronizacao/exclusoes/${aviso.id}/decisao`, { decisao });
      const r = corpoDe(data) as { apagados?: number; avisosFechados?: number } | null;
      const junto = r?.avisosFechados ?? 0;
      toast({
        // Neutro: "Planta apagada" e "Equipamento apagado" pedem gêneros diferentes
        title: `${decisao === 'apagar' ? 'Apagado aqui também' : 'Mantido só aqui'}: ${nome}`,
        description:
          decisao === 'apagar' && (r?.apagados ?? 0) > 1
            ? `${r?.apagados} registros, com o que ficava debaixo.`
            : decisao === 'manter' && junto > 0
              ? `Com o que fica debaixo (${junto} ${junto === 1 ? 'aviso' : 'avisos'} junto).`
              : undefined,
      });
      setConfirmando(false);
      await onDecidido();
    } catch (error) {
      toast({ title: 'Não foi possível registrar a decisão', description: formatApiError(error), variant: 'destructive' });
    } finally {
      setDecidindo(false);
    }
  };

  const vaiJunto = alcance ? alcance.unidades + alcance.equipamentos : 0;
  const soDaqui = alcance ? alcance.naoApagadosLa.unidades + alcance.naoApagadosLa.equipamentos : 0;
  const pedeNome = falhouAlcance || vaiJunto > 0;
  const podeApagar = !conferindo && !decidindo && (!pedeNome || nomeConfere(digitado, nome));

  return (
    <li className="space-y-2 py-3">
      <div>
        <p className="text-sm font-medium">{nome}</p>
        <p className="text-xs text-muted-foreground">
          {COMO_CHAMAR[aviso.recurso]} ·{' '}
          {aviso.apagado_em ? `exclusão no ${OUTRO_PRODUTO} em ${quando(aviso.apagado_em)}` : `aviso recebido em ${quando(aviso.recebido_em)}`}
          {aviso.apagado_por && ` por ${aviso.apagado_por}`}
        </p>
        {aviso.abaixo > 0 && (
          <p className="text-xs text-muted-foreground">
            Junto, {aviso.abaixo === 1 ? '1 aviso' : `${aviso.abaixo} avisos`} do que fica debaixo (instalações e equipamentos apagados lá).
          </p>
        )}
      </div>

      {confirmando ? (
        <div className="space-y-2 text-xs text-muted-foreground">
          {conferindo ? (
            <p className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Conferindo o que vai junto...
            </p>
          ) : (
            <>
              <p>
                Apaga aqui <span className="font-medium text-foreground">{nome}</span>
                {vaiJunto > 0 && alcance ? `, com ${descreverCompartilhados(alcance)} debaixo` : ''}.
              </p>
              {falhouAlcance && <p>Não foi possível conferir o que vai junto: o que fica debaixo sai também.</p>}
              {alcance && soDaqui > 0 && (
                <p className="flex items-start gap-2 text-foreground" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
                  <span>
                    Destes, {descreverCompartilhados(alcance.naoApagadosLa)}{' '}
                    {soDaqui === 1 ? 'existe só aqui ou continua' : 'existem só aqui ou continuam'} no {OUTRO_PRODUTO}
                    {alcance.naoApagadosLa.nomesDasInstalacoes.length > 0 && ` (${alcance.naoApagadosLa.nomesDasInstalacoes.join(', ')})`}: apagar é
                    decisão só daqui.
                  </span>
                </p>
              )}
              {pedeNome && (
                <>
                  <label htmlFor={idCampo} className="block text-foreground">
                    Para confirmar, digite o nome: <span className="font-medium">{nome}</span>
                  </label>
                  <Input id={idCampo} value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" />
                </>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="destructive" disabled={!podeApagar} onClick={() => decidir('apagar')}>
              {decidindo ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />}
              Confirmar
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={decidindo} onClick={() => setConfirmando(false)}>
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={decidindo} onClick={() => void abrirConfirmacao()}>
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
            Apagar aqui também
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={decidindo} onClick={() => decidir('manter')}>
            {decidindo ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="mr-1.5 h-4 w-4" aria-hidden />}
            Manter só aqui
          </Button>
        </div>
      )}
    </li>
  );
}
