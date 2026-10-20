/** Cores do padrão de formatação dos relatórios NexON (§3). Não usar tokens do tema do app. */
export const COR = {
  texto: '#1B1D3A',
  secundario: '#555A73',
  notificado: '#3D4260',
  marca: '#2F7D32',
  borda: '#E3E6EE',
  linha: '#EEF0F4',
  cabecalhoTabela: '#F4F5F9',
  zebra: '#FAFBFC',
  eixo: '#C9CDD8',
  trilho: '#EEF0F4',
  alerta: '#C2410C',
  ok: '#2E8B47',
  serie: '#3B6FD6',
  neutro: '#9AA0B4',
  faixaPonta: '#FCE7DA',
  limitacaoExterna: '#D49B1F',
  branco: '#FFFFFF',
} as const;

/** Horários tarifários: Ponta · Fora de ponta · Reservado. */
export const COR_POSTO = { ponta: COR.alerta, foraPonta: COR.serie, reservado: COR.ok } as const;

export const A4 = { largura: 794, altura: 1123 } as const;
