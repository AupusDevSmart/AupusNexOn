import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Cctv, ChevronRight, Lightbulb, Loader2, Plus, RefreshCw, Settings, Shield, ShieldOff, Siren, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import { marcarLidoNoCache, marcarTodosLidosNoCache } from '../hooks/cache';
import { chavesCameras } from '../hooks/chaves';
import { useCamerasUnidade } from '../hooks/useCamerasUnidade';
import { useResumoCameras } from '../hooks/useResumoCameras';
import { useTokenMidia } from '../hooks/useTokenMidia';
import { CamerasService } from '../services/cameras.service';
import type { CameraEvento, DispositivoAcionavel, ResumoCameras } from '../types';
import { chaveDia, chaveHoje } from '../utils/agrupar-por-dia';
import { mensagemErro } from '../utils/erros';
import { ehNaoLido, horaCurta, iconeEvento, subtituloResumo, textoChamado, textoNoite, tituloEvento } from '../utils/eventos';
import { CamerasSkeleton } from './CamerasSkeleton';
import { ConfigCamerasSheet, type AbaConfigCameras } from './ConfigCamerasSheet';
import { GradeCameras } from './GradeCameras';
import { PontoNaoLido } from './ItemEvento';
import { PainelCamera } from './PainelCamera';
import { PainelNotificacoes } from './PainelNotificacoes';

type Modo = 'camera' | 'todas';

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

