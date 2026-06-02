/**
 * Mapeamento de categoria de equipamento -> fluxo de energia no agregado de demanda.
 *
 * - GERACAO     : entra com sinal +1 (geração de energia).
 * - CONSUMO     : entra com sinal -1 (carga consome energia).
 * - BIDIRECIONAL: entra com sinal +1 por enquanto (gera mais do que consome no MVP).
 *                 Refinar depois separando phf/phr em séries distintas no backend.
 * - NEUTRO      : NÃO entra no agregado (controladores, transformadores, chaves,
 *                 proteções, capacitores).
 * - AMBIGUO     : categoria pode ser geração OU consumo dependendo de ONDE foi
 *                 instalada (entrada da concessionária, ramal do inversor, ramal
 *                 de carga). Admin marca individualmente no modal de configuração.
 *
 * Sem coluna no banco — mapping vive aqui ate uma eventual migration. Categorias
 * nao listadas viram NEUTRO por default (silencioso e seguro).
 */
export type FluxoEnergia =
  | 'GERACAO'
  | 'CONSUMO'
  | 'BIDIRECIONAL'
  | 'NEUTRO'
  | 'AMBIGUO';

export const CATEGORIA_FLUXO: Record<string, FluxoEnergia> = {
  // Inequivocos — geração
  'Inversor PV': 'GERACAO',
  'Módulos PV': 'GERACAO',

  // Bidirecional — ponto de conexão com a rede (importa e exporta).
  // Backend trata phf (forward, geração líquida) e phr (reverse, consumo líquido)
  // do payload MQTT do gateway.
  'Gateway': 'BIDIRECIONAL',

  // Inequivocos — consumo
  'Carregador Elétrico': 'CONSUMO',
  'Motor Elétrico': 'CONSUMO',
  'Inversor Frequência': 'CONSUMO',
  'Pivô': 'CONSUMO',
  'Power Meter (PM)': 'CONSUMO',

  // Ambiguos — admin decide caso a caso
  'Medidor SSU': 'AMBIGUO',

  // Neutros — não somam ao agregado
  'Banco Capacitor': 'NEUTRO',
  'Relê Proteção': 'NEUTRO',
  'RTU': 'NEUTRO',
  'SoftStarter': 'NEUTRO',
  'Transformador de Corrente (TC)': 'NEUTRO',
  'Transformador de Potencial (TP)': 'NEUTRO',
  'Transformador de Potência': 'NEUTRO',
  'Disjuntor BT': 'NEUTRO',
  'Disjuntor MT': 'NEUTRO',
  'Chave': 'NEUTRO',
  'TON': 'NEUTRO',
};

export type FluxoManualSelecao = 'GERACAO' | 'CONSUMO' | 'BIDIRECIONAL' | 'IGNORAR';

/**
 * Resolve o fluxo final de um equipamento.
 * - Categoria inequivoca: retorna direto.
 * - AMBIGUO: usa escolha manual do admin (`fluxoManual[id]`); se nao houver,
 *   retorna NEUTRO pra evitar somar com sinal trocado.
 * - Categoria desconhecida ou ausente: NEUTRO (nao soma).
 */
export function resolverFluxoEquipamento(
  categoriaNome: string | null | undefined,
  equipamentoId: string,
  fluxoManual: Record<string, FluxoManualSelecao> = {},
): FluxoEnergia {
  const padrao = categoriaNome ? CATEGORIA_FLUXO[categoriaNome] : undefined;

  if (!padrao) return 'NEUTRO';

  if (padrao === 'AMBIGUO') {
    const escolha = fluxoManual[equipamentoId.trim()];
    if (!escolha || escolha === 'IGNORAR') return 'NEUTRO';
    return escolha as FluxoEnergia;
  }

  return padrao;
}

/** True se a categoria exige decisão manual do admin. */
export function ehAmbiguo(categoriaNome: string | null | undefined): boolean {
  return categoriaNome ? CATEGORIA_FLUXO[categoriaNome] === 'AMBIGUO' : false;
}
