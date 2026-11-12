/**
 * Configuração do pivô — parâmetros numéricos (faixas, rótulos) e o que vai no PUT
 * /pivos/:id/config. Parte PURA da aba Configuração (PivoSheet), testada sem montar a ficha.
 */

export interface ParametrosPivo {
  pressao_minima: number | null; lamina_100: number | null; tempo_volta_100: number | null; percentimetro_ciclo_s?: number | null; correcao_angulo_zero: number | null;
  direcionamento: 'valvula' | 'fisico'; valvula_ton_id: string | null; valvula_bo: number | null;
  encoder_equipamento_id?: string | null; encoder_resolucao?: number | null; encoder_invertido?: boolean;
  /** Alarme de pivô travado (min): girando com o ângulo parado por este tempo. Vazio = 10. */
  travado_min?: number | null;
}

export const PARAMS = [
  { key: 'pressurizacao_s', label: 'Tempo para pressurizar', hint: 'Com pressostato: espera máxima pela pressão; sem: espera fixa · faixa 10 a 600 s', unit: 's', min: 10, max: 600, real: true, d: 0 },
  { key: 'confirma_giro_s', label: 'Confirmação do giro', hint: 'Tempo para o status "Irrigando" aparecer · faixa 5 a 120 s', unit: 's', min: 5, max: 120, real: true, d: 0 },
  { key: 'confirma_bomba_s', label: 'Confirmação da bomba', hint: 'Tempo para o "Bomba ligada" aparecer · faixa 5 a 300 s', unit: 's', min: 5, max: 300, real: true, d: 0 },
  { key: 'pressao_minima', label: 'Pressão mínima', hint: 'Abaixo dela: falha de pressão · faixa 0,5 a 6,0 bar', unit: 'bar', min: 0.5, max: 6, real: true, d: 1 },
  { key: 'lamina_100', label: 'Lâmina d’água a 100%', hint: 'Faixa 2,00 a 20,00 mm', unit: 'mm', min: 2, max: 20, real: true, d: 2 },
  { key: 'tempo_volta_100', label: 'Tempo de volta a 100%', hint: 'Base da previsão de término · faixa 6 a 72 h', unit: 'h', min: 6, max: 72, real: true, d: 1 },
  { key: 'percentimetro_ciclo_s', label: 'Ciclo do percentímetro', hint: 'A TON liga o motor de movimento % deste tempo · padrão 60 s · faixa 5 a 600 s', unit: 's', min: 5, max: 600, real: true, d: 0 },
  { key: 'correcao_angulo_zero', label: 'Correção do ângulo zero', hint: 'Faixa −180 a 180°', unit: '°', min: -180, max: 180, real: true, d: 0 },
  { key: 'travado_min', label: 'Alarme de pivô travado', hint: 'Girando com o ângulo parado por este tempo · padrão 10 min · faixa 1 a 240 min', unit: 'min', min: 1, max: 240, real: true, d: 0 },
] as const;

/** Tempos da sequência (PUT /bombeamento); o resto vai em pivo_config.parametros (PUT /config). */
export type ChaveSeq = 'pressurizacao_s' | 'confirma_giro_s' | 'confirma_bomba_s';
export const CHAVES_SEQ: readonly string[] = ['pressurizacao_s', 'confirma_giro_s', 'confirma_bomba_s'];
export const PARAMS_PAR = PARAMS.filter((p) => !CHAVES_SEQ.includes(p.key));

/**
 * Zero e sentido fora do diff e do PUT /config. Com encoder escolhido os dois vêm da Calibração
 * do ângulo (a Configuração não os edita mais, com ou sem calibração vigente); com calibração
 * vigente a API recusa a mudança. Só o pivô SEM encoder ainda grava a "Correção do ângulo zero".
 */
const zeroForaDaConfig = (encoderId: string, calibrado: boolean) => !!encoderId || calibrado;
/** Parâmetros numéricos de pivo_config.parametros que contam no rascunho (diff e validação). */
export const parametrosEmJogo = (encoderId: string, calibrado: boolean) => PARAMS_PAR.filter((p) =>
  !(p.key === 'correcao_angulo_zero' && zeroForaDaConfig(encoderId, calibrado)) && !(p.key === 'travado_min' && !encoderId));   // travado: campo só existe com encoder
/** Bloco `parametros` do PUT /pivos/:id/config. `num` devolve o número digitado em cada campo. */
export function corpoParametros(num: (k: string) => number | null, enc: { id: string; res: number | null }, gravados: ParametrosPivo | undefined, o: { travadoMudou: boolean; calibrado: boolean }) {
  const inteiro = (k: string) => { const v = num(k); return v == null ? null : Math.round(v); };
  return {
    pressao_minima: num('pressao_minima'), lamina_100: num('lamina_100'),
    tempo_volta_100: num('tempo_volta_100'),
    percentimetro_ciclo_s: inteiro('percentimetro_ciclo_s'),
    // Só quando mudou: a API anterior ao NEXON-103 recusa o campo que não conhece.
    ...(o.travadoMudou ? { travado_min: inteiro('travado_min') } : {}),
    encoder_equipamento_id: enc.id || null,
    encoder_resolucao: enc.id ? enc.res : gravados?.encoder_resolucao ?? null,
    // Sem encoder: o zero legado segue por aqui (e o sentido gravado vai junto, como sempre foi).
    ...(zeroForaDaConfig(enc.id, o.calibrado) ? {} : { correcao_angulo_zero: num('correcao_angulo_zero'), encoder_invertido: !!gravados?.encoder_invertido }),
  };
}
