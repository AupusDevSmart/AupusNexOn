import type { UnidadeStatus, UnidadeStatusNivel } from "../types/sinoptico.types";
import type { SinopticoStatusResponse } from "../services/sinoptico.service";
import { minutosParaTexto } from "./tempo";

/**
 * Deriva o status da unidade (R1) a partir da resposta do backend.
 * Funcao pura (testavel): alarme critico/alto -> CRITICA; alarme ou staleness -> ALARME.
 * O motivo discreto prioriza o alarme recente; senao, o equipamento sem dados.
 */
export function derivarStatus(resp: SinopticoStatusResponse): UnidadeStatus {
  const semDados = resp.equipamentosSemDados ?? [];
  const sev = resp.alarmeRecente?.severidade?.toUpperCase();

  let nivel: UnidadeStatusNivel = "NORMAL";
  if (resp.alarmesAtivos > 0 && (sev === "CRITICA" || sev === "ALTA")) {
    nivel = "CRITICA";
  } else if (resp.alarmesAtivos > 0 || semDados.length > 0) {
    nivel = "ALARME";
  }

  let motivo: string | null = null;
  if (resp.alarmeRecente) {
    motivo = `${resp.alarmeRecente.equipamentoNome}: ${resp.alarmeRecente.mensagem}`;
  } else if (semDados.length > 0) {
    const e = semDados[0];
    motivo =
      e.minutosSemDados == null
        ? `${e.nome} sem dados`
        : `${e.nome} sem dados há ${minutosParaTexto(e.minutosSemDados)}`;
    if (semDados.length > 1) motivo += ` (+${semDados.length - 1})`;
  }

  return {
    nivel,
    motivo,
    alarmesAtivos: resp.alarmesAtivos,
    ultimaAtualizacao: resp.ultimaAtualizacao,
  };
}
