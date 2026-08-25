import { useEffect, useRef, useCallback, useState, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Play, Download, Edit3, Maximize2, Minimize2, ZoomIn, Trash2, FolderPlus, Move, MousePointer2, Save, X, Network, Zap, Terminal, Power } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ESPLoader, Transport } from 'esptool-js';
import { api } from '@/config/api';
import { BASE_URL } from '@/config/constants';
import { iotApiService, type IoTProjeto, type IoTDiagrama } from '@/services/iot.services';
import { TonBoConfigModal } from './TonBoConfigModal';
import { TonBiConfigModal } from './TonBiConfigModal';
import { TonAiConfigModal } from './TonAiConfigModal';
import { EquipamentoCommandModal } from '../v2/components/EquipamentoCommandModal';
import { DeviceIoConfigModal, tipoTemIo, type DeviceIoConfig } from './DeviceIoConfigModal';
import { dominioDoTipo } from '../v2/utils/dominioEquipamento';

/**
 * Resposta do OtaController.compileAndPublish (com envelope ResponseInterceptor):
 *   { success: true, data: { published, topic, url, version, md5, size }, meta? }
 */
// Atenção: o interceptor de response em src/config/api.ts já desempacota
// o envelope {success, data, meta} do NexOn — então resp.data aqui já é a
// payload achatada {published, topic, url, ...}. NÃO acessar resp.data.data.
interface OtaCompilePublishResponse {
  published: boolean;
  topic: string;
  url: string;
  version: string;
  md5: string;
  size: number;
}

interface OtaCompileFiles {
  files: Record<string, string>;
  name: string;
}

// =============================================================================
// ESP32 Flash via Web Serial (esptool-js)
// =============================================================================
const ESP_FILTERS = [
  { usbVendorId: 0x303A },  // Espressif
  { usbVendorId: 0x10C4 },  // CP210x
  { usbVendorId: 0x1A86 },  // CH340
  { usbVendorId: 0x0403 },  // FTDI
  { usbVendorId: 0x067B },  // PL2303
];
const VENDOR_NAMES: Record<number, string> = {
  0x303A: 'Espressif ESP32',
  0x10C4: 'CP210x',
  0x1A86: 'CH340',
  0x0403: 'FTDI',
  0x067B: 'PL2303',
};

interface FlashLog {
  (msg: string): void;
}

async function flashESP32(firmwareBase64: string, logFn: FlashLog): Promise<boolean> {
  if (!('serial' in navigator)) {
    logFn('Web Serial nao suportado. Use Chrome ou Edge (v89+).');
    return false;
  }

  logFn('Selecione a porta serial do ESP32...');

  // Web Serial API: tipos disponiveis em @types/web-bluetooth ou @types/w3c-web-serial.
  // Como nao temos as definicoes instaladas, usamos any com cast minimal.
  let port: any;
  try {
    port = await (navigator as any).serial.requestPort({ filters: ESP_FILTERS });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'NotFoundError') {
      logFn('Nenhum ESP32 encontrado. Conecte via USB e tente novamente.');
    } else {
      logFn('Selecao cancelada.');
    }
    return false;
  }

  const portInfo = port.getInfo?.() || {};
  const chipName = VENDOR_NAMES[portInfo.usbVendorId] || 'Dispositivo serial';
  logFn(`Dispositivo: ${chipName} (VID:0x${(portInfo.usbVendorId || 0).toString(16).toUpperCase()})`);

  const transport = new Transport(port);

  const terminal = {
    clean: () => {},
    writeLine: (data: string) => logFn(data),
    write: (data: string) => {
      const trimmed = data.trim();
      if (trimmed) logFn(trimmed);
    },
  };

  try {
    logFn('Conectando ao bootloader...');
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal,
    } as any);

    const chip = await loader.main();
    logFn(`Chip detectado: ${chip}`);

    logFn('Configurando velocidade de flash (460800 baud)...');
    // esptool-js@0.6 declara changeBaud() sem parametros nos types, mas o
    // runtime aceita o novo baud rate. Cast preserva a chamada correta.
    await (loader as unknown as { changeBaud: (baud: number) => Promise<void> }).changeBaud(460800);

    const firmwareBytes = Uint8Array.from(atob(firmwareBase64), c => c.charCodeAt(0));
    logFn(`Firmware: ${(firmwareBytes.length / 1024).toFixed(1)} KB`);

    // otadata em 0xe000 (8KB). Quando todo 0xFF (estado apagado), bootloader
    // cai no app0. Sem isso, USB grave em 0x10000 não vence se uma OTA prévia
    // tiver deixado otadata apontando pra app1 — bootloader segue boot em app1.
    const otadataReset = new Uint8Array(0x2000).fill(0xff);

    logFn('Gravando otadata (0xe000) + firmware (0x10000)...');

    await loader.writeFlash({
      fileArray: [
        { data: otadataReset, address: 0xe000 },
        { data: firmwareBytes, address: 0x10000 },
      ],
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (_fileIndex: number, written: number, total: number) => {
        const pct = Math.round((written / total) * 100);
        logFn(`Progresso: ${pct}% (${(written / 1024).toFixed(0)}/${(total / 1024).toFixed(0)} KB)`);
      },
    } as any);

    logFn('Flash concluido! Reiniciando...');
    try { await (loader as any).hardReset(); } catch {}
    try { await transport.disconnect(); } catch {}

    logFn('ESP32 reiniciado com sucesso!');
    return true;

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logFn(`Erro: ${msg}`);
    try { await transport.disconnect(); } catch {}
    return false;
  }
}

declare global {
  interface Window {
    DiagramEditor: any;
    COMPONENT_TYPES: any;
    CATEGORIES: any;
    FirmwareGenerator: any;
    FirmwareGeneratorTonV2: any;
    __iotScriptsReady: boolean;
  }
  // Functions from iot-device-catalog.js (loaded as global script)
  function getCatalogByType(tipo: string): any[];
  function getCatalogDevice(catalogId: string): any;
  function getDevicePoints(tipo: string): any;
  function getResolvedPoints(catalogId: string): any;
  // Constants from iot-diagram.js
  var COMPONENT_TYPES: any;
  var CATEGORIES: any;
  var CONNECTION_STYLES: any;
  var DEVICE_POINTS: any;
  var DEVICE_MODELS: any;
  var BENCH_TESTS: any[];
}

/**
 * Shape minimo que o componente consome da API de projetos IoT.
 * Mantemos um alias local em vez de usar IoTProjeto direto pra deixar
 * explicito quais campos sao usados aqui (id/nome/diagrama).
 */
type IoTProject = Pick<IoTProjeto, 'id' | 'nome' | 'diagrama'>;

interface IoTDiagramProps { unidadeId: string; unidadeNome?: string; }

// Load IoT scripts ONCE globally (outside React lifecycle)
function ensureIoTScripts(): Promise<void> {
  if (window.__iotScriptsReady && window.DiagramEditor) return Promise.resolve();
  if ((window as any).__iotScriptsPromise) return (window as any).__iotScriptsPromise;

  (window as any).__iotScriptsPromise = new Promise<void>((resolve, reject) => {
    // Cache-buster: bumpe esta string sempre que editar qualquer iot-*.v2.js
    // ESTATICO. Browsers respeitam Cache-Control immutable mesmo em hard
    // refresh, então a única forma garantida de forçar fetch é mudar a URL.
    //
    // O catalogo de dispositivos foi movido pro backend (GET /iot-catalog/device-catalog.js)
    // — ele revalida sozinho via ETag. Os demais ainda sao estaticos.
    const IOT_SCRIPTS_VERSION = '20260721-tonv2-teste14b';
    const scripts = [
      `${BASE_URL}/iot-catalog/device-catalog.js`,
      `/iot-firmware-base.v2.js?v=${IOT_SCRIPTS_VERSION}`,
      `/iot-firmware-generator.v2.js?v=${IOT_SCRIPTS_VERSION}`,
      // TON-V2 (placa SCH-TON-v1b): base + gerador em arquivos SEPARADOS.
      // O gerador V1 ignora os tipos ton*v2 e vice-versa; o iot-diagram.v2.js
      // (carregado por último) define TON_CAPS/COMPONENT_TYPES com os 2 mundos.
      `/iot-firmware-base.ton-v2.js?v=${IOT_SCRIPTS_VERSION}`,
      `/iot-firmware-generator.ton-v2.js?v=${IOT_SCRIPTS_VERSION}`,
      `/iot-bench-tests.v2.js?v=${IOT_SCRIPTS_VERSION}`,
      `/iot-diagram.v2.js?v=${IOT_SCRIPTS_VERSION}`,
    ];
    let idx = 0;
    const loadNext = () => {
      if (idx >= scripts.length) {
        window.__iotScriptsReady = true;
        resolve();
        return;
      }
      const el = document.createElement('script');
      el.src = scripts[idx];
      el.onload = () => { idx++; loadNext(); };
      el.onerror = () => {
        const failed = scripts[idx];
        console.error('[IoT] Failed:', failed);
        // O catalogo (primeiro script) eh load-bearing: sem ele, DEVICE_POINTS e
        // DEVICE_MODELS ficam undefined e o editor abre quebrado com erros opacos.
        // Em vez de seguir silenciosamente, aborta o load e expoe a falha pro UI.
        if (failed.includes('device-catalog.js')) {
          (window as any).__iotScriptsPromise = null;
          window.__iotScriptsReady = false;
          const err = new Error(
            `Falha ao carregar catalogo IoT (${failed}). Editor IoT indisponivel.`,
          );
          (err as any).isCatalogLoadError = true;
          // Sonner toast pra UX imediata.
          import('sonner').then(({ toast }) => toast.error(err.message));
          // Rejeitar a promise — useEffect que aguarda ensureIoTScripts
          // captura via .catch e renderiza estado de falha.
          reject(err);
          return;
        }
        // Demais scripts seguem o comportamento antigo (warning + continua).
        idx++;
        loadNext();
      };
      document.body.appendChild(el);
    };
    loadNext();
  });
  return (window as any).__iotScriptsPromise;
}

// Agrupa os BOs (comandos) por dispositivo-alvo (ponto.equipamento_nome) pro
// painel de comando de teste exibir "SoftStarter_1: [ligar] [desligar]".
function groupBosByDevice(bos: any[]): Record<string, any[]> {
  const g: Record<string, any[]> = {};
  for (const b of bos) {
    const dev = b?.ponto?.equipamento_nome || 'Dispositivo';
    (g[dev] = g[dev] || []).push(b);
  }
  return g;
}

