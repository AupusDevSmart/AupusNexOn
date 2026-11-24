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
  estaEncerrado,
  MOTIVO_ROTULO,
  PRIORIDADE_ROTULO,
  STATUS_EXTERNO,
  STATUS_ROTULO,
  type Atualizacao,
  type Chamado,
  type DestinoChamado,
  type StatusExterno,
} from '../types';
import { deInputLocal, duracaoDoChamado, formatarDuracao, paraInputLocal } from '../utils/datas';
import { SeloStatus } from './SeloStatus';
import { FaltaEnergiaPainel } from '../falta-energia/FaltaEnergiaPainel';

type Painel = null | 'encaminhar' | 'fechar' | 'status' | 'nota' | 'excluir';

export function ChamadoDetalheModal({
  chamadoId,
  onClose,
  onMudou,
  onEditar,
  versao = 0,
}: {
  /** Muda depois de editar fora do modal: relê o chamado. */
  versao?: number;
  chamadoId: string | null;
  onClose: () => void;
  onMudou: () => void;
  onEditar: (c: Chamado) => void;
}) {
  const [c, setC] = useState<Chamado | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const [destino, setDestino] = useState<DestinoChamado>('WHATSAPP');
  const [contato, setContato] = useState('');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [novoStatus, setNovoStatus] = useState<StatusExterno>('EM_ANDAMENTO');
  const [quando, setQuando] = useState('');
  const [texto, setTexto] = useState('');

  useEffect(() => {
    setC(null);
    setPainel(null);
    if (!chamadoId) return;
    ChamadosService.detalhe(chamadoId)
      .then(setC)
      .catch((e) => toast.error(formatApiError(e)));
  }, [chamadoId, versao]);

  const abrirStatus = (s: StatusExterno) => {
    setNovoStatus(s);
    setQuando(paraInputLocal(new Date().toISOString()));
    setTexto('');
    setPainel('status');
  };

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
      setTexto('');
      toast.success(ok);
      onMudou();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSalvando(false);
    }
  };

  const fechado = c?.status === 'FECHADO';
  const externo = c?.tipo === 'EXTERNO';
  const encerrado = c ? estaEncerrado(c.status) : false;

  const excluir = async () => {
    if (!c) return;
    setSalvando(true);
    try {
      await ChamadosService.excluir(c.id, motivo.trim());
      toast.success(`Chamado #${c.numero} excluído`);
      onMudou();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSalvando(false);
    }
  };

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
            {externo && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border p-3 sm:grid-cols-3">
                <Campo rotulo="Aberto com" valor={c.orgao ?? '—'} />
                <Campo rotulo="Protocolo" valor={c.protocolo || '—'} copiavel={!!c.protocolo} />
                <Campo rotulo={encerrado ? 'Duração' : 'Aberto há'} valor={formatarDuracao(duracaoDoChamado(c))} />
                <Campo rotulo="Início do problema" valor={c.ocorrencia_em ? formatarDataHoraBR(c.ocorrencia_em) : '—'} />
                <Campo rotulo="Aberto no órgão" valor={c.aberto_em ? formatarDataHoraBR(c.aberto_em) : '—'} />
                <Campo
                  rotulo="Previsão"
                  valor={c.previsao_em ? formatarDataHoraBR(c.previsao_em) : '—'}
                  alerta={!encerrado && !!c.previsao_em && new Date(c.previsao_em).getTime() < Date.now()}
                />
              </dl>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Campo rotulo="Equipamento" valor={c.equipamento_nome ?? (externo ? '—' : (c.equipamento_id ?? '—'))} />
              <Campo rotulo="Local" valor={[c.planta_nome, c.unidade_nome].filter(Boolean).join(' · ') || '—'} />
              <Campo rotulo="Motivo" valor={MOTIVO_ROTULO[c.motivo] ?? c.motivo} />
              <Campo rotulo="Prioridade" valor={PRIORIDADE_ROTULO[c.prioridade]} />
              <Campo rotulo="Registrado por" valor={`${c.autor_nome ?? '—'} · ${c.canal === 'APP' ? 'app' : 'web'}`} />
              <Campo rotulo="Registrado em" valor={formatarDataHoraBR(c.created_at)} />
            </dl>

            <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3">{c.descricao}</p>

            {encerrado && (
              <div className="rounded-md border border-border p-3">
                <p className="font-medium">
                  {STATUS_ROTULO[c.status]} por {c.fechado_por_nome ?? '—'} em {c.fechado_em ? formatarDataHoraBR(c.fechado_em) : '—'}
                </p>
                {c.motivo_fechamento && <p className="text-muted-foreground">{c.motivo_fechamento}</p>}
              </div>
            )}

            {!externo && (
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
            )}

            {externo && c.motivo === 'FALTA_ENERGIA' && <FaltaEnergiaPainel chamadoId={c.id} />}

            <LinhaDoTempo itens={c.atualizacoes ?? []} />

            {painel === null && (
              <div className="flex flex-wrap justify-end gap-2">
                <button className="btn-minimal-outline mr-auto text-destructive" onClick={() => { setMotivo(''); setPainel('excluir'); }}>
                  Excluir
                </button>
                {(externo || !fechado) && (
                  <button className="btn-minimal-outline" onClick={() => onEditar(c)}>
                    Editar
                  </button>
                )}
                <button className="btn-minimal-outline" onClick={() => { setTexto(''); setPainel('nota'); }}>
                  Anotar
                </button>
                {!externo && !fechado && (
                  <>
                    <button className="btn-minimal-outline" onClick={() => setPainel('fechar')}>
                      Fechar chamado
                    </button>
                    <button className="btn-minimal-primary" onClick={() => setPainel('encaminhar')}>
                      Encaminhar
                    </button>
                  </>
                )}
                {externo && c.status === 'ABERTO' && (
                  <button className="btn-minimal-outline" onClick={() => abrirStatus('EM_ANDAMENTO')}>
                    Em andamento
                  </button>
                )}
                {externo && !encerrado && (
                  <button className="btn-minimal-primary" onClick={() => abrirStatus('RESOLVIDO')}>
                    Marcar resolvido
                  </button>
                )}
                {externo && encerrado && (
                  <button className="btn-minimal-outline" onClick={() => abrirStatus('ABERTO')}>
                    Reabrir
                  </button>
                )}
              </div>
            )}

            {painel === 'status' && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <h3 className="font-semibold">Mudar status</h3>
                <div className="flex flex-wrap gap-2">
                  {STATUS_EXTERNO.filter((s) => s !== c.status).map((s) => (
                    <button
                      key={s}
                      onClick={() => setNovoStatus(s)}
                      className={cn(novoStatus === s ? 'btn-minimal-primary' : 'btn-minimal-outline')}
                    >
                      {STATUS_ROTULO[s]}
                    </button>
                  ))}
                </div>
                {(novoStatus === 'RESOLVIDO' || novoStatus === 'CANCELADO') && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{novoStatus === 'RESOLVIDO' ? 'Resolvido em' : 'Cancelado em'}</label>
                    <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="text-base sm:text-sm" />
                  </div>
                )}
                <Textarea
                  value={texto}
                  rows={2}
                  maxLength={2000}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={novoStatus === 'RESOLVIDO' ? 'Ex.: Equatorial religou a rede às 17h40' : 'Observação (opcional)'}
                  className="text-base sm:text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-minimal-outline" onClick={() => setPainel(null)} disabled={salvando}>
                    Cancelar
                  </button>
                  <button
                    className="btn-minimal-primary"
                    disabled={salvando}
                    onClick={() =>
                      agir(
                        () =>
                          ChamadosService.mudarStatus(c.id, {
                            status: novoStatus,
                            texto: texto.trim() || undefined,
                            quando:
                              novoStatus === 'RESOLVIDO' || novoStatus === 'CANCELADO'
                                ? (deInputLocal(quando) ?? undefined)
                                : undefined,
                          }),
                        `Chamado #${c.numero}: ${STATUS_ROTULO[novoStatus].toLowerCase()}`,
                      )
                    }
                  >
                    {salvando ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </section>
            )}

            {painel === 'nota' && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <h3 className="font-semibold">Anotar</h3>
                <Textarea
                  value={texto}
                  rows={3}
                  maxLength={2000}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Ex.: Liguei de novo, nova previsão para 18h"
                  className="text-base sm:text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-minimal-outline" onClick={() => setPainel(null)} disabled={salvando}>
                    Cancelar
                  </button>
                  <button
                    className="btn-minimal-primary"
                    disabled={salvando || !texto.trim()}
                    onClick={() => agir(() => ChamadosService.adicionarNota(c.id, texto.trim()), 'Anotação registrada')}
                  >
                    {salvando ? 'Salvando…' : 'Registrar'}
                  </button>
                </div>
              </section>
            )}

            {painel === 'excluir' && (
              <section className="space-y-3 rounded-md border border-destructive/40 p-3">
                <h3 className="font-semibold">Excluir chamado #{c.numero}</h3>
                <p className="text-xs text-muted-foreground">
                  Some da lista e dos indicadores. Fica registrado no log de auditoria com o motivo.
                </p>
                <Textarea
                  value={motivo}
                  rows={2}
                  maxLength={500}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Por que excluir (ex.: aberto em duplicidade)"
                  className="text-base sm:text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-minimal-outline" onClick={() => setPainel(null)} disabled={salvando}>
                    Cancelar
                  </button>
                  <button className="btn-minimal-primary bg-destructive hover:bg-destructive/90" disabled={salvando || !motivo.trim()} onClick={excluir}>
                    {salvando ? 'Excluindo…' : 'Excluir'}
                  </button>
                </div>
              </section>
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

function Campo({ rotulo, valor, copiavel, alerta }: { rotulo: string; valor: string; copiavel?: boolean; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={cn('font-medium break-words', alerta && 'text-destructive')}>
        {copiavel ? (
          <button
            type="button"
            className="text-left underline decoration-dotted underline-offset-2"
            title="Copiar"
            onClick={() => navigator.clipboard?.writeText(valor).then(() => toast.success('Protocolo copiado'))}
          >
            {valor}
          </button>
        ) : (
          valor
        )}
        {alerta && <span className="ml-1 text-xs font-normal">(vencida)</span>}
      </dd>
    </div>
  );
}

function LinhaDoTempo({ itens }: { itens: Atualizacao[] }) {
  if (!itens.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Histórico</h3>
      <ol className="space-y-2 border-l border-border pl-3">
        {itens.map((a) => (
          <li key={a.id} className="relative">
            <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">
              {formatarDataHoraBR(a.created_at)} · {a.autor_nome ?? '—'}
            </p>
            {a.tipo === 'STATUS' && a.status_novo && (
              <p className="font-medium">
                {a.status_anterior ? `${STATUS_ROTULO[a.status_anterior]} → ` : ''}
                {STATUS_ROTULO[a.status_novo]}
              </p>
            )}
            {a.texto && <p className={cn('whitespace-pre-wrap', a.tipo === 'EDICAO' && 'text-muted-foreground')}>{a.texto}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
