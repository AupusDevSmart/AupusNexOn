import { useMutation } from '@tanstack/react-query';
import { Check, Copy, Eye, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CamerasService } from '../../services/cameras.service';
import { mensagemErro } from '../../utils/erros';

/**
 * Só admin: mostra a senha atual da câmera (inclusive a gerada pelo cadastro automático), para entrar na
 * página dela na rede local. Cada clique fica registrado na auditoria (camera_senha_vista).
 */
export function VerSenha({ cameraId }: { cameraId: string }) {
  const [senha, setSenha] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const ver = useMutation({
    mutationFn: () => CamerasService.senhaCamera(cameraId),
    onSuccess: (r) => setSenha(r.senha),
    onError: (e) => toast.error(mensagemErro(e, 'Não foi possível ver a senha')),
  });
  if (!senha) {
    return (
      <button
        type="button"
        onClick={() => ver.mutate()}
        disabled={ver.isPending}
        className="mt-1 inline-flex h-8 items-center gap-1.5 self-start text-xs font-medium text-muted-foreground mouse:hover:text-foreground touch:h-10"
      >
        {ver.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
        Mostrar senha atual
      </button>
    );
  }
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error('Não deu para copiar');
    }
  };
  return (
    <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-sm">{senha}</code>
      <button type="button" onClick={() => void copiar()} aria-label="Copiar senha" className="flex h-8 w-8 items-center justify-center rounded-md mouse:hover:bg-background">
        {copiado ? <Check className="h-4 w-4 text-nexon-verde" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
