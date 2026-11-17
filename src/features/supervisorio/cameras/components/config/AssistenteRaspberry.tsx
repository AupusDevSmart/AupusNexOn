import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Cpu, MapPin } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { chavesCameras } from '../../hooks/chaves';
import { useCamerasUnidade } from '../../hooks/useCamerasUnidade';
import { useAgentesCameras, useDescobertasAgentes } from '../../hooks/useConfigCameras';
import { CamerasService } from '../../services/cameras.service';
import {
  acharAparelhoNovo,
  ESPERA_ANTES_DE_AJUDA_MS,
  ETAPAS_ASSISTENTE,
  gravarSessao,
  lerSessao,
  limparSessao,
  sessaoNova,
  sistemaDoComputador,
  type EtapaAssistente,
  type SessaoAssistente,
} from '../../utils/assistente-raspberry';
import { VERDE_TEXTO } from '../estilo-filtro';
import { CAIXA_VERDE, EtapaCameras, EtapaConectar, EtapaGravar, EtapaLigar } from './EtapasAssistente';

interface Props {
  unidadeId: string;
  unidadeNome?: string;
  /** Fecha guardando onde parou (sessionStorage). */
  onFechar: () => void;
  /** Abre o "Adicionar aparelho" (vincular pela lista da mesma internet ou pelo código). */
  onVincular: () => void;
}

/** Enquanto espera o aparelho, consulta a lista a cada 5 s; antes disso, 30 s basta. */
const INTERVALO_ESPERA_MS = 5_000;

/**
 * Assistente "Adicionar Raspberry novo" (NEXON-108): do cartão SD às câmeras, em 4 etapas. Monte só
 * quando for abrir: a sessão (etapa, horário, aparelhos que já existiam) é lida do sessionStorage no
 * primeiro render, e o comando gerado nesta sessão continua o mesmo ao fechar e reabrir.
 */
