import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Copy,
  Lock,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  TIPO_ROTULO,
  type Atualizacao,
  type Chamado,
  type DestinoChamado,
  type StatusExterno,
} from '../types';
import { deInputLocal, duracaoDoChamado, formatarDuracao, paraInputLocal } from '../utils/datas';
import { SeloStatus } from './SeloStatus';
import { Segmentado } from './Segmentado';
import { Secao } from './Secao';
import { RodapeFixo } from './RodapeFixo';
import { FaltaEnergiaPainel } from '../falta-energia/FaltaEnergiaPainel';

type Painel = null | 'encaminhar' | 'fechar' | 'status' | 'nota' | 'excluir';

const DESTINOS = (Object.keys(DESTINO_ROTULO) as DestinoChamado[]).map((d) => ({ valor: d, rotulo: DESTINO_ROTULO[d] }));

/**
 * Detalhe do chamado numa folha lateral. Leitura em cima; embaixo, rodapé fixo com a
 * ação principal à direita, "Anotar" à vista e o resto (editar, mudar status, excluir)
 * no menu. Cada ação abre o próprio formulário no lugar do rodapé, perto do polegar.
 */
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
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
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
    setErro(null);
    setPainel(null);
    if (!chamadoId) return;
    let vivo = true;
    ChamadosService.detalhe(chamadoId)
      .then((d) => vivo && setC(d))
      .catch((e) => vivo && setErro(formatApiError(e)));
    return () => {
      vivo = false;
    };
  }, [chamadoId, versao, tentativa]);

  // Contato padrão = o do proprietário da planta; pode ser trocado.
  useEffect(() => {
    const p = c?.contatos_proprietario;
    setContato(destino === 'EMAIL' ? (p?.email ?? '') : destino === 'WHATSAPP' ? (p?.whatsapp ?? '') : '');
  }, [destino, c?.contatos_proprietario]);

  const abrirPainel = (p: Painel) => {
    setTexto('');
    setMotivo('');
    setObservacao('');
    setPainel(p);
  };

  const abrirStatus = (s: StatusExterno) => {
    setNovoStatus(s);
    setQuando(paraInputLocal(new Date().toISOString()));
    abrirPainel('status');
  };

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

  const fechado = c?.status === 'FECHADO';
  const externo = c?.tipo === 'EXTERNO';
  const encerrado = c ? estaEncerrado(c.status) : false;
  const previsaoVencida = !!c && !encerrado && !!c.previsao_em && new Date(c.previsao_em).getTime() < Date.now();

  // Ação principal: a que leva o chamado ao próximo passo.
  const principal: { rotulo: string; icone: ReactNode; agir: () => void } | null = !c
    ? null
    : externo
      ? encerrado
        ? { rotulo: 'Reabrir', icone: <RotateCcw className="mr-2 h-4 w-4" />, agir: () => abrirStatus('ABERTO') }
        : { rotulo: 'Marcar resolvido', icone: <CheckCircle2 className="mr-2 h-4 w-4" />, agir: () => abrirStatus('RESOLVIDO') }
      : !fechado
        ? { rotulo: 'Encaminhar', icone: <Send className="mr-2 h-4 w-4" />, agir: () => abrirPainel('encaminhar') }
        : null;

  const cancelarPainel = (
    <button className="btn-minimal-outline flex-1 touch:h-11 sm:flex-none" onClick={() => setPainel(null)} disabled={salvando}>
      Cancelar
    </button>
  );

  return (
    <Dialog open={!!chamadoId} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="space-y-2 pr-8 text-left">
          {c ? (
            <>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">#{c.numero}</span> · {TIPO_ROTULO[c.tipo ?? 'INTERNO']} ·{' '}
                {MOTIVO_ROTULO[c.motivo] ?? c.motivo}
              </p>
              <DialogTitle className="text-lg leading-snug">{c.titulo}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <SeloStatus status={c.status} />
                <span>Prioridade {PRIORIDADE_ROTULO[c.prioridade].toLowerCase()}</span>
                {previsaoVencida && <span className="font-medium text-destructive">· previsão vencida</span>}
              </div>
            </>
          ) : (
            <DialogTitle>Chamado</DialogTitle>
          )}
          <DialogDescription className="sr-only">Detalhe, histórico e ações do chamado</DialogDescription>
        </DialogHeader>

        {!c && !erro && <DetalheSkeleton />}

        {erro && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Não deu para abrir o chamado</p>
              <p className="text-sm text-muted-foreground">{erro}</p>
            </div>
            <button className="btn-minimal-outline" onClick={() => setTentativa((t) => t + 1)}>
              Tentar de novo
            </button>
          </div>
        )}

        {c && (
          <div className="space-y-6 text-sm">
            {encerrado && (
              <div className="flex gap-3 rounded-md border border-border bg-muted/40 p-3">
                {c.status === 'CANCELADO' ? (
                  <Ban className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nexon-link-claro dark:text-nexon-verde" />
                )}
                <div className="min-w-0">
                  <p className="font-medium">
                    {STATUS_ROTULO[c.status]} por {c.fechado_por_nome ?? '—'}
                    {c.fechado_em ? ` em ${formatarDataHoraBR(c.fechado_em)}` : ''}
                  </p>
                  {c.motivo_fechamento && <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{c.motivo_fechamento}</p>}
                </div>
              </div>
            )}

            {externo && (
              <Secao titulo="Atendimento">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Campo rotulo="Aberto com" valor={c.orgao ?? '—'} />
                  <Campo rotulo="Protocolo" valor={c.protocolo || '—'} copiavel={!!c.protocolo} />
                  <Campo rotulo={encerrado ? 'Duração' : 'Aberto há'} valor={formatarDuracao(duracaoDoChamado(c))} />
                  <Campo rotulo="Início do problema" valor={c.ocorrencia_em ? formatarDataHoraBR(c.ocorrencia_em) : '—'} />
                  <Campo rotulo="Aberto no órgão" valor={c.aberto_em ? formatarDataHoraBR(c.aberto_em) : '—'} />
                  <Campo rotulo="Previsão" valor={c.previsao_em ? formatarDataHoraBR(c.previsao_em) : '—'} alerta={previsaoVencida} />
                </dl>
              </Secao>
            )}

            <Secao titulo="Detalhes">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Campo rotulo="Local" valor={[c.planta_nome, c.unidade_nome].filter(Boolean).join(' · ') || '—'} />
                <Campo rotulo="Equipamento" valor={c.equipamento_nome ?? (externo ? '—' : (c.equipamento_id ?? '—'))} />
                <Campo rotulo="Registrado por" valor={`${c.autor_nome ?? '—'} · ${c.canal === 'APP' ? 'app' : 'web'}`} />
                <Campo rotulo="Registrado em" valor={formatarDataHoraBR(c.created_at)} />
              </dl>
              <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">{c.descricao}</p>
            </Secao>

            {!externo && (
              <Secao titulo="Encaminhamentos">
                {c.encaminhamentos.length === 0 && <p className="text-muted-foreground">Ainda não encaminhado.</p>}
                {c.encaminhamentos.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium">
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
                        'shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
                        e.status === 'ENVIADO' && 'bg-nexon-verde/15 text-nexon-link-claro dark:text-nexon-verde',
                        e.status === 'FALHOU' && 'bg-destructive/15 text-destructive',
                        (e.status === 'PENDENTE' || e.status === 'AGUARDANDO_INTEGRACAO') && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {ENCAMINHAMENTO_ROTULO[e.status]}
                    </span>
                  </div>
                ))}
              </Secao>
            )}

            {externo && c.motivo === 'FALTA_ENERGIA' && <FaltaEnergiaPainel chamadoId={c.id} />}

            <LinhaDoTempo itens={c.atualizacoes ?? []} />
          </div>
        )}

        {c && (
          <RodapeFixo>
            {painel === null && (
              <div className="flex items-center gap-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button className="btn-minimal-outline px-3 touch:h-11" aria-label="Mais ações">
                      <MoreHorizontal className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Mais</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="z-[10000] min-w-[12rem]">
                    {(externo || !fechado) && (
                      <DropdownMenuItem onSelect={() => onEditar(c)} className="touch:py-2.5">
                        <Pencil /> Editar
                      </DropdownMenuItem>
                    )}
                    {externo && c.status === 'ABERTO' && (
                      <DropdownMenuItem onSelect={() => abrirStatus('EM_ANDAMENTO')} className="touch:py-2.5">
                        <PlayCircle /> Marcar em andamento
                      </DropdownMenuItem>
                    )}
                    {externo && !encerrado && (
                      <DropdownMenuItem onSelect={() => abrirStatus('CANCELADO')} className="touch:py-2.5">
                        <Ban /> Cancelar chamado
                      </DropdownMenuItem>
                    )}
                    {!externo && !fechado && (
                      <DropdownMenuItem onSelect={() => abrirPainel('fechar')} className="touch:py-2.5">
                        <Lock /> Fechar chamado
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => abrirPainel('excluir')}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive touch:py-2.5"
                    >
                      <Trash2 /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="ml-auto flex min-w-0 gap-2">
                  <button className="btn-minimal-outline touch:h-11" onClick={() => abrirPainel('nota')}>
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Anotar
                  </button>
                  {principal && (
                    <button className="btn-minimal-primary whitespace-nowrap touch:h-11" onClick={principal.agir}>
                      {principal.icone}
                      {principal.rotulo}
                    </button>
                  )}
                </div>
              </div>
            )}

            {painel === 'status' && (
              <FormPainel titulo="Mudar status">
                <Segmentado<StatusExterno>
                  rotulo="Novo status"
                  opcoes={STATUS_EXTERNO.filter((s) => s !== c.status).map((s) => ({ valor: s, rotulo: STATUS_ROTULO[s] }))}
                  valor={novoStatus}
                  onChange={setNovoStatus}
                />
                {(novoStatus === 'RESOLVIDO' || novoStatus === 'CANCELADO') && (
                  <div className="space-y-1.5">
                    <label htmlFor="chamado-quando" className="text-sm font-medium">
                      {novoStatus === 'RESOLVIDO' ? 'Resolvido em' : 'Cancelado em'}
                    </label>
                    <Input
                      id="chamado-quando"
                      type="datetime-local"
                      value={quando}
                      onChange={(e) => setQuando(e.target.value)}
                      className="text-base sm:text-sm"
                    />
                  </div>
                )}
                <Textarea
                  value={texto}
                  rows={2}
                  maxLength={2000}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={novoStatus === 'RESOLVIDO' ? 'Ex.: Equatorial religou a rede às 17h40' : 'Observação (opcional)'}
                  aria-label="Observação"
                  className="text-base sm:text-sm"
                />
                <Botoes>
                  {cancelarPainel}
                  <button
                    className="btn-minimal-primary flex-1 touch:h-11 sm:flex-none"
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
                </Botoes>
              </FormPainel>
            )}

            {painel === 'nota' && (
              <FormPainel titulo="Anotar">
                <Textarea
                  value={texto}
                  rows={3}
                  maxLength={2000}
                  autoFocus
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Ex.: Liguei de novo, nova previsão para 18h"
                  aria-label="Anotação"
                  className="text-base sm:text-sm"
                />
                <Botoes>
                  {cancelarPainel}
                  <button
                    className="btn-minimal-primary flex-1 touch:h-11 sm:flex-none"
                    disabled={salvando || !texto.trim()}
                    onClick={() => agir(() => ChamadosService.adicionarNota(c.id, texto.trim()), 'Anotação registrada')}
                  >
                    {salvando ? 'Salvando…' : 'Registrar'}
                  </button>
                </Botoes>
              </FormPainel>
            )}

            {painel === 'excluir' && (
              <FormPainel titulo={`Excluir chamado #${c.numero}?`} perigo>
                <p className="text-xs text-muted-foreground">
                  Some da lista e dos indicadores. Fica no log de auditoria com o motivo.
                </p>
                <Textarea
                  value={motivo}
                  rows={2}
                  maxLength={500}
                  autoFocus
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Por que excluir (ex.: aberto em duplicidade)"
                  aria-label="Motivo da exclusão"
                  className="text-base sm:text-sm"
                />
                <Botoes>
                  {cancelarPainel}
                  <button
                    className="btn-minimal-destructive flex-1 touch:h-11 sm:flex-none"
                    disabled={salvando || !motivo.trim()}
                    onClick={excluir}
                  >
                    {salvando ? 'Excluindo…' : 'Excluir'}
                  </button>
                </Botoes>
              </FormPainel>
            )}

            {painel === 'encaminhar' && (
              <FormPainel titulo="Encaminhar">
                <Segmentado<DestinoChamado> rotulo="Destino" opcoes={DESTINOS} valor={destino} onChange={setDestino} />
                {destino !== 'SMART_SERVICE' ? (
                  <div className="space-y-1.5">
                    <label htmlFor="chamado-contato" className="text-sm font-medium">
                      {destino === 'EMAIL' ? 'E-mail' : 'WhatsApp (DDD + número)'}
                    </label>
                    <Input
                      id="chamado-contato"
                      value={contato}
                      inputMode={destino === 'EMAIL' ? 'email' : 'tel'}
                      onChange={(e) => setContato(e.target.value)}
                      className="text-base sm:text-sm"
                    />
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
                  aria-label="Observação"
                  className="text-base sm:text-sm"
                />
                <Botoes>
                  {cancelarPainel}
                  <button
                    className="btn-minimal-primary flex-1 touch:h-11 sm:flex-none"
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
                </Botoes>
              </FormPainel>
            )}

            {painel === 'fechar' && (
              <FormPainel titulo="Fechar chamado">
                <Textarea
                  value={motivo}
                  rows={2}
                  maxLength={500}
                  autoFocus
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="O que foi feito ou por que está sendo fechado"
                  aria-label="Motivo do fechamento"
                  className="text-base sm:text-sm"
                />
                <Botoes>
                  {cancelarPainel}
                  <button
                    className="btn-minimal-primary flex-1 touch:h-11 sm:flex-none"
                    disabled={salvando || !motivo.trim()}
                    onClick={() => agir(() => ChamadosService.fechar(c.id, motivo), `Chamado #${c.numero} fechado`)}
                  >
                    {salvando ? 'Fechando…' : 'Fechar chamado'}
                  </button>
                </Botoes>
              </FormPainel>
            )}
          </RodapeFixo>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormPainel({ titulo, perigo, children }: { titulo: string; perigo?: boolean; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className={cn('font-semibold', perigo && 'text-destructive')}>{titulo}</h3>
      {children}
    </section>
  );
}

function Botoes({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 sm:justify-end">{children}</div>;
}

function DetalheSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando chamado">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function Campo({ rotulo, valor, copiavel, alerta }: { rotulo: string; valor: string; copiavel?: boolean; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={cn('break-words font-medium', alerta && 'text-destructive')}>
        {copiavel ? (
          <button
            type="button"
            className="inline-flex max-w-full items-center gap-1.5 text-left hover:text-nexon-link-claro dark:hover:text-nexon-verde touch:py-1"
            title="Copiar protocolo"
            onClick={() => navigator.clipboard?.writeText(valor).then(() => toast.success('Protocolo copiado'))}
          >
            <span className="break-all">{valor}</span>
            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
    <Secao titulo="Histórico">
      <ol className="space-y-3 border-l border-border pl-4">
        {itens.map((a) => (
          <li key={a.id} className="relative">
            <span
              className={cn(
                'absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-4 ring-background',
                a.tipo === 'STATUS' ? 'bg-nexon-verde' : 'bg-muted-foreground/60',
              )}
            />
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
    </Secao>
  );
}
