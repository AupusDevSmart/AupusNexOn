import { Fragment, useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Trash2, Pencil, Cpu, Tag, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { formatApiError } from '@/utils/api-error';
import { TipoFormModal } from './TipoFormModal';
import { ModeloFormModal } from './ModeloFormModal';

type TipoModalState = { open: false } | { open: true; tipo: IotDeviceTipo | null };
type ModeloModalState = { open: false } | { open: true; modelo: IotDeviceModelo | null };

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
    <div className="flex items-center justify-between px-4 py-3 border-t">
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

  // Filtros
  const [modeloSearch, setModeloSearch] = useState('');
  const [modeloTipoFilter, setModeloTipoFilter] = useState<string>('all');
  const [tipoSearch, setTipoSearch] = useState('');

  // Paginação
  const [modeloPage, setModeloPage] = useState(1);
  const [tipoPage, setTipoPage] = useState(1);

  const tipos = tiposQuery.data ?? [];
  const modelos = modelosQuery.data ?? [];
  const tipoByCodigo = new Map(tipos.map((t) => [t.codigo, t]));
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

  // Resetar para página 1 quando filtros mudam ou lista encolhe
  useEffect(() => {
    setModeloPage(1);
  }, [modeloSearch, modeloTipoFilter]);
  useEffect(() => {
    setTipoPage(1);
  }, [tipoSearch]);

  const modelosTotalPages = Math.max(1, Math.ceil(modelosFiltrados.length / PAGE_SIZE));
  const tiposTotalPages = Math.max(1, Math.ceil(tiposFiltrados.length / PAGE_SIZE));
  const modelosPagina = modelosFiltrados.slice(
    (modeloPage - 1) * PAGE_SIZE,
    modeloPage * PAGE_SIZE,
  );
  const tiposPagina = tiposFiltrados.slice(
    (tipoPage - 1) * PAGE_SIZE,
    tipoPage * PAGE_SIZE,
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
    } catch (e: any) {
      toast.error(formatApiError(e));
    }
  };

  const handleDeleteModelo = async (m: IotDeviceModelo) => {
    if (!confirm(`Deletar modelo "${m.fabricante}/${m.modelo}"?`)) return;
    try {
      await removeModelo.mutateAsync(m.id);
      toast.success('Modelo removido');
    } catch (e: any) {
      toast.error(formatApiError(e));
    }
  };

  const handleDuplicate = async (m: IotDeviceModelo) => {
    try {
      const novo = await duplicateModelo.mutateAsync(m.id);
      toast.success(`Duplicado como "${novo.modelo}"`);
      setModeloModal({ open: true, modelo: novo });
    } catch (e: any) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Catalogo IoT</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tipos de dispositivo e modelos (Modbus mapping) consumidos pelo editor de
          diagrama IoT e pelo gerador de firmware.
        </p>
      </div>

      <Tabs defaultValue="modelos" className="w-full">
        <TabsList className="gap-2 rounded-sm bg-transparent p-0">
          <TabsTrigger
            value="modelos"
            className="gap-2 rounded-sm data-[state=active]:bg-accent"
          >
            <Cpu className="h-4 w-4" /> Modelos ({modelos.length})
          </TabsTrigger>
          <TabsTrigger
            value="tipos"
            className="gap-2 rounded-sm data-[state=active]:bg-accent"
          >
            <Tag className="h-4 w-4" /> Tipos ({tipos.length})
          </TabsTrigger>
        </TabsList>

        {/* MODELOS */}
        <TabsContent value="modelos" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Cada modelo aponta pra um tipo e contem o mapeamento Modbus
                  (ai_blocks, ai_map, etc.).
                </p>
                <Button
                  size="sm"
                  onClick={() => setModeloModal({ open: true, modelo: null })}
                  disabled={tipos.length === 0}
                  title={tipos.length === 0 ? 'Crie um tipo antes' : undefined}
                >
                  <Plus className="h-4 w-4 mr-1" /> Novo modelo
                </Button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por fabricante ou modelo..."
                    value={modeloSearch}
                    onChange={(e) => setModeloSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={modeloTipoFilter} onValueChange={setModeloTipoFilter}>
                  <SelectTrigger className="w-[220px]">
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

              <Table>
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
                        <TableRow key={m.id}>
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
                page={modeloPage}
                totalPages={modelosTotalPages}
                total={modelosFiltrados.length}
                pageSize={PAGE_SIZE}
                onPageChange={setModeloPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIPOS */}
        <TabsContent value="tipos" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Tipo abstrato (ex: inversor_solar) define o contrato de pontos AI/BI/BO.
                </p>
                <Button size="sm" onClick={() => setTipoModal({ open: true, tipo: null })}>
                  <Plus className="h-4 w-4 mr-1" /> Novo tipo
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou codigo..."
                  value={tipoSearch}
                  onChange={(e) => setTipoSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Table>
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
                        <TableRow key={t.id}>
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
                page={tipoPage}
                totalPages={tiposTotalPages}
                total={tiposFiltrados.length}
                pageSize={PAGE_SIZE}
                onPageChange={setTipoPage}
              />
            </CardContent>
          </Card>
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
          tipos={tipos}
          onClose={() => setModeloModal({ open: false })}
        />
      )}
    </div>
  );
}
