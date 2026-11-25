/** INTERNO = reparo de equipamento (NEXON-24). EXTERNO = aberto com terceiro, ex.: Equatorial (NEXON-144). */
export type TipoChamado = 'INTERNO' | 'EXTERNO';
export type StatusChamado = 'ABERTO' | 'ENCAMINHADO' | 'FECHADO' | 'EM_ANDAMENTO' | 'RESOLVIDO' | 'CANCELADO';
export type StatusExterno = 'ABERTO' | 'EM_ANDAMENTO' | 'RESOLVIDO' | 'CANCELADO';
export type MotivoChamado =
  | 'FALHA'
  | 'ALARME'
  | 'CAMPO'
  | 'OUTRO'
  | 'FALTA_ENERGIA'
  | 'OSCILACAO'
  | 'REDE'
  | 'MEDICAO'
  | 'RELIGACAO';
export type PrioridadeChamado = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type DestinoChamado = 'SMART_SERVICE' | 'WHATSAPP' | 'EMAIL';
export type StatusEncaminhamento = 'PENDENTE' | 'AGUARDANDO_INTEGRACAO' | 'ENVIADO' | 'FALHOU';

export interface Encaminhamento {
  id: string;
  destino: DestinoChamado;
  contato: string | null;
  observacao: string | null;
  status: StatusEncaminhamento;
  tentativas: number;
  ultimo_erro: string | null;
  enviado_em: string | null;
  autor_nome: string | null;
  created_at: string;
}

export interface Atualizacao {
  id: string;
  tipo: 'NOTA' | 'STATUS' | 'EDICAO';
  status_anterior: StatusChamado | null;
  status_novo: StatusChamado | null;
  texto: string | null;
  autor_nome: string | null;
  created_at: string;
}

export interface Chamado {
  id: string;
  numero: number;
  tipo: TipoChamado;
  equipamento_id: string | null;
  unidade_id: string | null;
  planta_id: string | null;
  titulo: string;
  descricao: string;
  motivo: MotivoChamado;
  prioridade: PrioridadeChamado;
  status: StatusChamado;
  canal: 'WEB' | 'APP';
  autor_nome: string | null;
  fechado_em: string | null;
  fechado_por_nome: string | null;
  motivo_fechamento: string | null;
  autor_id: string | null;
  orgao: string | null;
  protocolo: string | null;
  ocorrencia_em: string | null;
  aberto_em: string | null;
  previsao_em: string | null;
  created_at: string;
  updated_at: string;
  equipamento_nome: string | null;
  unidade_nome: string | null;
  planta_nome: string | null;
  encaminhamentos: Encaminhamento[];
  atualizacoes?: Atualizacao[];
  contatos_proprietario?: { nome: string; email: string | null; whatsapp: string | null } | null;
}

export interface ContagemChamados {
  abertos: number;
  aguardando_encaminhamento: number;
  encaminhados: number;
  externos_abertos?: number;
}

export interface ItemRanking {
  chave: string;
  rotulo: string;
  total: number;
}

export interface EstatisticasChamados {
  totais: {
    total: number;
    abertos: number;
    externos_abertos: number;
    internos_abertos: number;
    resolvidos: number;
    resolvidos_no_mes: number;
    abertos_no_mes: number;
    previsao_vencida: number;
    horas_media_resolucao: number | null;
    horas_media_falta_energia: number | null;
    horas_aberto_mais_antigo: number | null;
  };
  por_mes: { mes: string; abertos: number; resolvidos: number }[];
  por_status: ItemRanking[];
  por_motivo: ItemRanking[];
  por_orgao: ItemRanking[];
  por_planta: ItemRanking[];
  por_equipamento: ItemRanking[];
}

export interface ChamadosFilters {
  busca: string;
  status: string;
  tipo: string;
  motivo: string;
  orgao: string;
  /** Atalho de período ('30d', '90d', '12m', '' = tudo). Vale mais que `de`/`ate`. */
  periodo: string;
  /** Intervalo livre (links antigos); a tela não edita, só mostra e deixa tirar. */
  de: string;
  ate: string;
  prioridade: string;
  page: number;
  limit: number;
}

export const STATUS_ROTULO: Record<StatusChamado, string> = {
  ABERTO: 'Aberto',
  ENCAMINHADO: 'Encaminhado',
  FECHADO: 'Fechado',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
  CANCELADO: 'Cancelado',
};

export const TIPO_ROTULO: Record<TipoChamado, string> = { INTERNO: 'Reparo', EXTERNO: 'Externo' };

export const STATUS_EXTERNO: StatusExterno[] = ['ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO', 'CANCELADO'];
export const STATUS_ENCERRADOS: StatusChamado[] = ['FECHADO', 'RESOLVIDO', 'CANCELADO'];
export const estaEncerrado = (s: StatusChamado) => STATUS_ENCERRADOS.includes(s);

export const MOTIVO_ROTULO: Record<MotivoChamado, string> = {
  FALHA: 'Falha',
  ALARME: 'Alarme',
  CAMPO: 'Visto em campo',
  OUTRO: 'Outro',
  FALTA_ENERGIA: 'Falta de energia',
  OSCILACAO: 'Oscilação de tensão',
  REDE: 'Rede / poste / cabo',
  MEDICAO: 'Medição / fatura',
  RELIGACAO: 'Religação / ligação nova',
};

export const MOTIVOS_INTERNO: MotivoChamado[] = ['FALHA', 'ALARME', 'CAMPO', 'OUTRO'];
export const MOTIVOS_EXTERNO: MotivoChamado[] = ['FALTA_ENERGIA', 'OSCILACAO', 'REDE', 'MEDICAO', 'RELIGACAO', 'OUTRO'];

export const PRIORIDADE_ROTULO: Record<PrioridadeChamado, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

export const DESTINO_ROTULO: Record<DestinoChamado, string> = {
  SMART_SERVICE: 'Smart Service',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
};

export const ENCAMINHAMENTO_ROTULO: Record<StatusEncaminhamento, string> = {
  PENDENTE: 'Enviando',
  AGUARDANDO_INTEGRACAO: 'Na fila (integração pendente)',
  ENVIADO: 'Entregue',
  FALHOU: 'Não entregue',
};
