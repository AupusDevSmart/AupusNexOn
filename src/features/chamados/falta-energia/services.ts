import { api } from '@/config/api';

/** NEXON-145 — aviso de falta de energia da TON e o robô de WhatsApp da concessionária. */
export type StatusFaltaEnergia = 'AGUARDANDO' | 'CANCELADO' | 'ENVIANDO' | 'NO_ROBO' | 'PROTOCOLO' | 'SEM_DADOS' | 'FALHOU';

export interface FaltaEnergiaEvento {
  id: string;
  equipamento_id: string | null;
  unidade_id: string | null;
  planta_id: string;
  origem: 'TON' | 'MANUAL';
  status: StatusFaltaEnergia;
  status_rotulo: string;
  inicio_em: string;
  fim_em: string | null;
  chamado_id: string | null;
  uc: string | null;
  concessionaria: string | null;
  whatsaupus_id: string | null;
  protocolo: string | null;
  tentativas: number;
  ultimo_erro: string | null;
  avisos: number;
  autor_nome: string | null;
  created_at: string;
}

function unwrap(r: any) {
  if (r?.success !== undefined && r?.data !== undefined) return r.data;
  return r;
}

export const FaltaEnergiaService = {
  async doChamado(chamadoId: string): Promise<FaltaEnergiaEvento | null> {
    const { data } = await api.get('/falta-energia', { params: { chamado_id: chamadoId, limit: 1 } });
    const r = unwrap(data);
    return (r?.data ?? r ?? [])[0] ?? null;
  },
  async reenviar(id: string): Promise<FaltaEnergiaEvento> {
    const { data } = await api.post(`/falta-energia/${id}/reenviar`);
    return unwrap(data);
  },
  async avisar(payload: { equipamento_id?: string; unidade_id?: string }): Promise<FaltaEnergiaEvento> {
    const { data } = await api.post('/falta-energia/avisar', payload);
    return unwrap(data);
  },
};
