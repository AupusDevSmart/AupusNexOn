/**
 * Histórico gravado no aparelho (NEXON-108): contas da linha do tempo de 24 h, dos dias
 * que dá para ver e do trecho pedido. Tudo em America/Sao_Paulo (UTC−3 fixo, sem horário
 * de verão desde 2019), por chave de dia `AAAA-MM-DD` e hora `HH:MM:SS`.
 */
import type { CameraEvento, CameraGravacao, TipoEvento } from '../types';
import { chaveDia, chaveHoje, deslocarDia } from './agrupar-por-dia';

export const DIA_S = 24 * 60 * 60;
/** Cada trecho pedido ao aparelho. */
export const TRECHO_S = 60;
/** O trecho começa um pouco antes do ponto tocado (ou do evento). */
export const ANTES_S = 10;
/** Quantos dias a tela oferece (o aparelho guarda 7 por padrão). */
export const DIAS_HISTORICO = 7;

const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

export function horaValida(s: string): boolean {
  return RE_HORA.test(s);
}

/** `HH:MM:SS` → segundos desde 00:00. Inválida = null. */
export function segundosDeHora(hora: string | null | undefined): number | null {
  const m = hora ? RE_HORA.exec(hora) : null;
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Segundos desde 00:00 → `HH:MM:SS` (limitado ao dia). */
export function horaDeSegundos(s: number): string {
  const v = Math.min(DIA_S - 1, Math.max(0, Math.floor(s)));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(v / 3600))}:${p(Math.floor((v % 3600) / 60))}:${p(v % 60)}`;
}

/** Instante de `dia` + `hora` em Brasília. */
export function instante(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}-03:00`);
}

/** Dia e hora (Brasília) de um instante. */
export function diaHoraDe(d: Date | string | number): { dia: string; hora: string } {
  const data = d instanceof Date ? d : new Date(d);
  const dia = chaveDia(data);
  const s = Math.round((data.getTime() - instante(dia, '00:00:00').getTime()) / 1000);
  return { dia, hora: horaDeSegundos(s) };
}

/** Segundos desde 00:00 (Brasília) do instante dentro do `dia`; fora do dia = null. */
export function segundosNoDia(iso: string | Date, dia: string): number | null {
  const t = (iso instanceof Date ? iso : new Date(iso)).getTime();
  if (Number.isNaN(t)) return null;
  const s = (t - instante(dia, '00:00:00').getTime()) / 1000;
  return s >= 0 && s < DIA_S ? s : null;
}

/** Posição (0..100 %) na barra de 24 h. */
export function pctDoDia(segundos: number): number {
  return Math.min(100, Math.max(0, (segundos / DIA_S) * 100));
}

/** Ponto tocado na barra (x relativo à largura) → segundos do dia. */
export function segundosDoToque(x: number, largura: number): number {
  if (largura <= 0) return 0;
  return Math.round(Math.min(1, Math.max(0, x / largura)) * (DIA_S - 1));
}

/** Início do trecho a partir do ponto tocado/evento: ANTES_S antes, sem sair do dia. */
export function inicioDoTrecho(segundos: number): number {
  return Math.max(0, Math.floor(segundos) - ANTES_S);
}

/** Trecho anterior/seguinte: anda `delta` segundos, atravessando a meia-noite se preciso. */
export function deslocarTrecho(dia: string, hora: string, delta: number): { dia: string; hora: string } {
  return diaHoraDe(new Date(instante(dia, hora).getTime() + delta * 1000));
}

export interface MarcadorEvento {
  id: string;
  tipo: TipoEvento;
  pct: number;
  segundos: number;
  evento: CameraEvento;
}

/** Eventos da câmera que caem no dia, como marcas na barra (ordem do mais cedo ao mais tarde). */
export function marcadoresDoDia(eventos: readonly CameraEvento[], dia: string, cameraId?: string | null): MarcadorEvento[] {
  const out: MarcadorEvento[] = [];
  for (const ev of eventos) {
    if (cameraId && ev.camera_id !== cameraId) continue;
    const s = segundosNoDia(ev.inicio_em, dia);
    if (s === null) continue;
    out.push({ id: ev.id, tipo: ev.tipo, pct: pctDoDia(s), segundos: s, evento: ev });
  }
  return out.sort((a, b) => a.segundos - b.segundos);
}

