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
/**
 * Painel dos modelos TON-V2 (SCH-TON-v1b): 8 reles (so ton3v2/ton4v2),
 * 4 TRs, 8 PWMs via PCA9685 (comando "pwm<N> <0-100>" — presets 100%/off;
 * duty arbitrario via POST /equipamentos/:id/cmd).
 */
function tonV2Commands(hasRelays: boolean): CategoryCommands {
  const pwmButtons: CommandButton[] = [];
  for (let i = 1; i <= 8; i++) {
    pwmButtons.push(
      {
        label: `PWM ${i} · 100%`,
        cmd: `pwm${i} 100`,
        variant: 'success',
        hint: `Canal ${i} do PCA9685 a 100% (pwm${i} 100). Outro duty: enviar "pwm${i} <0-100>" via API.`,
      },
      {
        label: `PWM ${i} · Off`,
        cmd: `pwm${i} off`,
        variant: 'outline',
        hint: `Desliga o canal ${i} (pwm${i} off)`,
      },
    );
  }
  const groups: CommandGroup[] = [];
  if (hasRelays) {
    groups.push({
      title: 'Reles',
      description: '8 saidas via ULN2803 (bobina 5V). Disponiveis em TON3v2 e TON4v2.',
      buttons: buildToggleCommands('r', 8, 'Rele'),
    });
  }
  groups.push(
    {
      title: 'Transistores',
      description: '4 saidas digitais. Disponiveis em todos os modelos.',
      buttons: buildToggleCommands('tr', 4, 'TR'),
    },
    {
      title: 'PWM (PCA9685)',
      description: '8 canais 0-100%. Presets: 100% e Off — duty arbitrario via API (pwm<N> <0-100>).',
      buttons: pwmButtons,
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
  );
  return { groups };
}

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
  // TON-V2 por MODELO (tipo_equipamento.codigo). O lookup tenta o tipo exato
  // ANTES da categoria — assim os v2 ganham painel proprio (8 reles + PWM) e
  // os v1 seguem caindo na chave 'TON' generica.
  TON1V2: tonV2Commands(false),
  TON2V2: tonV2Commands(false),
  TON3V2: tonV2Commands(true),
  TON4V2: tonV2Commands(true),
};

/**
 * Normaliza nome de categoria para chave de lookup.
 * Mesma normalizacao usada por EquipmentIconFactory.getEquipmentIcon —
 * uppercase + remover espaco/parentese/hifen — pra que o registry case
 * com a categoria que vier do backend independente de capitalizacao.
 */
function normalizeKey(categoria: string): string {
  return categoria
    .toUpperCase()
    .replace(/[\-()]/g, '_')
    .trim();
}

/**
 * Lookup do registry para uma categoria. Retorna null se nao houver comandos
 * registrados (modal nao deve abrir nesses casos).
 *
 * Aceita tambem fallback pelo `tipo` do equipamento — assim TONs cadastrados
 * com tipo_equipamento.codigo='TON1'/'TON2'/'TON3'/'TON4' caem sob a chave
 * 'TON' do registry sem precisar entrada por modelo.
 */
export function getCommandsForCategoria(
  categoriaNome: string | null | undefined,
  tipoCodigo?: string | null,
): CategoryCommands | null {
  // 0) Match exato pelo TIPO (modelo) — permite painel por modelo (TON*V2)
  //    sem afetar categorias existentes (v1 nao tem chave por modelo).
  if (tipoCodigo) {
    const byTipo = COMMAND_REGISTRY[normalizeKey(tipoCodigo)];
    if (byTipo) return byTipo;
  }

  // 1) Match direto pela categoria
  if (categoriaNome) {
    const direct = COMMAND_REGISTRY[normalizeKey(categoriaNome)];
    if (direct) return direct;
  }

  // 2) Fallback: tipo_equipamento.codigo (TON1/2/3/4 -> TON)
  if (tipoCodigo) {
    const tipoNorm = normalizeKey(tipoCodigo);
    // Match exato (caso tipoCodigo seja 'TON' literal)
    if (COMMAND_REGISTRY[tipoNorm]) return COMMAND_REGISTRY[tipoNorm];
    // Match por prefixo numerado (TON1/2/3/4 -> TON)
    const prefixMatch = tipoNorm.match(/^([A-Z_]+?)\d+$/);
    if (prefixMatch && COMMAND_REGISTRY[prefixMatch[1]]) {
      return COMMAND_REGISTRY[prefixMatch[1]];
    }
  }

  return null;
}
