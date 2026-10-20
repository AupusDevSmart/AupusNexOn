import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatApiError } from '@/utils/api-error';
import { ChamadosService } from '../services';
import { MOTIVO_ROTULO, PRIORIDADE_ROTULO, type Chamado, type MotivoChamado, type PrioridadeChamado } from '../types';
import { EquipamentoSelector } from './EquipamentoSelector';

export function AbrirChamadoModal({
  aberto,
  onClose,
  onAberto,
}: {
  aberto: boolean;
  onClose: () => void;
  onAberto: (c: Chamado) => void;
}) {
  const [equipamentoId, setEquipamentoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [motivo, setMotivo] = useState<MotivoChamado>('FALHA');
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>('MEDIA');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setEquipamentoId('');
    setTitulo('');
    setDescricao('');
    setMotivo('FALHA');
    setPrioridade('MEDIA');
  }, [aberto]);

  const valido = !!equipamentoId && titulo.trim().length > 0 && descricao.trim().length > 0;

  const salvar = async () => {
    if (!valido) return;
    setSalvando(true);
    try {
      const c = await ChamadosService.abrir({ equipamento_id: equipamentoId, titulo, descricao, motivo, prioridade });
      toast.success(`Chamado #${c.numero} aberto`);
      onAberto(c);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Abrir chamado</DialogTitle>
          <DialogDescription>
            Registre o problema do equipamento. Depois você encaminha para o Smart Service, WhatsApp ou e-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <EquipamentoSelector value={equipamentoId} onChange={setEquipamentoId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Motivo</label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoChamado)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MOTIVO_ROTULO).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as PrioridadeChamado)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDADE_ROTULO).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Título</label>
            <Input
              value={titulo}
              maxLength={200}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Inversor parado desde a manhã"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">O que está acontecendo</label>
            <Textarea
              value={descricao}
              rows={4}
              maxLength={5000}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a falha, o alarme ou o que foi visto em campo"
            />
          </div>
        </div>

        <DialogFooter>
          <button className="btn-minimal-outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn-minimal-primary" onClick={salvar} disabled={!valido || salvando}>
            {salvando ? 'Abrindo…' : 'Abrir chamado'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
