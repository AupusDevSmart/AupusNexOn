// src/types/dtos/logs-eventos.ts

export interface LogEvento {
  id: string;
  dataHora: string;
  ativo: string;
  tipoEvento: "ALARME" | "URGENCIA" | "TRIP" | "INFORMATIVO" | "MANUTENCAO";
  mensagem: string;
  severidade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  usuario: string;
  reconhecido: boolean;
  osAssociada?: string;
  detalhes?: string;
  localizacao?: string;
  equipamento?: string;
}

export interface FiltrosLogsEventos {
  dataInicial: string;
  dataFinal: string;
  tipoEvento: string;
  ativo: string;
  severidade: string;
  reconhecido: boolean | null;
}

export interface ResumoEventos {
  totalEventos: number;
  eventosCriticos: number;
  eventosEmAberto: number;
  eventosReconhecidos: number;
}

export interface AtivoOption {
  value: string;
  label: string;
}
