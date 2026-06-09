import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatApiError } from '@/utils/api-error';
import {
  useCreateIotDeviceModelo,
  useUpdateIotDeviceModelo,
} from '@/hooks/useIotCatalog';
import type {
  IotDeviceModelo,
  IotDeviceTipo,
} from '@/services/iot-catalog.services';
import { MapeamentoEditor } from './components/MapeamentoEditor';
import {
  PROTOCOLOS,
  emptyMapeamentoForm,
  formToMapeamento,
  mapeamentoToForm,
  type MapeamentoForm,
} from './iot-catalog-shapes';

interface Props {
  modelo: IotDeviceModelo | null; // null = create
  tipos: IotDeviceTipo[];
  onClose: () => void;
}

const pretty = (o: unknown) => JSON.stringify(o, null, 2);

export function ModeloFormModal({ modelo, tipos, onClose }: Props) {
  const create = useCreateIotDeviceModelo();
  const update = useUpdateIotDeviceModelo();

  const tipoById = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);
  const tipoByCodigo = useMemo(() => new Map(tipos.map((t) => [t.codigo, t])), [tipos]);

  const [tipoCodigo, setTipoCodigo] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [modeloNome, setModeloNome] = useState('');
  const [protocolo, setProtocolo] = useState('rtu');
  const [connectionNote, setConnectionNote] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [form, setForm] = useState<MapeamentoForm>(emptyMapeamentoForm);
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const currentTipo = tipoByCodigo.get(tipoCodigo);

  useEffect(() => {
    if (modelo) {
      const tipo = tipoById.get(modelo.tipo_id);
      setTipoCodigo(tipo?.codigo ?? '');
      setFabricante(modelo.fabricante);
      setModeloNome(modelo.modelo);
      setProtocolo(modelo.protocolo);
      setConnectionNote(modelo.connection_note ?? '');
      const map = { ...modelo.mapeamento } as Record<string, unknown>;
      const cId = (map.catalog_id as string | undefined) ?? '';
      delete map.catalog_id;
      setCatalogId(cId);
      setForm(mapeamentoToForm(map, tipo?.pontos));
    }
  }, [modelo, tipoById]);

  // Mudar o tipo: regenera linhas a partir dos pontos do novo tipo, preservando
  // o que ja foi preenchido (casado por pointId; nao-casados viram orfaos).
  const handleTipoChange = (codigo: string) => {
    setTipoCodigo(codigo);
    const novoTipo = tipoByCodigo.get(codigo);
    let base: Record<string, unknown> = {};
    try {
      base = tab === 'json' ? JSON.parse(jsonDraft || '{}') : formToMapeamento(form);
    } catch {
      base = {};
    }
    const novoForm = mapeamentoToForm(base, novoTipo?.pontos);
    setForm(novoForm);
    if (tab === 'json') setJsonDraft(pretty(formToMapeamento(novoForm)));
  };

  const handleTab = (next: string) => {
    if (next === tab) return;
    if (next === 'json') {
      setJsonDraft(pretty(formToMapeamento(form)));
      setJsonError(null);
      setTab('json');
    } else {
      try {
        const parsed: unknown = JSON.parse(jsonDraft || '{}');
        setForm(mapeamentoToForm(parsed as Record<string, unknown>, currentTipo?.pontos));
        setJsonError(null);
        setTab('form');
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'JSON invalido');
      }
    }
  };

  const handleJsonChange = (val: string) => {
    setJsonDraft(val);
    try {
      JSON.parse(val || '{}');
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'JSON invalido');
    }
  };

  const buildMapeamento = (): Record<string, unknown> | null => {
    if (tab === 'json') {
      try {
        return JSON.parse(jsonDraft || '{}') as Record<string, unknown>;
      } catch {
        toast.error('JSON invalido em mapeamento');
        return null;
      }
    }
    return formToMapeamento(form);
  };

  const handleSubmit = async () => {
    const mapeamento = buildMapeamento();
    if (!mapeamento) return;

    const payload = {
      tipo: tipoCodigo,
      fabricante,
      modelo: modeloNome,
      protocolo,
      connection_note: connectionNote || undefined,
      catalog_id: catalogId || undefined,
      mapeamento,
    };

    try {
      if (modelo) {
        await update.mutateAsync({ id: modelo.id, payload });
        toast.success('Modelo atualizado');
      } else {
        await create.mutateAsync(payload);
        toast.success('Modelo criado');
      }
      onClose();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const loading = create.isPending || update.isPending;
  const hasError = tab === 'json' ? !!jsonError : false;
  const canSubmit = !!tipoCodigo && !!fabricante && !!modeloNome && !!protocolo && !hasError;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[1180px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modelo ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select value={tipoCodigo} onValueChange={handleTipoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.codigo}>
                      {t.nome} <span className="text-muted-foreground ml-1">({t.codigo})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>
                Protocolo <span className="text-destructive">*</span>
              </Label>
              <Select value={protocolo} onValueChange={setProtocolo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROTOCOLOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fabricante">
                Fabricante <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fabricante"
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                placeholder="Sungrow"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="modelo">
                Modelo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="modelo"
                value={modeloNome}
                onChange={(e) => setModeloNome(e.target.value)}
                placeholder="SG250CX"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="catalog_id">Catalog ID (opcional)</Label>
              <Input
                id="catalog_id"
                value={catalogId}
                onChange={(e) => setCatalogId(e.target.value)}
                placeholder="sungrow-sg250cx (vazio = derivado)"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="connection_note">Nota de conexao</Label>
              <Input
                id="connection_note"
                value={connectionNote}
                onChange={(e) => setConnectionNote(e.target.value)}
                placeholder="RS485 direto (9600 8N1)"
              />
            </div>
          </div>

          <Tabs value={tab} onValueChange={handleTab}>
            <TabsList>
              <TabsTrigger value="form">Estruturado</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="mt-3">
              <MapeamentoEditor value={form} onChange={setForm} hasTipo={!!currentTipo} />
            </TabsContent>

            <TabsContent value="json" className="mt-3 space-y-1">
              <Label htmlFor="mapeamento-json">Mapeamento Modbus (JSON)</Label>
              <Textarea
                id="mapeamento-json"
                value={jsonDraft}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="font-mono text-xs h-72"
                spellCheck={false}
              />
              {jsonError ? (
                <p className="text-xs text-destructive">{jsonError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Visao opcional. O editor estruturado ja cobre todos os campos.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
