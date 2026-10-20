import { api } from '@/config/api';
import type { Chamado, ContagemChamados, DestinoChamado, MotivoChamado, PrioridadeChamado } from './types';

function unwrap(r: any) {
  if (r?.success !== undefined && r?.data !== undefined) return r.data;
  return r;
}

export interface ListarChamadosParams {
  page?: number;
  limit?: number;
  status?: string;
  prioridade?: string;
  busca?: string;
  planta_id?: string;
  equipamento_id?: string;
}

export interface AbrirChamadoPayload {
  equipamento_id: string;
  titulo: string;
  descricao: string;
  motivo?: MotivoChamado;
  prioridade?: PrioridadeChamado;
}

export const ChamadosService = {
  async listar(params: ListarChamadosParams): Promise<{ data: Chamado[]; pagination: { total: number; totalPages: number } }> {
    const { data } = await api.get('/chamados', { params });
    return unwrap(data);
  },
  async contagem(): Promise<ContagemChamados> {
    const { data } = await api.get('/chamados/contagem');
    return unwrap(data);
  },
  async detalhe(id: string): Promise<Chamado> {
    const { data } = await api.get(`/chamados/${id}`);
    return unwrap(data);
  },
  async abrir(payload: AbrirChamadoPayload): Promise<Chamado> {
    const { data } = await api.post('/chamados', payload);
    return unwrap(data);
  },
  async encaminhar(id: string, payload: { destino: DestinoChamado; contato?: string; observacao?: string }): Promise<Chamado> {
    const { data } = await api.post(`/chamados/${id}/encaminhar`, payload);
    return unwrap(data);
  },
  async fechar(id: string, motivo: string): Promise<Chamado> {
    const { data } = await api.post(`/chamados/${id}/fechar`, { motivo });
    return unwrap(data);
  },
};
