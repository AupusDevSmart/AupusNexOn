import { Share2, AlertTriangle, Loader2 } from 'lucide-react';
import { EstadoSincronizacao, OUTRO_PRODUTO } from './useSincronizacao';

interface Props {
  estado?: EstadoSincronizacao;
}

/**
 * Diz, numa olhada, se este registro atravessa para o outro produto.
 *
 * Quatro estados, e cada um existe por um motivo:
 *
 *   nada        — so aqui. Silencio proposital: a maioria das linhas nao esta
 *                 compartilhada, e um selo em todas viraria ruido.
 *   compartilha — as edicoes dos dois lados se propagam sozinhas.
 *   enviando    — ha coisa na fila. Sem isto o usuario edita, olha o outro
 *                 sistema, nao ve nada e conclui que quebrou — quando so
 *                 faltavam alguns segundos.
 *   erro        — a entrega ja falhou tres vezes. E o unico estado que pede
 *                 acao, e por isso e o unico com cor.
 */
export function SeloSincronizacao({ estado }: Props) {
  if (!estado?.compartilhado) return null;

  if (estado.com_erro) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-amber-600"
        title={`Não foi possível enviar para o ${OUTRO_PRODUTO}. O envio continua tentando.`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Erro
      </span>
    );
  }

  if (estado.pendentes > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        title={`Enviando para o ${OUTRO_PRODUTO}...`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Enviando
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={`Compartilhado com o ${OUTRO_PRODUTO}. As edições dos dois lados se propagam.`}
    >
      <Share2 className="h-3.5 w-3.5" />
      Compartilhado
    </span>
  );
}
