// src/services/sim-bench.services.ts
// Discovery dos boards de BANCADA vivos no namespace TESTE/ (modo simulação).
// Backend: aupus-nexon-api → GET /iot/sim/bench-satellites (MqttService.getBenchSatellites).
// Usado pelo painel de teste do IoT pro remap: você escolhe qual board físico de
// bancada faz o papel da TON de produção, sem digitar MAC e sem tocar no cadastro.

import { api } from '@/config/api';

export interface BenchSatellite {
  mac: string; // MAC do board de bancada (ex: "28:37:2F:9D:8D:80")
  base: string; // base do tópico TESTE/ onde ele apareceu
  ageMs: number; // há quanto tempo foi visto (quanto menor, mais "vivo")
  label: string | null; // nome da TON pra qual o firmware 🧪 foi gerado (auto-casa board↔TON)
}

class SimBenchService {
  /** Lista os boards de bancada vistos no TESTE/ nos últimos ~90s, mais recentes primeiro. */
  async list(): Promise<BenchSatellite[]> {
    const resp = await api.get<{ data: BenchSatellite[] }>(
      '/iot/sim/bench-satellites',
    );
    return resp.data?.data ?? [];
  }
}

export const simBenchApi = new SimBenchService();
