import { useEffect, useId, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { api } from '@/config/api';
import { OUTRO_PRODUTO } from './useSincronizacao';
import { descreverCompartilhados, nomeConfere, type CompartilhadosNaCascata } from './exclusao-compartilhada';

interface ConfirmarExclusaoProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  recurso: 'plantas' | 'unidades';
  id: string;
  nome: string;
  /** O que sai junto, na frase da tela: "a planta, as instalações e os equipamentos dela" */
  oQueSai: string;
  excluindo: boolean;
  /** `confirmarCompartilhado`: o que é compartilhado foi mostrado e confirmado (a API recusa sem ele, 409) */
  onConfirmar: (confirmarCompartilhado: boolean) => void;
}

/**
 * A confirmação de excluir planta ou instalação (10/11/2026). Ao abrir, pergunta
 * à API o que da cascata está compartilhado com o outro produto. Compartilhado:
 * diz o quê, diz o que acontece lá (um aviso para alguém decidir, não uma
 * exclusão) e pede o nome digitado. A API recusa a exclusão sem essa
 * confirmação, para script ou outra tela não pularem a pergunta.
 *
 * O incidente que motivou: em 26/10 um super admin apagou no Service 6 plantas
 * compartilhadas, a tela não dizia nada, e o NexON escondeu usinas com TON ativa.
 * Antes o texto dizia "permanentemente": é exclusão lógica, os dados ficam.
 */
export function ConfirmarExclusao({ aberto, onAbertoChange, recurso, id, nome, oQueSai, excluindo, onConfirmar }: ConfirmarExclusaoProps) {
  const idCampo = useId();
  const [conferindo, setConferindo] = useState(false);
  const [compartilhados, setCompartilhados] = useState<CompartilhadosNaCascata | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [digitado, setDigitado] = useState('');

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setConferindo(true);
    setFalhou(false);
    setCompartilhados(null);
    setDigitado('');
    api
      .get(`/sincronizacao/vinculos/${recurso}/${id.trim()}/cascata`)
      .then(({ data }) => vivo && setCompartilhados((data?.data ?? data) as CompartilhadosNaCascata))
      // Sem a conferência, a exclusão vai sem a confirmação: se houver algo compartilhado, a API
      // recusa (409) e a mensagem dela aparece. Avisado aqui, não calado
      .catch(() => vivo && setFalhou(true))
      .finally(() => vivo && setConferindo(false));
    return () => {
      vivo = false;
    };
  }, [aberto, recurso, id]);

  const compartilhado = (compartilhados?.total ?? 0) > 0;
  const podeExcluir = !conferindo && !excluindo && (!compartilhado || nomeConfere(digitado, nome));

  return (
    <AlertDialog open={aberto} onOpenChange={(a) => !excluindo && onAbertoChange(a)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {recurso === 'plantas' ? 'planta' : 'instalação'}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Excluir <span className="font-medium text-foreground">{nome}</span> tira das listas {oQueSai}. Os dados ficam
                guardados: para restaurar, fale com o suporte.
              </p>

              {conferindo && (
                <p className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Conferindo se é compartilhado com o {OUTRO_PRODUTO}...
                </p>
              )}

              {falhou && <p>Não foi possível conferir o compartilhamento com o {OUTRO_PRODUTO}. Se houver algo compartilhado, a exclusão será recusada.</p>}

              {compartilhado && compartilhados && (
                <div className="space-y-2" role="alert">
                  <p className="flex items-start gap-2 text-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
                    <span>
                      Compartilhado com o {OUTRO_PRODUTO}: {descreverCompartilhados(compartilhados)}
                      {compartilhados.nomesDasInstalacoes.length > 0 && ` (${compartilhados.nomesDasInstalacoes.join(', ')})`}.
                    </span>
                  </p>
                  <p>
                    No {OUTRO_PRODUTO} nada é apagado: lá aparece um aviso para alguém decidir se apaga também ou mantém. Daqui em
                    diante, deixa de ser compartilhado.
                  </p>
                  <label htmlFor={idCampo} className="block text-foreground">
                    Para confirmar, digite o nome: <span className="font-medium">{nome}</span>
                  </label>
                  <Input id={idCampo} value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={!podeExcluir} onClick={() => onConfirmar(compartilhado)}>
            {excluindo && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
