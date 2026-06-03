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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatApiError } from '@/utils/api-error';
import {
  useCreateIotDeviceTipo,
  useUpdateIotDeviceTipo,
} from '@/hooks/useIotCatalog';
import type { IotDeviceTipo } from '@/services/iot-catalog.services';
import { PontosEditor } from './components/PontosEditor';
import { emptyPontosForm, formToPontos, pontosToForm, type PontosForm } from './iot-catalog-shapes';

interface Props {
  tipo: IotDeviceTipo | null; // null = create
  onClose: () => void;
}

const pretty = (o: unknown) => JSON.stringify(o, null, 2);

export function TipoFormModal({ tipo, onClose }: Props) {
  const create = useCreateIotDeviceTipo();
  const update = useUpdateIotDeviceTipo();

  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [form, setForm] = useState<PontosForm>(emptyPontosForm);
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (tipo) {
      setCodigo(tipo.codigo);
      setNome(tipo.nome);
      setForm(pontosToForm(tipo.pontos));
    }
  }, [tipo]);

  // Sincroniza ao trocar de aba: estruturado e' a fonte da verdade.
  const handleTab = (next: string) => {
    if (next === tab) return;
    if (next === 'json') {
      setJsonDraft(pretty(formToPontos(form)));
      setJsonError(null);
      setTab('json');
    } else {
      try {
        const parsed: unknown = JSON.parse(jsonDraft || '{}');
        setForm(pontosToForm(parsed as Record<string, unknown>));
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

  const buildPontos = (): Record<string, unknown> | null => {
    if (tab === 'json') {
      try {
        return JSON.parse(jsonDraft || '{}') as Record<string, unknown>;
      } catch {
        toast.error('JSON invalido em pontos');
        return null;
      }
    }
    return formToPontos(form);
  };

  const handleSubmit = async () => {
    const pontos = buildPontos();
    if (!pontos) return;
    try {
      if (tipo) {
        await update.mutateAsync({ id: tipo.id, payload: { codigo, nome, pontos } });
        toast.success('Tipo atualizado');
      } else {
        await create.mutateAsync({ codigo, nome, pontos });
        toast.success('Tipo criado');
      }
      onClose();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const loading = create.isPending || update.isPending;
  const hasError = tab === 'json' ? !!jsonError : false;
  const canSubmit = !!codigo && !!nome && !hasError;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[980px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipo ? 'Editar tipo' : 'Novo tipo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="codigo">
                Codigo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="inversor_solar"
                disabled={!!tipo}
              />
              <p className="text-xs text-muted-foreground">
                snake_case (a-z, 0-9, _) comecando com letra.
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
          </div>

          <Tabs value={tab} onValueChange={handleTab}>
            <TabsList>
              <TabsTrigger value="form">Estruturado</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="mt-3">
              <PontosEditor value={form} onChange={setForm} />
            </TabsContent>

            <TabsContent value="json" className="mt-3 space-y-1">
              <Label htmlFor="pontos-json">Pontos (JSON)</Label>
              <Textarea
                id="pontos-json"
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