/** Parte do dia que está gravada no aparelho (de/ate do último heartbeat), em %. */
export function faixaGravada(
  g: Pick<CameraGravacao, 'de' | 'ate'> | null | undefined,
  dia: string,
): { inicioPct: number; fimPct: number } | null {
  if (!g?.de || !g.ate) return null;
  const ini = instante(dia, '00:00:00').getTime();
  const fim = ini + DIA_S * 1000;
  const de = Math.max(ini, Date.parse(g.de));
  const ate = Math.min(fim, Date.parse(g.ate));
  if (Number.isNaN(de) || Number.isNaN(ate) || ate <= de) return null;
  return { inicioPct: ((de - ini) / (DIA_S * 1000)) * 100, fimPct: ((ate - ini) / (DIA_S * 1000)) * 100 };
}

/**
 * Dias que a tela oferece: os últimos 7 (hoje primeiro), cortados por de/ate quando o
 * aparelho já informou. Se o corte esvaziar a lista (relógio estranho), volta os 7.
 */
export function diasDisponiveis(g: Pick<CameraGravacao, 'de' | 'ate'> | null | undefined, agora = new Date()): string[] {
  const hoje = chaveHoje(agora);
  const todos = Array.from({ length: DIAS_HISTORICO }, (_, i) => deslocarDia(hoje, -i));
  const de = g?.de ? chaveDia(g.de) : '';
  const ate = g?.ate ? chaveDia(g.ate) : '';
  const filtrados = todos.filter((d) => (!de || d >= de) && (!ate || d <= ate));
  return filtrados.length ? filtrados : todos;
}

/** O trecho [inicio, inicio + dur) cai fora do que o aparelho tem gravado (quando se sabe)? */
export function foraDaGravacao(
  g: Pick<CameraGravacao, 'de' | 'ate'> | null | undefined,
  inicio: Date,
  duracaoS = TRECHO_S,
  agora = new Date(),
): boolean {
  const t = inicio.getTime();
  if (t > agora.getTime()) return true;
  if (g?.de && t + duracaoS * 1000 <= Date.parse(g.de)) return true;
  if (g?.ate && t > Date.parse(g.ate)) return true;
  return false;
}

const FMT_GB = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** "Gravando · 6 dias guardados · 120 GB livres" (ou o que o aparelho ainda não disse). */
export function textoDisco(g: CameraGravacao | null | undefined): string {
  if (!g) return 'Este aparelho ainda não grava histórico';
  if (!g.config.ativa) return 'Gravação contínua desligada';
  if (!g.em) return 'Aguardando o aparelho informar a gravação';
  const partes = [g.ativa ? 'Gravando' : 'Gravação parada'];
  if (g.de) {
    const fim = g.ate ? Date.parse(g.ate) : Date.parse(g.em);
    const dias = Math.max(0, Math.round((fim - Date.parse(g.de)) / 86_400_000));
    partes.push(dias < 1 ? 'menos de 1 dia guardado' : `${dias} ${dias === 1 ? 'dia guardado' : 'dias guardados'}`);
  }
  if (g.livre_gb !== null && g.livre_gb !== undefined) {
    partes.push(`${FMT_GB.format(g.livre_gb >= 10 ? Math.round(g.livre_gb) : g.livre_gb)} GB livres`);
  }
  return partes.join(' · ');
}

/** Rótulo do trecho tocando: "14:32:10 – 14:33:10". */
export function rotuloTrecho(hora: string, duracaoS = TRECHO_S): string {
  const s = segundosDeHora(hora);
  if (s === null) return hora;
  const fim = (s + duracaoS) % DIA_S;
  return `${hora} – ${horaDeSegundos(fim)}`;
}
