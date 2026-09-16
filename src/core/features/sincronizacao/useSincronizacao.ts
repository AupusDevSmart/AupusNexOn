import { useCallback } from 'react';

export type RecursoSincronizavel = 'usuarios' | 'plantas' | 'unidades' | 'equipamentos';

export interface EstadoSincronizacao {
  registro_id: string;
  compartilhado: boolean;
  versao: number;
  origem: string | null;
  atualizado_em: string | null;
  pendentes: number;
  com_erro: boolean;
}

/** O nome do outro produto, para os rotulos dizerem para ONDE vai. */
export const OUTRO_PRODUTO = import.meta.env.VITE_OUTRO_PRODUTO || 'Service';

/**
 * Estado de compartilhamento dos registros de uma pagina.
 *
 * Em LOTE, uma consulta por pagina, e nao uma por linha. Sao 9 a 23 linhas nas
 * telas de planta e instalacao, mas equipamentos passa de 250 — uma chamada por
 * linha ali seriam 250 requisicoes para desenhar uma coluna.
 *
 * O estado importa porque sem ele o botao pode ser um no-op sem avisar: clicar
 * em "compartilhar" no que ja esta compartilhado nao faz nada visivel, e botao
 * que nao diz o que fez vira desconfianca.
 */
/**
 * DESATIVADO (2026-09-10): o compartilhamento NexON↔Service foi aposentado quando os
 * dois viraram bancos separados — o `SincronizacaoModule` do backend foi desregistrado
 * (a rota `/sincronizacao/vinculos/*` responde 404). O hook virou no-op para não
 * disparar chamadas mortas nem estourar os botões; a coluna/botões de "compartilhar"
 * ficam inertes até serem removidos das telas (débito, part-by-part).
 */
export function useSincronizacao(_recurso: RecursoSincronizavel, _ids: string[]) {
  const noop = useCallback(async (_id?: string) => {}, []);
  return {
    estados: {} as Record<string, EstadoSincronizacao>,
    carregando: false,
    recarregar: noop,
    compartilhar: noop,
    pararDeCompartilhar: noop,
  };
}
