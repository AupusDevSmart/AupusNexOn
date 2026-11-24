export interface Vinculo {
  planta_id: string;
  unidade_id: string;
  equipamento_id: string;
}

export const VINCULO_VAZIO: Vinculo = { planta_id: '', unidade_id: '', equipamento_id: '' };
