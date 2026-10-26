import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { api } from '@/config/api';

/**
 * Acompanha o último OTA da TON até a confirmação (GET /equipamentos/:id/ota/ultima).
 * O backend registra cada OTA e avança o estado pelo `ota/status` da TON e pelo anúncio
 * de `status` quando ela volta: só é "confirmado" quando a TON anuncia a versão nova.
 */
type Estado = 'publicado' | 'baixando' | 'reiniciando' | 'confirmado' | 'falhou' | 'sem_resposta';

interface Execucao {
  id: string;
  estado: Estado;
  progresso: number;
  detalhe: string | null;
  versao_firmware: string | null;
  versao_anterior: string | null;
  criado_em: string;
  concluido_em: string | null;
}

const ABERTOS: Estado[] = ['publicado', 'baixando', 'reiniciando'];
const ORDEM: Estado[] = ['publicado', 'baixando', 'reiniciando', 'confirmado'];
const ROTULO: Record<string, string> = {
  publicado: 'Comando enviado à TON',
  baixando: 'Baixando o firmware',
  reiniciando: 'Gravado — reiniciando',
  confirmado: 'TON de volta com a versão nova',
};

export function AcompanhamentoOta({ equipamentoId, onTerminar }: { equipamentoId: string; onTerminar?: (ok: boolean) => void }) {
  const [ex, setEx] = useState<Execucao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const consultar = async () => {
      try {
        const r: any = await api.get(`/equipamentos/${encodeURIComponent(equipamentoId.trim())}/ota/ultima`);
        const d = r?.data?.data ?? r?.data;
        const e: Execucao | null = d?.execucao ?? null;
        if (!vivo) return;
        setEx(e);
        setErro(null);
        if (e && !ABERTOS.includes(e.estado)) { onTerminar?.(e.estado === 'confirmado'); return; }
      } catch {
        if (vivo) setErro('Não foi possível consultar o andamento — tentando de novo.');
      }
      if (vivo) timer = setTimeout(consultar, 3000);
    };
    void consultar();
    return () => { vivo = false; if (timer) clearTimeout(timer); };
  }, [equipamentoId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ex) {
    return <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando o registro do OTA…</div>;
  }

  const idxAtual = ORDEM.indexOf(ex.estado);
  const falhou = ex.estado === 'falhou' || ex.estado === 'sem_resposta';

  return (
    <div className="rounded-md border p-3 space-y-2" aria-live="polite">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Andamento do OTA</div>
      <ol className="space-y-1.5">
        {ORDEM.map((etapa, i) => {
          const feita = !falhou ? i < idxAtual || ex.estado === 'confirmado' : i < Math.max(idxAtual, 0);
          const atual = !falhou && i === idxAtual && ex.estado !== 'confirmado';
          return (
            <li key={etapa} className="flex items-center gap-2 text-sm">
              {feita ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : atual ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                : <Circle className="h-4 w-4 text-muted-foreground/40" />}
              <span className={feita || atual ? '' : 'text-muted-foreground'}>
                {ROTULO[etapa]}
                {etapa === 'baixando' && (atual || feita) && ` · ${ex.estado === 'baixando' ? ex.progresso : 100}%`}
              </span>
            </li>
          );
        })}
      </ol>
      {ex.estado === 'baixando' && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${ex.progresso}%` }} />
        </div>
      )}
      {ex.estado === 'confirmado' && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
          Confirmado: a TON está rodando {ex.versao_firmware ?? 'a versão nova'}.
          {ex.versao_anterior && ex.versao_anterior !== ex.versao_firmware && <span className="font-normal text-muted-foreground"> (antes: {ex.versao_anterior})</span>}
        </p>
      )}
      {ex.estado === 'falhou' && (
        <p className="text-sm text-red-600 flex items-start gap-1.5"><XCircle className="h-4 w-4 mt-0.5 shrink-0" /> Falhou: {ex.detalhe ?? 'erro na TON'}</p>
      )}
      {ex.estado === 'sem_resposta' && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Sem resposta da TON em 15 min. Se ela estava offline, o comando expira em 3 min — dispare de novo com a TON online.
        </p>
      )}
      {ABERTOS.includes(ex.estado) && (
        <p className="text-[11px] text-muted-foreground">Leva de 1 a 3 min. Pode fechar esta janela: o resultado fica registrado.</p>
      )}
      {erro && <p className="text-[11px] text-amber-600">{erro}</p>}
    </div>
  );
}

export default AcompanhamentoOta;
