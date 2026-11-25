import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatApiError } from '@/utils/api-error';
import { VinculoSelector } from '../components/VinculoSelector';
import { VINCULO_VAZIO, type Vinculo } from '../utils/vinculo';
import { FaltaEnergiaService } from './services';

/**
 * "Avisar falta de energia" (NEXON-145): faz à mão o que a TON faz sozinha. Abre o chamado na
 * concessionária na hora e manda ao robô do WhatsApp, que devolve o protocolo no chamado.
 */
export function AvisarFaltaEnergiaModal({
  aberto,
  onClose,
  onAberto,
}: {
  aberto: boolean;
  onClose: () => void;
  onAberto: (chamadoId: string | null) => void;
}) {
  const [v, setV] = useState<Vinculo>(VINCULO_VAZIO);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) setV(VINCULO_VAZIO);
  }, [aberto]);

  const pronto = !!(v.equipamento_id || v.unidade_id);

  const avisar = async () => {
    setEnviando(true);
    try {
      const ev = await FaltaEnergiaService.avisar(
        v.equipamento_id ? { equipamento_id: v.equipamento_id } : { unidade_id: v.unidade_id },
      );
      toast.success(
        ev.status === 'SEM_DADOS'
          ? 'Chamado aberto, mas falta cadastro para o robô: veja o chamado'
          : 'Chamado aberto e enviado ao WhatsApp da concessionária',
      );
      onAberto(ev.chamado_id);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !enviando && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Avisar falta de energia</DialogTitle>
          <DialogDescription>
            Abre o chamado na concessionária e pede o protocolo pelo WhatsApp com a UC, o endereço e os dados do proprietário.
          </DialogDescription>
        </DialogHeader>
        <VinculoSelector value={v} onChange={setV} equipamentoObrigatorio={false} />
        <p className="text-xs text-muted-foreground">Escolha a instalação (ou a TON). A UC vem do cadastro da instalação.</p>
        <DialogFooter className="gap-2">
          <button className="btn-minimal-outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </button>
          <button className="btn-minimal-primary" onClick={avisar} disabled={enviando || !pronto}>
            {enviando ? 'Abrindo…' : 'Abrir na concessionária'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