export function IoTDiagram({ unidadeId, unidadeNome: _unidadeNome }: IoTDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const saveTimerRef = useRef<any>(null);
  const initDoneRef = useRef(false);
  const selectedProjectIdRef = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [ready, setReady] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [toolMode, setToolModeState] = useState<'move' | 'select'>('move');
  const [simulating, setSimulating] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [compCount, setCompCount] = useState(0);
  const [connCount, setConnCount] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // Component properties modal
  const [propsModalOpen, setPropsModalOpen] = useState(false);
  const [propsComp, setPropsComp] = useState<any>(null);
  // Modal de configuracao de BOs (Binary Outputs) — aberto para TONs com has_relays.
  // Estado segura o id do equipamento alvo + nome para o header.
  const [boConfigOpen, setBoConfigOpen] = useState(false);
  const [boConfigTonId, setBoConfigTonId] = useState<string | null>(null);
  const [boConfigTonNome, setBoConfigTonNome] = useState<string | undefined>(undefined);
  // Modal de configuracao/estado de BIs (Boolean Inputs) — toda TON tem 6 entradas opto.
  const [biConfigOpen, setBiConfigOpen] = useState(false);
  const [biConfigTonId, setBiConfigTonId] = useState<string | null>(null);
  const [biConfigTonNome, setBiConfigTonNome] = useState<string | undefined>(undefined);
  // Modal de configuracao de AIs (Analog Inputs) — canais AN1/AN2 (nivel de tanque etc.).
  const [aiConfigOpen, setAiConfigOpen] = useState(false);
  const [aiConfigTonId, setAiConfigTonId] = useState<string | null>(null);
  const [aiConfigTonNome, setAiConfigTonNome] = useState<string | undefined>(undefined);

  // Modal de COMANDOS reais (relés/transistores/status) do TON — reusa o do unifilar.
  const [cmdRealModal, setCmdRealModal] = useState<{ id: string; nome: string; topico_mqtt?: string; tipo?: string } | null>(null);

  // Modal de I/O genérico (catálogo-driven) — relé e devices com BI/BO no catálogo.
  const [ioModalOpen, setIoModalOpen] = useState(false);
  const [propsValues, setPropsValues] = useState<Record<string, any>>({});
  // Disjuntores da unidade (unifilar) — pra associar um Power Meter ao disjuntor que ele
  // mede. O PM é só-IoT; sua exibição acontece via o disjuntor associado (Fase C).
  const [disjuntoresUnidade, setDisjuntoresUnidade] = useState<Array<{ id: string; nome: string }>>([]);

  // Prompt "qual ativo do unifilar é este?" ao CRIAR inversor/medidor/TON no IoT.
  const [associarComp, setAssociarComp] = useState<any>(null);
  const [associarLista, setAssociarLista] = useState<Array<{ id: string; nome: string }>>([]);
  const [associarBusy, setAssociarBusy] = useState(false);

  // Picker de equipamento NexOn para o campo `equipamento_id` dos componentes TON.
  // Substitui input de texto livre (CUID 26 chars) por um select com TONs da unidade.
  // Carregado quando o modal de props abre para um componente com has_relays/has_lora.
  const [availableTonsForPicker, setAvailableTonsForPicker] = useState<
    { id: string; nome: string }[]
  >([]);

  // Connection context menu
  const [connMenu, setConnMenu] = useState<{ conn: any; allowed: string[]; x: number; y: number } | null>(null);

  // Project state
  const [projects, setProjects] = useState<IoTProject[]>([]);
  const [selectedProjectId, _setSelectedProjectId] = useState<string | null>(null);
  const setSelectedProjectId = (id: string | null) => { selectedProjectIdRef.current = id; _setSelectedProjectId(id); };
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Step 1: Load scripts + projects in parallel, then init editor
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Load scripts — bail fora se o catalogo falhar
      try {
        await ensureIoTScripts();
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ?? 'Falha ao carregar scripts IoT.';
        console.error('[IoT] Script load aborted:', e);
        setCatalogLoadError(msg);
        setLoadingProjects(false);
        setReady(false);
        return;
      }
      if (cancelled) return;

      // Load projects via service centralizado (axios + interceptor de auth).
      try {
        const list = await iotApiService.listByUnidade(unidadeId);
        if (cancelled) return;
        setProjects(list);
        if (list.length > 0) {
          setSelectedProjectId(list[0].id);
          // Wait for DOM then init editor
          requestAnimationFrame(() => {
            if (!cancelled) initEditor(list[0]);
          });
        }
      } catch (e) {
        console.error('[IoT] Falha ao listar projetos:', e);
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) { setLoadingProjects(false); setReady(true); }
      }
    }

    function initEditor(proj: IoTProject) {
      const waitForContainer = () => {
        const container = containerRef.current;
        if (!container || container.clientWidth === 0) {
          requestAnimationFrame(waitForContainer);
          return;
        }
        createEditor(container, proj);
      };
      requestAnimationFrame(waitForContainer);
    }

    function createEditor(container: HTMLDivElement, proj: IoTProject) {
      if (!window.DiagramEditor || initDoneRef.current) return;
      initDoneRef.current = true;
      container.innerHTML = '';

      try {
        const editor = new window.DiagramEditor(container.id);
        editorRef.current = editor;

        editor.onZoomChange = (z: number) => setZoom(Math.round(z * 100));
        editor.onChange = () => {
          setCompCount(editor.components.length);
          setConnCount(editor.connections.length);
          setDirty(true);
        };
        editor.onSelect = (comp: any) => { if (comp && !editor.editMode) openComponentProps(comp); };
        editor.onDblClick = (comp: any) => { if (comp) openComponentProps(comp); };
        editor.onComponentAdded = (comp: any) => { abrirAssociar(comp); };
        editor.onConnectionMenu = (conn: any, allowed: string[], e: MouseEvent) => {
          setConnMenu({ conn, allowed, x: e.clientX, y: e.clientY });
        };

        if (proj?.diagrama) {
          editor.fromJSON(proj.diagrama);
        }
        setCompCount(editor.components.length);
        setConnCount(editor.connections.length);

        setTimeout(() => {
          editor.centerView();
          setZoom(Math.round(editor.zoom * 100));
        }, 200);
      } catch (e) {
        console.error('[IoT] Editor init error:', e);
      }
    }

    init();
    return () => { cancelled = true; initDoneRef.current = false; clearTimeout(saveTimerRef.current); };
  }, [unidadeId]);

  // Re-init when switching projects
  useEffect(() => {
    if (!ready || !selectedProjectId || !window.DiagramEditor || !containerRef.current) return;

    const container = containerRef.current;
    if (container.clientWidth === 0) return;

    container.innerHTML = '';
    initDoneRef.current = false;

    const editor = new window.DiagramEditor(container.id);
    editorRef.current = editor;
    editor.onZoomChange = (z: number) => setZoom(Math.round(z * 100));
    editor.onChange = () => {
      setCompCount(editor.components.length);
      setConnCount(editor.connections.length);
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveCurrentDiagram(), 1500);
    };
    // Mostra o motivo quando uma conexão é rejeitada (antes falhava em silêncio).
    editor.onValidationError = (reason: string) => {
      import('sonner').then(({ toast }) => toast.error(reason));
    };
    editor.onSelect = (comp: any) => { if (comp && !editor.editMode) openComponentProps(comp); };
    editor.onDblClick = (comp: any) => { if (comp) openComponentProps(comp); };
    editor.onComponentAdded = (comp: any) => { abrirAssociar(comp); };
    editor.onConnectionMenu = (conn: any, allowed: string[], e: MouseEvent) => {
      setConnMenu({ conn, allowed, x: e.clientX, y: e.clientY });
    };

    const proj = projects.find(p => p.id === selectedProjectId);
    if (proj?.diagrama) editor.fromJSON(proj.diagrama);
    setCompCount(editor.components.length);
    setConnCount(editor.connections.length);
    setEditMode(false);
    setTimeout(() => { editor.centerView(); setZoom(Math.round(editor.zoom * 100)); }, 200);
  }, [selectedProjectId]);

  // Re-fit (centerView) quando o container muda de tamanho ou ao girar o aparelho.
  // Antes o fit so rodava no init/troca de projeto, entao orientacao/abrir-fechar a
  // barra do navegador no mobile deixava o diagrama desalinhado.
  useEffect(() => {
    if (!ready) return;
    const el = containerRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const reFit = () => {
      clearTimeout(t);
      t = setTimeout(() => editorRef.current?.centerView?.(), 120);
    };
    const ro = new ResizeObserver(reFit);
    ro.observe(el);
    window.addEventListener('orientationchange', reFit);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener('orientationchange', reFit);
    };
  }, [ready]);

  const saveCurrentDiagram = useCallback(async () => {
    const projId = selectedProjectIdRef.current;
    if (!projId || !editorRef.current) return;
    setSaving(true);
    try {
      const diagrama: IoTDiagrama = editorRef.current.toJSON();
      const updated = await iotApiService.update(projId, { diagrama });
      // O backend AUTO-CRIA/associa equipamentos (TON, devices Modbus, bomba) e
      // carimba `equipamento_id` no JSON que salva. Reflete isso no editor em
      // memória — senão a associação só aparece após recarregar (o dropdown
      // "Equipamento NexON" fica vazio mesmo tendo criado). Aplica só o
      // equipamento_id, casando por id de componente (não mexe no resto).
      const compsSalvos = (updated as unknown as { diagrama?: { components?: any[] } })?.diagrama?.components;
      if (Array.isArray(compsSalvos) && editorRef.current) {
        for (const cs of compsSalvos) {
          const eqId = String(cs?.props?.equipamento_id ?? '').trim();
          if (!eqId || !cs?.id) continue;
          const local = (editorRef.current.components || []).find((c: any) => c.id === cs.id);
          if (local && String(local.props?.equipamento_id ?? '').trim() !== eqId) {
            editorRef.current.updateComponentProps(cs.id, { ...local.props, equipamento_id: eqId });
          }
        }
      }
      setDirty(false);
    } catch (e) {
      console.error('[IoT] Save failed:', e);
    } finally {
      setSaving(false);
    }
  }, []);

  // Project CRUD
  const openCreateModal = () => { setNewProjectName(''); setShowCreateModal(true); };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setShowCreateModal(false);
    try {
      const created = await iotApiService.create(unidadeId, newProjectName.trim());
      setProjects(prev => [...prev, created]);
      setSelectedProjectId(created.id);
    } catch (e) {
      console.error('[IoT] Falha ao criar projeto:', e);
    }
  };

  const renameProject = async (id: string, nome: string) => {
    try {
      await iotApiService.update(id, { nome });
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, nome } : p)));
    } catch (e) {
      console.error('[IoT] Falha ao renomear projeto:', e);
    }
    setRenamingId(null);
  };

  // NOTA: a UI atualmente nao expoe botao para deletar projeto. Quando o
  // menu de acoes for implementado, basta voltar com a funcao chamando
  // iotApiService.delete(id) — pattern identico ao renameProject acima.

  // Close connection menu on outside click
  useEffect(() => {
    if (!connMenu) return;
    const close = (e: MouseEvent) => {
      const menu = document.querySelector('[data-conn-menu]');
      if (menu && !menu.contains(e.target as Node)) setConnMenu(null);
    };
    setTimeout(() => window.addEventListener('mousedown', close), 10);
    return () => window.removeEventListener('mousedown', close);
  }, [connMenu]);

  // Expose global functions that diagram.js keyboard handlers call
  useEffect(() => {
    (window as any).setToolMode = (mode: string) => {
      setToolModeState(mode as 'move' | 'select');
    };
    (window as any).showToast = (_msg: string) => { /* silent — toasts vem via componente Sonner do projeto */ };
    (window as any).updateSidebarEquipList = () => {
      if (editorRef.current) {
        setCompCount(editorRef.current.components.length);
        setConnCount(editorRef.current.connections.length);
      }
    };
  }, []);

  // true se o componente IoT é um Power Meter (medidor) — tipos do diagrama IoT.
  const isPmComp = (type: any): boolean =>
    ['power_meter', 'medidor_comum'].includes(String(type || '').toLowerCase());

  // Lista os DISJUNTORES da unidade (unifilar) pra associar a um Power Meter.
  const carregarDisjuntoresUnidade = async () => {
    if (!unidadeId) { setDisjuntoresUnidade([]); return; }
    try {
      const { equipamentosApi } = await import('@/services/equipamentos.services');
      const resp = await equipamentosApi.findByUnidade(unidadeId, { limit: 200 });
      const list = (resp.data ?? [])
        .filter((e: any) => {
          if (e.deleted_at) return false;
          const codigo =
            e.tipo_equipamento_rel?.codigo ?? e.tipoEquipamento?.codigo ?? e.tipo_equipamento ?? '';
          return /DISJUNTOR/i.test(`${codigo} ${e.nome ?? ''}`);
        })
        .map((e: any) => ({ id: (e.id || '').trim(), nome: e.nome }));
      setDisjuntoresUnidade(list);
    } catch (err) {
      console.warn('[iot-diagram] carregarDisjuntoresUnidade falhou:', err);
      setDisjuntoresUnidade([]);
    }
  };

  const openComponentProps = async (comp: any) => {
    if (!comp || !window.COMPONENT_TYPES) return;
    const def = window.COMPONENT_TYPES[comp.type];
    if (!def) return;
    setPropsComp({ ...comp, _def: def });
    setPropsValues({ ...comp.props });
    setPropsModalOpen(true);

    // Picker do campo equipamento_id: MESMA lista do prompt de criação (por família,
    // excluindo os já vinculados a outro nó do diagrama) — mantém consistência.
    const hasEquipamentoIdField = Array.isArray(def.fields)
      && def.fields.some((f: any) => f?.key === 'equipamento_id');
    if (hasEquipamentoIdField && unidadeId) {
      setAvailableTonsForPicker(await listarAtivosParaVinculo(comp));
    }
    // Power Meter: carrega os disjuntores da unidade pro campo "Disjuntor associado".
    if (isPmComp(comp.type)) void carregarDisjuntoresUnidade();
  };

  const saveComponentProps = async () => {
    if (!propsComp || !editorRef.current) return;
    const compSalvo = { type: propsComp.type, props: { ...propsValues } };
    editorRef.current.updateComponentProps(propsComp.id, propsValues);
    setPropsModalOpen(false);
    setPropsComp(null);
    // Persistir alteracao no backend imediatamente
    await saveCurrentDiagram();
    // Espelha o modelo (catalog_id) no ativo vinculado, se for device 'ambos'.
    await espelharModeloNoAtivo(compSalvo);
  };

  // ---- Associação na criação (inversor/medidor/TON) ----
  // Mapa componente IoT -> tipo_equipamento p/ "Criar novo" (ativos 'ambos').
  // TON não cria aqui (é Fase 2, auto-create no backend). Ids semeados (estáveis).
  const TIPO_POR_COMPONENTE: Record<string, string> = {
    inversor: '01JAQTE1INVERSOR000000005',
    power_meter: '01JAQTE1MEDIDOR00000001',
    medidor_comum: '01JAQTE1MEDIDOR00000001',
    rele_protecao: '01JAQTE1RELE0000000000016', // Relé de Proteção (cat. Relê Proteção)
    bomba: '41f4145b41662798dca73a9d19', // Bomba de Combustível
    carregador: 'bb0thcmhchstqmauu7re83hx', // Carregador Elétrico Genérico
  };

  const familiaCasa = (tipoComp: string, codigo: string, nome: string): boolean => {
    const hay = `${codigo || ''} ${nome || ''}`;
    if (tipoComp === 'inversor') return /INVERSOR|SUN2000/i.test(hay);
    if (tipoComp === 'power_meter' || tipoComp === 'medidor_comum')
      return /METER|MEDIDOR|LANDIS|M160|M300|PD666|A966/i.test(hay);
    if (tipoComp === 'rele_protecao') return /RELE/i.test(hay);
    if (tipoComp === 'bomba') return /BOMBA|COMBUST/i.test(hay);
    if (tipoComp === 'carregador') return /CARREGADOR|CHARGER|\bEV\b/i.test(hay);
    return true;
  };

  // Lista os ativos da unidade vinculáveis a ESTE componente: por família
  // (inversor↔inversores, medidor↔medidores, TON↔categoria 'TON') e EXCLUINDO os
  // já vinculados a outro nó deste diagrama (1:1 no projeto → não deixa escolher repetido).
  const listarAtivosParaVinculo = async (comp: any): Promise<Array<{ id: string; nome: string }>> => {
    if (!comp || !unidadeId) return [];
    const tipo = String(comp.type || '').toLowerCase();
    try {
      const { equipamentosApi } = await import('@/services/equipamentos.services');
      const resp = await equipamentosApi.findByUnidade(unidadeId, { limit: 100 });
      const isTon = tipo.startsWith('ton');
      const jaVinculados = new Set(
        (editorRef.current?.components ?? [])
          .filter((c: any) => c.id !== comp.id)
          .map((c: any) => String(c.props?.equipamento_id || '').trim())
          .filter(Boolean),
      );
      return (resp.data ?? [])
        .filter((e: any) => {
          if (e.deleted_at) return false;
          if (jaVinculados.has(String(e.id || '').trim())) return false;
          const catNome =
            e.tipo_equipamento_rel?.categoria?.nome ?? e.tipoEquipamento?.categoria?.nome ?? '';
          const codigo =
            e.tipo_equipamento_rel?.codigo ?? e.tipoEquipamento?.codigo ?? e.tipo_equipamento ?? '';
          if (isTon) return String(catNome).trim().toUpperCase() === 'TON';
          // Identidade = componente IoT ↔ SEU equipamento Modbus (inversor 'ambos',
          // PM/relé 'iot'). Exclui só ativos de POTÊNCIA pura (disjuntor/trafo) — esses
          // não são identidade; o PM apenas os ASSOCIA depois (disjuntor associado).
          if (dominioDoTipo(codigo, e.nome) === 'potencia') return false;
          return familiaCasa(tipo, codigo, e.nome);
        })
        .map((e: any) => ({ id: (e.id || '').trim(), nome: e.nome }));
    } catch (err) {
      console.warn('[iot-diagram] listarAtivosParaVinculo falhou:', err);
      return [];
    }
  };

  // Abre o prompt de associação logo ao criar um inversor/medidor/TON.
  const abrirAssociar = async (comp: any) => {
    if (!comp || !unidadeId) return;
    const tipo = String(comp.type || '').toLowerCase();
    const isTon = tipo.startsWith('ton');
    const linkavel =
      isTon ||
      ['inversor', 'power_meter', 'medidor_comum', 'rele_protecao', 'bomba', 'carregador'].includes(tipo);
    if (!linkavel) return;
    const lista = await listarAtivosParaVinculo(comp);
    // TON sem nenhum equipamento livre → NÃO pergunta: o backend (ensureTonEquipamentos)
    // cria o equipamento correto (topico/automação) e associa ao salvar. Se houver TON(s)
    // livre(s), aí sim abre o picker (associar a um existente OU criar novo).
    if (isTon && lista.length === 0) {
      import('sonner').then(({ toast }) => toast.info('Nenhum TON livre — um novo será criado e associado ao salvar.'));
      return;
    }
    setAssociarLista(lista);
    setAssociarComp(comp);
  };

  const aplicarVinculo = async (equipId: string) => {
    if (!associarComp || !editorRef.current) return;
    const compVinculado = { type: associarComp.type, props: { ...associarComp.props, equipamento_id: equipId } };
    editorRef.current.updateComponentProps(associarComp.id, {
      ...associarComp.props,
      equipamento_id: equipId,
    });
    setAssociarComp(null);
    await saveCurrentDiagram();
    // Espelha o modelo no ativo recém-vinculado (se já tiver catalog_id).
    await espelharModeloNoAtivo(compVinculado);
  };

  const criarNovoAtivo = async () => {
    if (!associarComp || !unidadeId) return;
    const tipoComp = String(associarComp.type || '').toLowerCase();
    // TON: não cria via /rapido (o equipamento precisa dos campos certos — topico_mqtt,
    // automação). Fecha sem vínculo → o backend cria+associa o TON no save (ensureTonEquipamentos).
    if (tipoComp.startsWith('ton')) {
      setAssociarComp(null);
      import('sonner').then(({ toast }) => toast.info('Novo TON será criado e associado ao salvar.'));
      return;
    }
    const tipoId = TIPO_POR_COMPONENTE[tipoComp];
    if (!tipoId) return;
    setAssociarBusy(true);
    try {
      const { equipamentosApi } = await import('@/services/equipamentos.services');
      const resp = await equipamentosApi.criarEquipamentoRapido(
        unidadeId,
        tipoId,
        associarComp.props?.name,
      );
      const novoId = ((resp?.data as any)?.id || '').trim();
      if (novoId) await aplicarVinculo(novoId);
    } catch (err) {
      console.warn('[iot-diagram] criarNovoAtivo falhou:', err);
      import('sonner').then(({ toast }) => toast.error('Falha ao criar equipamento.'));
    } finally {
      setAssociarBusy(false);
    }
  };

  // Espelha o MODELO do IoT (catalog_id) no ativo vinculado: escreve fabricante+modelo
  // em equipamentos → aparece no unifilar (mesma linha). Só p/ device 'ambos' vinculado.
  const espelharModeloNoAtivo = async (comp: any) => {
    const tipo = String(comp?.type || '').toLowerCase();
    if (!['inversor', 'power_meter', 'medidor_comum', 'rele_protecao'].includes(tipo)) return;
    const equipId = String(comp?.props?.equipamento_id || '').trim();
    const catalogId = String(comp?.props?.catalog_id || '').trim();
    if (!equipId || !catalogId) return;
    if (typeof getCatalogDevice !== 'function') return;
    const dev: any = getCatalogDevice(catalogId);
    if (!dev || (!dev.fabricante && !dev.modelo)) return;
    try {
      const { equipamentosApi } = await import('@/services/equipamentos.services');
      await equipamentosApi.update(equipId, { fabricante: dev.fabricante, modelo: dev.modelo });
      console.warn('[iot-diagram] modelo espelhado no ativo:', equipId, dev.fabricante, dev.modelo);
    } catch (err) {
      console.warn('[iot-diagram] espelharModeloNoAtivo falhou:', err);
    }
  };

  const setToolMode = (mode: 'move' | 'select') => {
    setToolModeState(mode);
    if (editorRef.current) {
      editorRef.current.toolMode = mode;
      editorRef.current.svg.style.cursor = mode === 'move' ? 'grab' : 'default';
      if (mode === 'move') {
        editorRef.current.selectedIds = new Set();
        editorRef.current._renderAll();
      }
    }
  };

  // Editor actions
  const toggleEdit = () => {
    const next = !editMode;
    setEditMode(next);
    if (!next) {
      setToolMode('move');
      if (dirty) saveCurrentDiagram();
    }
    if (editorRef.current) {
      editorRef.current.editMode = next;
      editorRef.current._deselect();
      editorRef.current._renderAll();
    }
  };

  const toggleSimulation = () => {
    if (!editorRef.current) return;
    if (simulating) { editorRef.current.stopSimulation(); setSimulating(false); }
    else { editorRef.current.startSimulation(); setSimulating(true); }
  };

  // ===== Painel de COMANDO DE TESTE (modo Simular) — DATA-DRIVEN =====
  // Espelha o Unifilar: lista os pontos CADASTRADOS da TON (BOs = comandos por
  // dispositivo, ex. "ligar → SoftStarter_1"; BIs = status). Aciona via
  // acionarPonto em modo SIM → o mesmo pulso ON->OFF, mas em TESTE/<topico>/cmd
  // (firmware de simulação), sem tocar produção. Campo manual (avançado) de fallback.
  const [cmdSimModal, setCmdSimModal] = useState<{
    tons: { id: string; name: string }[];
    selected: number;
    loading: boolean;
    loadErr: string | null;
    bos: any[];   // TonBo[] mapeados+ativos (comandos)
    bis: any[];   // TonBi[] mapeados (status)
    acting: string | null;   // ponto.id sendo acionado
    result: { ok: boolean; text: string } | null;
    manualCmd: string;
    sendingManual: boolean;
    benchSats: any[];        // boards de bancada vivos no TESTE/ (discovery)
    benchLoading: boolean;
    testMac: string | null;  // MAC do board de bancada escolhido p/ esta sessão (remap)
  } | null>(null);

  // Discovery dos boards de bancada vivos no TESTE/ (pro remap). Auto-seleciona se
  // só há um; mantém o escolhido se ainda vivo; senão deixa o usuário escolher.
  const loadBenchSats = async () => {
    setCmdSimModal((m) => m && ({ ...m, benchLoading: true }));
    try {
      const { simBenchApi } = await import('@/services/sim-bench.services');
      const sats = await simBenchApi.list();
      setCmdSimModal((m) => {
        if (!m) return m;
        // Auto-casa: board cujo label (nome da TON no firmware 🧪) == TON selecionada.
        // Senão mantém o escolhido se vivo; senão auto-seleciona se só há um.
        const tonName = m.tons[m.selected]?.name;
        const match = sats.find((s: any) => s.label && tonName && s.label === tonName);
        const keep = m.testMac && sats.some((s: any) => s.mac === m.testMac);
        const testMac = match ? match.mac : (keep ? m.testMac : (sats.length === 1 ? sats[0].mac : null));
        return { ...m, benchLoading: false, benchSats: sats, testMac };
      });
    } catch {
      setCmdSimModal((m) => m && ({ ...m, benchLoading: false, benchSats: [] }));
    }
  };

  const loadTonPoints = async (tonEqId: string) => {
    setCmdSimModal((m) => m && ({ ...m, loading: true, loadErr: null, bos: [], bis: [] }));
    try {
      const [{ tonBoApi }, { tonBiApi }] = await Promise.all([
        import('@/services/ton-bo.services'),
        import('@/services/ton-bi.services'),
      ]);
      const [bosAll, bisAll] = await Promise.all([
        tonBoApi.list(tonEqId).catch(() => [] as any[]),
        tonBiApi.list(tonEqId).catch(() => [] as any[]),
      ]);
      const bos = (bosAll || []).filter((b: any) => b.ponto && b.ativo);
      const bis = (bisAll || []).filter((b: any) => b.ponto);
      setCmdSimModal((m) => m && ({ ...m, loading: false, bos, bis }));
    } catch (e: any) {
      setCmdSimModal((m) => m && ({ ...m, loading: false, loadErr: e?.message || 'erro ao carregar pontos' }));
    }
  };

  const openCmdSimModal = () => {
    if (!editorRef.current) return;
    const tons = (editorRef.current.components || [])
      .filter((c: any) => typeof c.type === 'string' && c.type.startsWith('ton') && (c.props?.equipamento_id || '').trim())
      .map((c: any) => ({ id: String(c.props.equipamento_id).trim(), name: c.props?.name || c.type }));
    if (tons.length === 0) {
      alert('Nenhuma TON com equipamento NexOn vinculado no diagrama (defina o equipamento na TON pra poder comandar).');
      return;
    }
    setCmdSimModal({ tons, selected: 0, loading: true, loadErr: null, bos: [], bis: [], acting: null, result: null, manualCmd: 'status', sendingManual: false, benchSats: [], benchLoading: true, testMac: null });
    loadTonPoints(tons[0].id);
    loadBenchSats();
  };

  const selectCmdSimTon = (i: number) => {
    if (!cmdSimModal) return;
    // Re-casa o board de bancada pela TON nova (por nome); senão único; senão nada.
    const tonName = cmdSimModal.tons[i]?.name;
    const match = cmdSimModal.benchSats.find((s: any) => s.label && s.label === tonName);
    const testMac = match ? match.mac : (cmdSimModal.benchSats.length === 1 ? cmdSimModal.benchSats[0].mac : null);
    setCmdSimModal({ ...cmdSimModal, selected: i, result: null, testMac });
    loadTonPoints(cmdSimModal.tons[i].id);
  };

  // Aciona um ponto de comando (pulso ON->OFF) em modo SIM (TESTE/).
  const acionarSimPonto = async (bo: any) => {
    if (!cmdSimModal || !bo?.ponto) return;
    // Se há board(s) de bancada vivos mas nenhum escolhido, exige o remap antes de
    // acionar — senão o comando iria pro MAC cadastrado/placeholder e daria timeout.
    if (cmdSimModal.benchSats.length > 0 && !cmdSimModal.testMac) {
      setCmdSimModal((m) => m && ({ ...m, result: { ok: false, text: 'Escolha abaixo o board de bancada que representa esta TON antes de acionar.' } }));
      return;
    }
    setCmdSimModal((m) => m && ({ ...m, acting: bo.ponto.id, result: null }));
    try {
      const { acionarPontoApi } = await import('@/services/acionar-ponto.services');
      const res: any = await acionarPontoApi.acionar(bo.ponto.equipamento_id, bo.ponto.id, true, cmdSimModal.testMac || undefined); // sim=true + remap
      const lat = res?.latency_ms != null ? ` (${res.latency_ms}ms)` : '';
      setCmdSimModal((m) => m && ({ ...m, acting: null, result: { ok: true, text: `${res?.comando_semantico || bo.ponto.nome}: ${res?.status ?? 'ok'}${lat} [${res?.comando_tecnico || ('r' + bo.bo_numero)}]` } }));
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || 'erro';
      setCmdSimModal((m) => m && ({ ...m, acting: null, result: { ok: false, text: String(msg) } }));
    }
  };

  // Comando manual (avançado) — texto livre via TESTE/<topico>/cmd.
  const sendSimManual = async () => {
    if (!cmdSimModal) return;
    const ton = cmdSimModal.tons[cmdSimModal.selected];
    const cmd = (cmdSimModal.manualCmd || '').trim();
    if (!ton || !cmd) return;
    if (cmdSimModal.benchSats.length > 0 && !cmdSimModal.testMac) {
      setCmdSimModal((m) => m && ({ ...m, result: { ok: false, text: 'Escolha abaixo o board de bancada antes de enviar o comando.' } }));
      return;
    }
    setCmdSimModal((m) => m && ({ ...m, sendingManual: true, result: null }));
    try {
      const { equipamentosApi } = await import('@/services/equipamentos.services');
      const res: any = await equipamentosApi.sendCommand(ton.id, cmd, true, cmdSimModal.testMac || undefined);
      const lat = res?.latency_ms != null ? ` (${res.latency_ms}ms)` : '';
      setCmdSimModal((m) => m && ({ ...m, sendingManual: false, result: { ok: true, text: `ack: ${res?.status ?? '?'}${res?.msg ? ' — ' + res.msg : ''}${lat}` } }));
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || 'erro';
      setCmdSimModal((m) => m && ({ ...m, sendingManual: false, result: { ok: false, text: String(msg) } }));
    }
  };

  const handleAddComponent = (type: string) => {
    if (!editorRef.current || !editMode) return;
    const c = containerRef.current;
    if (!c) return;
    const cx = (c.clientWidth / 2 - editorRef.current.pan.x) / editorRef.current.zoom;
    const cy = (c.clientHeight / 2 - editorRef.current.pan.y) / editorRef.current.zoom;
    editorRef.current.addComponent(type, Math.round(cx / 40) * 40, Math.round(cy / 40) * 40);
    setCompCount(editorRef.current.components.length);
  };

  const [benchTestModal, setBenchTestModal] = useState<{
    selectedTest: number;
    checklist: Record<string, boolean>;
  } | null>(null);

  // Serial Monitor state — suporta 1 ou 2 paineis
  const [serialOpen, setSerialOpen] = useState(false);
  const [serialPanelCount, setSerialPanelCount] = useState(1);

  interface SerialPanel {
    lines: string[];
    input: string;
    connected: boolean;
    port: any;
    reader: any;
    writer: any;
    reading: boolean;
    label: string;
  }
  const [serialPanels, setSerialPanels] = useState<[SerialPanel, SerialPanel]>([
    { lines: [], input: '', connected: false, port: null, reader: null, writer: null, reading: false, label: '' },
    { lines: [], input: '', connected: false, port: null, reader: null, writer: null, reading: false, label: '' },
  ]);
  const serialLogRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  const serialAddLine = useCallback((idx: number, line: string) => {
    setSerialPanels(prev => {
      const next = [...prev] as [SerialPanel, SerialPanel];
      const lines = [...next[idx].lines, line];
      next[idx] = { ...next[idx], lines: lines.length > 500 ? lines.slice(-500) : lines };
      return next;
    });
  }, []);

  // Auto-scroll
  useEffect(() => {
    serialLogRefs.forEach((ref, i) => {
      if (ref.current && i < serialPanelCount) {
        ref.current.scrollTop = ref.current.scrollHeight;
      }
    });
  }, [serialPanels, serialPanelCount]);

  const serialConnect = useCallback(async (idx: number) => {
    if (!('serial' in navigator)) {
      serialAddLine(idx, '[ERRO] Web Serial nao suportado. Use Chrome ou Edge.');
      return;
    }
    try {
      const port = await (navigator as any).serial.requestPort({ filters: ESP_FILTERS });
      await port.open({ baudRate: 115200 });

      const portInfo = port.getInfo?.() || {};
      const chipName = VENDOR_NAMES[portInfo.usbVendorId] || 'Dispositivo serial';
      const label = `${chipName} (PID:${(portInfo.usbProductId || 0).toString(16)})`;
      serialAddLine(idx, `[CONECTADO] ${chipName} (115200 baud)`);

      const writer = port.writable.getWriter();
      const reader = port.readable.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Guarda reader+writer no estado pra o Desconectar conseguir cancelar.
      // (Bug anterior: o reader nunca era salvo -> cancel() no disconnect nao
      //  fazia nada -> o read loop seguia segurando o lock da porta -> close()
      //  falhava em silencio e a serial "continuava conectada".)
      setSerialPanels(prev => {
        const next = [...prev] as [SerialPanel, SerialPanel];
        next[idx] = { ...next[idx], connected: true, port, writer, reader, reading: true, label };
        return next;
      });

      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;  // reader.cancel() (disconnect) resolve aqui
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n');
            buffer = parts.pop() || '';
            for (const line of parts) {
              const trimmed = line.replace(/\r/g, '').trim();
              if (trimmed) serialAddLine(idx, trimmed);
            }
          }
        } catch (e: unknown) {
          // Device desplugado fisicamente cai aqui; cancel() manual nao (resolve done).
          serialAddLine(idx, `[DESCONECTADO] ${e instanceof Error ? e.message : ''}`);
        } finally {
          // Cleanup unico (disconnect manual OU device caiu): solta os locks e
          // FECHA a porta de verdade, depois limpa o estado.
          try { reader.releaseLock(); } catch {}
          try { writer.releaseLock(); } catch {}
          try { await port.close(); } catch {}
          setSerialPanels(prev => {
            const next = [...prev] as [SerialPanel, SerialPanel];
            next[idx] = { ...next[idx], connected: false, port: null, reader: null, writer: null, reading: false };
            return next;
          });
        }
      })();

    } catch (e: unknown) {
      // Web Serial requestPort cancelado pelo usuario lanca DOMException 'NotFoundError'
      if (e instanceof Error && e.name !== 'NotFoundError') {
        serialAddLine(idx, `[ERRO] ${e.message}`);
      }
    }
  }, [serialAddLine]);

  const serialDisconnect = useCallback(async (idx: number) => {
    const panel = serialPanels[idx];
    // Cancela o reader -> o read loop quebra (done) e faz TODO o cleanup no
    // finally (releaseLock + port.close + limpa estado). Nao mexemos no lock/
    // porta aqui pra nao competir com o loop que ainda segura o reader.
    try { await panel.reader?.cancel(); } catch {}
    serialAddLine(idx, '[DESCONECTADO]');
  }, [serialPanels, serialAddLine]);

  const serialSend = useCallback(async (idx: number, cmd: string) => {
    if (!serialPanels[idx].writer || !cmd.trim()) return;
    try {
      const encoder = new TextEncoder();
      await serialPanels[idx].writer.write(encoder.encode(cmd + '\n'));
      serialAddLine(idx, `> ${cmd}`);
      setSerialPanels(prev => {
        const next = [...prev] as [SerialPanel, SerialPanel];
        next[idx] = { ...next[idx], input: '' };
        return next;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      serialAddLine(idx, `[ERRO TX] ${msg}`);
    }
  }, [serialPanels, serialAddLine]);

  const [firmwareModal, setFirmwareModal] = useState<{
    projects: any[];
    selected: number;
    status: 'idle' | 'compiling' | 'compiled' | 'flashing' | 'deploying' | 'deployed' | 'done' | 'error';
    log: string[];
    binData: any | null;
    simulate?: boolean;
  } | null>(null);

  // Monta o mapa BO/BI da(s) bomba(s) a partir do mapeamento PADRÃO da TON
  // (Configurar BOs/BIs → ton_bo/ton_bi). Resolve por PAPEL pelo nome do ponto da
  // bomba (Ligar/Desligar/Solenoide = comando; Cartão/Emergência = status) e
  // devolve { [equipamentoIdDaBomba]: { bo:{liga,desliga,solenoide}, bi:{cartao,estop} } }.
  // Chaveado pelo equipamento do PONTO (ponto.equipamento_id) — assim uma TON que
  // controle mais de um equipamento não mistura os papéis.
  const buildBombaIoMap = async (): Promise<Record<string, { bo: Record<string, number>; bi: Record<string, number>; ai: Record<string, { ch: number; mv0: number; mv100: number }> }>> => {
    const map: Record<string, { bo: Record<string, number>; bi: Record<string, number>; ai: Record<string, { ch: number; mv0: number; mv100: number }> }> = {};
    const comps = editorRef.current?.components || [];
    const tonEqIds = Array.from(new Set(
      comps
        .filter((c: any) => typeof c.type === 'string' && c.type.startsWith('ton') && (c.props?.equipamento_id || '').trim())
        .map((c: any) => String(c.props.equipamento_id).trim()),
    )) as string[];
    if (tonEqIds.length === 0) return map;
    const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const boRole = (nome: string): string | null => {
      const n = norm(nome);
      if (/deslig/.test(n)) return 'desliga';        // "desliga" antes de "liga"
      if (/\blig|acion|partid/.test(n)) return 'liga';
      if (/solenoid|valvul|bloque/.test(n)) return 'solenoide';
      return null;
    };
    const biRole = (nome: string): string | null => {
      const n = norm(nome);
      if (/cart|rfid|leitor|tag/.test(n)) return 'cartao';
      if (/emerg|estop|parad|seg/.test(n)) return 'estop';
      return null;
    };
    const aiRole = (nome: string): string | null => {
      const n = norm(nome);
      if (/nivel|tanque|level|volume/.test(n)) return 'nivel';
      return null;
    };
    try {
      const [{ tonBoApi }, { tonBiApi }, { tonAiApi }] = await Promise.all([
        import('@/services/ton-bo.services'),
        import('@/services/ton-bi.services'),
        import('@/services/ton-ai.services'),
      ]);
      await Promise.all(tonEqIds.map(async (tonId) => {
        try {
          const [bos, bis, aisList] = await Promise.all([tonBoApi.list(tonId), tonBiApi.list(tonId), tonAiApi.list(tonId)]);
          for (const bo of bos) {
            if (!bo?.ativo || !bo?.ponto?.equipamento_id) continue;
            const role = boRole(bo.ponto.nome);
            if (!role) continue;
            const eq = String(bo.ponto.equipamento_id).trim();
            (map[eq] ||= { bo: {}, bi: {}, ai: {} }).bo[role] = bo.bo_numero;
          }
          for (const bi of bis) {
            if (!bi?.ativo || !bi?.ponto?.equipamento_id) continue;
            const role = biRole(bi.ponto.nome);
            if (!role) continue;
            const eq = String(bi.ponto.equipamento_id).trim();
            (map[eq] ||= { bo: {}, bi: {}, ai: {} }).bi[role] = bi.bi_numero;
          }
          for (const ai of aisList) {
            if (!ai?.ativo || !ai?.ponto?.equipamento_id) continue;
            const role = aiRole(ai.ponto.nome);
            if (!role) continue;
            const eq = String(ai.ponto.equipamento_id).trim();
            (map[eq] ||= { bo: {}, bi: {}, ai: {} }).ai[role] = { ch: ai.ai_numero, mv0: ai.mv_0, mv100: ai.mv_100 };
          }
        } catch (err) {
          console.warn('[iot-diagram] Falha ao ler ton_bo/bi/ai da TON', tonId, err);
        }
      }));
    } catch (err) {
      console.warn('[iot-diagram] Falha ao carregar serviços ton_bo/ton_bi:', err);
    }
    return map;
  };

  const handleGenerateFirmware = async (simulate: boolean = simulating) => {
    if (!editorRef.current) return;
    if (!window.FirmwareGenerator) {
      alert('Os scripts do gerador de firmware não carregaram. Recarregue a página (Ctrl+F5). Se persistir, avise o suporte.');
      return;
    }
    // Modo simulação/lab: ligado ao botão "Simular" do diagrama. Se a simulação
    // está ativa, o firmware sai em modo LAB — leitores devolvem valores plausíveis
    // (sem periférico real) e o tópico ganha prefixo "TESTE/". Reseta logo após
    // gerar pra não vazar. (Pode forçar via argumento, mas o padrão é o estado.)
    (window as any).IOT_SIMULATE = simulate;
    // Bomba de combustível: o firmware precisa dos números FÍSICOS de BO/BI, mas a
    // bomba não os guarda — a fonte da verdade é o mapeamento PADRÃO da TON
    // (Configurar BOs/BIs → ton_bo/ton_bi). Lê aqui (async, antes de gerar), resolve
    // por PAPEL (pelo nome do ponto: Ligar/Desligar/Solenoide, Cartão/Emergência) e
    // injeta em _bombaIoByEquip pra o gerador (que é síncrono) consumir. Chave = id
    // do equipamento da bomba (vem no ponto do ton_bo/ton_bi).
    const bombaIoByEquip = await buildBombaIoMap();
    // Dispatch V1 + V2: cada gerador só enxerga os próprios tipos (V1 filtra
    // ton1..ton4; V2 filtra ton1v2..ton4v2) — diagrama misto gera N+M projetos.
    const gen = new window.FirmwareGenerator(editorRef.current);
    (gen as any)._bombaIoByEquip = bombaIoByEquip;
    const projects = gen.generateAll();
    if (window.FirmwareGeneratorTonV2) {
      const genV2 = new window.FirmwareGeneratorTonV2(editorRef.current);
      (genV2 as any)._bombaIoByEquip = bombaIoByEquip;
      projects.push(...genV2.generateAll());
    }
    (window as any).IOT_SIMULATE = false;
    if (projects.length === 0) {
      alert('Nenhum controlador TON encontrado no diagrama.');
      return;
    }
    // Resolve o nome do equipamento NexOn vinculado a cada TON (equipamento_id ->
    // nome, ex: "TON4-1") pra rotular o seletor de controlador. Carrega aqui
    // porque availableTonsForPicker só é populado ao abrir o painel de
    // propriedades de uma TON — e o usuário gera firmware sem necessariamente
    // ter aberto esse painel. Atribui direto em _displayName pra não depender
    // do timing do setState.
    const idToNome = new Map<string, string>();
    try {
      if (unidadeId) {
        const { equipamentosApi } = await import('@/services/equipamentos.services');
        const resp = await equipamentosApi.findByUnidade(unidadeId, { limit: 100 });
        (resp.data ?? []).forEach((e: any) => {
          if (e?.id) idToNome.set(String(e.id).trim(), e.nome);
        });
      }
    } catch (err) {
      console.warn('[iot-diagram] Falha ao resolver nomes de TON pro seletor:', err);
    }
    const enriched = projects.map((p: any) => {
      const eqId = (p?.spec?.equipamentoId || '').trim();
      return { ...p, _displayName: (eqId && idToNome.get(eqId)) || '' };
    });
    setFirmwareModal({ projects: enriched, selected: 0, status: 'idle', log: [], binData: null, simulate });
  };

  const firmwareCompile = async () => {
    if (!firmwareModal) return;
    const proj = firmwareModal.projects[firmwareModal.selected];
    setFirmwareModal(prev => prev ? { ...prev, status: 'compiling', log: ['Enviando para compilacao...'] } : null);

    try {
      const resp = await fetch('/iot-compile/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: proj.files, name: proj.name }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setFirmwareModal(prev => prev ? {
          ...prev, status: 'error',
          log: [...prev.log, 'ERRO: ' + (data.error || 'Compilacao falhou'), ...(data.details ? [data.details] : [])],
        } : null);
        return;
      }

      setFirmwareModal(prev => prev ? {
        ...prev, status: 'compiled', binData: data,
        log: [...prev.log,
          `Compilado em ${data.build_time_ms}ms`,
          `Firmware: ${(data.firmware_size / 1024).toFixed(1)} KB`,
          data.ram_usage ? `RAM: ${data.ram_usage} | Flash: ${data.flash_usage}` : '',
          'Pronto para gravar! Conecte a TON via USB e clique "Gravar".',
        ].filter(Boolean),
      } : null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setFirmwareModal(prev => prev ? {
        ...prev, status: 'error',
        log: [...prev.log, 'Erro de conexao: ' + msg],
      } : null);
    }
  };

  const firmwareFlash = async () => {
    if (!firmwareModal?.binData) return;

    setFirmwareModal(prev => prev ? {
      ...prev, status: 'flashing',
      log: [...prev.log, '--- Gravacao via USB (esptool-js) ---'],
    } : null);

    const logFn = (msg: string) => {
      setFirmwareModal(prev => prev ? {
        ...prev, log: [...prev.log, msg],
      } : null);
    };

    const success = await flashESP32(firmwareModal.binData.firmware, logFn);

    setFirmwareModal(prev => prev ? {
      ...prev,
      status: success ? 'done' : 'compiled',
      log: [...prev.log, success
        ? 'Gravacao concluida! Abrindo Serial Monitor...'
        : 'Falha na gravacao. Tente novamente ou baixe o .bin.'],
    } : null);

    // Abrir Serial Monitor automaticamente apos flash bem-sucedido
    if (success) {
      setTimeout(() => setSerialOpen(true), 1000);
    }
  };

  const firmwareDownloadBin = () => {
    if (!firmwareModal?.binData) return;
    const binBytes = Uint8Array.from(atob(firmwareModal.binData.firmware), c => c.charCodeAt(0));
    const blob = new Blob([binBytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${firmwareModal.projects[firmwareModal.selected].name}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const firmwareDownloadCode = () => {
    if (!firmwareModal) return;
    const proj = firmwareModal.projects[firmwareModal.selected];
    const content = Object.entries(proj.files).map(([path, code]) =>
      `// ========== ${path} ==========\n${code}\n`
    ).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name}-source.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Implanta OTA no TON em campo via /api/v1/equipamentos/:id/ota/compilar-e-publicar.
   * Pré-requisito: o componente TON do diagrama precisa ter `equipamento_id`
   * preenchido (CUID 26 chars de um equipamento NexOn com mqtt_habilitado).
   *
   * Backend (OtaService.compileAndPublish):
   *   1. Consulta equipamentos.topico_mqtt
   *   2. Chama firmware-compiler /publish-artifact
   *   3. Publica MQTT em <topico_mqtt>/ota/cmd com {url, version, md5}
   *   4. TON recebe, baixa via HTTP, valida MD5 com Update.h, reinicia.
   */
  const firmwareDeployOta = async () => {
    if (!firmwareModal) return;
    const proj = firmwareModal.projects[firmwareModal.selected];
    const equipamentoId = (proj.spec?.equipamentoId || '').trim();

    if (!equipamentoId) {
      setFirmwareModal(prev => prev ? {
        ...prev, status: 'error',
        log: [...prev.log,
          'ERRO: TON sem equipamento NexOn vinculado.',
          'Abra as Propriedades do controlador (duplo-clique no diagrama)',
          'e preencha o campo "Equipamento NexOn (ID)".',
        ],
      } : null);
      return;
    }

    // Versão derivada do timestamp local — backend valida o formato com regex.
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const version = `1.0.${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

    setFirmwareModal(prev => prev ? {
      ...prev, status: 'deploying',
      log: [...prev.log,
        '--- Implantando OTA via NestJS ---',
        `Equipamento: ${equipamentoId}`,
        `Versão alvo: ${version}`,
        'Compilando + publicando artefato + comando MQTT (~60s)...',
      ],
    } : null);

    try {
      const body: OtaCompileFiles & { version: string } = {
        files: proj.files,
        name: proj.name,
        version,
      };
      // Timeout estendido: compile (~40s) + publish-artifact + publish MQTT
      // pode passar de 60s. Default global do api é 30s, insuficiente.
      const resp = await api.post<OtaCompilePublishResponse>(
        `/equipamentos/${encodeURIComponent(equipamentoId)}/ota/compilar-e-publicar`,
        body,
        { timeout: 180000 },
      );
      // resp.data já vem desempacotado pelo interceptor (vide src/config/api.ts).
      const payload = resp.data;
      setFirmwareModal(prev => prev ? {
        ...prev, status: 'deployed',
        log: [...prev.log,
          'Comando OTA publicado!',
          `Tópico: ${payload.topic}`,
          `URL: ${payload.url}`,
          `Tamanho: ${(payload.size / 1024).toFixed(1)} KB`,
          `MD5: ${payload.md5.slice(0, 12)}…`,
          'TON deve baixar e aplicar em ~30-90s. Após reiniciar e publicar 3 vezes,',
          'o firmware é confirmado válido (caso contrário, rollback automático).',
        ],
      } : null);
    } catch (e: unknown) {
      // axios coloca a resposta de erro em e.response.data; o envelope do NexOn eh
      // { success: false, error: { code, message }, ... }
      const stringify = (v: unknown): string =>
        typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);
      const err = e as { response?: { data?: { error?: { message?: unknown; code?: unknown }; message?: unknown; details?: unknown }; status?: number }; message?: string };
      const data = err.response?.data;
      const msg =
        stringify(data?.error?.message) ||
        stringify(data?.error?.code) ||
        stringify(data?.message) ||
        err.message ||
        `HTTP ${err.response?.status ?? '???'}`;
      const detail = stringify(data?.details);
      setFirmwareModal(prev => prev ? {
        ...prev, status: 'error',
        log: [...prev.log, 'ERRO: ' + msg, ...(detail ? [detail] : [])],
      } : null);
    }
  };

  const handleCenter = () => {
    editorRef.current?.centerView();
    setZoom(Math.round((editorRef.current?.zoom || 1) * 100));
  };

  const toggleFullscreen = () => {
    const w = containerRef.current?.parentElement?.parentElement;
    if (!w) return;
    if (!document.fullscreenElement) { w.requestFullscreen?.(); setFullscreen(true); }
    else { document.exitFullscreen?.(); setFullscreen(false); }
  };

  // No project selected
  if (!selectedProjectId && !loadingProjects) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
          <span className="text-sm font-medium">Projetos IoT</span>
          <Button variant="outline" size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-3">Nenhum projeto IoT nesta unidade</p>
            <Button onClick={openCreateModal}><Plus className="h-4 w-4 mr-2" /> Criar Primeiro Projeto</Button>
          </div>
        </div>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderPlus className="h-5 w-5" />Novo Projeto IoT</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="pn">Nome do Projeto</Label><Input id="pn" placeholder="Ex: Monitoramento Usina" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createProject(); }} autoFocus /></div></div>
            <DialogFooter><Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button><Button onClick={createProject} disabled={!newProjectName.trim()}>Criar Projeto</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (catalogLoadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-destructive font-medium">Editor IoT indisponivel</div>
          <p className="text-sm text-muted-foreground">{catalogLoadError}</p>
          <p className="text-xs text-muted-foreground">
            Verifique se o backend esta no ar e que o endpoint /iot-catalog/device-catalog.js responde.
            Recarregue a pagina apos confirmar.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Recarregar pagina
          </Button>
        </div>
      </div>
    );
  }

  if (loadingProjects) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* View mode header */}
      {!editMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2 bg-muted/30 min-h-[48px]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
            <h3 className="hidden sm:flex text-sm font-semibold text-foreground items-center gap-2 shrink-0">
              <Network className="h-4 w-4" />
              Diagrama IoT
            </h3>
            {/* Project tabs */}
            <div className="flex items-center gap-0.5 sm:ml-2 min-w-0 overflow-x-auto">
              {projects.map(p => (
                <div key={p.id} className="flex items-center">
                  {renamingId === p.id ? (
                    <input autoFocus className="px-2 py-0.5 text-xs bg-background border rounded w-32" value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => renameProject(p.id, renameValue)}
                      onKeyDown={e => { if (e.key === 'Enter') renameProject(p.id, renameValue); if (e.key === 'Escape') setRenamingId(null); }}
                    />
                  ) : (
                    <button onClick={() => setSelectedProjectId(p.id)} onDoubleClick={() => { setRenamingId(p.id); setRenameValue(p.nome); }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors truncate max-w-[55vw] sm:max-w-none ${p.id === selectedProjectId ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                      title="Duplo-clique para renomear">{p.nome}</button>
                  )}
                </div>
              ))}
              <button onClick={openCreateModal} className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted shrink-0" title="Novo projeto"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            <span className="hidden md:inline text-muted-foreground text-xs ml-2 shrink-0">{compCount} componentes · {connCount} conexões</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" onClick={handleCenter}><ZoomIn className="h-4 w-4 mr-1" />{zoom}%</Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
            <Button variant="outline" size="sm" onClick={toggleSimulation}>
              <Play className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{simulating ? 'Parar' : 'Simular'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleGenerateFirmware()}
              className={simulating ? 'border-amber-500 text-amber-600' : undefined}
              title={simulating
                ? 'Modo Simular ATIVO → gera firmware de LAB: dados plausíveis (sem periférico real), publica em TESTE/, sem OTA. Pare a simulação pra gerar o firmware real.'
                : 'Gera o firmware real do projeto'}>
              <Download className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{simulating ? 'Firmware 🧪' : 'Firmware'}</span>
            </Button>
            {simulating && (
              <Button variant="outline" size="sm" onClick={openCmdSimModal}
                className="border-amber-500 text-amber-600"
                title="Envia comando de teste pra TON de simulação (publica em TESTE/<tópico>/cmd). Testa o pipeline de comando sem tocar o equipamento de produção.">
                <Zap className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Comando 🧪</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setBenchTestModal({ selectedTest: 0, checklist: {} })}>
              <Zap className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Teste Bancada</span>
            </Button>
            <Button variant={serialOpen ? 'default' : 'outline'} size="sm" onClick={() => setSerialOpen(!serialOpen)}>
              <Terminal className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Serial</span>
            </Button>
            <Button variant="outline" size="sm" onClick={toggleEdit}>
              <Edit3 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Editar</span>
            </Button>
          </div>
        </div>
      )}

      {/* Edit mode toolbar — matches Unifilar style */}
      {editMode && (
        <div className="border-b bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Network className="h-5 w-5" />
              Diagrama IoT
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={saveCurrentDiagram} disabled={saving} className="flex items-center gap-2">
                {saving ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" /><span className="hidden sm:inline">Salvando...</span></>
                ) : (
                  <><Save className="h-4 w-4" /><span className="hidden sm:inline">Salvar</span></>
                )}
              </Button>
              <div className="hidden md:flex text-xs text-muted-foreground items-center gap-3">
                <span>Componentes: {compCount}</span>
                <span>Conexões: {connCount}</span>
              </div>
              <Button variant="default" size="sm" onClick={toggleEdit} disabled={saving} className="flex items-center gap-2">
                <X className="h-4 w-4" /><span className="hidden sm:inline">Sair da Edição</span>
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 px-3 pb-3">
            {/* Tool mode */}
            <div className="flex items-center gap-2 border-r pr-4">
              <span className="text-sm font-medium">Modo:</span>
              <div className="flex gap-1">
                <Button variant={toolMode === 'move' ? 'default' : 'outline'} size="sm" onClick={() => setToolMode('move')} className="flex items-center gap-1">
                  <Move className="h-4 w-4" />Mover
                </Button>
                <Button variant={toolMode === 'select' ? 'default' : 'outline'} size="sm" onClick={() => setToolMode('select')} className="flex items-center gap-1">
                  <MousePointer2 className="h-4 w-4" />Selecionar
                </Button>
              </div>
            </div>
            {/* Add component */}
            <div className="flex items-center gap-2 border-r pr-4">
              <span className="text-sm font-medium">Adicionar:</span>
              <select
                className="h-8 px-3 py-1 text-sm border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[220px]"
                onChange={(e) => { if (e.target.value) { handleAddComponent(e.target.value); e.target.value = ''; } }}
                defaultValue=""
              >
                <option value="" disabled>Selecione um equipamento</option>
                {window.CATEGORIES?.map((cat: any) => (
                  <optgroup key={cat.id} label={cat.label}>
                    {cat.types.map((typeId: string) => {
                      const t = window.COMPONENT_TYPES?.[typeId];
                      return t ? <option key={typeId} value={typeId}>{t.label}</option> : null;
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
            {/* Zoom */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCenter}><ZoomIn className="h-4 w-4 mr-1" />{zoom}%</Button>
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div id="iotDiagramCanvas" ref={containerRef} className="min-h-[360px] sm:min-h-[500px]" style={{ position: 'relative', overflow: 'hidden', background: '#0a0a0a', flex: '1 1 0%' }} />

      {/* Connection Context Menu */}
      {connMenu && (
        <div
          className="fixed z-[9999] rounded-lg shadow-2xl p-1.5 min-w-[180px] border"
          data-conn-menu
          style={{ left: connMenu.x, top: connMenu.y, background: '#1a1a2e', borderColor: '#2a2a4a' }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-xs font-bold text-white border-b border-white/10 mb-1">
            Conexão: {connMenu.conn.style?.toUpperCase()}
          </div>
          {connMenu.allowed.map((style: string) => (
            <button
              key={style}
              className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors"
              style={{
                color: connMenu.conn.style === style ? '#60a5fa' : '#e2e8f0',
                fontWeight: connMenu.conn.style === style ? 600 : 400,
                background: connMenu.conn.style === style ? 'rgba(96,165,250,0.1)' : 'transparent',
              }}
              onMouseEnter={e => { if (connMenu.conn.style !== style) (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = connMenu.conn.style === style ? 'rgba(96,165,250,0.1)' : 'transparent'; }}
              onClick={() => {
                if (editorRef.current) {
                  const c = editorRef.current.connections.find((x: any) => x.id === connMenu.conn.id);
                  if (c) { c.style = style; editorRef.current._renderAll(); editorRef.current.onChange?.(); }
                }
                setConnMenu(null);
              }}
            >
              {connMenu.conn.style === style ? '✓' : '\u00A0\u00A0'} {style.toUpperCase()}
            </button>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, paddingTop: 4 }}>
            <button
              className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors"
              style={{ color: '#f87171' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(248,113,113,0.1)'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
              onClick={() => {
                if (editorRef.current) {
                  editorRef.current.removeConnection(connMenu.conn.id);
                  editorRef.current.onChange?.();
                }
                setConnMenu(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir Conexão
            </button>
          </div>
        </div>
      )}

      {/* Component Properties Modal */}
      {/* Associação na CRIAÇÃO: "qual ativo do unifilar é este?" */}
      <Dialog open={!!associarComp} onOpenChange={(o) => { if (!o) setAssociarComp(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Qual {String(associarComp?.type || '').toLowerCase().startsWith('ton')
                ? 'TON'
                : String(associarComp?.type || '').toLowerCase() === 'inversor'
                ? 'inversor'
                : String(associarComp?.type || '').toLowerCase() === 'rele_protecao'
                ? 'relé'
                : 'medidor'} do unifilar é este?
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 max-h-[50dvh] overflow-y-auto py-1">
            {associarLista.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">
                Nenhum ativo dessa família disponível nesta unidade.
                {!String(associarComp?.type || '').toLowerCase().startsWith('ton') && ' Crie um novo abaixo.'}
              </p>
            )}
            {associarLista.map((a) => (
              <button
                key={a.id}
                onClick={() => aplicarVinculo(a.id)}
                className="text-left text-sm rounded border border-input px-3 py-2 hover:bg-accent"
              >
                {a.nome}
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={criarNovoAtivo} disabled={associarBusy}>
              <Plus className="h-4 w-4 mr-1" />
              {associarBusy ? 'Criando…' : 'Criar novo'}
            </Button>
            {/* TON sempre tem equipamento (comando/OTA ancoram nele) → sem "sem vínculo". */}
            {associarComp && !String(associarComp.type || '').toLowerCase().startsWith('ton') && (
              <Button variant="outline" onClick={() => setAssociarComp(null)}>
                Deixar sem vínculo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={propsModalOpen} onOpenChange={setPropsModalOpen}>
        <DialogContent className="sm:max-w-2xl w-[92vw] max-h-[85dvh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {propsComp && <div className="w-3 h-3 rounded-full" style={{ background: propsComp._def?.color }} />}
              {propsComp?.props?.name || propsComp?._def?.label || 'Propriedades'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 py-2">
            {propsComp?._def?.fields?.map((f: any) => (
              <Fragment key={f.key}>
                {f.section && (
                  <div className="sm:col-span-2 mt-1 border-b border-border pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {f.section}
                  </div>
                )}
              <div className={`space-y-1 ${(f.wide || f.key === 'equipamento_id') ? 'sm:col-span-2' : ''}`}>
                <Label className="text-xs">{f.label}</Label>
                {/* Caso especial: campo equipamento_id (TON) — vira picker em vez de
                    input texto livre. Lista TONs da unidade categorizados como 'TON'. */}
                {f.key === 'equipamento_id' && (
                  <>
                    <select
                      value={propsValues[f.key] ?? ''}
                      onChange={e =>
                        setPropsValues(prev => ({ ...prev, [f.key]: e.target.value }))
                      }
                      className="w-full h-8 text-sm rounded border border-input bg-background dark:bg-black px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">— Selecionar equipamento do NexON —</option>
                      {availableTonsForPicker.map((ton) => (
                        <option key={ton.id} value={ton.id}>
                          {ton.nome}
                        </option>
                      ))}
                      {/* Se a TON atual nao esta na lista (deletada/categoria diferente), preserva o valor */}
                      {propsValues[f.key]
                        && !availableTonsForPicker.some((t) => t.id === propsValues[f.key])
                        && (
                          <option value={propsValues[f.key]} className="text-amber-600">
                            ⚠ {String(propsValues[f.key])} (fora da unidade ou removido)
                          </option>
                        )}
                    </select>
                    <p className="text-[10px] text-muted-foreground">
                      Vincula o ativo real desta unidade ao nó do IoT (TON, inversor ou medidor).
                    </p>
                    {String(propsComp?.type || '').toLowerCase().startsWith('ton')
                      && !String(propsValues['equipamento_id'] || '').trim() && (
                        <p className="text-[10px] text-sky-600">
                          ℹ Ao <b>salvar</b>, a TON é <b>criada e associada</b> automaticamente
                          (igual aos outros ativos). Preencha o <b>Tópico Base</b> (formato
                          PROPRIETARIO/ESTADO/PLANTA/INSTALACAO) para habilitar comando, OTA e telemetria —
                          pode ser depois.
                        </p>
                      )}
                    {String(propsComp?.type || '').toLowerCase().startsWith('ton')
                      && !!String(propsValues['equipamento_id'] || '').trim()
                      && !String(propsValues['mqtt_topic_base'] || '').trim() && (
                        <p className="text-[10px] text-amber-600">
                          ⚠ TON associada, mas <b>sem Tópico Base</b> — comando, OTA e telemetria ficam
                          inativos até você preencher o tópico e salvar.
                        </p>
                      )}
                  </>
                )}
                {f.key !== 'equipamento_id' && (f.type === 'text' || f.type === 'number') && (
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={propsValues[f.key] ?? ''}
                    placeholder={f.placeholder || ''}
                    onChange={e => setPropsValues(prev => ({ ...prev, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    className="h-8 text-sm"
                  />
                )}
                {f.type === 'toggle' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!propsValues[f.key]}
                      onChange={e => setPropsValues(prev => ({ ...prev, [f.key]: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                  </div>
                )}
                {f.type === 'select' && (
                  <select
                    value={propsValues[f.key] ?? ''}
                    onChange={e => setPropsValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full h-8 text-sm rounded-md border bg-background px-2"
                  >
                    {f.options?.map((o: any) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
                  </select>
                )}
                {f.type === 'device_select' && (
                  <select
                    value={propsValues[f.key] ?? ''}
                    onChange={e => {
                      const catalogId = e.target.value;
                      setPropsValues(prev => {
                        const next: Record<string, unknown> = { ...prev, [f.key]: catalogId };
                        // Auto-preenche dados padrao do modelo selecionado (catalogo legado em JS, dev:any).
                        if (catalogId && typeof getCatalogDevice === 'function') {
                          const dev = getCatalogDevice(catalogId);
                          if (dev) {
                            if (dev.num_mppts !== undefined) next['num_mppts'] = dev.num_mppts;
                            if (dev.num_strings !== undefined) next['num_strings'] = dev.num_strings;
                            if (dev.modbus_address_default !== undefined && !next['modbus_address']) {
                              next['modbus_address'] = dev.modbus_address_default;
                            }
                          }
                        }
                        return next;
                      });
                    }}
                    className="w-full h-8 text-sm rounded-md border bg-background px-2"
                  >
                    <option value="">-- Selecionar Modelo --</option>
                    {(typeof getCatalogByType === 'function' ? getCatalogByType(f.device_type) : []).map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.fabricante} {d.modelo}{d.protocolo ? ` · ${String(d.protocolo).toUpperCase()}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              </Fragment>
            ))}

            {/* Power Meter: disjuntor associado (o PM é só-IoT; exibido via disjuntor). */}
            {isPmComp(propsComp?.type) && (
              <div className="space-y-1 pt-2 border-t sm:col-span-2">
                <Label className="text-xs">Disjuntor associado (unifilar)</Label>
                <select
                  value={propsValues['disjuntor_equipamento_id'] ?? ''}
                  onChange={e => setPropsValues(prev => ({ ...prev, disjuntor_equipamento_id: e.target.value }))}
                  className="w-full h-8 text-sm rounded border border-input bg-background dark:bg-black px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Nenhum —</option>
                  {disjuntoresUnidade.map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                  {propsValues['disjuntor_equipamento_id']
                    && !disjuntoresUnidade.some(d => d.id === propsValues['disjuntor_equipamento_id'])
                    && (
                      <option value={propsValues['disjuntor_equipamento_id']} className="text-amber-600">
                        ⚠ {String(propsValues['disjuntor_equipamento_id'])} (fora da unidade ou removido)
                      </option>
                    )}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Este medidor é só-IoT (coleta de dados). Seus dados aparecem ao clicar no disjuntor associado no unifilar.
                </p>
              </div>
            )}

            {/* Show connections */}
            {propsComp && editorRef.current && (() => {
              const conns = editorRef.current.connections.filter((c: any) =>
                c.from.componentId === propsComp.id || c.to.componentId === propsComp.id
              );
              if (conns.length === 0) return null;
              return (
                <div className="pt-2 border-t">
                  <Label className="text-xs">Conexões</Label>
                  <div className="space-y-1 mt-1">
                    {conns.map((c: any) => {
                      const otherId = c.from.componentId === propsComp.id ? c.to.componentId : c.from.componentId;
                      const other = editorRef.current.components.find((x: any) => x.id === otherId);
                      return (
                        <div key={c.id} className="flex justify-between text-xs p-1.5 rounded bg-muted/50">
                          <span className="font-medium">{c.style?.toUpperCase()}</span>
                          <span className="text-muted-foreground">{other?.props?.name || '?'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {/* Botao "Configurar BOs" — so para TONs com reles (TON3/TON4).
                Exige equipamento_id ja vinculado a um equipamento real do NexOn. */}
            {propsComp?._def?.has_relays === true && (
              <Button
                type="button"
                variant="outline"
                disabled={!String(propsValues.equipamento_id ?? '').trim()}
                title={
                  String(propsValues.equipamento_id ?? '').trim()
                    ? 'Configurar mapeamento de cada rele para equipamentos da unidade'
                    : 'Defina o Equipamento NexOn primeiro'
                }
                onClick={() => {
                  const eid = String(propsValues.equipamento_id ?? '').trim();
                  if (!eid) return;
                  setBoConfigTonId(eid);
                  setBoConfigTonNome(
                    String(propsValues.name ?? propsComp?._def?.label ?? 'TON'),
                  );
                  setBoConfigOpen(true);
                }}
                className="mr-auto"
              >
                Configurar BOs
              </Button>
            )}
            {/* Botao "Configurar BIs" — toda TON tem 6 entradas opto integradas.
                Exige equipamento_id ja vinculado a um equipamento real do NexOn. */}
            {(propsComp?._def?.integrated?.opto_inputs?.count ?? 0) > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={!String(propsValues.equipamento_id ?? '').trim()}
                title={
                  String(propsValues.equipamento_id ?? '').trim()
                    ? 'Configurar entradas digitais e ver estado ao vivo'
                    : 'Defina o Equipamento NexOn primeiro'
                }
                onClick={() => {
                  const eid = String(propsValues.equipamento_id ?? '').trim();
                  if (!eid) return;
                  setBiConfigTonId(eid);
                  setBiConfigTonNome(
                    String(propsValues.name ?? propsComp?._def?.label ?? 'TON'),
                  );
                  setBiConfigOpen(true);
                }}
              >
                Configurar BIs
              </Button>
            )}
            {/* Botao "Configurar AIs" — entradas analogicas (AN1/AN2): nivel do tanque etc. */}
            {String(propsComp?.type ?? '').toLowerCase().startsWith('ton') && (
              <Button
                type="button"
                variant="outline"
                disabled={!String(propsValues.equipamento_id ?? '').trim()}
                title={
                  String(propsValues.equipamento_id ?? '').trim()
                    ? 'Configurar entradas analogicas (nivel do tanque etc.) + escala mV'
                    : 'Defina o Equipamento NexOn primeiro'
                }
                onClick={() => {
                  const eid = String(propsValues.equipamento_id ?? '').trim();
                  if (!eid) return;
                  setAiConfigTonId(eid);
                  setAiConfigTonNome(
                    String(propsValues.name ?? propsComp?._def?.label ?? 'TON'),
                  );
                  setAiConfigOpen(true);
                }}
              >
                Configurar AIs
              </Button>
            )}
            {/* Botao "Comandos" — TONs: envia reles(TON3/4)/transistores/status ao TON real. */}
            {String(propsComp?.type ?? '').toLowerCase().startsWith('ton') && (
              <Button
                type="button"
                variant="outline"
                disabled={!String(propsValues.equipamento_id ?? '').trim()}
                title={
                  String(propsValues.equipamento_id ?? '').trim()
                    ? 'Enviar comandos (relés/transistores/status) ao TON'
                    : 'Defina o Equipamento NexON primeiro'
                }
                onClick={() => {
                  const eid = String(propsValues.equipamento_id ?? '').trim();
                  if (!eid) return;
                  setCmdRealModal({
                    id: eid,
                    nome: String(propsValues.name ?? propsComp?._def?.label ?? 'TON'),
                    topico_mqtt: String(propsValues.mqtt_topic_base ?? '') || undefined,
                    // Modelo vem do DIAGRAMA (ex.: 'ton4v2'), nao de tipos_equipamentos —
                    // la' todas as TON apontam pra linha generica 'TON' e o painel da v2
                    // (r7/r8 + PWM) nunca seria encontrado.
                    tipo: String(propsComp?.type ?? '') || undefined,
                  });
                }}
              >
                Comandos
              </Button>
            )}
            {/* Botao "Configurar I/O" — devices com BI/BO no catalogo (relé, etc.). */}
            {tipoTemIo(propsComp?.type) && (
              <Button type="button" variant="outline" onClick={() => setIoModalOpen(true)}>
                Configurar I/O
              </Button>
            )}
            <Button variant="outline" onClick={() => setPropsModalOpen(false)}>Fechar</Button>
            <Button onClick={saveComponentProps}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TonBoConfigModal
        open={boConfigOpen}
        onClose={() => setBoConfigOpen(false)}
        tonId={boConfigTonId}
        unidadeId={unidadeId}
        tonNome={boConfigTonNome}
      />

      <TonBiConfigModal
        open={biConfigOpen}
        onClose={() => setBiConfigOpen(false)}
        tonId={biConfigTonId}
        unidadeId={unidadeId}
        tonNome={biConfigTonNome}
      />

      <TonAiConfigModal
        open={aiConfigOpen}
        onClose={() => setAiConfigOpen(false)}
        tonId={aiConfigTonId}
        unidadeId={unidadeId}
        tonNome={aiConfigTonNome}
      />

      {/* Comandos reais do TON (relés/transistores/status) — reusa o modal do unifilar. */}
      <EquipamentoCommandModal
        open={!!cmdRealModal}
        onClose={() => setCmdRealModal(null)}
        equipamento={{
          id: cmdRealModal?.id ?? '',
          nome: cmdRealModal?.nome ?? '',
          categoria: 'TON',
          tipo: cmdRealModal?.tipo ?? null,
          topico_mqtt: cmdRealModal?.topico_mqtt ?? null,
        }}
      />

      {/* Config de I/O genérica (catálogo-driven): relé e devices com BI/BO. */}
      <DeviceIoConfigModal
        open={ioModalOpen}
        onClose={() => setIoModalOpen(false)}
        compType={String(propsComp?.type ?? '')}
        compNome={String(propsValues.name ?? propsComp?._def?.label ?? '')}
        catalogId={String(propsValues.catalog_id ?? '')}
        unidadeId={unidadeId}
        ioConfig={(propsValues.io_config ?? {}) as DeviceIoConfig}
        onSave={(ioCfg) => {
          const merged = { ...propsValues, io_config: ioCfg };
          setPropsValues(merged);
          if (propsComp && editorRef.current) {
            editorRef.current.updateComponentProps(propsComp.id, merged);
            void saveCurrentDiagram();
          }
        }}
        onEnviarComando={async (cmdId, cmdLabel) => {
          if (!propsComp || !editorRef.current) return;
          // Resolve a TON gateway pela topologia (BFS nas conexões do diagrama):
          // o comando do relé vai pro tópico da TON que o lê; a TON faz o write Modbus.
          const ed: any = editorRef.current;
          const comps: any[] = ed.components ?? [];
          const conns: any[] = ed.connections ?? [];
          const isTon = (t: string) => String(t || '').toLowerCase().startsWith('ton');
          const adj = new Map<string, string[]>();
          for (const c of conns) {
            const a = c?.from?.componentId, b = c?.to?.componentId;
            if (!a || !b) continue;
            if (!adj.has(a)) adj.set(a, []);
            if (!adj.has(b)) adj.set(b, []);
            adj.get(a)!.push(b); adj.get(b)!.push(a);
          }
          const byId = new Map<string, any>(comps.map((c) => [c.id, c]));
          const start = propsComp.id;
          const visited = new Set<string>([start]);
          const queue: string[] = [start];
          let ton: any = null;
          while (queue.length) {
            const id = queue.shift() as string;
            const comp = byId.get(id);
            if (id !== start && comp && isTon(comp.type) && String(comp.props?.equipamento_id ?? '').trim()) { ton = comp; break; }
            for (const nb of (adj.get(id) ?? [])) { if (!visited.has(nb)) { visited.add(nb); queue.push(nb); } }
          }
          const { toast } = await import('sonner');
          if (!ton) { toast.error('TON gateway não encontrada — ligue o relé a uma TON (com equipamento) no diagrama.'); return; }
          const tonEquipId = String(ton.props.equipamento_id).trim();
          const relayName = String(propsValues.name ?? propsComp?._def?.label ?? '');
          try {
            const { equipamentosApi } = await import('@/services/equipamentos.services');
            const payload = JSON.stringify({ device: relayName, cmd: cmdId });
            const res = await equipamentosApi.sendCommand(tonEquipId, payload as never, false);
            const msg = (res as { msg?: string } | undefined)?.msg;
            toast.success(`"${cmdLabel}" enviado via ${String(ton.props?.name ?? 'TON')}`, { description: typeof msg === 'string' ? msg : undefined });
          } catch {
            toast.error(`Falha ao enviar "${cmdLabel}"`);
          }
        }}
      />

      {/* Create Project Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderPlus className="h-5 w-5" />Novo Projeto IoT</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="project-name">Nome do Projeto</Label><Input id="project-name" placeholder="Ex: Monitoramento Usina" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createProject(); }} autoFocus /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button><Button onClick={createProject} disabled={!newProjectName.trim()}>Criar Projeto</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Serial Monitor Sheet */}
      <Sheet open={serialOpen} onOpenChange={(open: boolean) => { if (!open) { setSerialOpen(false); } }}>
        <SheetContent side="right" className={`${serialPanelCount === 2 ? 'w-[850px] sm:max-w-[850px]' : 'w-[430px] sm:max-w-[430px]'} p-0 flex flex-col [&>button.absolute]:text-gray-400 [&>button.absolute]:hover:text-white [&>button.absolute]:bg-gray-800 [&>button.absolute]:rounded [&>button.absolute]:p-1 [&>button.absolute]:top-2.5 [&>button.absolute]:right-2.5 [&>button.absolute]:z-10`}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-900 shrink-0 pr-12">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-green-400" />
              <span className="text-sm font-bold text-white">Serial Monitor</span>
            </div>
            <button
              onClick={() => setSerialPanelCount(serialPanelCount === 1 ? 2 : 1)}
              className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              title={serialPanelCount === 1 ? 'Abrir segundo monitor' : 'Fechar segundo monitor'}
            >
              {serialPanelCount === 1 ? '+ Dual' : '- Single'}
            </button>
          </div>

          {/* Panel container */}
          <div className={`flex-1 flex ${serialPanelCount === 2 ? 'flex-row divide-x divide-gray-700' : 'flex-col'}`} style={{ minHeight: 0 }}>
            {Array.from({ length: serialPanelCount }).map((_, idx) => {
              const panel = serialPanels[idx];
              return (
                <div key={idx} className="flex-1 flex flex-col min-w-0" style={{ minHeight: 0 }}>
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${panel.connected ? 'bg-green-500' : 'bg-gray-600'}`} />
                      <span className="text-[11px] text-gray-400 truncate max-w-[150px]">
                        {panel.connected ? panel.label || 'Conectado' : `Monitor ${idx + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!panel.connected ? (
                        <button onClick={() => serialConnect(idx)} className="text-[10px] px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700">
                          Conectar
                        </button>
                      ) : (
                        <button onClick={() => serialDisconnect(idx)} className="text-[10px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700">
                          Desconectar
                        </button>
                      )}
                      <button onClick={() => setSerialPanels(prev => {
                        const next = [...prev] as [typeof prev[0], typeof prev[1]];
                        next[idx] = { ...next[idx], lines: [] };
                        return next;
                      })} className="text-[10px] px-2 py-0.5 bg-gray-700 text-gray-400 rounded hover:bg-gray-600">
                        Limpar
                      </button>
                    </div>
                  </div>

                  {/* Terminal */}
                  <div
                    ref={serialLogRefs[idx]}
                    className="flex-1 overflow-y-auto bg-gray-950 px-2 py-1 font-mono text-[11px] leading-4 select-text"
                    style={{ minHeight: 0 }}
                  >
                    {panel.lines.length === 0 && (
                      <div className="text-gray-600 py-8 text-center text-[10px]">
                        <Terminal className="h-6 w-6 mx-auto mb-1 opacity-20" />
                        Clique "Conectar" | 115200 baud
                      </div>
                    )}
                    {panel.lines.map((line, i) => (
                      <div key={i} className={
                        line.startsWith('>')        ? 'text-cyan-400' :
                        line.startsWith('[OK]')     ? 'text-green-400' :
                        line.startsWith('[FAIL]')   ? 'text-red-400' :
                        line.startsWith('[ERRO')    ? 'text-red-400' :
                        line.startsWith('[CONECTADO') ? 'text-green-400 font-bold' :
                        line.startsWith('[DESCONECTADO') ? 'text-yellow-400 font-bold' :
                        line.startsWith('[MQTT]')   ? 'text-blue-400' :
                        line.startsWith('[WIFI]')   ? 'text-purple-400' :
                        line.startsWith('[LORA]')   ? 'text-orange-400' :
                        line.startsWith('[CMD]')    ? 'text-yellow-300' :
                        line.startsWith('[SCAN]')   ? 'text-teal-400' :
                        line.startsWith('[ETH]')    ? 'text-indigo-400' :
                        line.startsWith('===')      ? 'text-white font-bold' :
                                                      'text-gray-300'
                      }>{line}</div>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="border-t border-gray-700 bg-gray-900 px-2 py-1.5 flex gap-1 shrink-0">
                    <input
                      type="text"
                      value={panel.input}
                      onChange={e => setSerialPanels(prev => {
                        const next = [...prev] as [typeof prev[0], typeof prev[1]];
                        next[idx] = { ...next[idx], input: e.target.value };
                        return next;
                      })}
                      onKeyDown={e => { if (e.key === 'Enter') serialSend(idx, panel.input); }}
                      placeholder={panel.connected ? 'Comando...' : 'Conecte primeiro'}
                      disabled={!panel.connected}
                      className="flex-1 bg-gray-800 text-white text-[11px] font-mono px-2 py-1 rounded border border-gray-700 focus:border-green-500 focus:outline-none disabled:opacity-40 min-w-0"
                    />
                    <button
                      onClick={() => serialSend(idx, panel.input)}
                      disabled={!panel.connected || !panel.input.trim()}
                      className="px-2 py-1 bg-green-600 text-white text-[10px] rounded hover:bg-green-700 disabled:opacity-30 shrink-0"
                    >
                      Enviar
                    </button>
                  </div>

                  {/* Quick commands */}
                  {panel.connected && (
                    <div className="border-t border-gray-700 bg-gray-900 px-2 py-1 shrink-0">
                      <div className="flex flex-wrap gap-0.5">
                        {['guia','help','id','all','scan','din','rtest','trtest','adc','pwmtest','eth','sd','modbus','lora eco'].map(cmd => (
                          <button
                            key={cmd}
                            onClick={() => serialSend(idx, cmd)}
                            className="px-1.5 py-0.5 text-[9px] font-mono bg-gray-800 text-green-400 rounded border border-gray-700 hover:bg-gray-700 hover:border-green-600"
                          >
                            {cmd}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Painel de Comando de Teste (modo Simular) — data-driven pelos pontos cadastrados, em TESTE/ */}
      {cmdSimModal && (
        <Dialog open={true} onOpenChange={() => setCmdSimModal(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>🧪 Comando de Teste (Simulação)</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-amber-600">
                Aciona os pontos <b>cadastrados</b> desta TON em <code>TESTE/&lt;tópico&gt;/cmd</code> — mesmo pulso ON→OFF do Unifilar, no tópico de teste. Os relés acionam de verdade na bancada. Não toca produção.
              </p>
              {/* TON selector */}
              <div className="flex flex-wrap gap-1">
                {cmdSimModal.tons.map((t, i) => (
                  <Button key={t.id} size="sm" variant={i === cmdSimModal.selected ? 'default' : 'outline'}
                    onClick={() => selectCmdSimTon(i)}>{t.name}</Button>
                ))}
              </div>

              {/* Board de bancada — auto-casado pelo NOME que o firmware 🧪 anuncia
                  (você não lida com MAC). MAC distinto do de campo => nunca aciona o real. */}
              {(() => {
                const tonName = cmdSimModal.tons[cmdSimModal.selected]?.name;
                const matched = cmdSimModal.benchSats.find((s: any) => s.label && s.label === tonName);
                const selectedSat = cmdSimModal.benchSats.find((s: any) => s.mac === cmdSimModal.testMac);
                return (
                  <div className="border rounded p-2 bg-amber-50/40">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-semibold">Board de bancada</Label>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                        onClick={loadBenchSats} disabled={cmdSimModal.benchLoading}>
                        {cmdSimModal.benchLoading ? '…' : '↻ atualizar'}
                      </Button>
                    </div>
                    {cmdSimModal.benchLoading ? (
                      <p className="text-[11px] text-muted-foreground">procurando boards de bancada…</p>
                    ) : cmdSimModal.benchSats.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Nenhum board vivo no TESTE/. Grave o <b>Firmware 🧪</b> de <b>{tonName}</b> e ligue o board — ele se identifica e aparece aqui sozinho.
                      </p>
                    ) : matched ? (
                      <p className="text-[11px] text-green-700">
                        ✓ <b>{tonName}</b> → board vivo <code>{matched.mac}</code> ({Math.round((matched.ageMs || 0) / 1000)}s). Comandos roteados pra ele — cadastro intocado.
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] text-amber-700">
                          Nenhum board anunciou ser <b>{tonName}</b>. Regrave o <b>Firmware 🧪</b> (passa a se identificar sozinho) ou escolha manualmente:
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {cmdSimModal.benchSats.map((s: any) => (
                            <Button key={s.mac} size="sm" variant={cmdSimModal.testMac === s.mac ? 'default' : 'outline'}
                              className="h-7 text-[11px]"
                              onClick={() => setCmdSimModal((m) => m && ({ ...m, testMac: s.mac, result: null }))}>
                              <span className={s.label ? '' : 'font-mono'}>{s.label || s.mac}</span>
                              <span className="opacity-50 ml-1">{Math.round((s.ageMs || 0) / 1000)}s</span>
                            </Button>
                          ))}
                        </div>
                        {selectedSat && (
                          <p className="text-[10px] text-green-700 mt-1">
                            Roteando pro board <code>{selectedSat.label || selectedSat.mac}</code> (cadastro intocado).
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {cmdSimModal.loading && <p className="text-sm text-muted-foreground">Carregando pontos cadastrados…</p>}
              {cmdSimModal.loadErr && <p className="text-sm text-red-600">Erro ao carregar pontos: {cmdSimModal.loadErr}</p>}

              {!cmdSimModal.loading && !cmdSimModal.loadErr && (
                <>
                  {/* COMANDOS (BOs) agrupados por dispositivo */}
                  {cmdSimModal.bos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum comando cadastrado nesta TON. Configure os pontos (BO) em <b>"Configurar pontos"</b> do equipamento — vincule o dispositivo (ex. SoftStarter) a um relé.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Comandos</Label>
                      {Object.entries(groupBosByDevice(cmdSimModal.bos)).map(([dev, list]) => (
                        <div key={dev} className="border rounded p-2">
                          <div className="text-xs text-muted-foreground mb-1">{dev}</div>
                          <div className="flex flex-wrap gap-1">
                            {(list as any[]).map((bo: any) => (
                              <Button key={bo.id || bo.bo_numero} size="sm" variant="outline" className="h-7"
                                disabled={cmdSimModal.acting === bo.ponto.id}
                                onClick={() => acionarSimPonto(bo)}>
                                <Power className="h-3 w-3 mr-1" />
                                {bo.ponto.nome}<span className="opacity-50 ml-1">R{bo.bo_numero}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* STATUS (BIs cadastrados) */}
                  {cmdSimModal.bis.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Status (entradas cadastradas)</Label>
                      <div className="flex flex-wrap gap-1">
                        {cmdSimModal.bis.map((bi: any) => (
                          <span key={bi.id || bi.bi_numero} className="text-xs border rounded px-2 py-0.5 text-muted-foreground">
                            {bi.ponto.nome} <span className="opacity-50">({bi.ponto.equipamento_nome} · D{bi.bi_numero})</span>
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Estado ao vivo do BI ainda não em simulação (o backend lê do tópico real, não do TESTE/).</p>
                    </div>
                  )}
                </>
              )}

              {/* Resultado do acionamento */}
              {cmdSimModal.result && (
                <div className={`text-sm rounded p-2 ${cmdSimModal.result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {cmdSimModal.result.ok ? '✅ ' : '❌ '}{cmdSimModal.result.text}
                </div>
              )}

              {/* Comando manual (avançado) */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Comando manual (avançado)</summary>
                <div className="flex gap-2 mt-1">
                  <Input value={cmdSimModal.manualCmd}
                    onChange={(e) => setCmdSimModal({ ...cmdSimModal, manualCmd: e.target.value })}
                    placeholder="ex: r1 on, status"
                    onKeyDown={(e) => { if (e.key === 'Enter') sendSimManual(); }} />
                  <Button size="sm" onClick={sendSimManual} disabled={cmdSimModal.sendingManual || !cmdSimModal.manualCmd.trim()}>
                    {cmdSimModal.sendingManual ? '…' : 'Enviar'}
                  </Button>
                </div>
              </details>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bench Test Modal */}
      {benchTestModal && window.BENCH_TESTS && (
        <Dialog open={true} onOpenChange={() => setBenchTestModal(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Teste de Bancada
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Test selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Tipo de Teste:</span>
                <select
                  className="h-8 px-3 py-1 text-sm border rounded-md bg-background flex-1"
                  value={benchTestModal.selectedTest}
                  onChange={e => setBenchTestModal({ selectedTest: parseInt(e.target.value), checklist: {} })}
                >
                  {window.BENCH_TESTS.map((t: any, i: number) => (
                    <option key={t.id} value={i}>{t.name} v{t.version} — {t.category}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const test = window.BENCH_TESTS[benchTestModal.selectedTest];
                if (!test) return null;
                return (
                  <>
                    {/* Description */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                      <p className="text-sm">{test.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Compativel: {test.targets.map((t: string) => t.toUpperCase()).join(', ')}
                      </p>
                    </div>

                    {/* Instructions */}
                    <div>
                      <p className="text-sm font-medium mb-2">Instrucoes:</p>
                      <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
                        {test.instructions.map((inst: string, i: number) => (
                          <li key={i}>{inst}</li>
                        ))}
                      </ol>
                    </div>

                    {/* Commands */}
                    {test.commands.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Comandos Serial Monitor:</p>
                        <div className="bg-gray-900 rounded-md p-3 max-h-48 overflow-y-auto">
                          <table className="w-full text-xs font-mono">
                            <tbody>
                              {test.commands.map((c: any, i: number) => (
                                <tr key={i} className="border-b border-gray-700 last:border-0">
                                  <td className="text-green-400 py-1 pr-4 whitespace-nowrap font-bold">{c.cmd}</td>
                                  <td className="text-gray-400 py-1">{c.desc}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Checklist */}
                    {(() => {
                      const totalItens = test.checklist.length;
                      const marcados = test.checklist.filter((c: any) => benchTestModal.checklist[c.key]).length;
                      const todosMarcados = totalItens > 0 && marcados === totalItens;
                      const toggleTodos = () => {
                        const novoEstado = !todosMarcados;
                        setBenchTestModal(prev => prev ? {
                          ...prev,
                          checklist: test.checklist.reduce(
                            (acc: Record<string, boolean>, c: any) => {
                              acc[c.key] = novoEstado;
                              return acc;
                            },
                            { ...prev.checklist },
                          ),
                        } : null);
                      };
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Checklist de Validacao:</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={toggleTodos}
                            >
                              {todosMarcados ? 'Limpar todos' : 'Selecionar todos'}
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {test.checklist.map((c: any) => (
                              <label key={c.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                                <input
                                  type="checkbox"
                                  checked={benchTestModal.checklist[c.key] || false}
                                  onChange={e => setBenchTestModal(prev => prev ? {
                                    ...prev,
                                    checklist: { ...prev.checklist, [c.key]: e.target.checked }
                                  } : null)}
                                  className="rounded"
                                />
                                <span className={benchTestModal.checklist[c.key] ? 'text-green-600 dark:text-green-400 line-through' : ''}>
                                  {c.item}
                                </span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {marcados} / {totalItens} itens verificados
                          </p>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>

            <DialogFooter className="flex gap-2">
              {window.BENCH_TESTS[benchTestModal.selectedTest]?.bin && (
                <>
                  <Button variant="outline" onClick={async () => {
                    const test = window.BENCH_TESTS[benchTestModal.selectedTest];
                    try {
                      const resp = await fetch(`/iot-compile/prebuilt/${test.bin}`);
                      const data = await resp.json();
                      if (data.firmware) {
                        const binBytes = Uint8Array.from(atob(data.firmware), c => c.charCodeAt(0));
                        const blob = new Blob([binBytes], { type: 'application/octet-stream' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${test.bin}`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    } catch (e) {
                      alert('Erro ao baixar firmware de teste');
                    }
                  }}>
                    <Download className="h-4 w-4 mr-1" /> Baixar .bin
                  </Button>
                  <Button onClick={async () => {
                    const test = window.BENCH_TESTS[benchTestModal.selectedTest];
                    try {
                      setBenchTestModal(prev => prev ? { ...prev, checklist: { ...prev.checklist, _flashing: true } } : null);
                      const resp = await fetch(`/iot-compile/prebuilt/${test.bin}`);
                      const data = await resp.json();
                      if (!data.firmware) { alert('Firmware nao encontrado no servidor'); return; }

                      const logs: string[] = [];
                      const success = await flashESP32(data.firmware, (msg) => {
                        logs.push(msg);
                      });

                      if (success) {
                        alert('Firmware de teste gravado com sucesso!\n\nAbra o Serial Monitor (115200 baud) e digite "help".');
                      } else {
                        alert('Falha na gravacao.\n\nLog:\n' + logs.slice(-5).join('\n'));
                      }
                    } catch (e: unknown) {
                      alert('Erro: ' + (e instanceof Error ? e.message : String(e)));
                    } finally {
                      setBenchTestModal(prev => prev ? { ...prev, checklist: { ...prev.checklist, _flashing: false } } : null);
                    }
                  }}>
                    <Zap className="h-4 w-4 mr-1" /> Gravar via USB
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setBenchTestModal(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Firmware Build & Flash Modal */}
      {firmwareModal && (
        <Dialog open={true} onOpenChange={() => setFirmwareModal(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Firmware - Compilar e Gravar
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* TON selector */}
              {firmwareModal.projects.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Controlador:</span>
                  <select
                    className="h-8 px-3 py-1 text-sm border rounded-md bg-background"
                    value={firmwareModal.selected}
                    onChange={e => setFirmwareModal(prev => prev ? { ...prev, selected: parseInt(e.target.value), status: 'idle', log: [], binData: null } : null)}
                  >
                    {firmwareModal.projects.map((p: any, i: number) => {
                      // Rótulo limpo: nome do equipamento NexOn vinculado (resolvido
                      // em handleGenerateFirmware -> _displayName, ex: "TON4-1").
                      // Fallback: nome do componente no diagrama (se renomeado) >
                      // "tipo #índice" como último recurso (garante unicidade).
                      const spec = p.spec || {};
                      const tonType = spec.tonType?.toUpperCase() || 'TON';
                      const label = p._displayName
                        || (p.name && p.name !== tonType ? p.name : '')
                        || `${tonType} #${i + 1}`;
                      return (
                        <option key={i} value={i}>{label}</option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Warnings */}
              {firmwareModal.projects[firmwareModal.selected]?.warnings?.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Avisos:</p>
                  {firmwareModal.projects[firmwareModal.selected].warnings.map((w: string, i: number) => (
                    <p key={i} className="text-xs text-yellow-700 dark:text-yellow-300">- {w}</p>
                  ))}
                </div>
              )}

              {/* Project info */}
              <div className="bg-muted/50 rounded-md p-3 text-xs font-mono">
                <p><strong>Projeto:</strong> {
                  firmwareModal.projects[firmwareModal.selected]?._displayName
                  || firmwareModal.projects[firmwareModal.selected]?.name
                }</p>
                <p><strong>Tipo:</strong> {firmwareModal.projects[firmwareModal.selected]?.spec?.tonType?.toUpperCase()}</p>
                <p><strong>Arquivos:</strong> {Object.keys(firmwareModal.projects[firmwareModal.selected]?.files || {}).join(', ')}</p>
                {firmwareModal.projects[firmwareModal.selected]?.spec?.rs485_devices?.length > 0 && (
                  <p><strong>Dispositivos RS485:</strong> {firmwareModal.projects[firmwareModal.selected].spec.rs485_devices.map((d: any) => d.name).join(', ')}</p>
                )}
              </div>

              {/* Log output */}
              {firmwareModal.log.length > 0 && (
                <div className="bg-gray-900 text-green-400 rounded-md p-3 text-xs font-mono max-h-48 overflow-y-auto">
                  {firmwareModal.log.map((line, i) => (
                    <div key={i} className={line.startsWith('ERRO') ? 'text-red-400' : ''}>{line}</div>
                  ))}
                  {firmwareModal.status === 'compiling' && (
                    <div className="animate-pulse">Compilando...</div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              {firmwareModal.status === 'idle' && (
                <>
                  <Button variant="outline" onClick={firmwareDownloadCode}>
                    <Download className="h-4 w-4 mr-1" /> Codigo Fonte
                  </Button>
                  {firmwareModal.simulate ? (
                    <span className="text-xs text-amber-600 self-center mr-auto" title="Firmware de simulação não usa OTA: o OTA registra versão/MAC no banco e mira o equipamento real. Grave por USB.">
                      🧪 Simulação — só USB (não toca o banco)
                    </span>
                  ) : (
                    <Button variant="outline" onClick={firmwareDeployOta} title="Compila no servidor e envia OTA via MQTT (TON em campo)">
                      <Zap className="h-4 w-4 mr-1" /> Implantar OTA
                    </Button>
                  )}
                  <Button onClick={firmwareCompile} title="Compila no servidor para gravar via USB local (Web Serial)">
                    <Zap className="h-4 w-4 mr-1" /> Compilar
                  </Button>
                </>
              )}
              {firmwareModal.status === 'compiling' && (
                <Button disabled><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" /> Compilando...</Button>
              )}
              {firmwareModal.status === 'deploying' && (
                <Button disabled><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" /> Implantando OTA...</Button>
              )}
              {firmwareModal.status === 'compiled' && (
                <>
                  <Button variant="outline" onClick={firmwareDownloadCode}>
                    <Download className="h-4 w-4 mr-1" /> Codigo Fonte
                  </Button>
                  <Button variant="outline" onClick={firmwareDownloadBin}>
                    <Download className="h-4 w-4 mr-1" /> Baixar .bin
                  </Button>
                  <Button onClick={firmwareFlash}>
                    <Zap className="h-4 w-4 mr-1" /> Gravar via USB
                  </Button>
                </>
              )}
              {firmwareModal.status === 'deployed' && (
                <Button variant="outline" onClick={() => setFirmwareModal(null)}>
                  Fechar
                </Button>
              )}
              {firmwareModal.status === 'done' && (
                <>
                  <Button variant="outline" onClick={firmwareDownloadBin}>
                    <Download className="h-4 w-4 mr-1" /> Baixar .bin
                  </Button>
                  <Button variant="outline" onClick={() => setFirmwareModal(null)}>
                    Fechar
                  </Button>
                </>
              )}
              {firmwareModal.status === 'error' && (
                <>
                  <Button variant="outline" onClick={firmwareDownloadCode}>
                    <Download className="h-4 w-4 mr-1" /> Ver Codigo
                  </Button>
                  <Button onClick={firmwareCompile}>
                    <Zap className="h-4 w-4 mr-1" /> Tentar Novamente
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
