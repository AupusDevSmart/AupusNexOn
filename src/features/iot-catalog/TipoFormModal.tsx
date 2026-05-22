import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import { formatApiError } from '@/utils/api-error';
import {
  useCreateIotDeviceTipo,
  useUpdateIotDeviceTipo,
} from '@/hooks/useIotCatalog';
import type { IotDeviceTipo } from '@/services/iot-catalog.services';

interface Props {
  tipo: IotDeviceTipo | null; // null = create
  onClose: () => void;
}

const DEFAULT_PONTOS = `{
  "ai": [],
  "bi": [],
  "bo": []
}`;

export function TipoFormModal({ tipo, onClose }: Props) {
  const create = useCreateIotDeviceTipo();
  const update = useUpdateIotDeviceTipo();

  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [pontosJson, setPontosJson] = useState(DEFAULT_PONTOS);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (tipo) {
      setCodigo(tipo.codigo);
      setNome(tipo.nome);
      setPontosJson(JSON.stringify(tipo.pontos, null, 2));
    }
  }, [tipo]);

  const handleJsonChange = (val: string) => {
    setPontosJson(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const handleSubmit = async () => {
    if (jsonError) {
      toast.error('JSON invalido em pontos');
      return;
    }
    let pontos: Record<string, unknown>;
    try {
      pontos = JSON.parse(pontosJson);
    } catch (e: any) {
      toast.error('JSON invalido');
      return;
    }

    try {
      if (tipo) {
        await update.mutateAsync({ id: tipo.id, payload: { codigo, nome, pontos } });
        toast.success('Tipo atualizado');
      } else {
        await create.mutateAsync({ codigo, nome, pontos });
        toast.success('Tipo criado');
      }
      onClose();
    } catch (e: any) {
      toast.error(formatApiError(e));
    }
  };

  const loading = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{tipo ? 'Editar tipo' : 'Novo tipo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="codigo">
              Codigo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="inversor_solar"
              disabled={!!tipo} // codigo nao deveria mudar apos criado
            />
            <p className="text-xs text-muted-foreground">
              snake_case (a-z, 0-9, _) comecando com letra. Usado como chave no DEVICE_POINTS.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="nome">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Inversor Solar"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pontos">Pontos (JSON)</Label>
            <Textarea
              id="pontos"
              value={pontosJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="font-mono text-xs h-64"
              spellCheck={false}
            />
            {jsonError ? (
              <p className="text-xs text-destructive">{jsonError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Shape esperado: {'{ ai: Point[], bi: Point[], bo: Point[], group_order?, publish? }'}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !codigo || !nome || !!jsonError}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
