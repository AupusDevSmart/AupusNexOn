import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Loader2, RefreshCw, Settings, Shield, ShieldOff, Siren, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import { marcarLidoNoCache, marcarTodosLidosNoCache } from '../hooks/cache';
import { chavesCameras } from '../hooks/chaves';
import { useCamerasUnidade } from '../hooks/useCamerasUnidade';
import { useEventosCameras } from '../hooks/useEventosCameras';
import { useResumoCameras } from '../hooks/useResumoCameras';
import { useTokenMidia } from '../hooks/useTokenMidia';
import { CamerasService } from '../services/cameras.service';
import type { CameraEvento, DispositivoAcionavel, FiltroEventos, ResumoCameras } from '../types';
import { mensagemErro } from '../utils/erros';
import { ehNaoLido, textoArmamento, textoNoite } from '../utils/eventos';
import { CamerasSkeleton } from './CamerasSkeleton';
import { ConfigCamerasSheet, type AbaConfigCameras } from './ConfigCamerasSheet';
import { GradeCameras } from './GradeCameras';
import { PainelCamera } from './PainelCamera';
import { PainelEventos, type EscopoEventos } from './PainelEventos';
import { TutorialCameras } from './TutorialCameras';

const PAGINA = 50;

interface CamerasTabProps {
  unidadeId: string;
  unidadeNome?: string;
}

const RESUMO_VAZIO: ResumoCameras = {
  total: 0,
  online: 0,
  offline: 0,
  armado: false,
  armado_ate: null,
  armamento_modo: 'desarmado',
  nao_lidos: 0,
  ultimo_alerta: null,
  noite: null,
  sem_sinal: [],
  comandos: { refletor: false, sirene: false },
};

/** Abaixo de `lg` o player e a lista ficam empilhados: abrir evento precisa subir até o player. */
function empilhado(): boolean {
  return typeof window.matchMedia === 'function' && !window.matchMedia('(min-width: 1024px)').matches;
}

