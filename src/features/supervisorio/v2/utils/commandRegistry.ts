/**
 * COMMAND REGISTRY
 *
 * Registry declarativo de comandos disponiveis por categoria de equipamento.
 * Consumido pelo modal de comando (ex: RelayControlModal pra TONs).
 *
 * Por que registry e nao hardcoded no modal:
 *  - Escalavel: adicionar nova categoria = adicionar entrada aqui, sem
 *    tocar no componente do modal.
 *  - Backend dumb: backend repassa qualquer string/objeto para publishCommand.
 *    O registry vive 100% no frontend ate o dia em que tipos_equipamentos.mqtt_schema
 *    for populado e migrarmos pra BD-driven.
 *
 * Dois eixos de extensao:
 *  1. Nova categoria: adicione `'NOVA_CATEGORIA': { groups: [...] }` em
 *     COMMAND_REGISTRY.
 *  2. Comandos dinamicos por modelo (TON1 vs TON3): hoje renderizamos tudo
 *     e firmware rejeita o que nao suporta. Quando precisar filtrar, adicionar
 *     funcao `buildCommandsForModelo(tipoCodigo)`.
 */

import type { EquipamentoCommand } from '@/services/equipamentos.services';

export type ButtonVariant = 'default' | 'success' | 'destructive' | 'outline';

export interface CommandButton {
  /** Texto exibido no botao */
  label: string;
  /** Payload exato enviado ao backend (string ou objeto) */
  cmd: EquipamentoCommand;
  /** Estilo do botao */
  variant?: ButtonVariant;
  /** Tooltip opcional */
  hint?: string;
}

export interface CommandGroup {
  /** Titulo da secao no modal */
  title: string;
  /** Descricao curta opcional (ex: "ULN2803, 6× 12V") */
  description?: string;
  /** Botoes agrupados (renderizados como cards lado-a-lado) */
  buttons: CommandButton[];
}

export interface CategoryCommands {
  /** Categorias podem ter multiplos grupos de comandos */
  groups: CommandGroup[];
}

/**
 * Helper para gerar pares ON/OFF de saidas digitais.
 * Ex: buildToggleCommands('r', 6) gera 12 botoes (r1-r6, on/off).
 */
function buildToggleCommands(
  prefix: string,
  count: number,
  labelBase: string,
): CommandButton[] {
  const buttons: CommandButton[] = [];
  for (let i = 1; i <= count; i++) {
    buttons.push(
      {
        label: `${labelBase} ${i} · Ligar`,
        cmd: `${prefix}${i} on`,
        variant: 'success',
        hint: `Liga ${labelBase.toLowerCase()} ${i} (${prefix}${i} on)`,
      },
      {
        label: `${labelBase} ${i} · Desligar`,
        cmd: `${prefix}${i} off`,
        variant: 'outline',
        hint: `Desliga ${labelBase.toLowerCase()} ${i} (${prefix}${i} off)`,
      },
    );
  }
  return buttons;
}

/**
 * Mapa de categoria_nome (de equipamentos.tipo_equipamento_id -> categoria.nome)
 * para sua estrutura de comandos.
 *
 * IMPORTANTE: chave eh case-sensitive e match exato com `categoria.nome` da DB.
 * Se a categoria 'TON' for renomeada no cadastro, atualizar aqui tambem.
 */
export const COMMAND_REGISTRY: Record<string, CategoryCommands> = {
  TON: {
    groups: [
      {
        title: 'Reles',
        description: '6 saidas via ULN2803 (12V). Disponiveis em TON3 e TON4.',
        buttons: buildToggleCommands('r', 6, 'Rele'),
      },
      {
        title: 'Transistores',
        description: '4 saidas digitais. Disponiveis em todos os modelos.',
        buttons: buildToggleCommands('tr', 4, 'TR'),
      },
      {
        title: 'Diagnostico',
        description: 'Comandos de debug — sem efeito fisico.',
        buttons: [
          {
            label: 'Status',
            cmd: 'status',
            variant: 'default',
            hint: 'Imprime estado dos I/Os no Serial Monitor do TON',
          },
        ],
      },
    ],
  },
};

/**
 * Lookup do registry para uma categoria. Retorna null se nao houver comandos
 * registrados (modal nao deve abrir nesses casos).
 */
export function getCommandsForCategoria(
  categoriaNome: string | null | undefined,
): CategoryCommands | null {
  if (!categoriaNome) return null;
  return COMMAND_REGISTRY[categoriaNome.trim()] ?? null;
}
