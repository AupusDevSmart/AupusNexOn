import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatarDataHoraBR } from '@/lib/utils/date-formatters';
import { formatApiError } from '@/utils/api-error';
import { FaltaEnergiaService, type FaltaEnergiaEvento, type StatusFaltaEnergia } from './services';

/** Enquanto o robô trabalha, relê a cada 15 s (o protocolo chega sozinho). */
const EM_CURSO: StatusFaltaEnergia[] = ['AGUARDANDO', 'ENVIANDO', 'NO_ROBO'];

const COR: Record<StatusFaltaEnergia, string> = {
  AGUARDANDO: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ENVIANDO: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  NO_ROBO: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  PROTOCOLO: 'bg-nexon-verde/15 text-nexon-link-claro dark:text-nexon-verde',
  CANCELADO: 'bg-muted text-muted-foreground',
  SEM_DADOS: 'bg-destructive/15 text-destructive',
  FALHOU: 'bg-destructive/15 text-destructive',
};

/**
 * Bloco "WhatsApp da concessionária" no detalhe do chamado de falta de energia (NEXON-145):
 * em que pé está o robô, UC enviada, protocolo e, se falhou, o motivo e o botão Reenviar.
 * Não aparece em chamado que não veio de aviso de falta.
 */
export function FaltaEnergiaPainel({ chamadoId, onAtualizou }: { chamadoId: string; onAtualizou?: () => void }) {
  const [ev, setEv] = useState<FaltaEnergiaEvento | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(() => {
    FaltaEnergiaService.doChamado(chamadoId)
      .then(setEv)
      .catch(() => setEv(null));
  }, [chamadoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!ev || !EM_CURSO.includes(ev.status)) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') carregar();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [ev, carregar]);

  if (!ev) return null;

  const reenviar = async () => {
    setEnviando(true);
    try {
      setEv(await FaltaEnergiaService.reenviar(ev.id));
      toast.success('Reenviado ao WhatsApp da concessionária');
      onAtualizou?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setEnviando(false);
    }
  };

  const podeReenviar = ev.status === 'FALHOU' || ev.status === 'SEM_DADOS';

  return (
    <section className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">WhatsApp da concessionária</h3>
        <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', COR[ev.status])}>{ev.status_rotulo}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Aviso</dt>
        <dd>
          {ev.origem === 'TON' ? 'TON' : (ev.autor_nome ?? 'Manual')} · {formatarDataHoraBR(ev.inicio_em)}
          {ev.avisos > 1 && <span className="text-muted-foreground"> · {ev.avisos} avisos</span>}
        </dd>
        <dt className="text-muted-foreground">UC</dt>
        <dd>{ev.uc ?? '—'}</dd>
        {ev.concessionaria && (
          <>
            <dt className="text-muted-foreground">Concessionária</dt>
            <dd>{ev.concessionaria}</dd>
          </>
        )}
        {ev.protocolo && (
          <>
            <dt className="text-muted-foreground">Protocolo</dt>
            <dd className="font-medium">{ev.protocolo}</dd>
          </>
        )}
        {ev.fim_em && (
          <>
            <dt className="text-muted-foreground">Energia voltou</dt>
            <dd>{formatarDataHoraBR(ev.fim_em)}</dd>
          </>
        )}
      </dl>
      {ev.status === 'NO_ROBO' && (
        <p className="text-xs text-muted-foreground">
          O robô está conversando com a concessionária. Se ele travar, um atendente do WhatsAupus termina e o protocolo aparece aqui.
        </p>
      )}
      {podeReenviar && (
        <>
          {ev.ultimo_erro && <p className="text-xs text-destructive">{ev.ultimo_erro}</p>}
          <div className="flex justify-end">
            <button className="btn-minimal-outline" onClick={reenviar} disabled={enviando}>
              {enviando ? 'Reenviando…' : 'Reenviar'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
