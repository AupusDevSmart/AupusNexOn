import { api } from '@/config/api';
import type {
  Chamado,
  ContagemChamados,
  DestinoChamado,
  EstatisticasChamados,
  MotivoChamado,
  PrioridadeChamado,
  StatusExterno,
  TipoChamado,
} from './types';

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
  tipo?: string;
  motivo?: string;
  orgao?: string;
  de?: string;
  ate?: string;
  planta_id?: string;
  equipamento_id?: string;
}

export interface CamposExterno {
  orgao?: string;
  protocolo?: string;
  /** ISO 8601; null limpa na edição. */
  ocorrencia_em?: string | null;
  aberto_em?: string | null;
  previsao_em?: string | null;
}

export interface AbrirChamadoPayload extends CamposExterno {
  tipo?: TipoChamado;
  equipamento_id?: string;
  unidade_id?: string;
  planta_id?: string;
  titulo: string;
  descricao: string;
  motivo?: MotivoChamado;
  prioridade?: PrioridadeChamado;
}

export interface EditarChamadoPayload extends CamposExterno {
  titulo?: string;
  descricao?: string;
  motivo?: MotivoChamado;
  prioridade?: PrioridadeChamado;
  equipamento_id?: string | null;
  unidade_id?: string | null;
  planta_id?: string;
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
  async estatisticas(params: ListarChamadosParams): Promise<EstatisticasChamados> {
    const { data } = await api.get('/chamados/estatisticas', { params });
    return unwrap(data);
  },
  async orgaos(): Promise<string[]> {
    const { data } = await api.get('/chamados/orgaos');
    return unwrap(data);
  },
  async editar(id: string, payload: EditarChamadoPayload): Promise<Chamado> {
    const { data } = await api.patch(`/chamados/${id}`, payload);
    return unwrap(data);
  },
  async mudarStatus(id: string, payload: { status: StatusExterno; texto?: string; quando?: string }): Promise<Chamado> {
    const { data } = await api.post(`/chamados/${id}/status`, payload);
    return unwrap(data);
  },
  async adicionarNota(id: string, texto: string): Promise<Chamado> {
    const { data } = await api.post(`/chamados/${id}/notas`, { texto });
    return unwrap(data);
  },
  async excluir(id: string, motivo: string): Promise<void> {
    await api.delete(`/chamados/${id}`, { data: { motivo } });
  },
};