function rolarAte(el: HTMLElement | null) {
  if (!el || !empilhado()) return;
  const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView?.({ behavior: parado ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Aba Câmeras do Sinóptico (NEXON-88, refeita no NEXON-108): faixa de status com
 * armamento, câmeras online e não vistos; player grande + miniaturas à esquerda e a
 * lista de eventos à direita, cada lado com a própria rolagem (desktop, `lg:`).
 * No celular tudo empilha: status, player, faixa de câmeras, eventos.
 * Comandos só com `comandar`; configuração pela engrenagem (`cadastroTecnico`/`configOperacional`).
 */
export function CamerasTab({ unidadeId, unidadeNome }: CamerasTabProps) {
  const capacidades = useUserStore((s) => s.capacidades);
  const podeComandar = capacidades.comandar;
  const podeCadastrar = capacidades.cadastroTecnico;
  const podeConfigurar = capacidades.configOperacional;
  const queryClient = useQueryClient();

  const cameras = useCamerasUnidade(unidadeId);
  const resumoQuery = useResumoCameras(unidadeId);
  const midia = useTokenMidia();

  const [cameraSelId, setCameraSelId] = useState<string | null>(null);
  const [eventoSel, setEventoSel] = useState<CameraEvento | null>(null);
  const [filtro, setFiltro] = useState<FiltroEventos>('todas');
  const [somenteNaoVistos, setSomenteNaoVistos] = useState(false);
  const [escopo, setEscopo] = useState<EscopoEventos>('todas');
  const [limite, setLimite] = useState(PAGINA);
  const [config, setConfig] = useState<{ aberta: boolean; aba?: AbaConfigCameras }>({ aberta: false });
  const [confirmarSirene, setConfirmarSirene] = useState(false);
  const [confirmarArmar, setConfirmarArmar] = useState(false);
  const [acionadoRecente, setAcionadoRecente] = useState<DispositivoAcionavel | null>(null);
  const playerRef = useRef<HTMLElement>(null);
  const eventosRef = useRef<HTMLElement>(null);

  const lista = cameras.data ?? [];
  const resumo = resumoQuery.data ?? RESUMO_VAZIO;
  const cameraSel = lista.find((c) => c.id === cameraSelId) ?? lista[0] ?? null;

  const eventos = useEventosCameras(
    {
      unidadeId,
      cameraId: escopo === 'camera' ? cameraSel?.id : undefined,
      filtro,
      somenteNaoLidos: somenteNaoVistos,
      limit: limite,
    },
    lista.length > 0,
  );
  const listaEventos = eventos.data?.data ?? [];

  // Trocou de unidade: volta ao estado inicial.
  useEffect(() => {
    setCameraSelId(null);
    setEventoSel(null);
    setFiltro('todas');
    setSomenteNaoVistos(false);
    setEscopo('todas');
    setLimite(PAGINA);
  }, [unidadeId]);

  // Filtro novo começa da primeira página.
  useEffect(() => setLimite(PAGINA), [filtro, somenteNaoVistos, escopo]);

  useEffect(() => {
    if (!acionadoRecente) return undefined;
    const id = window.setTimeout(() => setAcionadoRecente(null), 3000);
    return () => window.clearTimeout(id);
  }, [acionadoRecente]);

  const invalidarTudo = () => queryClient.invalidateQueries({ queryKey: chavesCameras.tudo });

  const armar = useMutation({
    mutationFn: (armado: boolean) => CamerasService.armar(unidadeId, { armado }),
    onSuccess: (r) => {
      queryClient.setQueryData(chavesCameras.resumo(unidadeId), r);
      toast.success(r.armado ? 'Câmeras armadas' : 'Câmeras desarmadas');
    },
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível mudar o armamento')),
  });

  const acionar = useMutation({
    mutationFn: (dispositivo: DispositivoAcionavel) => CamerasService.acionar(unidadeId, dispositivo),
    onSuccess: (_r, dispositivo) => {
      setAcionadoRecente(dispositivo);
      toast.success(dispositivo === 'refletor' ? 'Refletores acionados' : 'Sirene acionada');
    },
    onError: (e, dispositivo) =>
      toast.error(mensagemErro(e, dispositivo === 'refletor' ? 'Não foi possível acionar os refletores' : 'Não foi possível acionar a sirene')),
  });

  const foto = useMutation({
    mutationFn: (cameraId: string) => CamerasService.foto(cameraId),
    onSuccess: () => {
      toast.success('Foto pedida. Ela aparece nos eventos em instantes.');
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['cameras', 'eventos'] }), 8000);
    },
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível pedir a foto')),
  });

  const marcarLido = useMutation({
    mutationFn: (ev: CameraEvento) => CamerasService.marcarLido(ev.id),
    onMutate: (ev) => marcarLidoNoCache(queryClient, unidadeId, ev),
    onSettled: () => void invalidarTudo(),
  });

  const marcarTodos = useMutation({
    mutationFn: () => CamerasService.marcarTodosLidos({ unidade_id: unidadeId }),
    onMutate: () => marcarTodosLidosNoCache(queryClient, unidadeId),
    onSuccess: () => toast.success('Eventos marcados como vistos'),
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível marcar como vistos')),
    onSettled: () => void invalidarTudo(),
  });

  const selecionarCamera = (id: string) => {
    setCameraSelId(id);
    setEventoSel(null);
  };

  /** Abre o evento no player (câmera do evento), marca como visto e, no celular, sobe até o player. */
  const abrirEvento = (ev: CameraEvento) => {
    setCameraSelId(ev.camera_id);
    setEventoSel(ev);
    if (ehNaoLido(ev)) marcarLido.mutate(ev);
    rolarAte(playerRef.current);
  };

  const voltarAoVivo = () => setEventoSel(null);

  const indiceSel = eventoSel ? listaEventos.findIndex((e) => e.id === eventoSel.id) : -1;
  const eventoAnterior = indiceSel > 0 ? listaEventos[indiceSel - 1] : null;
  const eventoProximo = eventoSel ? (indiceSel >= 0 ? listaEventos[indiceSel + 1] : listaEventos[0]) ?? null : null;

  const verNaoVistos = () => {
    setFiltro('todas');
    setSomenteNaoVistos(true);
    rolarAte(eventosRef.current);
  };

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || !eventoSel) return;
    if ((e.target as Element).closest('[role="dialog"],[role="alertdialog"]')) return;
    voltarAoVivo();
  };

  const abrirConfig = (aba?: AbaConfigCameras) => setConfig({ aberta: true, aba });

  if (cameras.isPending || (resumoQuery.isPending && !resumoQuery.isError)) {
    return <CamerasSkeleton />;
  }

  if (cameras.isError) {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">{mensagemErro(cameras.error, 'Não foi possível carregar as câmeras.')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void cameras.refetch()}>
          <RefreshCw aria-hidden />
          Tentar de novo
        </Button>
      </div>
    );
  }

  const noite = textoNoite(resumo);
  const podeAbrirConfig = podeCadastrar || podeConfigurar;
  const semCameras = lista.length === 0;

  return (
    // Esc volta ao vivo de qualquer ponto da aba.
    // No desktop a grade abaixo ocupa a altura que sobra e cada lado rola sozinho; a rolagem
    // daqui só aparece em janela muito baixa (nada fica cortado).
    <div onKeyDown={teclas} className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Câmeras</h1>
          {!semCameras && (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                {resumo.armado ? (
                  <Shield className="h-4 w-4 text-nexon-verde" aria-hidden />
                ) : (
                  <ShieldOff className="h-4 w-4 text-muted-foreground" aria-hidden />
                )}
                {textoArmamento(resumo)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span aria-hidden className={cn('h-2 w-2 rounded-full', resumo.offline > 0 ? 'bg-amber-500' : 'bg-nexon-verde')} />
                <span>
                  {resumo.online} de {resumo.total} online
                  {resumo.offline > 0 && <span className="text-amber-600 dark:text-amber-400"> · {resumo.offline} sem sinal</span>}
                </span>
              </span>
              {resumo.nao_lidos > 0 && (
                <button
                  type="button"
                  onClick={verNaoVistos}
                  className="inline-flex items-center gap-1.5 rounded font-medium text-foreground mouse:hover:underline"
                >
                  <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white tabular-nums">
                    {resumo.nao_lidos > 99 ? '99+' : resumo.nao_lidos}
                  </span>
                  {resumo.nao_lidos === 1 ? 'não visto' : 'não vistos'}
                </button>
              )}
            </div>
          )}
          {!semCameras && noite && <p className="mt-1 text-xs text-muted-foreground">{noite}</p>}
        </div>

        <div role="group" aria-label="Comandos" className="flex flex-wrap items-center gap-2">
          {podeComandar && resumo.comandos.refletor && (
            <BotaoComando
              rotulo="Refletores"
              icone={Lightbulb}
              pressionado={acionadoRecente === 'refletor'}
              ocupado={acionar.isPending && acionar.variables === 'refletor'}
              onClick={() => acionar.mutate('refletor')}
            />
          )}
          {podeComandar && resumo.comandos.sirene && (
            <BotaoComando
              rotulo="Sirene"
              icone={Siren}
              pressionado={acionadoRecente === 'sirene'}
              ocupado={acionar.isPending && acionar.variables === 'sirene'}
              onClick={() => setConfirmarSirene(true)}
            />
          )}
          {podeComandar && !semCameras && (
            <Button
              type="button"
              variant={resumo.armado ? 'outline' : 'default'}
              className="h-10 gap-2"
              disabled={armar.isPending}
              onClick={() => setConfirmarArmar(true)}
            >
              {armar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : resumo.armado ? (
                <ShieldOff className="h-4 w-4" aria-hidden />
              ) : (
                <Shield className="h-4 w-4" aria-hidden />
              )}
              {resumo.armado ? 'Desarmar' : 'Armar'}
            </Button>
          )}
          {podeAbrirConfig && <BotaoComando rotulo="Configurar câmeras" icone={Settings} onClick={() => abrirConfig()} />}
        </div>
      </header>

      {semCameras ? (
        <div className="p-3 sm:p-4">
          <TutorialCameras
            unidadeId={unidadeId}
            unidadeNome={unidadeNome}
            podeCadastrar={podeCadastrar}
            podeConfigurar={podeConfigurar}
            onAbrirConfig={abrirConfig}
          />
        </div>
      ) : (
        <div className="grid gap-3 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
            <PainelCamera
              ref={playerRef}
              camera={cameraSel}
              evento={eventoSel}
              onVoltarAoVivo={voltarAoVivo}
              onEventoAnterior={eventoAnterior ? () => abrirEvento(eventoAnterior) : undefined}
              onEventoProximo={eventoProximo ? () => abrirEvento(eventoProximo) : undefined}
              urlMidia={midia.url}
              podeComandar={podeComandar}
              onFoto={() => cameraSel && foto.mutate(cameraSel.id)}
              fotoPendente={foto.isPending}
            />
            {lista.length > 1 && (
              <GradeCameras
                cameras={lista}
                selecionadaId={cameraSel?.id ?? null}
                onSelecionar={selecionarCamera}
                urlMidia={midia.url}
                className="lg:min-h-[7.5rem] lg:flex-1"
              />
            )}
          </div>

          <PainelEventos
            ref={eventosRef}
            className="min-h-[320px] lg:min-h-0"
            eventos={eventos}
            filtro={filtro}
            onFiltro={setFiltro}
            somenteNaoVistos={somenteNaoVistos}
            onSomenteNaoVistos={setSomenteNaoVistos}
            escopo={escopo}
            onEscopo={setEscopo}
            cameraNome={cameraSel?.nome ?? null}
            naoVistos={resumo.nao_lidos}
            eventoSelId={eventoSel?.id ?? null}
            onAbrirEvento={abrirEvento}
            onMarcarTodos={() => marcarTodos.mutate()}
            marcandoTodos={marcarTodos.isPending}
            onMostrarMais={() => setLimite((l) => l + PAGINA)}
            urlMidia={midia.url}
          />
        </div>
      )}

      <AlertDialog open={confirmarArmar} onOpenChange={setConfirmarArmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resumo.armado ? 'Desarmar as câmeras?' : 'Armar as câmeras?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {resumo.armado
                ? 'O vídeo continua, mas nada que aparecer nas câmeras gera alerta até você armar de novo.'
                : 'O que aparecer nas câmeras passa a gerar alerta, até você desarmar.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => armar.mutate(!resumo.armado)}>{resumo.armado ? 'Desarmar' : 'Armar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarSirene} onOpenChange={setConfirmarSirene}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acionar a sirene?</AlertDialogTitle>
            <AlertDialogDescription>
              A sirene toca agora na usina{unidadeNome ? ` ${unidadeNome}` : ''}. Use só quando houver invasão confirmada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => acionar.mutate('sirene')}>Acionar sirene</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {podeAbrirConfig && (
        <ConfigCamerasSheet
          unidadeId={unidadeId}
          unidadeNome={unidadeNome}
          aberto={config.aberta}
          abaInicial={config.aba}
          onFechar={() => setConfig({ aberta: false })}
        />
      )}
    </div>
  );
}

/** Botão redondo de comando (refletor, sirene, configurar), com dica no hover. */
function BotaoComando({
  rotulo,
  icone: Icone,
  pressionado,
  ocupado,
  onClick,
}: {
  rotulo: string;
  icone: LucideIcon;
  pressionado?: boolean;
  ocupado?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          aria-pressed={pressionado}
          aria-busy={ocupado || undefined}
          disabled={ocupado}
          onClick={onClick}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-60',
            pressionado ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground mouse:hover:bg-muted',
          )}
        >
          {ocupado ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : <Icone className="h-[18px] w-[18px]" aria-hidden />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{rotulo}</TooltipContent>
    </Tooltip>
  );
}
