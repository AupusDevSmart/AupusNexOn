import { api } from "@/config/api";

export interface SinopticoStatusResponse {
  /** ISO UTC do dado mais recente da unidade (formatar em local na exibicao). */
  ultimaAtualizacao: string | null;
  alarmesAtivos: number;
  alarmeRecente: {
    equipamentoNome: string;
    mensagem: string;
    severidade: string;
    createdAt: string;
  } | null;
  equipamentosSemDados: Array<{
    id: string;
    nome: string;
    minutosSemDados: number | null;
  }>;
}

export const sinopticoService = {
  /** GET /sinoptico/unidade/:id/status (R1). */
  async getStatus(unidadeId: string): Promise<SinopticoStatusResponse> {
    const response = await api.get(`/sinoptico/unidade/${unidadeId.trim()}/status`);
    // O interceptor do axios ja desempacota { success, data, meta } em response.data.
    return response.data;
  },
};
