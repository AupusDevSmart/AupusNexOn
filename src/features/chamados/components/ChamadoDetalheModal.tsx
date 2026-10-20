import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatarDataHoraBR } from '@/lib/utils/date-formatters';
import { formatApiError } from '@/utils/api-error';
import { cn } from '@/lib/utils';
import { ChamadosService } from '../services';
import {
  DESTINO_ROTULO,
  ENCAMINHAMENTO_ROTULO,
  MOTIVO_ROTULO,
  PRIORIDADE_ROTULO,
  type Chamado,
  type DestinoChamado,
} from '../types';
import { SeloStatus } from './SeloStatus';

type Painel = null | 'encaminhar' | 'fechar';

export function ChamadoDetalheModal({
  chamadoId,
  onClose,
  onMudou,
}: {
  chamadoId: string | null;
  onClose: () => void;
  onMudou: () => void;
}) {
  const [c, setC] = useState<Chamado | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const [destino, setDestino] = useState<DestinoChamado>('WHATSAPP');
  const [contato, setContato] = useState('');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setC(null);
    setPainel(null);
    if (!chamadoId) return;
    ChamadosService.detalhe(chamadoId)
      .then(setC)
      .catch((e) => toast.error(formatApiError(e)));
  }, [chamadoId]);

  // Contato padrão = o do proprietário da planta; pode ser trocado.
  useEffect(() => {
    const p = c?.contatos_proprietario;
    setContato(destino === 'EMAIL' ? (p?.email ?? '') : destino === 'WHATSAPP' ? (p?.whatsapp ?? '') : '');
  }, [destino, c?.contatos_proprietario]);

  const agir = async (fn: () => Promise<Chamado>, ok: string) => {
    setSalvando(true);
    try {
      const novo = await fn();
      setC(novo);
      setPainel(null);
      setObservacao('');
      setMotivo('');
      toast.success(ok);
      onMudou();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSalvando(false);
    }
  };

  const fechado = c?.status === 'FECHADO';

  return (
    <Dialog open={!!chamadoId} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {c ? `Chamado #${c.numero}` : 'Chamado'}
            {c && <SeloStatus status={c.status} />}
          </DialogTitle>
          <DialogDescription>{c?.titulo ?? 'Carregando…'}</DialogDescription>
        </DialogHeader>

        {c && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Campo rotulo="Equipamento" valor={c.equipamento_nome ?? c.equipamento_id} />
              <Campo rotulo="Local" valor={[c.planta_nome, c.unidade_nome].filter(Boolean).join(' · ') || '—'} />
              <Campo rotulo="Motivo" valor={MOTIVO_ROTULO[c.motivo]} />
              <Campo rotulo="Prioridade" valor={PRIORIDADE_ROTULO[c.prioridade]} />
              <Campo rotulo="Aberto por" valor={`${c.autor_nome ?? '—'} · ${c.canal === 'APP' ? 'app' : 'web'}`} />
              <Campo rotulo="Aberto em" valor={formatarDataHoraBR(c.created_at)} />
            </dl>

            <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3">{c.descricao}</p>

            {fechado && (
              <div className="rounded-md border border-border p-3">
                <p className="font-medium">
                  Fechado por {c.fechado_por_nome ?? '—'} em {c.fechado_em ? formatarDataHoraBR(c.fechado_em) : '—'}
                </p>
                <p className="text-muted-foreground">{c.motivo_fechamento}</p>
              </div>
            )}

            <section className="space-y-2">
              <h3 className="font-semibold">Encaminhamentos</h3>
              {c.encaminhamentos.length === 0 && <p className="text-muted-foreground">Ainda não encaminhado.</p>}
              {c.encaminhamentos.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
                  <div>
                    <p className="font-medium">
                      {DESTINO_ROTULO[e.destino]}
                      {e.contato ? ` · ${e.contato}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.autor_nome ?? '—'} em {formatarDataHoraBR(e.created_at)}
                      {e.observacao ? ` · ${e.observacao}` : ''}
                    </p>
                    {e.ultimo_erro && e.status !== 'ENVIADO' && <p className="text-xs text-destructive">{e.ultimo_erro}</p>}
                  </div>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-medium',
                      e.status === 'ENVIADO' && 'bg-nexon-verde/15 text-nexon-link-claro dark:text-nexon-verde',
                      e.status === 'FALHOU' && 'bg-destructive/15 text-destructive',
                      (e.status === 'PENDENTE' || e.status === 'AGUARDANDO_INTEGRACAO') && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {ENCAMINHAMENTO_ROTULO[e.status]}
                  </span>
                </div>
              ))}
            </section>

            {!fechado && painel === null && (
              <div className="flex flex-wrap justify-end gap-2">
                <button className="btn-minimal-outline" onClick={() => setPainel('fechar')}>
                  Fechar chamado
                </button>
                <button className="btn-minimal-primary" onClick={() => setPainel('encaminhar')}>
                  Encaminhar
                </button>
              </div>
            )}

            {painel === 'encaminhar' && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <h3 className="font-semibold">Encaminhar</h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DESTINO_ROTULO) as DestinoChamado[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDestino(d)}
                      className={cn(destino === d ? 'btn-minimal-primary' : 'btn-minimal-outline')}
                    >
                      {DESTINO_ROTULO[d]}
                    </button>
                  ))}
                </div>
                {destino !== 'SMART_SERVICE' ? (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{destino === 'EMAIL' ? 'E-mail' : 'WhatsApp (DDD + número)'}</label>
                    <Input value={contato} onChange={(e) => setContato(e.target.value)} />
                    {c.contatos_proprietario && (
                      <p className="text-xs text-muted-foreground">Padrão: contato de {c.contatos_proprietario.nome} (proprietário)</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Vai para a fila do Smart Service. Enquanto a integração não estiver ligada, fica aguardando e sai sozinho
                    depois.
                  </p>
                )}
                <Textarea
                  value={observacao}
                  rows={2}
                  maxLength={1000}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Observação para quem recebe (opcional)"
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-minimal-outline" onClick={() => setPainel(null)} disabled={salvando}>
                    Cancelar
                  </button>
                  <button
                    className="btn-minimal-primary"
                    disabled={salvando || (destino !== 'SMART_SERVICE' && !contato.trim())}
                    onClick={() =>
                      agir(
                        () =>
                          ChamadosService.encaminhar(c.id, {
                            destino,
                            contato: destino === 'SMART_SERVICE' ? undefined : contato,
                            observacao: observacao || undefined,
                          }),
                        `Encaminhado para ${DESTINO_ROTULO[destino]}`,
                      )
                    }
                  >
                    {salvando ? 'Encaminhando…' : 'Encaminhar'}
                  </button>
                </div>
              </section>
            )}

            {painel === 'fechar' && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <h3 className="font-semibold">Fechar chamado</h3>
                <Textarea
                  value={motivo}
                  rows={2}
                  maxLength={500}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="O que foi feito ou por que está sendo fechado"
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-minimal-outline" onClick={() => setPainel(null)} disabled={salvando}>
                    Cancelar
                  </button>
                  <button
                    className="btn-minimal-primary"
                    disabled={salvando || !motivo.trim()}
                    onClick={() => agir(() => ChamadosService.fechar(c.id, motivo), `Chamado #${c.numero} fechado`)}
                  >
                    {salvando ? 'Fechando…' : 'Fechar chamado'}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
