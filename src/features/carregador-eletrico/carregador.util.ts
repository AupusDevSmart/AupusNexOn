/**
 * Tipos e contas puras do carregador de veículo elétrico (NEXON-130).
 * Contrato da API: docs/carregador/API-CARREGADOR-OCPP.md (seção 2 = rotas e JSON).
 * Sem React e sem rede: tudo aqui roda direto no teste (carregador.util.test.ts).
 */

// ------------------------------------------------------------------ tipos
export interface Carregador { id: string; nome: string; unidade_nome?: string; planta_id?: string }
export interface CarregadorInfo extends Carregador { potencia_kw?: number | string | null; tarifa_kwh?: number | string | null }
export interface Morador {
  id: string; nome: string; apartamento?: string | null; tag_uid?: string | null; email?: string | null;
  validade?: string | null; ativo?: boolean; em_recarga?: boolean; aviso_validade_em?: string | null;
}
export interface Sessao {
  id: string; equipamento_id?: string; planta_id?: string | null; morador_nome?: string | null; morador_id?: string | null; status?: string;
  kwh_total?: number | string | null; inicio?: string | null; fim?: string | null; inicio_iso?: string | null; fim_iso?: string | null;
  tarifa_kwh?: number | string | null; ocioso_inicio?: string | null; ocioso_por_nome?: string | null;
  /** Liberada no NexON e o carregador ainda não confirmou o início (cai sozinha em 3 min). */
  aguardando_inicio?: boolean;
  /** nexon | cartao (cartão no carregador) | automatico (sem identificação). */
  origem?: string | null;
  duracao_min?: number | string | null;
  limite_tempo_min?: number | string | null; limite_energia_kwh?: number | string | null;
  motivo_fim?: string | null; motivo_fim_texto?: string | null;
}
export type Papel = 'analista' | 'proprietario' | 'operador' | 'morador';
export interface OcppResumo {
  conectado?: boolean; ultima_comunicacao?: string | null;
  /** false = bloqueado pelo NexON. */
  disponivel?: boolean; fabricante?: string | null; modelo?: string | null;
}
export interface Leitura {
  potencia_kw?: number | string | null; corrente_a?: number | string | null; tensao_v?: number | string | null;
  temperatura_c?: number | string | null; energia_sessao_kwh?: number | string | null; lido_em?: string | null;
}
export interface Falha { codigo?: string | null; ocpp?: string | null; titulo?: string | null; solucao?: string | null; desde?: string | null }
export interface Limites {
  tempo_min?: number | string | null; energia_kwh?: number | string | null; inicio_automatico?: boolean;
  /** null = sem limite (nominal). */
  corrente_a?: number | string | null; corrente_min_a?: number | string | null; corrente_max_a?: number | string | null;
  /** null = ainda não testado; false = o carregador recusou o limite. */
  corrente_suportada?: boolean | null;
}
/** O que o usuário pode fazer neste carregador (a proteção de verdade é a API; a tela só esconde). */
export interface Pode { comandar?: boolean; limites?: boolean; bloquear?: boolean; tecnico?: boolean }
export interface Estado {
  estado?: string; fonte_kwh?: string; tarifa_kwh?: number | string | null; soc?: number | string | null;
  potencia_kw?: number | string | null; capacidade_bateria_kwh?: number | string | null;
  papel?: Papel; meu_morador?: { id: string; nome: string; apartamento?: string | null } | null;
  sessao_ativa?: Sessao | null; sessoes?: Sessao[];
  /** null/ausente = carregador que não é OCPP: a tela fica como sempre foi. */
  ocpp?: OcppResumo | null; leitura?: Leitura | null; falha?: Falha | null; limites?: Limites | null; pode?: Pode | null;
}
export interface LinhaExport { apartamento?: string | null; morador?: string | null; recargas?: number; kwh: number | string; ocioso_min: number | string; valor_reais: number | string }
export interface DetalheExport {
  apartamento?: string | null; morador?: string | null; vaga?: string | null; inicio?: string; fim?: string;
  duracao_min?: number; kwh: number | string; tarifa_kwh?: number | string | null; valor_reais: number | string;
}
export interface Recusada { quando?: string | null; identidade?: string | null; motivo?: string | null; ip?: string | null }
/** GET :id/ocpp */
export interface ConexaoOcpp {
  vinculado?: boolean; charge_point_id?: string | null; conectado?: boolean; ultima_conexao?: string | null; ultimo_heartbeat?: string | null;
  ultimo_boot?: string | null; fabricante?: string | null; modelo?: string | null; numero_serie?: string | null; firmware?: string | null;
  perfis?: string[] | null; ip?: string | null; chave_gerada_em?: string | null; url_base?: string | null; recusadas?: Recusada[] | null;
}
/** Chave e URLs: a API devolve UMA vez (primeiro vínculo ou chave nova). */
export interface Credenciais { chave?: string | null; url?: string | null; url_completa?: string | null }
export interface Parametro { chave: string; valor?: string | null; somente_leitura?: boolean }
export type Comando = 'bloquear' | 'liberar' | 'destravar' | 'reiniciar' | 'atualizar';
export type Tom = 'ok' | 'warn' | 'bad' | 'off';

