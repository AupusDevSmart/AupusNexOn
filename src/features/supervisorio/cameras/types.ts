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

/** Chips de tipo da lista de eventos (`sistema` = sem sinal / voltou). */
export type FiltroEventos = 'todas' | 'pessoas' | 'veiculos' | 'animais' | 'movimento' | 'sistema';

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
  /** Segundos gravados antes do movimento (0–30). */
  pre_s?: number;
  zonas: unknown[];
}

/** Qualidade gravada no aparelho: `secundario` = leve (sub-stream), `principal` = alta. */
export type StreamGravacao = 'secundario' | 'principal';

export interface GravacaoConfig {
  ativa: boolean;
  /** Dias guardados no disco do aparelho (1..30, padrão 7). */
  dias: number;
  stream: StreamGravacao;
}

/**
 * Histórico gravado no aparelho (NEXON-108): último estado informado pelo agente
 * (`ativa`, `de`/`ate` = gravação mais antiga/mais nova no disco) + a `config` pedida.
 */
export interface CameraGravacao {
  ativa: boolean;
  de: string | null;
  ate: string | null;
  uso_gb: number | null;
  livre_gb: number | null;
  /** Quando o aparelho informou. */
  em: string | null;
  config: GravacaoConfig;
}

export type EstadoTrecho = 'pendente' | 'pronto' | 'erro' | 'expirado';

/** `GET /cameras/trechos/:comando_id` — `url` (já com `?token=`) só quando pronto. */
export interface TrechoHistorico {
  comando_id: string;
  estado: EstadoTrecho;
  inicio: string | null;
  duracao_s: number | null;
  erro?: string;
  url?: string;
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
  /** Ausente em API antiga (sem histórico no aparelho). */
  gravacao?: CameraGravacao;
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
  /** Câmera nova de fábrica achada pelo aparelho entra sozinha (padrão: sim). */
  auto_cadastrar?: boolean;
  updated_at: string | null;
}

export type ConfigCamerasPayload = Omit<ConfigCameras, 'unidade_id' | 'updated_at'>;

/**
 * `GET /cameras/instalador?unidade_id=` (NEXON-108). Com `unidade_id`, o `comando` leva a chave da
 * usina (uso único, 48 h): o Raspberry gravado por ele entra sozinho nela, sem código.
 */
export interface InstaladorAparelho {
  versao: string;
  /** Bytes da imagem. */
  tamanho: number;
  publicado_em: string | null;
  /** Validade do comando. */
  valido_ate: string;
  url_imagem: string;
  comando: string;
  /** Mesmo instalador no Windows (PowerShell; pede administrador sozinho). */
  comando_windows?: string;
  /** `null` = o comando não leva a chave (vincular depois pelo código). */
  vinculo_automatico: { valido_ate: string } | null;
  /** Nome da usina que a chave leva. */
  usina: string | null;
}

export interface Agente {
  id: string;
  unidade_id: string;
  nome: string;
  versao: string | null;
  host: string | null;
  ultimo_contato_em: string | null;
  /** Nº de câmeras ligadas ao agente. */
  cameras: number;
  /** Câmeras que o agente achou na rede e ainda não foram cadastradas (NEXON-108). */
  descobertas_pendentes?: number;
  created_at: string;
  updated_at: string;
}

/** Instalação feita pelo computador (relato do instalador, NEXON-108). */
export interface InstalacaoPc {
  id: string;
  sessao: string;
  usuario_nome: string | null;
  unidade_id: string | null;
  unidade_nome: string | null;
  sistema: string | null;
  passo: string | null;
  estado: 'andamento' | 'erro' | 'ok' | string;
  mensagem: string | null;
  versao: string | null;
  created_at: string;
  updated_at: string;
}

/** Aparelho na lista de todas as usinas (administrador, NEXON-108). */
export interface AgenteGlobal extends Agente {
  planta_id?: string;
  online?: boolean;
  unidade_nome: string | null;
  unidade_excluida?: boolean;
  planta_nome: string | null;
}

/**
 * Aparelho (agente) pedindo pareamento na mesma rede de quem consulta (NEXON-108):
 * `GET /cameras/pareamento/proximos`.
 */
export interface PedidoPareamento {
  pedido_id: string;
  host: string;
  mac: string | null;
  ip_local: string | null;
  criado_em: string;
  expira_em: string;
}

/** Câmera achada pelo agente na rede local e ainda não cadastrada: `GET /cameras/agentes/:id/descobertas`. */
export interface CameraDescoberta {
  ip: string;
  mac: string | null;
  /** Em minúsculas: "intelbras", "hikvision", "onvif". */
  fabricante: string | null;
  modelo: string | null;
  serial: string | null;
  porta_http: number | null;
  porta_rtsp: number | null;
  /** `false` = câmera de fábrica, sem senha criada. */
  inicializada: boolean | null;
  visto_em: string;
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
  gravacao?: Partial<GravacaoConfig>;
  ordem?: number;
}

export interface ListarEventosParams {
  unidade_id: string;
  camera_id?: string;
  /** AAAA-MM-DD em America/Sao_Paulo. */
  dia?: string;
  /** Período (AAAA-MM-DD, inclusive) e faixa de hora (HH:MM) de cada dia. */
  de?: string;
  ate?: string;
  hora_de?: string;
  hora_ate?: string;
  /** Lista separada por vírgula (`pessoa,veiculo`). */
  tipo?: string;
  somente_nao_lidos?: 0 | 1;
  incluir_descartados?: 0 | 1;
  page?: number;
  limit?: number;
}

/** Comando do aparelho pela web (NEXON-108). `expirado` = o aparelho não respondeu em 3 min. */
export interface EstadoComandoAparelho {
  id: string;
  tipo: 'atualizar' | 'reiniciar' | 'logs';
  estado: 'pendente' | 'entregue' | 'ok' | 'erro' | 'expirado';
  erro: string | null;
  resultado: { linhas?: string[]; versao?: string; de?: string; para?: string; ja_atualizado?: boolean } | null;
  criado_em: string;
  concluido_em: string | null;
}
