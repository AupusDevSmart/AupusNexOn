import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Copy, Trash2, Pencil, Cpu, Tag, Search, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { baixarTemplateModelo, parseModeloPlanilha, type ModeloImportado } from './catalogo-planilha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useDuplicateIotDeviceModelo,
  useIotDeviceModelos,
  useIotDeviceTipos,
  useRemoveIotDeviceModelo,
  useRemoveIotDeviceTipo,
} from '@/hooks/useIotCatalog';
import type {
  IotDeviceModelo,
  IotDeviceTipo,
} from '@/services/iot-catalog.services';
import { formatApiError } from '@/utils/api-error';
import { TipoFormModal } from './TipoFormModal';
import { ModeloFormModal } from './ModeloFormModal';
import { useEstadoLembrado } from '@/hooks/useEstadoLembrado';

type TipoModalState = { open: false } | { open: true; tipo: IotDeviceTipo | null };
type ModeloModalState =
  | { open: false }
  | { open: true; modelo: IotDeviceModelo | null; importData?: ModeloImportado };

const PAGE_SIZE = 15;

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function PaginationBar({ page, totalPages, total, pageSize, onPageChange }: PaginationBarProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const visiblePages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 sm:px-4 py-3 border-t">
      <div className="text-sm text-muted-foreground">
        Mostrando <span className="font-medium">{from}</span> a{' '}
        <span className="font-medium">{to}</span> de{' '}
        <span className="font-medium">{total}</span> resultados
      </div>
      <div className="flex items-center space-x-2">
        <button
          className="btn-minimal-outline h-8 w-8 p-0 flex items-center justify-center overflow-visible"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
        </button>
        <div className="flex items-center space-x-1">
          {visiblePages.map((p, idx, arr) => {
            const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
            const btnClass =
              page === p
                ? 'btn-minimal-primary w-8 h-8 p-0 flex items-center justify-center'
                : 'btn-minimal-outline w-8 h-8 p-0 flex items-center justify-center';
            return (
              <Fragment key={p}>
                {showEllipsisBefore && (
                  <span className="px-2 text-muted-foreground">...</span>
                )}
                <button className={btnClass} onClick={() => onPageChange(p)}>
                  {p}
                </button>
              </Fragment>
            );
          })}
        </div>
        <button
          className="btn-minimal-outline h-8 w-8 p-0 flex items-center justify-center overflow-visible"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
        >
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function IotCatalogPage() {
  const tiposQuery = useIotDeviceTipos();
  const modelosQuery = useIotDeviceModelos();

  const removeTipo = useRemoveIotDeviceTipo();
  const removeModelo = useRemoveIotDeviceModelo();
  const duplicateModelo = useDuplicateIotDeviceModelo();

  const [tipoModal, setTipoModal] = useState<TipoModalState>({ open: false });
  const [modeloModal, setModeloModal] = useState<ModeloModalState>({ open: false });
  const [templateDialog, setTemplateDialog] = useState(false);
  const fileImportRef = useRef<HTMLInputElement>(null);

  const baixarTemplate = async (tipo: IotDeviceTipo) => {
    setTemplateDialog(false);
    try { await baixarTemplateModelo(tipo); } catch (e: any) { toast.error('Falha ao gerar template: ' + (e?.message || e)); }
  };
  const onImportPlanilha = async (file: File) => {
    try {
      const parsed = await parseModeloPlanilha(file);
      const nRegs = Object.keys((parsed.mapeamento as any).ai_map || {}).length;
      setModeloModal({ open: true, modelo: null, importData: parsed });
      toast.success(`Planilha lida: ${nRegs} registrador(es). Revise e salve.`);
    } catch (e: any) { toast.error('Falha ao importar: ' + (e?.message || e)); }
  };

  // Filtros
  // Busca, filtro, página e aba lembrados para a próxima visita.
  const [modeloSearch, setModeloSearch] = useEstadoLembrado('iot:modelos:busca', '');
  const [modeloTipoFilter, setModeloTipoFilter] = useEstadoLembrado<string>('iot:modelos:tipo', 'all');
  const [tipoSearch, setTipoSearch] = useEstadoLembrado('iot:tipos:busca', '');

  // Paginação
  const [modeloPage, setModeloPage] = useEstadoLembrado('iot:modelos:pagina', 1);
  const [tipoPage, setTipoPage] = useEstadoLembrado('iot:tipos:pagina', 1);
  const [aba, setAba] = useEstadoLembrado('iot:aba', 'modelos');

  const tipos = tiposQuery.data ?? [];
  const modelos = modelosQuery.data ?? [];
  const tipoById = new Map(tipos.map((t) => [t.id, t]));

  const modelosFiltrados = useMemo(() => {
    const q = modeloSearch.trim().toLowerCase();
    return modelos.filter((m) => {
      if (modeloTipoFilter !== 'all') {
        const tipo = tipoById.get(m.tipo_id);
        if (tipo?.codigo !== modeloTipoFilter) return false;
      }
      if (q) {
        const hay = `${m.fabricante} ${m.modelo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [modelos, modeloSearch, modeloTipoFilter, tipoById]);

  const tiposFiltrados = useMemo(() => {
    const q = tipoSearch.trim().toLowerCase();
    if (!q) return tipos;
    return tipos.filter(
      (t) =>
        t.nome.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q),
    );
  }, [tipos, tipoSearch]);

  // Resetar para página 1 quando filtros mudam ou lista encolhe. Pula o
  // mount: a página lembrada da última visita tem que sobreviver.
  const filtroModeloRef = useRef(`${modeloSearch}|${modeloTipoFilter}`);
  useEffect(() => {
    const atual = `${modeloSearch}|${modeloTipoFilter}`;
    if (filtroModeloRef.current === atual) return;
    filtroModeloRef.current = atual;
    setModeloPage(1);
  }, [modeloSearch, modeloTipoFilter, setModeloPage]);
  const filtroTipoRef = useRef(tipoSearch);
  useEffect(() => {
    if (filtroTipoRef.current === tipoSearch) return;
    filtroTipoRef.current = tipoSearch;
    setTipoPage(1);
  }, [tipoSearch, setTipoPage]);

  const modelosTotalPages = Math.max(1, Math.ceil(modelosFiltrados.length / PAGE_SIZE));
  const tiposTotalPages = Math.max(1, Math.ceil(tiposFiltrados.length / PAGE_SIZE));
  // A página lembrada pode passar do fim se a lista encolheu desde a última visita.
  const paginaModelo = Math.min(modeloPage, modelosTotalPages);
  const paginaTipo = Math.min(tipoPage, tiposTotalPages);
  const modelosPagina = modelosFiltrados.slice(
    (paginaModelo - 1) * PAGE_SIZE,
    paginaModelo * PAGE_SIZE,
  );
  const tiposPagina = tiposFiltrados.slice(
    (paginaTipo - 1) * PAGE_SIZE,
    paginaTipo * PAGE_SIZE,
  );

  const handleDeleteTipo = async (t: IotDeviceTipo) => {
    const linked = modelos.filter((m) => m.tipo_id === t.id).length;
    const aviso = linked > 0
      ? `\n\nATENCAO: ${linked} modelo(s) sera(o) DELETADO(s) em cascata.`
      : '';
    if (!confirm(`Deletar tipo "${t.nome}" (${t.codigo})?${aviso}`)) return;
    try {
      await removeTipo.mutateAsync(t.id);
      toast.success('Tipo removido');
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleDeleteModelo = async (m: IotDeviceModelo) => {
    if (!confirm(`Deletar modelo "${m.fabricante}/${m.modelo}"?`)) return;
    try {
      await removeModelo.mutateAsync(m.id);
      toast.success('Modelo removido');
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleDuplicate = async (m: IotDeviceModelo) => {
    try {
      const novo = await duplicateModelo.mutateAsync(m.id);
      toast.success(`Duplicado como "${novo.modelo}"`);
      setModeloModal({ open: true, modelo: novo });
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <Layout>
      <Layout.Main>
        <Tabs value={aba} onValueChange={setAba} className="w-full">
          <TitleCard
            title="Drivers de Equipamento"
            description="Tipos de dispositivo e modelos (Modbus mapping) consumidos pelo editor de diagrama IoT e pelo gerador de firmware."
            actions={
              <TabsList>
                <TabsTrigger value="modelos" className="gap-2">
                  <Cpu className="h-4 w-4" /> Modelos ({modelos.length})
                </TabsTrigger>
                <TabsTrigger value="tipos" className="gap-2">
                  <Tag className="h-4 w-4" /> Tipos ({tipos.length})
                </TabsTrigger>
              </TabsList>
            }
          />

          {/* MODELOS */}
          <TabsContent value="modelos" className="mt-0">
            <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-start">
              <div className="grid flex-1 gap-3 grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por fabricante ou modelo..."
                    value={modeloSearch}
                    onChange={(e) => setModeloSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={modeloTipoFilter} onValueChange={setModeloTipoFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.codigo}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-row gap-2 w-full lg:w-auto">
                <button className="btn-minimal-outline flex-1 lg:flex-none whitespace-nowrap" onClick={() => setTemplateDialog(true)} disabled={tipos.length === 0}>
                  <Download className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">Template</span>
                </button>
                <button className="btn-minimal-outline flex-1 lg:flex-none whitespace-nowrap" onClick={() => fileImportRef.current?.click()} disabled={tipos.length === 0}>
                  <Upload className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">Importar</span>
                </button>
                <input ref={fileImportRef} type="file" accept=".xlsx" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportPlanilha(f); e.currentTarget.value = ''; }} />
                <button
                  className="btn-minimal-primary flex-1 lg:flex-none whitespace-nowrap"
                  onClick={() => setModeloModal({ open: true, modelo: null })}
                  disabled={tipos.length === 0}
                  title={tipos.length === 0 ? 'Crie um tipo antes' : undefined}
                >
                  <Plus className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">Novo modelo</span>
                </button>
              </div>
            </div>

            <div className="border rounded-md bg-card overflow-x-auto">
                <Table className="table-minimal min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fabricante</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Protocolo</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelosQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : modelos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Nenhum modelo cadastrado
                        </TableCell>
                      </TableRow>
                    ) : modelosFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Nenhum modelo corresponde aos filtros
                        </TableCell>
                      </TableRow>
                    ) : (
                      modelosPagina.map((m) => {
                        const tipo = tipoById.get(m.tipo_id);
                        return (
                          <TableRow key={m.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{m.fabricante}</TableCell>
                            <TableCell>{m.modelo}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {tipo ? `${tipo.nome} (${tipo.codigo})` : <span className="text-destructive">tipo orfao</span>}
                            </TableCell>
                            <TableCell className="text-muted-foreground uppercase text-xs">{m.protocolo}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setModeloModal({ open: true, modelo: m })}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDuplicate(m)}
                                  title="Duplicar"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteModelo(m)}
                                  title="Deletar"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <PaginationBar
                  page={paginaModelo}
                  totalPages={modelosTotalPages}
                  total={modelosFiltrados.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setModeloPage}
                />
            </div>
          </TabsContent>

          {/* TIPOS */}
          <TabsContent value="tipos" className="mt-0">
            <div className="flex flex-col lg:flex-row gap-3 mb-6 lg:items-start">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou codigo..."
                  value={tipoSearch}
                  onChange={(e) => setTipoSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <button className="btn-minimal-primary w-full lg:w-auto whitespace-nowrap" onClick={() => setTipoModal({ open: true, tipo: null })}>
                <Plus className="mr-2 h-4 w-4" /><span>Novo tipo</span>
              </button>
            </div>

            <div className="border rounded-md bg-card overflow-x-auto">
                <Table className="table-minimal min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Modelos</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiposQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : tipos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          Nenhum tipo cadastrado
                        </TableCell>
                      </TableRow>
                    ) : tiposFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          Nenhum tipo corresponde ao filtro
                        </TableCell>
                      </TableRow>
                    ) : (
                      tiposPagina.map((t) => {
                        const count = modelos.filter((m) => m.tipo_id === t.id).length;
                        return (
                          <TableRow key={t.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs">{t.codigo}</TableCell>
                            <TableCell>{t.nome}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{count}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setTipoModal({ open: true, tipo: t })}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteTipo(t)}
                                  title="Deletar"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <PaginationBar
                  page={paginaTipo}
                  totalPages={tiposTotalPages}
                  total={tiposFiltrados.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setTipoPage}
                />
            </div>
          </TabsContent>
        </Tabs>

        {tipoModal.open && (
          <TipoFormModal
            tipo={tipoModal.tipo}
            onClose={() => setTipoModal({ open: false })}
          />
        )}

        {modeloModal.open && (
          <ModeloFormModal
            modelo={modeloModal.modelo}
            importData={modeloModal.importData}
            tipos={tipos}
            onClose={() => setModeloModal({ open: false })}
          />
        )}

        <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Baixar template — escolha o tipo</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1 py-1 max-h-[60dvh] overflow-y-auto">
              {tipos.map((t) => (
                <button
                  key={t.id}
                  onClick={() => baixarTemplate(t)}
                  className="text-left text-sm rounded border border-input px-3 py-2 hover:bg-accent flex items-center gap-2"
                >
                  <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{t.nome}</span>
                  <span className="text-xs text-muted-foreground">({t.codigo})</span>
                </button>
              ))}
              {tipos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum tipo cadastrado.</p>}
            </div>
          </DialogContent>
        </Dialog>
      </Layout.Main>
    </Layout>
  );
}
