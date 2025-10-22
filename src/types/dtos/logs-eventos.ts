// src/types/dtos/logs-eventos.ts

export type CategoriaAuditoria =
  | "LOGIN"           // Login/Logout de usuários
  | "LOGOUT"          // Logout de usuários
  | "COMANDO"         // Comandos executados (ligar/desligar equipamentos)
  | "CONFIGURACAO"    // Alterações em configurações
  | "DIAGRAMA"        // Modificações em diagramas unifilares
  | "USUARIO"         // Criação/edição de usuários
  | "SISTEMA"         // Eventos automáticos do sistema
  | "RELATORIO";      // Geração de relatórios

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
  categoriaAuditoria?: CategoriaAuditoria;
  ip?: string;
  sessaoId?: string;
}

export interface FiltrosLogsEventos {
  dataInicial: string;
  dataFinal: string;
  tipoEvento: string;
  ativo: string;
  severidade: string;
  reconhecido: boolean | null;
  categoriaAuditoria?: string;
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
