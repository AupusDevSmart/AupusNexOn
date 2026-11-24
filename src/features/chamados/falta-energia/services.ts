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

/** A API às vezes embrulha em { success, data }. */
function unwrap<T>(r: unknown): T {
  const o = r as { success?: unknown; data?: unknown } | null;
  return (o?.success !== undefined && o?.data !== undefined ? o.data : r) as T;
}

export const FaltaEnergiaService = {
  async doChamado(chamadoId: string): Promise<FaltaEnergiaEvento | null> {
    const { data } = await api.get('/falta-energia', { params: { chamado_id: chamadoId, limit: 1 } });
    const r = unwrap<{ data?: FaltaEnergiaEvento[] } | FaltaEnergiaEvento[]>(data);
    const lista = Array.isArray(r) ? r : (r?.data ?? []);
    return lista[0] ?? null;
  },
  async reenviar(id: string): Promise<FaltaEnergiaEvento> {
    const { data } = await api.post(`/falta-energia/${id}/reenviar`);
    return unwrap<FaltaEnergiaEvento>(data);
  },
  async avisar(payload: { equipamento_id?: string; unidade_id?: string }): Promise<FaltaEnergiaEvento> {
    const { data } = await api.post('/falta-energia/avisar', payload);
    return unwrap<FaltaEnergiaEvento>(data);
  },
};
