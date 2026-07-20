// src/services/acionar-ponto.services.ts
// Service REST de acionamento de pontos (Fase C).
// Backend: aupus-nexon-api/src/modules/equipamentos-cmd/acionar-ponto.controller.ts

import { api } from '@/config/api';

export interface AcionarPontoResult {
  cmd_id: string;
  status: 'ok' | 'duplicate';
  msg: string;
  latency_ms: number;
  pulso_ms: number;
  comando_tecnico: string;
  comando_semantico: string;
  bo_numero?: number;
}

class AcionarPontoService {
  /**
   * POST /equipamentos/:id/pontos/:pontoId/acionar
   * Resolve ton_bo, executa pulso na TON mapeada e retorna ack.
   */
  async acionar(
    equipamentoId: string,
    pontoId: string,
    sim = false,
    testMac?: string,
  ): Promise<AcionarPontoResult> {
    // sim=true: backend executa o pulso em TESTE/<topico>/cmd (firmware de
    // simulação), sem tocar o equipamento real. Usado pelo painel de teste do IoT.
    // testMac (remap de bancada): o backend reescreve .../satellite/<MAC> pro MAC do
    // board físico de bancada, roteando o teste pra ele sem tocar no cadastro.
    const body = sim
      ? testMac
        ? { sim: true, testMac }
        : { sim: true }
      : {};
    const resp = await api.post<AcionarPontoResult>(
      `/equipamentos/${equipamentoId.trim()}/pontos/${pontoId.trim()}/acionar`,
      body,
    );
    return resp.data;
  }
}

export const acionarPontoApi = new AcionarPontoService();
