import { useEffect, useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Play, Download, Edit3, Maximize2, Minimize2, ZoomIn, Trash2, FolderPlus, Move, MousePointer2, Save, X, Network, Zap, Terminal } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ESPLoader, Transport } from 'esptool-js';
import { api } from '@/config/api';
import { iotApiService, type IoTProjeto, type IoTDiagrama } from '@/services/iot.services';

/**
 * Resposta do OtaController.compileAndPublish (com envelope ResponseInterceptor):
 *   { success: true, data: { published, topic, url, version, md5, size }, meta? }
 */
interface OtaCompilePublishResponse {
  data: {
    published: boolean;
    topic: string;
    url: string;
    version: string;
    md5: string;
    size: number;
  };
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
    logFn('Gravando firmware (0x10000)...');

    await loader.writeFlash({
      fileArray: [{ data: firmwareBytes, address: 0x10000 }],
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

  (window as any).__iotScriptsPromise = new Promise<void>((resolve) => {
    const scripts = [
      '/iot-device-catalog.v2.js',
      '/iot-firmware-base.v2.js',
      '/iot-firmware-generator.v2.js',
      '/iot-bench-tests.v2.js',
      '/iot-diagram.v2.js',
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
      el.onerror = () => { console.error('[IoT] Failed:', scripts[idx]); idx++; loadNext(); };
      document.body.appendChild(el);
    };
    loadNext();
  });
  return (window as any).__iotScriptsPromise;
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
  const [propsValues, setPropsValues] = useState<Record<string, any>>({});

  // Connection context menu
  const [connMenu, setConnMenu] = useState<{ conn: any; allowed: string[]; x: number; y: number } | null>(null);

  // Project state
  const [projects, setProjects] = useState<IoTProject[]>([]);
  const [selectedProjectId, _setSelectedProjectId] = useState<string | null>(null);
  const setSelectedProjectId = (id: string | null) => { selectedProjectIdRef.current = id; _setSelectedProjectId(id); };
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Step 1: Load scripts + projects in parallel, then init editor
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Load scripts
      await ensureIoTScripts();
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
    editor.onSelect = (comp: any) => { if (comp && !editor.editMode) openComponentProps(comp); };
    editor.onDblClick = (comp: any) => { if (comp) openComponentProps(comp); };
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

  const saveCurrentDiagram = useCallback(async () => {
    const projId = selectedProjectIdRef.current;
    if (!projId || !editorRef.current) return;
    setSaving(true);
    try {
      const diagrama: IoTDiagrama = editorRef.current.toJSON();
      await iotApiService.update(projId, { diagrama });
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

  const openComponentProps = (comp: any) => {
    if (!comp || !window.COMPONENT_TYPES) return;
    const def = window.COMPONENT_TYPES[comp.type];
    if (!def) return;
    setPropsComp({ ...comp, _def: def });
    setPropsValues({ ...comp.props });
    setPropsModalOpen(true);
  };

  const saveComponentProps = async () => {
    if (!propsComp || !editorRef.current) return;
    editorRef.current.updateComponentProps(propsComp.id, propsValues);
    setPropsModalOpen(false);
    setPropsComp(null);
    // Persistir alteracao no backend imediatamente
    await saveCurrentDiagram();
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
      setSerialPanels(prev => {
        const next = [...prev] as [SerialPanel, SerialPanel];
        next[idx] = { ...next[idx], connected: true, port, writer, reading: true, label };
        return next;
      });

      const reader = port.readable.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n');
            buffer = parts.pop() || '';
            for (const line of parts) {
              const trimmed = line.replace(/\r/g, '').trim();
              if (trimmed) serialAddLine(idx, trimmed);
            }
          }
        } catch (e: unknown) {
          serialAddLine(idx, `[DESCONECTADO] ${e instanceof Error ? e.message : ''}`);
        }
        setSerialPanels(prev => {
          const next = [...prev] as [SerialPanel, SerialPanel];
          next[idx] = { ...next[idx], connected: false, reading: false };
          return next;
        });
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
    try { await panel.reader?.cancel(); } catch {}
    try { panel.reader?.releaseLock(); } catch {}
    try { await panel.writer?.close(); } catch {}
    try { panel.writer?.releaseLock(); } catch {}
    try { await panel.port?.close(); } catch {}
    setSerialPanels(prev => {
      const next = [...prev] as [SerialPanel, SerialPanel];
      next[idx] = { ...next[idx], connected: false, port: null, reader: null, writer: null, reading: false };
      return next;
    });
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
  } | null>(null);

  const handleGenerateFirmware = () => {
    if (!editorRef.current || !window.FirmwareGenerator) return;
    const gen = new window.FirmwareGenerator(editorRef.current);
    const projects = gen.generateAll();
    if (projects.length === 0) {
      alert('Nenhum controlador TON encontrado no diagrama.');
      return;
    }
    setFirmwareModal({ projects, selected: 0, status: 'idle', log: [], binData: null });
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
      const resp = await api.post<OtaCompilePublishResponse>(
        `/equipamentos/${encodeURIComponent(equipamentoId)}/ota/compilar-e-publicar`,
        body,
      );
      const payload = resp.data.data;
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
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
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

  if (loadingProjects) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* View mode header */}
      {!editMode && (
        <div className="flex items-center justify-between px-5 py-2 bg-muted/30 border-b min-h-[48px]">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Network className="h-4 w-4" />
              Diagrama IoT
            </h3>
            {/* Project tabs */}
            <div className="flex items-center gap-0.5 ml-2">
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
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${p.id === selectedProjectId ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                      title="Duplo-clique para renomear">{p.nome}</button>
                  )}
                </div>
              ))}
              <button onClick={openCreateModal} className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted" title="Novo projeto"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            <span className="text-muted-foreground text-xs ml-2">{compCount} componentes · {connCount} conexões</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCenter}><ZoomIn className="h-4 w-4 mr-1" />{zoom}%</Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
            <Button variant="outline" size="sm" onClick={toggleSimulation}>
              <Play className="h-4 w-4 mr-1" />{simulating ? 'Parar' : 'Simular'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateFirmware}>
              <Download className="h-4 w-4 mr-1" />Firmware
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBenchTestModal({ selectedTest: 0, checklist: {} })}>
              <Zap className="h-4 w-4 mr-1" />Teste Bancada
            </Button>
            <Button variant={serialOpen ? 'default' : 'outline'} size="sm" onClick={() => setSerialOpen(!serialOpen)}>
              <Terminal className="h-4 w-4 mr-1" />Serial
            </Button>
            <Button variant="outline" size="sm" onClick={toggleEdit}>
              <Edit3 className="h-4 w-4 mr-1" />Editar
            </Button>
          </div>
        </div>
      )}

      {/* Edit mode toolbar — matches Unifilar style */}
      {editMode && (
        <div className="border-b bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between p-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Network className="h-5 w-5" />
              Diagrama IoT
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={saveCurrentDiagram} disabled={saving} className="flex items-center gap-2">
                {saving ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />Salvando...</>
                ) : (
                  <><Save className="h-4 w-4" />Salvar</>
                )}
              </Button>
              <div className="text-xs text-muted-foreground flex items-center gap-3">
                <span>Componentes: {compCount}</span>
                <span>Conexões: {connCount}</span>
              </div>
              <Button variant="default" size="sm" onClick={toggleEdit} disabled={saving} className="flex items-center gap-2">
                <X className="h-4 w-4" />Sair da Edição
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
      <div id="iotDiagramCanvas" ref={containerRef} style={{ position: 'relative', overflow: 'hidden', background: '#0a0a0a', flex: '1 1 0%', minHeight: '500px' }} />

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
      <Dialog open={propsModalOpen} onOpenChange={setPropsModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {propsComp && <div className="w-3 h-3 rounded-full" style={{ background: propsComp._def?.color }} />}
              {propsComp?.props?.name || propsComp?._def?.label || 'Propriedades'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {propsComp?._def?.fields?.map((f: any) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                {(f.type === 'text' || f.type === 'number') && (
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
                      <option key={d.id} value={d.id}>{d.fabricante} {d.modelo}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}

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
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropsModalOpen(false)}>Fechar</Button>
            <Button onClick={saveComponentProps}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                        {['help','all','scan','id','din','rtest','trtest','adc','eth','sd','modbus'].map(cmd => (
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

      {/* Bench Test Modal */}
      {benchTestModal && window.BENCH_TESTS && (
        <Dialog open={true} onOpenChange={() => setBenchTestModal(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
                    <div>
                      <p className="text-sm font-medium mb-2">Checklist de Validacao:</p>
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
                        {Object.values(benchTestModal.checklist).filter(Boolean).length} / {test.checklist.length} itens verificados
                      </p>
                    </div>
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
                    {firmwareModal.projects.map((p: any, i: number) => (
                      <option key={i} value={i}>{p.name} ({p.spec?.tonType?.toUpperCase()})</option>
                    ))}
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
                <p><strong>Projeto:</strong> {firmwareModal.projects[firmwareModal.selected]?.name}</p>
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
                  <Button variant="outline" onClick={firmwareDeployOta} title="Compila no servidor e envia OTA via MQTT (TON em campo)">
                    <Zap className="h-4 w-4 mr-1" /> Implantar OTA
                  </Button>
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
