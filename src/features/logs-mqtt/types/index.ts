export interface LogMqtt {
  id: string;
  regra_id: string;
  equipamento_id: string;
  valor_lido: number;
  mensagem: string;
  severidade: string;
  dados_snapshot: any;
  created_at: string;
  createdAt: string;
  updatedAt: string;
  regra?: {
    id: string;
    nome: string;
    campo_json: string;
    operador: string;
    valor: number;
  };
  equipamento?: { id: string; nome: string };
}

export interface LogsMqttFilters {
  search: string;
  equipamentoId: string;
  severidade: string;
  dataInicial: string;
  dataFinal: string;
  page: number;
  limit: number;
}