/**
 * Aba Câmeras do Sinóptico (NEXON-88): cabeçalho com armamento e comandos, grade
 * de câmeras com último alerta e resumo da noite, e painel lateral (Câmera /
 * Todas as notificações). Visível para todo usuário que vê a unidade; comandos só
 * com `comandar`, cadastro/config pela engrenagem (`cadastroTecnico`/`configOperacional`).
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
  const [modo, setModo] = useState<Modo>('camera');
  const [dia, setDia] = useState(() => chaveHoje());
  const [eventoSel, setEventoSel] = useState<CameraEvento | null>(null);
  const [config, setConfig] = useState<{ aberta: boolean; aba?: AbaConfigCameras }>({ aberta: false });
  const [confirmarSirene, setConfirmarSirene] = useState(false);
  const [acionadoRecente, setAcionadoRecente] = useState<DispositivoAcionavel | null>(null);

  const lista = cameras.data ?? [];
  const resumo = resumoQuery.data ?? RESUMO_VAZIO;
  const cameraSel = lista.find((c) => c.id === cameraSelId) ?? lista[0] ?? null;

  // Trocou de unidade: volta ao estado inicial.
  useEffect(() => {
    setCameraSelId(null);
    setEventoSel(null);
    setModo('camera');
    setDia(chaveHoje());
  }, [unidadeId]);

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
      toast.success('Foto pedida à câmera. Ela aparece nos eventos em instantes.');
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
    onSuccess: () => toast.success('Notificações marcadas como lidas'),
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível marcar como lidas')),
    onSettled: () => void invalidarTudo(),
  });

  const selecionarCamera = (id: string) => {
    setCameraSelId(id);
    setEventoSel(null);
    setModo('camera');
  };

  const selecionarEvento = (ev: CameraEvento | null) => {
    setEventoSel(ev);
    if (ev && ehNaoLido(ev)) marcarLido.mutate(ev);
  };

  /** Vindo de "Todas as notificações" ou do cartão do último alerta: câmera + dia + evento. */
  const abrirEvento = (ev: CameraEvento) => {
    setCameraSelId(ev.camera_id);
    setDia(chaveDia(ev.inicio_em) || chaveHoje());
    setModo('camera');
    selecionarEvento(ev);
  };

  const abrirConfig = (aba?: AbaConfigCameras) => setConfig({ aberta: true, aba });

  if (cameras.isPending || (resumoQuery.isPending && !resumoQuery.isError)) {
    return <CamerasSkeleton />;
  }

  if (cameras.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">{mensagemErro(cameras.error, 'Não foi possível carregar as câmeras.')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void cameras.refetch()}>
          <RefreshCw aria-hidden />
          Tentar de novo
        </Button>
      </div>
    );
  }

  const ultimo = resumo.ultimo_alerta;
  const IconeUltimo = ultimo ? iconeEvento(ultimo.tipo) : null;
  const noite = textoNoite(resumo);
  const podeAbrirConfig = podeCadastrar || podeConfigurar;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight">Câmeras</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{subtituloResumo(resumo)}</p>
        </div>
        <div role="group" aria-label="Comandos" className="flex gap-2">
          {podeComandar && resumo.comandos.refletor && (
            <BotaoRedondo
              rotulo="Refletores"
              icone={Lightbulb}
              pressionado={acionadoRecente === 'refletor'}
              ocupado={acionar.isPending && acionar.variables === 'refletor'}
              onClick={() => acionar.mutate('refletor')}
            />
          )}
          {podeComandar && resumo.comandos.sirene && (
            <BotaoRedondo
              rotulo="Sirene"
              icone={Siren}
              pressionado={acionadoRecente === 'sirene'}
              ocupado={acionar.isPending && acionar.variables === 'sirene'}
              onClick={() => setConfirmarSirene(true)}
            />
          )}
          {podeComandar && (
            <BotaoRedondo
              rotulo={resumo.armado ? 'Desarmar' : 'Armar'}
              icone={resumo.armado ? Shield : ShieldOff}
              pressionado={resumo.armado}
              ocupado={armar.isPending}
              onClick={() => armar.mutate(!resumo.armado)}
            />
          )}
          {podeAbrirConfig && <BotaoRedondo rotulo="Configurar câmeras" icone={Settings} onClick={() => abrirConfig()} />}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <Cctv className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Nenhuma câmera nesta usina</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Cadastre as câmeras e um agente na rede {unidadeNome ? `de ${unidadeNome}` : 'da usina'} para ver o vídeo e receber os alertas aqui.
          </p>
          {podeCadastrar && (
            <Button type="button" size="sm" onClick={() => abrirConfig('cameras')}>
              <Plus aria-hidden />
              Cadastrar câmera
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {ultimo && IconeUltimo && (
              <button
                type="button"
                onClick={() => abrirEvento(ultimo)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors mouse:hover:bg-muted/50"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    ehNaoLido(ultimo) ? 'bg-red-500/10 text-red-500' : 'bg-muted text-foreground/80',
                  )}
                >
                  <IconeUltimo className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">
                      {tituloEvento(ultimo)} · {ultimo.camera_nome}
                    </span>
                    {ehNaoLido(ultimo) && <PontoNaoLido />}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {horaCurta(ultimo.inicio_em)}
                    {textoChamado(ultimo) ? ` · ${textoChamado(ultimo)}` : ''}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            )}

            <button
              type="button"
              onClick={() => setModo('todas')}
              className="inline-flex h-8 items-center gap-1.5 self-end text-xs font-medium text-muted-foreground transition-colors mouse:hover:text-foreground"
            >
              Todas as notificações
              {resumo.nao_lidos > 0 && <Contador valor={resumo.nao_lidos} />}
              <span aria-hidden>›</span>
            </button>

            <GradeCameras cameras={lista} selecionadaId={cameraSel?.id ?? null} onSelecionar={selecionarCamera} urlMidia={midia.url} />

            {noite && <p className="mt-1 text-xs text-muted-foreground">{noite}</p>}
          </div>

          <aside className="w-full shrink-0 overflow-hidden rounded-xl border border-border bg-card lg:w-[400px] xl:w-[440px]">
            <Tabs value={modo} onValueChange={(v) => setModo(v as Modo)}>
              <TabsList aria-label="Painel" className="grid h-11 w-full grid-cols-2 rounded-none border-b border-border bg-transparent p-0">
                <TabsTrigger
                  value="camera"
                  className="h-full rounded-none border-b-2 border-transparent text-[13px] shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  Câmera
                </TabsTrigger>
                <TabsTrigger
                  value="todas"
                  className="h-full gap-1.5 rounded-none border-b-2 border-transparent text-[13px] shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  Todas as notificações
                  {resumo.nao_lidos > 0 && <Contador valor={resumo.nao_lidos} />}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="camera" className="mt-0">
                <PainelCamera
                  unidadeId={unidadeId}
                  camera={cameraSel}
                  dia={dia}
                  onDia={(d) => {
                    setDia(d);
                    setEventoSel(null);
                  }}
                  eventoSel={eventoSel}
                  onSelecionarEvento={selecionarEvento}
                  urlMidia={midia.url}
                  podeComandar={podeComandar}
                  onFoto={() => cameraSel && foto.mutate(cameraSel.id)}
                  fotoPendente={foto.isPending}
                />
              </TabsContent>
              <TabsContent value="todas" className="mt-0">
                <PainelNotificacoes
                  unidadeId={unidadeId}
                  naoLidos={resumo.nao_lidos}
                  onAbrirEvento={abrirEvento}
                  onMarcarTodas={() => marcarTodos.mutate()}
                  marcandoTodas={marcarTodos.isPending}
                />
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      )}

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
          aberto={config.aberta}
          abaInicial={config.aba}
          onFechar={() => setConfig({ aberta: false })}
        />
      )}
    </div>
  );
}

function BotaoRedondo({
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
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
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
  );
}

/** Contador verde de não lidas (mesmo desenho do contador da barra lateral). */
function Contador({ valor }: { valor: number }) {
  return (
    <span
      aria-label={`${valor} não ${valor === 1 ? 'lida' : 'lidas'}`}
      className="min-w-5 shrink-0 rounded-full bg-nexon-verde px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white tabular-nums"
    >
      {valor > 99 ? '99+' : valor}
    </span>
  );
}