// ------------------------------------------------------------------ números e erro
export const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const nBr = (n: number, d = 1): string => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const reais = (v: number): string => `R$ ${nBr(v, 2)}`;
/** Número para o campo: vírgula e sem zeros sobrando (20 → "20", 15.5 → "15,5"). */
export const numTxt = (v: unknown): string => { const n = num(v); return n == null ? '' : String(n).replace('.', ','); };

/**
 * Mensagem de erro da API; sem ela, o texto padrão. O filtro global da API responde
 * `{ success: false, error: { code, message } }`: a mensagem fica em `error.message`
 * (`message` direto no corpo cobre resposta sem esse envelope). Texto ou lista de textos.
 */
export const erroMsg = (e: unknown, padrao: string): string => {
  const d = (e as { response?: { data?: { message?: unknown; error?: { message?: unknown } | null } | null } })?.response?.data;
  for (const m of [d?.error?.message, d?.message]) {
    const txt = Array.isArray(m) ? m.filter((x) => typeof x === 'string' && x).join('; ') : typeof m === 'string' ? m : '';
    if (txt) return txt;
  }
  return padrao;
};

// ------------------------------------------------------------------ datas
const p2 = (n: number) => String(n).padStart(2, '0');
/** "09/10 18:40" → Date (ano corrente; se cair no futuro, ano anterior). */
export function parseDm(v?: string | null): Date | null {
  const m = /^(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1]), Number(m[3]), Number(m[4]));
  if (d.getTime() - now.getTime() > 86400000) d.setFullYear(d.getFullYear() - 1);
  return d;
}
export const isoDate = (v?: string | null) => (v ? new Date(v) : null);
export const hojeYmd = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const amanhaYmd = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const dataBR = (ymd?: string | null) => (ymd ? ymd.slice(0, 10).split('-').reverse().join('/') : 'Sem validade');
export const hm = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const dm = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
export const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
export const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Minutos → "1 h 05 min" (o mesmo formato da tabela de recargas e da planilha). */
export function duracaoTxt(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return '—';
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)} h ${p2(m % 60)} min`;
}
export const durTxt = (a: Date | null, b: Date | null) => (!a || !b ? '—' : duracaoTxt((b.getTime() - a.getTime()) / 60000));

const dataDe = (iso?: string | null): Date | null => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
/** ISO → "18/11/2026 14:11" no horário do aparelho; sem data válida, null. */
export function dataHora(iso?: string | null): string | null {
  const d = dataDe(iso);
  return d ? `${dm(d)}/${d.getFullYear()} ${hm(d)}` : null;
}
/** ISO → "18/11 14:11"; o que não for data volta como veio. */
export function dataHoraCurta(v?: string | null): string {
  const d = dataDe(v);
  return d ? `${dm(d)} ${hm(d)}` : String(v ?? '').trim() || '—';
}
/** ISO → "desde 14:02" (hoje) ou "desde 17/11 14:02"; sem data válida, vazio. */
export function desdeTxt(iso?: string | null, agora: Date = new Date()): string {
  const d = dataDe(iso);
  if (!d) return '';
  return `desde ${d.toDateString() === agora.toDateString() ? hm(d) : `${dm(d)} ${hm(d)}`}`;
}
/** Hora da última medição: "lido às 14:11" (hoje) ou "lido em 17/11 14:11"; sem data válida, vazio. */
export function lidoTxt(iso?: string | null, agora: Date = new Date()): string {
  const d = dataDe(iso);
  if (!d) return '';
  return d.toDateString() === agora.toDateString() ? `lido às ${hm(d)}` : `lido em ${dm(d)} ${hm(d)}`;
}

// ------------------------------------------------------------------ potência
/**
 * Potência em kW de uma leitura do histórico. `potencia_kw` já vem em kW e vale direto;
 * sem ela, `Pt` (W ou kW) segue a regra antiga: acima de 100 é W e divide por 1000.
 */
export const kwDe = (d: Record<string, unknown> | null | undefined): number | null => {
  const kw = num(d?.potencia_kw);
  if (kw != null) return kw;
  const v = num(d?.Pt ?? d?.potencia ?? d?.power);
  return v == null ? null : Math.abs(v) > 100 ? v / 1000 : v;
};

// ------------------------------------------------------------------ situação
export type ChaveSituacao = 'disponivel' | 'conectado' | 'carregando' | 'pausado' | 'finalizando' | 'reservado'
  | 'indisponivel' | 'bloqueado' | 'falha' | 'sem_comunicacao' | 'legado';
export interface Situacao { chave: ChaveSituacao; rotulo: string; tom: Tom }

/** Estado do carregador → rótulo, tom (pílula e linha de status) e o detalhe que vai ao lado. */
const SITUACOES: Record<Exclude<ChaveSituacao, 'legado'>, { rotulo: string; tom: Tom; detalhe: string; ocioso: string }> = {
  disponivel: { rotulo: 'Disponível', tom: 'ok', detalhe: 'Pronto para uso', ocioso: 'Conecte o carro e inicie a recarga' },
  conectado: { rotulo: 'Carro conectado', tom: 'ok', detalhe: 'Recarga não iniciada', ocioso: 'Carro conectado. Inicie a recarga.' },
  carregando: { rotulo: 'Carregando', tom: 'ok', detalhe: 'Recarga em andamento', ocioso: 'Recarga em andamento' },
  pausado: { rotulo: 'Pausado', tom: 'warn', detalhe: 'O carro ou o carregador pausou a recarga', ocioso: 'Recarga pausada' },
  finalizando: { rotulo: 'Finalizando', tom: 'ok', detalhe: 'Encerrando a recarga', ocioso: 'Encerrando a recarga' },
  reservado: { rotulo: 'Reservado', tom: 'off', detalhe: 'Reservado para outra recarga', ocioso: 'Carregador reservado' },
  indisponivel: { rotulo: 'Indisponível', tom: 'warn', detalhe: 'Não está aceitando recargas', ocioso: 'Carregador indisponível no momento' },
  bloqueado: { rotulo: 'Bloqueado', tom: 'off', detalhe: 'Não aceita recargas até ser liberado', ocioso: 'Carregador bloqueado' },
  falha: { rotulo: 'Falha', tom: 'bad', detalhe: 'Carregador em falha', ocioso: 'Carregador em falha' },
  sem_comunicacao: { rotulo: 'Sem comunicação', tom: 'off', detalhe: 'Sem registro de comunicação', ocioso: 'Sem comunicação com o carregador' },
};

/**
 * Situação do carregador. O mapa só vale para carregador OCPP (`ocpp` presente): no antigo o
 * `estado` é texto livre do equipamento e a tela continua como era (Carregando com recarga
 * em andamento, senão Disponível).
 */
export function situacaoDe(e: Pick<Estado, 'estado' | 'ocpp' | 'sessao_ativa'> | null | undefined): Situacao {
  const bruto = String(e?.estado ?? '').trim().toLowerCase();
  // "bloqueado" não é estado da API: sai de `indisponivel` + `ocpp.disponivel === false`.
  if (e?.ocpp != null && bruto !== 'bloqueado' && Object.prototype.hasOwnProperty.call(SITUACOES, bruto)) {
    const chave = (bruto === 'indisponivel' && e.ocpp.disponivel === false ? 'bloqueado' : bruto) as Exclude<ChaveSituacao, 'legado'>;
    return { chave, rotulo: SITUACOES[chave].rotulo, tom: SITUACOES[chave].tom };
  }
  return { chave: 'legado', rotulo: e?.sessao_ativa ? 'Carregando' : 'Disponível', tom: 'ok' };
}

/** Texto ao lado do rótulo na linha de status (no carregador antigo o rótulo é "Normal"). */
export function textoSituacao(s: Situacao, e: Estado | null | undefined, kw: number | null): string {
  const sa = e?.sessao_ativa ?? null;
  const potencia = kw != null ? `${nBr(kw, 1)} kW` : null;
  const vaga = sa?.ocioso_inicio ? `vaga pedida por ${sa.ocioso_por_nome ?? '—'}` : null;
  const junta = (...p: Array<string | null>) => p.filter(Boolean).join(' · ');
  if (s.chave === 'legado') return sa ? junta('Carregando', potencia, vaga) : 'Disponível';
  if (sa?.aguardando_inicio) return 'Aguardando o carro ser conectado';
  if (s.chave === 'sem_comunicacao') {
    const d = dataHora(e?.ocpp?.ultima_comunicacao);
    return d ? `Última comunicação: ${d}` : SITUACOES.sem_comunicacao.detalhe;
  }
  if (s.chave === 'falha') return e?.falha?.titulo || SITUACOES.falha.detalhe;
  if (s.chave === 'carregando') return junta(potencia ?? SITUACOES.carregando.detalhe, vaga);
  return junta(SITUACOES[s.chave].detalhe, vaga);
}

/** Frase embaixo da bateria quando não há recarga (o que a pessoa faz agora). */
export const orientacaoOcioso = (s: Situacao): string => (s.chave === 'legado' ? SITUACOES.disponivel.ocioso : SITUACOES[s.chave].ocioso);

/** Por que não dá para iniciar agora (a API recusaria com 400); null = pode tentar. */
export function bloqueioIniciar(s: Situacao): string | null {
  switch (s.chave) {
    case 'sem_comunicacao': return 'Sem comunicação com o carregador. Não dá para iniciar agora.';
    case 'falha': return 'Carregador em falha. Resolva a falha para iniciar.';
    case 'bloqueado': return 'Carregador bloqueado. Só inicia depois de liberado.';
    case 'indisponivel': return 'Carregador indisponível no momento.';
    default: return null;
  }
}

// ------------------------------------------------------------------ limites
export interface Faixa { min: number; max: number; inteiro?: boolean }
/** Faixas do contrato (POST :id/liberar e PUT :id/config). */
export const FAIXA_TEMPO: Faixa = { min: 5, max: 1440, inteiro: true };
export const FAIXA_ENERGIA: Faixa = { min: 1, max: 200 };
export const FAIXA_TARIFA: Faixa = { min: 0.3, max: 5 };
/** Faixa da corrente máxima deste carregador (padrão do contrato: 6 a 32 A). */
export const faixaCorrente = (l: Pick<Limites, 'corrente_min_a' | 'corrente_max_a'> | null | undefined): Faixa =>
  ({ min: num(l?.corrente_min_a) ?? 6, max: num(l?.corrente_max_a) ?? 32, inteiro: true });
/** Ao iniciar, o padrão do carregador é o teto: a faixa encolhe até ele. */
export const faixaComTeto = (f: Faixa, teto: unknown): Faixa => { const t = num(teto); return t == null ? f : { ...f, max: Math.min(f.max, t) }; };

/** Campo de limite: vazio = sem limite (valor null); fora da faixa ou texto que não é número = inválido. */
export function validarLimite(txt: string | null | undefined, f: Faixa): { valor: number | null; ok: boolean } {
  const t = String(txt ?? '').trim();
  if (t === '') return { valor: null, ok: true };
  if (!/^\d+([.,]\d+)?$/.test(t)) return { valor: null, ok: false };
  const n = Number(t.replace(',', '.'));
  if ((f.inteiro && !Number.isInteger(n)) || n < f.min || n > f.max) return { valor: null, ok: false };
  return { valor: n, ok: true };
}

export interface CorpoLiberar { morador_id: string; limite_tempo_min?: number; limite_energia_kwh?: number }
/**
 * Corpo do POST :id/liberar. Limite vazio não vai no corpo. Carregador sem `limites` (não é
 * OCPP) manda só o morador, como sempre. Campo inválido = null (a tela não deixa enviar).
 */
export function corpoLiberar(moradorId: string, tempoTxt: string, energiaTxt: string, limites: Pick<Limites, 'tempo_min' | 'energia_kwh'> | null | undefined): CorpoLiberar | null {
  if (!moradorId) return null;
  const corpo: CorpoLiberar = { morador_id: moradorId };
  if (limites == null) return corpo;
  const t = validarLimite(tempoTxt, faixaComTeto(FAIXA_TEMPO, limites.tempo_min));
  const e = validarLimite(energiaTxt, faixaComTeto(FAIXA_ENERGIA, limites.energia_kwh));
  if (!t.ok || !e.ok) return null;
  if (t.valor != null) corpo.limite_tempo_min = t.valor;
  if (e.valor != null) corpo.limite_energia_kwh = e.valor;
  return corpo;
}

type LimitesDaSessao = Pick<Sessao, 'limite_tempo_min' | 'limite_energia_kwh' | 'duracao_min' | 'kwh_total' | 'aguardando_inicio'>;
/** Quanto falta para cada limite da recarga (null = sem aquele limite ou sem a medida). */
export function faltaDoLimite(sa: LimitesDaSessao | null | undefined, kwhAtual?: number | null): { tempo_min: number | null; energia_kwh: number | null; atingido: boolean } {
  const lt = num(sa?.limite_tempo_min), le = num(sa?.limite_energia_kwh);
  const dur = num(sa?.duracao_min), kwh = kwhAtual ?? num(sa?.kwh_total);
  const tempo = lt != null && dur != null ? Math.max(0, Math.ceil(lt - dur)) : null;
  const energia = le != null && kwh != null ? Math.max(0, Math.round((le - kwh) * 1000) / 1000) : null;
  return { tempo_min: tempo, energia_kwh: energia, atingido: tempo === 0 || energia === 0 };
}
/** "60 min · 15 kWh" e "Faltam 33 min · 11,7 kWh"; null = recarga sem limite. */
export function limiteTxt(sa: LimitesDaSessao | null | undefined, kwhAtual?: number | null): { limite: string; falta: string | null } | null {
  const lt = num(sa?.limite_tempo_min), le = num(sa?.limite_energia_kwh);
  if (lt == null && le == null) return null;
  const limite = [lt != null ? `${numTxt(lt)} min` : null, le != null ? `${numTxt(le)} kWh` : null].filter(Boolean).join(' · ');
  if (sa?.aguardando_inicio) return { limite, falta: null };
  const f = faltaDoLimite(sa, kwhAtual);
  if (f.atingido) return { limite, falta: 'Limite atingido' };
  const partes = [f.tempo_min != null ? `${f.tempo_min} min` : null, f.energia_kwh != null ? `${nBr(f.energia_kwh, 1)} kWh` : null].filter(Boolean);
  if (!partes.length) return { limite, falta: null };
  const um = partes.length === 1 && (f.tempo_min === 1 || f.energia_kwh === 1);
  return { limite, falta: `${um ? 'Falta' : 'Faltam'} ${partes.join(' · ')}` };
}

// ------------------------------------------------------------------ tabela de recargas
/** Origem que merece aviso na tabela: iniciada pelo cartão ou sozinha. Pelo NexON, nada. */
export function rotuloOrigem(origem?: string | null): string | null {
  const o = String(origem ?? '').trim().toLowerCase();
  return o === 'cartao' ? 'Cartão' : o === 'automatico' ? 'Automático' : null;
}
/** Segunda linha da recarga na tabela: de onde veio (se não foi do NexON) e como terminou. */
export function subRecarga(x: Pick<Sessao, 'origem' | 'motivo_fim_texto'>): string {
  const fim = String(x.motivo_fim_texto ?? '').trim();
  return [rotuloOrigem(x.origem), fim ? `Terminou: ${fim}` : null].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------------ configuração (PUT :id/config)
/** Rascunho da aba Configuração: null = campo não mexido. */
export interface RascunhoConfig { tarifa: string | null; tempo: string | null; energia: string | null; auto: boolean | null; corrente: string | null }
export const RASCUNHO_VAZIO: RascunhoConfig = { tarifa: null, tempo: null, energia: null, auto: null, corrente: null };
export interface Mudanca { label: string; de: string; para: string }
export interface CorpoConfig {
  tarifa_kwh?: number; limite_tempo_min?: number | null; limite_energia_kwh?: number | null;
  inicio_automatico?: boolean; limite_corrente_a?: number | null;
}
export interface RevisaoConfig {
  mudancas: Mudanca[]; corpo: CorpoConfig;
  ruins: { tarifa: boolean; tempo: boolean; energia: boolean; corrente: boolean }; invalido: boolean;
}
const semLimite = (v: number | null, unidade: string) => (v == null ? 'Sem limite' : `${numTxt(v)} ${unidade}`);
const igual = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(a - b) < 0.00001);

/**
 * Compara o rascunho com o que está gravado: a lista "de → para" da revisão e o corpo do PUT
 * só com o que mudou e que o usuário pode mudar. Vazio em limite = tirar o limite (null).
 */
export function revisarConfig(
  atual: { tarifa: number | null; limites: Limites | null | undefined },
  r: RascunhoConfig,
  pode: { tarifa: boolean; limites: boolean; corrente: boolean },
): RevisaoConfig {
  const mudancas: Mudanca[] = []; const corpo: CorpoConfig = {};
  const ruins = { tarifa: false, tempo: false, energia: false, corrente: false };
  const l = atual.limites ?? null;

  if (pode.tarifa && r.tarifa != null) {
    const v = validarLimite(r.tarifa, FAIXA_TARIFA);
    if (!v.ok || v.valor == null) ruins.tarifa = true;
    else if (!igual(v.valor, atual.tarifa)) {
      mudancas.push({ label: 'Valor do kWh', de: atual.tarifa != null ? reais(atual.tarifa) : '—', para: reais(v.valor) });
      corpo.tarifa_kwh = v.valor;
    }
  }
  if (l && pode.limites) {
    const campo = (txt: string | null, f: Faixa, gravado: number | null, label: string, unidade: string, ruim: 'tempo' | 'energia', chave: 'limite_tempo_min' | 'limite_energia_kwh') => {
      if (txt == null) return;
      const v = validarLimite(txt, f);
      if (!v.ok) { ruins[ruim] = true; return; }
      if (igual(v.valor, gravado)) return;
      mudancas.push({ label, de: semLimite(gravado, unidade), para: semLimite(v.valor, unidade) });
      corpo[chave] = v.valor;
    };
    campo(r.tempo, FAIXA_TEMPO, num(l.tempo_min), 'Tempo padrão por recarga', 'min', 'tempo', 'limite_tempo_min');
    campo(r.energia, FAIXA_ENERGIA, num(l.energia_kwh), 'Energia padrão por recarga', 'kWh', 'energia', 'limite_energia_kwh');
    if (r.auto != null && r.auto !== !!l.inicio_automatico) {
      const txt = (on: boolean) => (on ? 'Ligado' : 'Desligado');
      mudancas.push({ label: 'Iniciar sozinho ao conectar o carro', de: txt(!!l.inicio_automatico), para: txt(r.auto) });
      corpo.inicio_automatico = r.auto;
    }
  }
  if (l && pode.corrente && r.corrente != null) {
    const v = validarLimite(r.corrente, faixaCorrente(l));
    const gravado = num(l.corrente_a);
    if (!v.ok) ruins.corrente = true;
    else if (!igual(v.valor, gravado)) {
      mudancas.push({ label: 'Corrente máxima', de: semLimite(gravado, 'A'), para: semLimite(v.valor, 'A') });
      corpo.limite_corrente_a = v.valor;
    }
  }
  return { mudancas, corpo, ruins, invalido: ruins.tarifa || ruins.tempo || ruins.energia || ruins.corrente };
}

/** Aviso do diálogo de revisão: o que cada alteração provoca ao gravar. */
export function notaDaRevisao(corpo: CorpoConfig): string {
  const so = Object.keys(corpo).length === 1;
  return [
    'tarifa_kwh' in corpo ? `O novo valor${so ? '' : ' do kWh'} vale a partir de agora. Recargas já fechadas não são recalculadas.` : null,
    'limite_tempo_min' in corpo || 'limite_energia_kwh' in corpo || 'inicio_automatico' in corpo ? 'Os limites de uso valem para as próximas recargas.' : null,
    'limite_corrente_a' in corpo ? 'A corrente máxima é enviada ao carregador agora.' : null,
  ].filter(Boolean).join(' ');
}

// ------------------------------------------------------------------ conexão e parâmetros (só analista)
/** Identidade do carregador: vai dentro da URL, então sem espaço, barra, ? nem #. */
export const identidadeValida = (txt: string | null | undefined): boolean => /^[^\s/?#]{1,64}$/.test(String(txt ?? '').trim());

/** Resposta do carregador ao gravar um parâmetro, em português; `gravou` = o valor novo vale. */
export function respostaParametro(resposta?: string | null): { texto: string; gravou: boolean; reiniciar: boolean } {
  switch (String(resposta ?? '').trim()) {
    case 'Accepted': return { texto: 'Aceito', gravou: true, reiniciar: false };
    case 'RebootRequired': return { texto: 'Aceito, exige reiniciar', gravou: true, reiniciar: true };
    case 'Rejected': return { texto: 'Recusado', gravou: false, reiniciar: false };
    case 'NotSupported': return { texto: 'Não suportado', gravou: false, reiniciar: false };
    default: return { texto: String(resposta ?? '').trim() || 'Sem resposta', gravou: false, reiniciar: false };
  }
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Busca por texto na chave ou no valor, sem diferenciar maiúscula nem acento. */
export function filtrarParametros(lista: Parametro[], busca: string): Parametro[] {
  const q = semAcento(busca.trim());
  if (!q) return lista;
  return lista.filter((p) => semAcento(p.chave).includes(q) || semAcento(String(p.valor ?? '')).includes(q));
}
