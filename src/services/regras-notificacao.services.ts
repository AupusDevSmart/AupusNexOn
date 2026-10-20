import { api } from '@/config/api';

/** NEXON-25 — Configurações › Notificações: regras de quem é avisado, de quê e por qual canal. */
export type EventoNotificacao = 'falha' | 'sem_comunicacao' | 'vencimento_acesso_morador';
export type CanalNotificacao = 'push' | 'email' | 'whatsapp';

export interface RegraNotificacao {
  id: string;
  nome: string;
  evento: EventoNotificacao;
  limite_minutos: number | null;
  antecedencia_dias: number | null;
  canais: CanalNotificacao[];
  papeis: string[];
  planta_ids: string[];
  usuario_ids: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
  plantas: { id: string; nome: string | null }[];
  usuarios: { id: string; nome: string | null; email: string | null }[];
}

/** Linha da tabela (BaseTable pede createdAt/updatedAt). */
export type RegraNotificacaoLinha = RegraNotificacao & { createdAt: string; updatedAt: string };

export interface SalvarRegraNotificacaoDto {
  nome: string;
  evento: EventoNotificacao;
  limite_minutos?: number | null;
  antecedencia_dias?: number | null;
  canais: CanalNotificacao[];
  papeis: string[];
  planta_ids: string[];
  usuario_ids: string[];
  ativo: boolean;
}

export interface FiltrosRegrasNotificacao {
  page?: number;
  limit?: number;
  search?: string;
  evento?: string;
  canal?: string;
  plantaId?: string;
  ativo?: string;
}

export interface Destinatario {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  role: string;
}

function unwrap(response: { success?: boolean; data?: unknown } | undefined) {
  if (response?.success !== undefined && response?.data) return response.data as never;
  return response as never;
}

class RegrasNotificacaoServiceClass {
  async getAll(params: FiltrosRegrasNotificacao = {}): Promise<{ data: RegraNotificacao[]; pagination: { total: number } }> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== '' && val !== 'all') searchParams.append(key, String(val));
    });
    const { data } = await api.get(`/regras-notificacao?${searchParams}`);
    return unwrap(data);
  }

  async create(dto: SalvarRegraNotificacaoDto): Promise<RegraNotificacao> {
    const { data } = await api.post('/regras-notificacao', dto);
    return unwrap(data);
  }

  async update(id: string, dto: Partial<SalvarRegraNotificacaoDto>): Promise<RegraNotificacao> {
    const { data } = await api.put(`/regras-notificacao/${id.trim()}`, dto);
    return unwrap(data);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/regras-notificacao/${id.trim()}`);
  }

  async destinatarios(id: string): Promise<{ total: number; usuarios: Destinatario[] }> {
    const { data } = await api.get(`/regras-notificacao/${id.trim()}/destinatarios`);
    return unwrap(data);
  }
}

export const RegrasNotificacaoService = new RegrasNotificacaoServiceClass();
