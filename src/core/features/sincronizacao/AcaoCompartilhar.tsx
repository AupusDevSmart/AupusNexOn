import { useState } from 'react';
import { Share2, Unlink, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { formatApiError } from '@/utils/api-error';
import { EstadoSincronizacao, OUTRO_PRODUTO } from './useSincronizacao';

interface Props {
  nome: string;
  estado?: EstadoSincronizacao;
  onCompartilhar: () => Promise<void>;
  onParar: () => Promise<void>;
  /** `botao` no rodape do sheet, `linha` na tabela. */
  formato?: 'botao' | 'linha';
}

/**
 * Ligar e desligar o compartilhamento com o outro produto.
 *
 * Compartilhar e uma decisao, nao um envio: a partir dela as edicoes dos DOIS
 * lados se propagam sozinhas. O texto da confirmacao diz isso com todas as
 * letras, porque "compartilhar" sozinho sugere uma copia unica — e a diferenca
 * so apareceria quando alguem editasse do outro lado e visse a mudanca aqui.
 *
 * Parar tambem confirma, e por um motivo oposto: as pessoas esperam que
 * "descompartilhar" apague la. Nao apaga, e dizer isso antes evita a conclusao
 * errada de que o botao falhou.
 */
export function AcaoCompartilhar({ nome, estado, onCompartilhar, onParar, formato = 'linha' }: Props) {
  const [confirmando, setConfirmando] = useState<'ligar' | 'desligar' | null>(null);
  const [salvando, setSalvando] = useState(false);

  const compartilhado = !!estado?.compartilhado;

  const executar = async () => {
    setSalvando(true);
    try {
      if (confirmando === 'ligar') {
        await onCompartilhar();
        toast({
          title: `Compartilhado com o ${OUTRO_PRODUTO}`,
          description: 'As edições dos dois lados passam a se propagar.',
        });
      } else {
        await onParar();
        toast({
          title: 'Compartilhamento encerrado',
          description: `O registro continua no ${OUTRO_PRODUTO}, mas para de receber alterações.`,
        });
      }
      setConfirmando(null);
    } catch (error) {
      toast({
        title: 'Não foi possível concluir',
        description: formatApiError(error),
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  const rotulo = compartilhado ? 'Parar de compartilhar' : `Compartilhar com o ${OUTRO_PRODUTO}`;
  const Icone = compartilhado ? Unlink : Share2;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={formato === 'botao' ? 'sm' : 'icon'}
        className={formato === 'linha' ? 'h-8 w-8 text-muted-foreground hover:text-foreground' : 'text-muted-foreground'}
        title={rotulo}
        aria-label={rotulo}
        onClick={() => setConfirmando(compartilhado ? 'desligar' : 'ligar')}
      >
        <Icone className="h-4 w-4" />
        {formato === 'botao' && <span className="ml-1.5">{rotulo}</span>}
      </Button>

      <AlertDialog open={!!confirmando} onOpenChange={o => !o && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmando === 'ligar' ? `Compartilhar com o ${OUTRO_PRODUTO}?` : 'Parar de compartilhar?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando === 'ligar' ? (
                <>
                  <span className="font-medium text-foreground">{nome}</span> passa a existir também
                  no {OUTRO_PRODUTO}. A partir daí, editar de qualquer um dos dois lados
                  atualiza o outro — não é uma cópia única.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{nome}</span> continua no{' '}
                  {OUTRO_PRODUTO}, mas para de receber as alterações feitas aqui.
                  Nada é apagado de lá.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); void executar(); }}
              disabled={salvando}
            >
              {salvando ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Aguarde...</>
              ) : confirmando === 'ligar' ? 'Compartilhar' : 'Parar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
