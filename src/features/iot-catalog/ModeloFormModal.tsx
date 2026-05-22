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

interface Props {
  modelo: IotDeviceModelo | null; // null = create
  tipos: IotDeviceTipo[];
  onClose: () => void;
}

const PROTOCOLOS = ['rtu', 'tcp', 'tcp_usr', 'serial'];

const DEFAULT_MAP = `{
  "ai_blocks": [],
  "ai_map": {},
  "bi_map": {},
  "bo_map": {}
}`;

export function ModeloFormModal({ modelo, tipos, onClose }: Props) {
  const create = useCreateIotDeviceModelo();
  const update = useUpdateIotDeviceModelo();

  const tipoById = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);

  const [tipoCodigo, setTipoCodigo] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [modeloNome, setModeloNome] = useState('');
  const [protocolo, setProtocolo] = useState('rtu');
  const [connectionNote, setConnectionNote] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [mapJson, setMapJson] = useState(DEFAULT_MAP);
  const [jsonError, setJsonError] = useState<string | null>(null);

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
      setMapJson(JSON.stringify(map, null, 2));
    }
  }, [modelo, tipoById]);

  const handleJsonChange = (val: string) => {
    setMapJson(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const handleSubmit = async () => {
    if (jsonError) {
      toast.error('JSON invalido em mapeamento');
      return;
    }
    let mapeamento: Record<string, unknown>;
    try {
      mapeamento = JSON.parse(mapJson);
    } catch {
      toast.error('JSON invalido');
      return;
    }

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
    } catch (e: any) {
      toast.error(formatApiError(e));
    }
  };

  const loading = create.isPending || update.isPending;
  const canSubmit = tipoCodigo && fabricante && modeloNome && protocolo && !jsonError;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modelo ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select value={tipoCodigo} onValueChange={setTipoCodigo}>
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

          <div className="space-y-1">
            <Label htmlFor="catalog_id">Catalog ID (opcional)</Label>
            <Input
              id="catalog_id"
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
              placeholder="sungrow-sg250cx (vazio = derivado)"
            />
            <p className="text-xs text-muted-foreground">
              Slug usado como chave no DEVICE_MODELS. Vazio = gerado a partir de fabricante+modelo.
            </p>
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

          <div className="space-y-1">
            <Label htmlFor="mapeamento">Mapeamento Modbus (JSON)</Label>
            <Textarea
              id="mapeamento"
              value={mapJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="font-mono text-xs h-64"
              spellCheck={false}
            />
            {jsonError ? (
              <p className="text-xs text-destructive">{jsonError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Shape: ai_blocks, ai_map, bi_map, bo_map, num_mppts?, num_strings?, word_order?, tp_tc?, ...
              </p>
            )}
          </div>
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
