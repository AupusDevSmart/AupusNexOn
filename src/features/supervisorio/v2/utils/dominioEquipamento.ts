/**
 * DOMÍNIO DE EQUIPAMENTO (IoT × Unifilar) — Fase 0 (fundação).
 *
 * Classifica cada TIPO de equipamento em um domínio, derivado do `codigo` do tipo
 * (com `nome` como fallback). Sem coluna no schema — mesma abordagem em código do
 * `commandRegistry`/`TON_CAPS`, porque `equipamentos`/`tipos_equipamentos` vivem no
 * pacote compartilhado `@aupus/api-shared` (não alterar schema unilateralmente).
 *
 * Domínios:
 *  - 'potencia' : ativo elétrico do unifilar (transformador, disjuntor, …). Só unifilar.
 *  - 'ambos'    : device de potência do unifilar lido por Modbus (inversor, A-966).
 *                 Aparece nos DOIS (unifilar + IoT) — 1 linha só, referenciada por identidade.
 *  - 'iot'      : dispositivo de IoT — TON, Power Meters (M160/M300/Landis/PD666) e relé.
 *                 Não aparece no unifilar. O PM é exibido via DISJUNTOR associado.
 *
 * DEFAULT = 'potencia' (comportamento atual: aparece no unifilar). Assim, tipos não
 * mapeados não mudam de comportamento — só quem está explicitamente em IOT/AMBOS muda.
 *
 * ⚠️ A classificação abaixo é decisão de NEGÓCIO — revisar/confirmar antes de ligar
 * comportamento (Fase 1/2). Ver docs/IOT-TON-DOMINIO-EQUIPAMENTOS.md §4.
 */

export type DominioEquipamento = 'potencia' | 'iot' | 'ambos';

/** Normaliza codigo/nome p/ comparação (uppercase, sem espaço/hífen/parênteses). */
function norm(s: string | undefined | null): string {
  return (s ?? '').toUpperCase().replace(/[\s\-()]/g, '_');
}

/** Tipos que são dispositivo de IoT (não aparecem no unifilar). */
const CODIGOS_IOT: readonly string[] = [
  // TON1..TON4 — o codigo do tipo hoje é 'TON1' (nome 'TON'); cobrimos por prefixo abaixo.
];

/** Padrões (prefixo, no codigo/nome normalizado) que indicam domínio 'iot'. */
const PREFIXOS_IOT: readonly string[] = ['TON'];

/**
 * Tipos que aparecem nos DOIS mundos (device de potência do unifilar lido por Modbus).
 * Match por igualdade OU por substring (normalizado). Ex.: 'INVERSOR' casa 'INVERSOR',
 * 'INVERSOR_SUNGROW'; 'SUN2000' casa o Huawei. O A-966 (gateway/medidor de ENTRADA)
 * continua no unifilar — tratado à parte abaixo pra não ser pego por 'MEDIDOR'.
 */
const PADROES_AMBOS: readonly string[] = [
  'INVERSOR',
  'SUN2000',
  // Bomba de Combustível: equipamento controlado pela TON (BO/BI/AI + Modbus) que
  // TAMBÉM aparece no unifilar (símbolo + BombaModal). Sem isto cairia no default
  // 'potencia' e era excluída do picker "Equipamento NexON" da bomba no IoT.
  'COMBUSTIVEL',
  // Carregador Elétrico (EV): idem — controlado pela TON, aparece nos dois mundos.
  'CARREGADOR',
];

/**
 * Power Meters e Relé de proteção → domínio 'iot' (dispositivo de REQUISIÇÃO, não
 * elemento do unifilar). O PM continua existindo no IoT pra puxar dados; sua exibição
 * passa a ser via o DISJUNTOR associado (ver docs/IOT-PM-RELE-IOT.md). O relé é só-IoT
 * (comando/atuação no unifilar via ponto, Path B). ⚠️ O A-966 NÃO entra aqui — é
 * checado antes e fica no unifilar, mesmo que o nome contenha "medidor".
 * Match por substring (normalizado): 'METER' casa 'POWER_METER'; 'MEDIDOR' casa
 * 'MEDIDOR_COMUM'; 'M160'/'M300'/'LANDIS'/'PD666' os modelos; 'RELE' o relé.
 */
const PADROES_IOT_DEVICE: readonly string[] = [
  'METER',
  'MEDIDOR',
  'LANDIS',
  'M160',
  'M300',
  'PD666',
  'RELE',
];

/**
 * ⚠️ REVISAR (docs §4): 'SSW07' (soft-starter WEG) — se for lido por Modbus, é 'ambos';
 * senão fica no default 'potencia'. Aguardando confirmação.
 */

/** Classifica um tipo de equipamento em seu domínio. */
export function dominioDoTipo(codigo?: string | null, nome?: string | null): DominioEquipamento {
  const c = norm(codigo);
  const n = norm(nome);
  const hay = `${c}|${n}`;

  if (PREFIXOS_IOT.some(p => c.startsWith(p) || n.startsWith(p))) return 'iot';
  if (CODIGOS_IOT.some(x => c === x || n === x)) return 'iot';
  // A-966 é gateway/medidor de entrada e FICA no unifilar (ambos) — precisa vir antes
  // de PADROES_IOT_DEVICE pra não ser pego por 'MEDIDOR' num nome como "Medidor A966".
  if (hay.includes('A966')) return 'ambos';
  // Power Meters e relé → só IoT.
  if (PADROES_IOT_DEVICE.some(p => hay.includes(p))) return 'iot';
  if (PADROES_AMBOS.some(p => hay.includes(p))) return 'ambos';
  return 'potencia';
}

/** true se o domínio deve aparecer no diagrama UNIFILAR. */
export function apareceNoUnifilar(d: DominioEquipamento): boolean {
  return d === 'potencia' || d === 'ambos';
}

/** true se o domínio pertence/aparece no mundo IoT. */
export function apareceNoIot(d: DominioEquipamento): boolean {
  return d === 'iot' || d === 'ambos';
}

/**
 * Conveniência: um equipamento (com codigo/nome do seu tipo) deve aparecer no unifilar?
 * Aceita as várias formas que o backend expõe o codigo do tipo.
 */
export function equipamentoApareceNoUnifilar(eq: {
  tipo_equipamento?: string | null;
  tipoEquipamento?: { codigo?: string | null } | null;
  tipo_equipamento_rel?: { codigo?: string | null } | null;
  nome?: string | null;
}): boolean {
  const codigo =
    eq.tipo_equipamento_rel?.codigo ??
    eq.tipoEquipamento?.codigo ??
    eq.tipo_equipamento ??
    null;
  return apareceNoUnifilar(dominioDoTipo(codigo, eq.nome));
}
