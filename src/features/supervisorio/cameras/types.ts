/**
 * Câmeras do NexON (NEXON-88). Espelho do contrato `docs/cameras/API-CAMERAS.md`
 * (snake_case, como vem da API). A senha da câmera nunca volta nas rotas de usuário.
 */

export type CameraStatus = 'online' | 'offline' | 'desconhecido';

export type TipoEvento =
  | 'pessoa'
  | 'veiculo'
  | 'animal'
  | 'movimento'
  | 'sem_sinal'
  | 'sinal_restabelecido'
  | 'foto';

/** Classes que a análise pode marcar como alerta (subconjunto de `TipoEvento`). */
export type ClasseAlerta = 'pessoa' | 'veiculo' | 'animal' | 'movimento';

export type MotivoDescarte = 'desarmado' | 'classe_ignorada' | 'agente';

export type ArmamentoModo = 'manual' | 'agenda' | 'desarmado';

export type EstadoStream = 'publicando' | 'aguardando' | 'offline';

export type DispositivoAcionavel = 'refletor' | 'sirene';

/** Chips da aba "Todas as notificações". */
export type FiltroEventos = 'todas' | 'pessoas' | 'veiculos' | 'sistema';

export interface CameraStream {
  continuo: boolean;
  transcodificar: boolean;
  publicando: boolean;
  caminho: string;
}

export interface CameraAnalise {
  ativa: boolean;
  sensibilidade: number;
  area_minima_pct: number;
  fps_analise: number;
  classificar: boolean;
  classes_alerta: ClasseAlerta[];
  clipe_s: number;
  zonas: unknown[];
}

export interface Camera {
  id: string;
  unidade_id: string;
  planta_id: string;
  agente_id: string | null;
  equipamento_id: string | null;
  nome: string;
  fabricante: string | null;
  modelo: string | null;
  ip: string;
  porta_rtsp: number;
  porta_http: number;
  usuario: string;
  canal: number;
  ativa: boolean;
  ordem: number;
  status: CameraStatus;
  status_em: string | null;
  ultimo_contato_em: string | null;
  /** Caminho (ou URL) da última miniatura JPEG; aceita `?token=`. */
  miniatura_url: string | null;
  miniatura_em: string | null;
  /** Eventos de alerta não lidos desta câmera. */
  nao_lidos: number;
  ultimo_alerta_em: string | null;
  stream: CameraStream;
  analise: CameraAnalise;
  created_at: string;
  updated_at: string;
}

export interface CaixaDeteccao {
  classe: string;
  conf: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraEvento {
  id: string;
  camera_id: string;
  camera_nome: string;
  unidade_id: string;
  tipo: TipoEvento;
  titulo: string;
  inicio_em: string;
  fim_em: string | null;
  confianca: number | null;
  armado: boolean;
  alerta: boolean;
  descartado: boolean;
  motivo_descarte: MotivoDescarte | null;
  snapshot_url: string | null;
  clipe_url: string | null;
  lido_em: string | null;
  lido_por_nome: string | null;
  chamado_id: string | null;
  chamado_numero: number | null;
  dados: { caixas?: CaixaDeteccao[]; area_pct?: number } | null;
  created_at: string;
}

export interface ResumoCameras {
  total: number;
  online: number;
  offline: number;
  armado: boolean;
  armado_ate: string | null;
  armamento_modo: ArmamentoModo;
  nao_lidos: number;
  ultimo_alerta: CameraEvento | null;
  noite: { inicio: string | null; alertas: number; descartados: number } | null;
  sem_sinal: { camera_id: string; camera_nome: string; desde: string | null }[];
  /** Há ponto configurado para o comando? */
  comandos: { refletor: boolean; sirene: boolean };
}

export interface PontoComando {
  equipamento_id: string;
  ponto_id: string;
}

export interface ConfigArmamento {
  modo: ArmamentoModo;
  armado_manual: boolean;
  armado_manual_ate: string | null;
  agenda: { inicio: string; fim: string } | null;
}

export interface ConfigCameras {
  unidade_id: string;
  armamento: ConfigArmamento;
  refletor: PontoComando | null;
  sirene: PontoComando | null;
  abrir_chamado: boolean;
  notificar_emails: string[];
  updated_at: string | null;
}

export type ConfigCamerasPayload = Omit<ConfigCameras, 'unidade_id' | 'updated_at'>;

export interface Agente {
  id: string;
  unidade_id: string;
  nome: string;
  versao: string | null;
  host: string | null;
  ultimo_contato_em: string | null;
  /** Nº de câmeras ligadas ao agente. */
  cameras: number;
  created_at: string;
  updated_at: string;
}

export interface StreamCamera {
  hls_url: string;
  estado: EstadoStream;
  valido_ate: string;
}

export interface TokenMidia {
  token: string;
  valido_ate: string;
}

export interface Paginacao {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginado<T> {
  data: T[];
  pagination: Paginacao;
}

/** Body de `POST /cameras` e `PATCH /cameras/:id` (`senha` só se enviada). */
export interface CameraPayload {
  unidade_id?: string;
  nome: string;
  ip: string;
  usuario: string;
  senha?: string;
  porta_rtsp?: number;
  porta_http?: number;
  canal?: number;
  fabricante?: string | null;
  modelo?: string | null;
  agente_id?: string | null;
  equipamento_id?: string | null;
  stream?: Partial<Pick<CameraStream, 'continuo' | 'transcodificar'>>;
  analise?: Partial<CameraAnalise>;
  ordem?: number;
}

export interface ListarEventosParams {
  unidade_id: string;
  camera_id?: string;
  /** AAAA-MM-DD em America/Sao_Paulo. */
  dia?: string;
  /** Lista separada por vírgula (`pessoa,veiculo`). */
  tipo?: string;
  somente_nao_lidos?: 0 | 1;
  incluir_descartados?: 0 | 1;
  page?: number;
  limit?: number;
}
