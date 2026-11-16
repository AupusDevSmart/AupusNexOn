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
  // Leituras Modbus por minuto de cada equipamento deste tipo, em pontos.leituras_min — o gerador
  // de firmware le nesse ritmo (iot-firmware-agenda.js). Vazio = rodizio padrao.
  const [leituraS, setLeituraS] = useState('');

  useEffect(() => {
    if (tipo) {
      setCodigo(tipo.codigo);
      setNome(tipo.nome);
      setForm(pontosToForm(tipo.pontos));
      const l = Number((tipo.pontos as Record<string, unknown> | undefined)?.leituras_min);
      setLeituraS(Number.isFinite(l) && l > 0 ? String(l) : '');
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

  const leituraN = leituraS.trim() === '' ? null : Number(leituraS);
  const leituraInvalida = leituraN !== null && !(Number.isInteger(leituraN) && leituraN >= 1 && leituraN <= 60);

  const handleSubmit = async () => {
    const built = buildPontos();
    if (!built) return;
    const { leituras_min: _antigo, ...semLeitura } = built;
    const pontos = leituraN !== null ? { ...semLeitura, leituras_min: leituraN } : semLeitura;
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
  const canSubmit = !!codigo && !!nome && !hasError && !leituraInvalida;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[980px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipo ? 'Editar tipo' : 'Novo tipo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div className="space-y-1">
              <Label htmlFor="leituras_min">Leituras por minuto</Label>
              <Input
                id="leituras_min"
                inputMode="numeric"
                value={leituraS}
                onChange={(e) => setLeituraS(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Padrão"
                aria-invalid={leituraInvalida}
              />
              <p className={`text-xs ${leituraInvalida ? 'text-destructive' : 'text-muted-foreground'}`}>
                {leituraInvalida
                  ? 'De 1 a 60 por minuto.'
                  : leituraN
                    ? `Cada equipamento deste tipo é lido ${leituraN}× por minuto (a cada ${Math.round(600 / leituraN) / 10} s). Vale ao gerar e gravar o firmware.`
                    : 'Quantas vezes por minuto a TON lê cada equipamento deste tipo. Vazio = rodízio padrão (4 s × nº de equipamentos). Vale ao gerar e gravar o firmware.'}
              </p>
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
