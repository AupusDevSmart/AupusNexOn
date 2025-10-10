// src/types/dtos/sinoptico-ativo.ts

export interface AtivoData {
  id: string;
  nome: string;
  tipo: "UFV" | "CARGA" | "MOTOR" | "TRANSFORMADOR";
  status: "NORMAL" | "ALARME" | "URGENCIA" | "TRIP" | "MANUTENCAO";
  potencia: number;
  tensao: number;
  corrente: number;
  localizacao: string;
  ultimaAtualizacao: string;
}

export interface StatusRede {
  status: "NORMAL" | "FALTA_ENERGIA";
  tempoFalta?: string;
  protocoloFalta?: string;
  tensaoRede: number;
  frequencia: number;
}

export interface DadosGrafico {
  timestamp: string;
  potencia: number;
  tensao: number;
  corrente: number;
}

export interface IndicadoresRodape {
  thd: number;
  fp: number; // Fator de Potência
  dt: number; // Distorção Total
  frequencia: number;
  alarmes: number;
  falhas: number;
  urgencias: number;
  osAbertas: number;
}

export interface ComponenteDU {
  id: string;
  tipo:
    | "MEDIDOR"
    | "TRANSFORMADOR"
    | "INVERSOR"
    | "MOTOR"
    | "CAPACITOR"
    | "DISJUNTOR"
    | "DISJUNTOR_FECHADO"
    | "DISJUNTOR_ABERTO"
    | "CHAVE_FUSIVEL"
    | "BARRAMENTO";
  nome: string;
  posicao: { x: number; y: number };
  status: "NORMAL" | "ALARME" | "FALHA";
  dados: any; // Dados específicos do componente
}

// Interfaces para modais específicos
export interface DadosMedidor {
  ufer: number;
  demanda: number;
  energiaConsumida: number;
  energiaInjetada: number;
  tensaoFases: { a: number; b: number; c: number };
  correnteFases: { a: number; b: number; c: number };
}

export interface DadosTransformador {
  potencias: { ativa: number; reativa: number; aparente: number };
  tensoes: { primario: number; secundario: number };
  correntes: { primario: number; secundario: number };
  temperatura: number;
  carregamento: number;
}

export interface DadosInversor {
  potenciaAC: number;
  potenciaDC: number;
  tensoesMPPT: number[];
  correntePorString: number[];
  curvaGeracao: { hora: string; potencia: number }[];
  eficiencia: number;
  temperatura: number;
}

export interface DadosMotor {
  tensao: number;
  corrente: number;
  vibracao: number;
  temperatura: number;
  desequilibrioTensao: number;
  rpm: number;
  torque: number;
}

export interface DadosCapacitor {
  tensao: number;
  corrente: number;
  status: "LIGADO" | "DESLIGADO" | "FALHA";
  potenciaReativa: number;
  temperatura: number;
}

export interface DadosDisjuntor {
  status: "ABERTO" | "FECHADO";
  estadoMola: "ARMADO" | "DESARMADO";
  corrente: number;
  ultimaOperacao: string;
  numeroOperacoes: number;
}