export function AssistenteRaspberry({ unidadeId, unidadeNome, onFechar, onVincular }: Props) {
  const sistema = useMemo(() => sistemaDoComputador(), []);
  const [sessao, setSessao] = useState<SessaoAssistente>(
    () => lerSessao(unidadeId) ?? sessaoNova('pc'),
  );
  const { etapa } = sessao;
  const atualizar = (m: Partial<SessaoAssistente>) => setSessao((s) => ({ ...s, ...m }));

  useEffect(() => {
    gravarSessao(unidadeId, sessao);
  }, [unidadeId, sessao]);

  const agentes = useAgentesCameras(unidadeId, true, etapa >= 3 ? INTERVALO_ESPERA_MS : 30_000);

  // Aparelhos que a usina já tinha: guardados uma vez, quando a lista chega.
  useEffect(() => {
    if (sessao.idsIniciais === null && agentes.data) {
      atualizar({ idsIniciais: agentes.data.map((a) => a.id) });
    }
  }, [agentes.data, sessao.idsIniciais]);

  const novo = acharAparelhoNovo(agentes.data, sessao.idsIniciais);

  // Comemora uma vez quando ele chega (na etapa Câmeras ele já chegou: reabrir ali não repete).
  const avisado = useRef<string | null>(null);
  useEffect(() => {
    if (novo && avisado.current !== novo.id) {
      avisado.current = novo.id;
      if (etapa < 4) toast.success(`Raspberry '${novo.nome}' conectado!`);
    }
  }, [novo, etapa]);

  const instalador = useQuery({
    queryKey: chavesCameras.instalador(unidadeId, sessao.iniciadoEm),
    queryFn: () => CamerasService.instalador(unidadeId),
    enabled: etapa === 1,
    staleTime: Infinity,
    gcTime: 2 * 3_600_000,
    retry: 1,
  });

  const usina = instalador.data?.usina?.trim() || unidadeNome?.trim() || 'esta usina';
  // Sem o instalador em cache (reabriu na etapa 3), o jeito escolhido decide.
  const automatico = sessao.jeito === 'pc' && (instalador.data ? instalador.data.vinculo_automatico !== null : true);

  // Relógio da etapa Conectar.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (etapa !== 3 || novo) return;
    setAgora(Date.now());
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [etapa, novo]);
  const esperandoMs = sessao.procurandoDesde ? agora - sessao.procurandoDesde : 0;

  const cameras = useCamerasUnidade(unidadeId, etapa === 4 && !!novo);
  const camerasDele = (cameras.data ?? []).filter((c) => novo && c.agente_id === novo.id);
  const agentesDescoberta = useMemo(() => (etapa === 4 && novo ? [novo] : []), [etapa, novo]);
  const descobertas = useDescobertasAgentes(agentesDescoberta);
  const ipsCadastrados = new Set(camerasDele.map((c) => c.ip));
  const pendentes = descobertas.itens.filter((d) => !ipsCadastrados.has(d.descoberta.ip));

  const irPara = (n: EtapaAssistente) => {
    atualizar(n === 3 && sessao.procurandoDesde === null ? { etapa: n, procurandoDesde: Date.now() } : { etapa: n });
  };

  // Cada etapa começa do topo, com o foco no título (leitor de tela anuncia a etapa).
  const corpo = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const primeiroRender = useRef(true);
  useEffect(() => {
    if (corpo.current) corpo.current.scrollTop = 0;
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    document.getElementById(tituloId)?.focus();
  }, [etapa, tituloId]);

  const concluir = () => {
    limparSessao(unidadeId);
    if (novo) toast.success(`Raspberry '${novo.nome}' pronto em ${usina}`);
    onFechar();
  };

  const recomecar = () => {
    limparSessao(unidadeId);
    avisado.current = null;
    setSessao(sessaoNova(sessao.jeito));
  };

  // Câmeras só depois que o aparelho chegou; o resto fica livre para ir e voltar.
  const podeIr = (n: EtapaAssistente) => n < 4 || !!novo;

  const proximo =
    etapa === 1
      ? { rotulo: 'Próximo', acao: () => irPara(2), ativo: true }
      : etapa === 2
        ? { rotulo: 'Próximo', acao: () => irPara(3), ativo: true }
        : etapa === 3
          ? { rotulo: novo ? 'Ver câmeras' : 'Esperando…', acao: () => irPara(4), ativo: !!novo }
          : { rotulo: 'Concluir', acao: concluir, ativo: true };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent
        className="w-full max-w-none gap-0 overflow-hidden p-0 sm:w-[min(720px,100vw)]"
      >
        <DialogHeader className="gap-3 space-y-0 border-b border-border px-4 pb-4 pt-4 text-left sm:px-6 sm:pt-6">
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle className="text-lg font-semibold">Adicionar Raspberry novo</DialogTitle>
            <DialogDescription asChild>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">
                  Entra em <strong className="text-foreground">{usina}</strong>
                </span>
              </p>
            </DialogDescription>
          </div>

          <ol aria-label="Etapas" className="grid grid-cols-4 gap-2">
            {ETAPAS_ASSISTENTE.map((rotulo, i) => {
              const n = (i + 1) as EtapaAssistente;
              const atual = n === etapa;
              const feita = n < etapa;
              return (
                <li key={rotulo}>
                  <button
                    type="button"
                    aria-current={atual ? 'step' : undefined}
                    disabled={!podeIr(n)}
                    onClick={() => irPara(n)}
                    className="flex min-h-11 w-full flex-col gap-1.5 rounded-md pt-1 text-left disabled:cursor-not-allowed"
                  >
                    <span aria-hidden className={cn('h-1.5 w-full rounded-full', atual || feita ? 'bg-nexon-verde' : 'bg-muted')} />
                    <span
                      className={cn(
                        'flex items-center gap-1 text-sm',
                        atual ? 'font-semibold text-foreground' : feita ? cn('font-medium', VERDE_TEXTO) : 'text-muted-foreground',
                      )}
                    >
                      {feita ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden /> : <span className="tabular-nums">{n}</span>}
                      <span className="truncate">{rotulo}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        {novo && etapa < 3 && (
          <div role="status" className={cn('mx-4 mt-4 flex items-center gap-3 rounded-xl p-3 text-sm sm:mx-6', CAIXA_VERDE)}>
            <Cpu className={cn('h-5 w-5 shrink-0', VERDE_TEXTO)} aria-hidden />
            <span className="min-w-0 flex-1">
              {novo.nome} já conectou.
            </span>
            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => irPara(4)}>
              Ver câmeras
            </Button>
          </div>
        )}

        <div ref={corpo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {etapa === 1 && (
            <EtapaGravar
              tituloId={tituloId}
              jeito={sessao.jeito}
              onJeito={(jeito) => atualizar({ jeito })}
              sistema={sistema}
              instalador={instalador.data}
              carregando={instalador.isPending}
              erro={instalador.isError ? instalador.error : null}
              onTentarDeNovo={() => void instalador.refetch()}
              gerando={instalador.isFetching}
            />
          )}
          {etapa === 2 && (
            <EtapaLigar
              tituloId={tituloId}
              marcados={sessao.marcados}
              onMarcar={(id) =>
                atualizar({ marcados: sessao.marcados.includes(id) ? sessao.marcados.filter((m) => m !== id) : [...sessao.marcados, id] })
              }
            />
          )}
          {etapa === 3 && (
            <EtapaConectar
              tituloId={tituloId}
              novo={novo}
              usina={usina}
              automatico={automatico}
              esperandoMs={esperandoMs}
              mostrarAjuda={esperandoMs >= ESPERA_ANTES_DE_AJUDA_MS}
              erroLista={agentes.isError}
              onVincular={onVincular}
            />
          )}
          {etapa === 4 && (
            <EtapaCameras
              tituloId={tituloId}
              novo={novo}
              cameras={camerasDele}
              carregando={cameras.isPending}
              descobertas={pendentes}
            />
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <div className="flex items-center gap-2">
            {etapa > 1 ? (
              <Button type="button" variant="ghost" className="h-11 gap-1 px-3" onClick={() => irPara((etapa - 1) as EtapaAssistente)}>
                <ChevronLeft aria-hidden />
                Voltar
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="h-11 px-3" onClick={onFechar}>
                Fechar
              </Button>
            )}
            <span className="flex-1" />
            <Button type="button" className="h-11 gap-1 px-5" disabled={!proximo.ativo} onClick={proximo.acao}>
              {proximo.rotulo}
              {etapa < 4 && proximo.ativo && <ChevronRight aria-hidden />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm text-muted-foreground">
            <span>Pode fechar: ele lembra onde parou.</span>
            {etapa > 1 && (
              <button type="button" className="min-h-11 underline-offset-4 mouse:hover:underline" onClick={recomecar}>
                Recomeçar
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
