export type StatusChamado = 'ABERTO' | 'ENCAMINHADO' | 'FECHADO';
export type MotivoChamado = 'FALHA' | 'ALARME' | 'CAMPO' | 'OUTRO';
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

export interface Chamado {
  id: string;
  numero: number;
  equipamento_id: string;
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
  created_at: string;
  equipamento_nome: string | null;
  unidade_nome: string | null;
  planta_nome: string | null;
  encaminhamentos: Encaminhamento[];
  contatos_proprietario?: { nome: string; email: string | null; whatsapp: string | null } | null;
}

export interface ContagemChamados {
  abertos: number;
  aguardando_encaminhamento: number;
  encaminhados: number;
}

export interface ChamadosFilters {
  busca: string;
  status: string;
  prioridade: string;
  page: number;
  limit: number;
}

export const STATUS_ROTULO: Record<StatusChamado, string> = {
  ABERTO: 'Aberto',
  ENCAMINHADO: 'Encaminhado',
  FECHADO: 'Fechado',
};

export const MOTIVO_ROTULO: Record<MotivoChamado, string> = {
  FALHA: 'Falha',
  ALARME: 'Alarme',
  CAMPO: 'Visto em campo',
  OUTRO: 'Outro',
};

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
