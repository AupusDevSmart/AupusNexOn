/**
 * Estilo único dos filtros da lista de eventos (segmento de câmeras, chips de tipo, atalhos e
 * blocos do período). Marca NexON: selecionado = verde translúcido + borda verde, nunca bloco
 * branco; ação principal = verde cheio com texto azul da marca.
 *
 * Tailwind 3 não aplica opacidade em cor `var(...)` (`bg-nexon-verde/15` não gera CSS): o tom
 * claro sai por color-mix em classe arbitrária.
 */

export const FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Fundo verde de item selecionado (texto continua `foreground`: AA nos dois temas). */
export const VERDE_FUNDO = 'bg-[color-mix(in_srgb,var(--nx-verde)_16%,transparent)]';
/** Fundo verde bem leve (barra do período com filtro ligado). */
export const VERDE_FUNDO_LEVE = 'bg-[color-mix(in_srgb,var(--nx-verde)_7%,transparent)]';
/** Texto/ícone verde legível: verde escuro da marca no claro, verde da marca no escuro. */
export const VERDE_TEXTO = 'text-nexon-link-claro dark:text-nexon-verde';

/** Item selecionado (chip, segmento, bloco de hora). */
export const ITEM_ATIVO = `border-nexon-verde ${VERDE_FUNDO} text-foreground`;
/** Item solto: contorno da linha da marca, hover com borda puxando para o verde. */
export const ITEM_INATIVO =
  'border-border text-foreground mouse:hover:border-[color-mix(in_srgb,var(--nx-verde)_50%,var(--border))] mouse:hover:bg-muted';

export const DESABILITADO = 'disabled:pointer-events-none disabled:opacity-40';

/** Botão de ação principal: verde da marca com texto azul #161633 (contraste ~8:1). */
export const BOTAO_PRIMARIO = `inline-flex items-center justify-center gap-2 rounded-lg bg-nexon-verde font-semibold text-nexon-azul transition-colors mouse:hover:bg-[color-mix(in_srgb,var(--nx-verde)_88%,white)] active:bg-[color-mix(in_srgb,var(--nx-verde)_85%,black)] ${DESABILITADO} ${FOCO}`;

/** Botão discreto (Limpar, Marcar vistos): sem caixa, ganha fundo no hover. */
export const BOTAO_SECUNDARIO = `inline-flex items-center justify-center gap-2 rounded-lg font-medium text-muted-foreground transition-colors mouse:hover:bg-muted mouse:hover:text-foreground ${DESABILITADO} ${FOCO}`;
